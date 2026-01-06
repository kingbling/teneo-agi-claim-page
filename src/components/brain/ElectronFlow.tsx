import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SynapseNode } from '@/types'

interface ElectronFlowProps {
  synapseNodes: SynapseNode[]
  opacity?: number // 0-1 for LOD cross-fade transitions
}

export function ElectronFlow({ synapseNodes, opacity = 1 }: ElectronFlowProps) {
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

        // Calculate positions matching SynapseNodeMarkers (volume-based)
        // Source node position with depth factor
        const sRawLen = Math.sqrt(
          node.position[0] * node.position[0] +
          node.position[1] * node.position[1] +
          node.position[2] * node.position[2]
        )
        const sDepthFactor = Math.max(0.35, Math.min(1.1, sRawLen))
        const snx = node.position[0] / sRawLen
        const sny = node.position[1] / sRawLen
        const snz = node.position[2] / sRawLen

        // Target node position with depth factor
        const eRawLen = Math.sqrt(
          targetNode.position[0] * targetNode.position[0] +
          targetNode.position[1] * targetNode.position[1] +
          targetNode.position[2] * targetNode.position[2]
        )
        const eDepthFactor = Math.max(0.35, Math.min(1.1, eRawLen))
        const enx = targetNode.position[0] / eRawLen
        const eny = targetNode.position[1] / eRawLen
        const enz = targetNode.position[2] / eRawLen

        // Scale to brain volume using depthFactor (matches SynapseNodeMarkers)
        const startPos = new THREE.Vector3(
          snx * brainScale.x * brainRadius * sDepthFactor,
          sny * brainScale.y * brainRadius * sDepthFactor,
          snz * brainScale.z * brainRadius * sDepthFactor
        )
        const endPos = new THREE.Vector3(
          enx * brainScale.x * brainRadius * eDepthFactor,
          eny * brainScale.y * brainRadius * eDepthFactor,
          enz * brainScale.z * brainRadius * eDepthFactor
        )

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
      materialRef.current.uniforms.uOpacity.value = opacity
    }
  })

  if (curves.length === 0) return null

  return (
    <group ref={linesRef}>
      {/* Connection lines - more visible */}
      <lineSegments key={`lines-${curves.length}`}>
        <bufferGeometry key={`lines-geom-${linePositions.length}`}>
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
          opacity={0.6 * opacity}
          linewidth={1}
        />
      </lineSegments>

      {/* Electrons - DISTINCT: larger, brighter, white core */}
      <points key={`electrons-${curves.length}`} ref={electronsRef}>
        <bufferGeometry key={`electrons-geom-${curves.length}`}>
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
            uOpacity: { value: opacity },
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
            uniform float uOpacity;
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

              gl_FragColor = vec4(color, alpha * uOpacity);
            }
          `}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  )
}
