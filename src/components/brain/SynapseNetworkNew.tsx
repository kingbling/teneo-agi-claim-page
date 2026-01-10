import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { SpaceCluster } from '@/types/agent'
import { BRAIN_SCALE, NETWORK_CONFIG } from './core/brainConstants'
import { useScaledTime } from './core/useBrainTime'

interface SynapseNetworkProps {
  spaceClusters: SpaceCluster[]
  maxConnectionDistance?: number
}

interface DiscoveredNode {
  position: THREE.Vector3
  discoveryRatio: number
}

interface Connection {
  from: THREE.Vector3
  to: THREE.Vector3
  brightness: number
}

// Build network of connections between discovered clusters
function buildNetwork(
  clusters: SpaceCluster[],
  maxDistance: number
): { nodes: DiscoveredNode[]; connections: Connection[] } {
  // Filter to clusters with discoveries
  const discovered = clusters.filter(c => c.discoveredCount > 0)

  const nodes: DiscoveredNode[] = discovered.map(c => ({
    position: new THREE.Vector3(
      c.positionX * BRAIN_SCALE.x,
      c.positionY * BRAIN_SCALE.y,
      c.positionZ * BRAIN_SCALE.z
    ),
    discoveryRatio: c.discoveredCount / Math.max(1, c.spaceCount)
  }))

  if (discovered.length < 2) return { nodes, connections: [] }

  const connections: Connection[] = []
  const connectionSet = new Set<string>()

  // Connect nearby discovered clusters
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const distance = nodes[i].position.distanceTo(nodes[j].position)

      if (distance <= maxDistance) {
        const key = `${i}-${j}`
        if (!connectionSet.has(key)) {
          connectionSet.add(key)

          // Brightness based on discovery ratio
          const avgRatio = (nodes[i].discoveryRatio + nodes[j].discoveryRatio) / 2
          const brightness = 0.3 + avgRatio * 0.7

          connections.push({
            from: nodes[i].position.clone(),
            to: nodes[j].position.clone(),
            brightness
          })
        }
      }
    }
  }

  return { nodes, connections }
}

// Node marker vertex shader
const NODE_VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aColor;

  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Node marker fragment shader
const NODE_FRAGMENT_SHADER = `
  varying vec3 vColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(vColor, alpha * 0.9);
  }
`

export function SynapseNetworkNew({
  spaceClusters,
  maxConnectionDistance = NETWORK_CONFIG.maxConnectionDistance
}: SynapseNetworkProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Build network
  const { nodes, connections } = useMemo(() => {
    return buildNetwork(spaceClusters, maxConnectionDistance)
  }, [spaceClusters, maxConnectionDistance])

  // Node marker geometry
  const { nodePositions, nodeSizes, nodeColors } = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3)
    const sizes = new Float32Array(nodes.length)
    const colors = new Float32Array(nodes.length * 3)

    nodes.forEach((node, i) => {
      positions[i * 3] = node.position.x
      positions[i * 3 + 1] = node.position.y
      positions[i * 3 + 2] = node.position.z

      // Gold color for discovered nodes
      const brightness = 0.6 + node.discoveryRatio * 0.4
      colors[i * 3] = 1.0 * brightness
      colors[i * 3 + 1] = 0.84 * brightness
      colors[i * 3 + 2] = 0.0

      sizes[i] = 8.0 + node.discoveryRatio * 4.0
    })

    return { nodePositions: positions, nodeSizes: sizes, nodeColors: colors }
  }, [nodes])

  // Time for animations
  const scaledTime = useScaledTime()

  // Update shader
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = scaledTime
    }
  })

  if (nodes.length === 0) return null

  return (
    <group>
      {/* Connection lines */}
      {connections.map((conn, i) => (
        <Line
          key={i}
          points={[conn.from, conn.to]}
          color={new THREE.Color(0.2, 0.6 + conn.brightness * 0.4, 0.8 + conn.brightness * 0.2)}
          lineWidth={1 + conn.brightness * 2}
          transparent
          opacity={0.3 + conn.brightness * 0.4}
        />
      ))}

      {/* Node markers for discovered clusters */}
      {nodes.length > 0 && (
        <points ref={pointsRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[nodePositions, 3]} />
            <bufferAttribute attach="attributes-aSize" args={[nodeSizes, 1]} />
            <bufferAttribute attach="attributes-aColor" args={[nodeColors, 3]} />
          </bufferGeometry>
          <shaderMaterial
            ref={materialRef}
            uniforms={{ uTime: { value: 0 } }}
            vertexShader={NODE_VERTEX_SHADER}
            fragmentShader={NODE_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  )
}
