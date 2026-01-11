import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { SynapseType } from '@/types/game'
import { SYNAPSE_TYPE_COLORS, SYNAPSE_UNLOCK_LEVELS, SYNAPSE_TYPE_ORDER } from '@/types/game'
import { BRAIN_SCALE, NETWORK_CONFIG } from './core/brainConstants'
import { useScaledTime } from './core/useBrainTime'

// Synapse cluster interface (matches SpaceMarkersNew)
// Masterplan 2026: Updated property names to match shipStore mapping
interface SynapseCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  synapseCount: number
  discoveredCount: number
  beingExploredCount: number  // Renamed from beingSolvedCount
  avgLootPool: number         // Renamed from avgReward
  explorerCount?: number
  typeCounts: Record<SynapseType, number>
  updatedAt: number
}

interface SynapseNetworkProps {
  synapseClusters: SynapseCluster[]
  userBrainLevel?: number  // For showing locked connections
  maxConnectionDistance?: number
}

interface DiscoveredNode {
  position: THREE.Vector3
  discoveryRatio: number
  dominantType: SynapseType
  isLocked: boolean
}

interface Connection {
  from: THREE.Vector3
  to: THREE.Vector3
  brightness: number
  dominantType: SynapseType
  isLocked: boolean
}

// Get dominant synapse type from type counts
function getDominantSynapseType(typeCounts?: Record<SynapseType, number>): SynapseType {
  if (!typeCounts) return 'minor'

  let dominantType: SynapseType = 'minor'
  let highestCount = 0

  for (const type of SYNAPSE_TYPE_ORDER) {
    const count = typeCounts[type] || 0
    if (count > highestCount) {
      dominantType = type
      highestCount = count
    }
  }

  return dominantType
}

// Build network of connections between discovered synapse clusters
function buildNetwork(
  clusters: SynapseCluster[],
  maxDistance: number,
  userBrainLevel: number
): { nodes: DiscoveredNode[]; connections: Connection[] } {
  // Filter to clusters with discoveries
  const discovered = clusters.filter(c => c.discoveredCount > 0)

  const nodes: DiscoveredNode[] = discovered.map(c => {
    const dominantType = getDominantSynapseType(c.typeCounts)
    const unlockLevel = SYNAPSE_UNLOCK_LEVELS[dominantType]
    return {
      position: new THREE.Vector3(
        c.positionX * BRAIN_SCALE.x,
        c.positionY * BRAIN_SCALE.y,
        c.positionZ * BRAIN_SCALE.z
      ),
      discoveryRatio: c.discoveredCount / Math.max(1, c.synapseCount),
      dominantType,
      isLocked: userBrainLevel < unlockLevel
    }
  })

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

          // Use the rarer type for connection color
          const type1Index = SYNAPSE_TYPE_ORDER.indexOf(nodes[i].dominantType)
          const type2Index = SYNAPSE_TYPE_ORDER.indexOf(nodes[j].dominantType)
          const dominantType = type1Index > type2Index ? nodes[i].dominantType : nodes[j].dominantType
          const isLocked = nodes[i].isLocked || nodes[j].isLocked

          connections.push({
            from: nodes[i].position.clone(),
            to: nodes[j].position.clone(),
            brightness,
            dominantType,
            isLocked
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
  synapseClusters,
  userBrainLevel = 1,
  maxConnectionDistance = NETWORK_CONFIG.maxConnectionDistance
}: SynapseNetworkProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Build network
  const { nodes, connections } = useMemo(() => {
    return buildNetwork(synapseClusters, maxConnectionDistance, userBrainLevel)
  }, [synapseClusters, maxConnectionDistance, userBrainLevel])

  // Node marker geometry with synapse type colors
  const { nodePositions, nodeSizes, nodeColors } = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3)
    const sizes = new Float32Array(nodes.length)
    const colors = new Float32Array(nodes.length * 3)

    nodes.forEach((node, i) => {
      positions[i * 3] = node.position.x
      positions[i * 3 + 1] = node.position.y
      positions[i * 3 + 2] = node.position.z

      // Color based on synapse type
      const typeColor = SYNAPSE_TYPE_COLORS[node.dominantType]
      let brightness = 0.6 + node.discoveryRatio * 0.4

      // Dim locked nodes
      if (node.isLocked) {
        brightness *= 0.3
      }

      colors[i * 3] = typeColor.r * brightness
      colors[i * 3 + 1] = typeColor.g * brightness
      colors[i * 3 + 2] = typeColor.b * brightness

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

  // Helper to get connection color based on synapse type
  const getConnectionColor = (conn: Connection): THREE.Color => {
    const typeColor = SYNAPSE_TYPE_COLORS[conn.dominantType]
    const brightness = conn.isLocked ? 0.2 : conn.brightness

    return new THREE.Color(
      typeColor.r * brightness,
      typeColor.g * brightness,
      typeColor.b * brightness
    )
  }

  return (
    <group>
      {/* Connection lines colored by synapse type */}
      {connections.map((conn, i) => (
        <Line
          key={i}
          points={[conn.from, conn.to]}
          color={getConnectionColor(conn)}
          lineWidth={conn.isLocked ? 1 : 1 + conn.brightness * 2}
          transparent
          opacity={conn.isLocked ? 0.15 : 0.3 + conn.brightness * 0.4}
        />
      ))}

      {/* Node markers for discovered synapse clusters */}
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
