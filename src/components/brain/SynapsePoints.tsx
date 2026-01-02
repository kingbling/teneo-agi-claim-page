import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SynapseNode } from '@/types'

interface SynapsePointsProps {
  synapseNodes: SynapseNode[]
  userSynapseIds: string[]
}

export function SynapsePoints({ synapseNodes, userSynapseIds }: SynapsePointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Filter to only connected nodes
  const connectedNodes = useMemo(() => {
    return synapseNodes.filter((node) => node.state === 'connected')
  }, [synapseNodes])

  // Create a set for quick lookup
  const userNodeSet = useMemo(() => new Set(userSynapseIds), [userSynapseIds])

  // Set up instanced mesh transforms
  useMemo(() => {
    if (!meshRef.current) return

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    // Brain scale factors (must match BrainParticles)
    const brainScale = { x: 1.3, y: 1.0, z: 1.1 }
    const brainRadius = 1.2

    connectedNodes.forEach((node, i) => {
      // Scale position to match brain surface
      position.set(
        node.position[0] * brainScale.x * brainRadius,
        node.position[1] * brainScale.y * brainRadius,
        node.position[2] * brainScale.z * brainRadius
      )

      // Normalize and push slightly outward from brain surface
      const len = position.length()
      position.multiplyScalar((len + 0.05) / len)

      // User's synapses are slightly larger, but keep all subtle
      const isUserNode = userNodeSet.has(node.id)
      const nodeScale = isUserNode ? 0.018 : 0.012
      scale.set(nodeScale, nodeScale, nodeScale)

      matrix.compose(position, quaternion, scale)
      meshRef.current!.setMatrixAt(i, matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  }, [connectedNodes, userNodeSet])

  // Set up instance colors (user vs others)
  useMemo(() => {
    if (!meshRef.current) return

    const colors = new Float32Array(connectedNodes.length)
    connectedNodes.forEach((node, i) => {
      // 1.0 = user's synapse (bright), 0.0 = others (dim)
      colors[i] = userNodeSet.has(node.id) ? 1.0 : 0.0
    })

    meshRef.current.geometry.setAttribute(
      'aIsUser',
      new THREE.InstancedBufferAttribute(colors, 1)
    )
  }, [connectedNodes, userNodeSet])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  const vertexShader = `
    attribute float aIsUser;
    varying float vIsUser;
    varying vec3 vPosition;

    void main() {
      vIsUser = aIsUser;
      vPosition = position;

      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uUserColor;
    uniform vec3 uOtherColor;

    varying float vIsUser;
    varying vec3 vPosition;

    void main() {
      // Distance from sphere center for soft edges
      float dist = length(vPosition);

      // Gentle pulse - more subtle, organic feeling
      float pulse = 0.85 + 0.15 * sin(uTime * 1.5 + vIsUser * 3.14);

      // Color based on ownership
      vec3 color = mix(uOtherColor, uUserColor, vIsUser);

      // Subtle brightness difference
      float brightness = mix(0.4, 0.7, vIsUser) * pulse;
      color *= brightness;

      // Soft edges, subtle alpha
      float alpha = smoothstep(1.0, 0.3, dist);
      alpha *= mix(0.3, 0.6, vIsUser);

      gl_FragColor = vec4(color, alpha);
    }
  `

  if (connectedNodes.length === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, connectedNodes.length]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uUserColor: { value: new THREE.Color('#75e6ea') },
          uOtherColor: { value: new THREE.Color('#4a5568') },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}
