import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SynapseNode } from '@/types'

interface ElectronFlowProps {
  synapseNodes: SynapseNode[]
}

export function ElectronFlow({ synapseNodes }: ElectronFlowProps) {
  const linesRef = useRef<THREE.Group>(null)
  const electronsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const brainScale = useMemo(() => ({ x: 1.3, y: 1.0, z: 1.1 }), [])
  const brainRadius = 1.2

  // Build connection curves
  const { curves, linePositions } = useMemo(() => {
    const curves: THREE.CatmullRomCurve3[] = []
    const linePositions: number[] = []
    const nodeMap = new Map<string, SynapseNode>()

    synapseNodes.forEach((node) => nodeMap.set(node.id, node))

    synapseNodes.forEach((node) => {
      if (node.state !== 'connected' || !node.connectedToIds) return

      node.connectedToIds.forEach((targetId) => {
        const targetNode = nodeMap.get(targetId)
        if (!targetNode || targetNode.state !== 'connected') return

        const startPos = new THREE.Vector3(
          node.position[0] * brainScale.x * brainRadius,
          node.position[1] * brainScale.y * brainRadius,
          node.position[2] * brainScale.z * brainRadius
        )
        const endPos = new THREE.Vector3(
          targetNode.position[0] * brainScale.x * brainRadius,
          targetNode.position[1] * brainScale.y * brainRadius,
          targetNode.position[2] * brainScale.z * brainRadius
        )

        startPos.normalize().multiplyScalar(startPos.length() + 0.05)
        endPos.normalize().multiplyScalar(endPos.length() + 0.05)

        const midPoint = new THREE.Vector3()
          .addVectors(startPos, endPos)
          .multiplyScalar(0.5)
        midPoint.normalize().multiplyScalar(
          Math.max(startPos.length(), endPos.length()) * 1.08
        )

        const curve = new THREE.CatmullRomCurve3([startPos, midPoint, endPos])
        curves.push(curve)

        // Generate line points (fewer for cleaner lines)
        const points = curve.getPoints(12)
        points.forEach((p, i) => {
          linePositions.push(p.x, p.y, p.z)
          if (i > 0 && i < points.length - 1) {
            // Duplicate middle points for line segments
            linePositions.push(p.x, p.y, p.z)
          }
        })
      })
    })

    return { curves, linePositions: new Float32Array(linePositions) }
  }, [synapseNodes, brainScale, brainRadius])

  // Electron positions - just one per curve
  const { electronPositions, curveIndices } = useMemo(() => {
    const positions = new Float32Array(curves.length * 3)
    const indices = new Float32Array(curves.length)

    curves.forEach((curve, i) => {
      const point = curve.getPoint(0)
      positions[i * 3] = point.x
      positions[i * 3 + 1] = point.y
      positions[i * 3 + 2] = point.z
      indices[i] = i
    })

    return { electronPositions: positions, curveIndices: indices }
  }, [curves])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()

    // Update electron positions along curves
    if (electronsRef.current) {
      const posAttr = electronsRef.current.geometry.getAttribute('position')
      curves.forEach((curve, i) => {
        const t = (time * 0.4 + i * 0.1) % 1
        const point = curve.getPoint(t)
        posAttr.setXYZ(i, point.x, point.y, point.z)
      })
      posAttr.needsUpdate = true
    }

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time
    }
  })

  if (curves.length === 0) return null

  return (
    <group ref={linesRef}>
      {/* Connection lines - more visible */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePositions.length / 3}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#75e6ea"
          transparent
          opacity={0.6}
          linewidth={1}
        />
      </lineSegments>

      {/* Electrons - DISTINCT: larger, brighter, white core */}
      <points ref={electronsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={curves.length}
            array={electronPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={{
            uTime: { value: 0 },
          }}
          vertexShader={`
            uniform float uTime;
            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              // Larger size + pulse for visibility
              float pulse = 1.0 + 0.2 * sin(uTime * 5.0);
              gl_PointSize = 8.0 * pulse;
              gl_Position = projectionMatrix * mvPosition;
            }
          `}
          fragmentShader={`
            uniform float uTime;
            void main() {
              vec2 c = gl_PointCoord - vec2(0.5);
              float d = length(c);
              if (d > 0.5) discard;

              // Bright yellow/gold core - highly visible
              float core = smoothstep(0.3, 0.0, d);
              vec3 gold = vec3(1.0, 0.85, 0.2);
              vec3 white = vec3(1.0, 1.0, 1.0);
              vec3 color = mix(gold, white, core);

              // Full opacity for visibility
              float alpha = smoothstep(0.5, 0.0, d);

              gl_FragColor = vec4(color, alpha);
            }
          `}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  )
}
