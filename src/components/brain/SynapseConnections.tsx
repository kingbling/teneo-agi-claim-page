import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useClaimStore } from '@/stores/claimStore'

export function SynapseConnections() {
  const synapseNodes = useClaimStore((state) => state.synapseNodes)
  const connectedSynapseIds = useClaimStore((state) => state.connectedSynapseIds)

  // Get connected nodes and their connections
  const connections = useMemo(() => {
    const result: Array<{
      start: [number, number, number]
      end: [number, number, number]
      id: string
    }> = []

    const connectedNodes = synapseNodes.filter((n) =>
      connectedSynapseIds.includes(n.id)
    )

    connectedNodes.forEach((node) => {
      node.connectedToIds.forEach((targetId) => {
        const targetNode = synapseNodes.find((n) => n.id === targetId)
        if (targetNode && connectedSynapseIds.includes(targetId)) {
          // Avoid duplicate connections
          const existingConnection = result.find(
            (c) =>
              (c.id === `${node.id}-${targetId}`) ||
              (c.id === `${targetId}-${node.id}`)
          )
          if (!existingConnection) {
            result.push({
              start: node.position,
              end: targetNode.position,
              id: `${node.id}-${targetId}`,
            })
          }
        }
      })
    })

    return result.slice(0, 50) // Limit for performance
  }, [synapseNodes, connectedSynapseIds])

  return (
    <group>
      {connections.map((connection) => (
        <ConnectionLine
          key={connection.id}
          start={connection.start}
          end={connection.end}
        />
      ))}
    </group>
  )
}

interface ConnectionLineProps {
  start: [number, number, number]
  end: [number, number, number]
}

function ConnectionLine({ start, end }: ConnectionLineProps) {
  const lineRef = useRef<THREE.Line>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Create curved path between points
  const { curve, geometry } = useMemo(() => {
    const startVec = new THREE.Vector3(...start)
    const endVec = new THREE.Vector3(...end)
    const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5)

    // Add some curve by offsetting midpoint outward
    const direction = midPoint.clone().normalize()
    midPoint.add(direction.multiplyScalar(0.1))

    const curve = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec)
    const points = curve.getPoints(20)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)

    // Add progress attribute for shader
    const progress = new Float32Array(21)
    for (let i = 0; i < 21; i++) {
      progress[i] = i / 20
    }
    geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1))

    return { curve, geometry }
  }, [start, end])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uStartColor: { value: new THREE.Color('#75e6ea') },
      uEndColor: { value: new THREE.Color('#0044ff') },
    }),
    []
  )

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  const vertexShader = `
    attribute float progress;
    varying float vProgress;

    void main() {
      vProgress = progress;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uStartColor;
    uniform vec3 uEndColor;
    varying float vProgress;

    void main() {
      // Animated dash pattern
      float dashSpeed = 1.0;
      float dashFreq = 15.0;
      float dash = sin((vProgress - uTime * dashSpeed) * dashFreq * 3.14159);
      dash = smoothstep(0.0, 0.5, dash);

      // Color gradient along connection
      vec3 color = mix(uStartColor, uEndColor, vProgress);

      float alpha = dash * 0.6;

      gl_FragColor = vec4(color, alpha);
    }
  `

  return (
    <line ref={lineRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        blending={THREE.AdditiveBlending}
      />
    </line>
  )
}
