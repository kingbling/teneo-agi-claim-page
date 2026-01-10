import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Agent, AgentCluster, AgentState } from '@/types/agent'
import { useAgentStore } from '@/stores/agentStore'

interface AgentMarkersProps {
  userAgents: Agent[]
  agentClusters: AgentCluster[]
  onAgentClick?: (agent: Agent) => void
  showPaths?: boolean
  opacity?: number
  hideTooltip?: boolean
}

// Hash string to number for consistent color generation
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360
  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return [r, g, b]
}

// Generate unique color for each agent based on their ID
function getAgentColor(agentId: string, state: AgentState): [number, number, number] {
  // Hash agent ID to get consistent hue (0-360)
  const hue = hashString(agentId) % 360

  // State affects saturation and lightness
  const stateModifiers: Record<string, { s: number; l: number }> = {
    idle: { s: 0.4, l: 0.45 },           // Dim, slightly desaturated
    solving: { s: 0.95, l: 0.60 },       // Bright
    deploying: { s: 0.85, l: 0.55 },     // Blue-ish, emerging
    wandering: { s: 0.80, l: 0.55 },     // Vibrant cyan, exploring
    limping_home: { s: 0.65, l: 0.50 },  // Amber/orange, low energy
    exhausted: { s: 0.25, l: 0.35 },     // Dim gray, depleted
  }

  const mod = stateModifiers[state]
  if (!mod) {
    throw new Error(`Unknown agent state: ${state}`)
  }
  return hslToRgb(hue, mod.s, mod.l)
}

// Keep state colors for clusters (which aggregate multiple agents)
const STATE_COLORS: Record<string, [number, number, number]> = {
  idle: [0.5, 0.5, 0.5],
  solving: [1.0, 0.8, 0.2],
  deploying: [0.4, 0.6, 1.0],      // Blue - emerging from center
  wandering: [0.2, 0.8, 0.9],      // Cyan - exploring
  limping_home: [1.0, 0.6, 0.2],   // Orange - low fuel return
  exhausted: [0.4, 0.3, 0.3],      // Dim red-gray - depleted
}

// Store agent colors for use in travel paths
const agentColorCache = new Map<string, THREE.Color>()

// Search radius ring component for active agents
interface SearchRadiusRingProps {
  position: [number, number, number]
  radius: number
  color: THREE.Color
  state: AgentState
  opacity: number
  timeScale: number
  solveProgress?: number  // 0-1 progress when solving
}

function SearchRadiusRing({ position, radius, color, state, opacity, timeScale, solveProgress = 0 }: SearchRadiusRingProps) {
  const ringRef = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const scanDotsRef = useRef<THREE.Group>(null)
  const progressRingRef = useRef<THREE.Mesh>(null)
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  useFrame(({ clock }) => {
    // Calculate scaled time for trance slowdown
    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
    const time = scaledTimeRef.current

    if (ringRef.current) {
      // Pulsing scale animation - faster and bigger when solving
      const pulseSpeed = state === 'solving' ? 3.0 : 1.5
      const pulseAmount = state === 'solving' ? 0.2 : 0.12
      const pulse = 1.0 + Math.sin(time * pulseSpeed) * pulseAmount
      ringRef.current.scale.setScalar(pulse)
      ringRef.current.rotation.z = time * (state === 'solving' ? 0.8 : 0.5)
    }
    if (ring2Ref.current) {
      // Slower counter-rotating ring
      const pulse2 = 1.0 + Math.sin(time * 1.2 + Math.PI) * 0.1
      ring2Ref.current.scale.setScalar(pulse2 * 1.3)
      ring2Ref.current.rotation.z = -time * 0.3
    }

    // Animate wandering spiral
    if (scanDotsRef.current && state === 'wandering') {
      scanDotsRef.current.rotation.z = time * 2.0
      // Pulse the dot sizes
      scanDotsRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh
        const phase = (i / 8) * Math.PI * 2
        const scale = 0.8 + Math.sin(time * 4 + phase) * 0.3
        mesh.scale.setScalar(scale)
      })
    }

    // Animate progress ring when solving
    if (progressRingRef.current && state === 'solving') {
      // Subtle rotation for the progress ring
      progressRingRef.current.rotation.z = time * 0.3
    }
  })

  const ringOpacity = state === 'solving' ? 0.7 : 0.4
  const isSolving = state === 'solving'

  return (
    <group position={position}>
      {/* Inner ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[radius * 0.9, radius, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={ringOpacity * opacity}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Outer ring */}
      <mesh ref={ring2Ref}>
        <ringGeometry args={[radius * 1.2, radius * 1.3, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={ringOpacity * 0.4 * opacity}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Wandering spiral pattern - wider exploration radius */}
      {state === 'wandering' && (
        <group ref={scanDotsRef}>
          {Array.from({ length: 8 }).map((_, i) => {
            // Spiral arrangement - dots at increasing radius
            const angle = (i / 8) * Math.PI * 2.5
            const spiralRadius = radius * (0.6 + (i / 8) * 0.6)
            const x = Math.cos(angle) * spiralRadius
            const y = Math.sin(angle) * spiralRadius
            return (
              <mesh key={i} position={[x, y, 0]}>
                <circleGeometry args={[0.008 + (i / 8) * 0.006, 12]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={(0.6 + (i / 8) * 0.4) * opacity}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            )
          })}
        </group>
      )}
      {/* Center glow when solving */}
      {isSolving && (
        <mesh>
          <circleGeometry args={[radius * 0.5, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2 * opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* Solve progress ring - shows completion percentage */}
      {isSolving && solveProgress > 0 && (
        <mesh ref={progressRingRef} rotation={[0, 0, -Math.PI / 2]}>
          <ringGeometry args={[radius * 0.65, radius * 0.8, 64, 1, 0, Math.PI * 2 * solveProgress]} />
          <meshBasicMaterial
            color={new THREE.Color(0.3, 1.0, 0.5)}  // Green progress
            transparent
            opacity={0.9 * opacity}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* Progress percentage text indicator dots around the ring */}
      {isSolving && solveProgress > 0 && (
        <group>
          {/* 4 milestone dots at 25%, 50%, 75%, 100% */}
          {[0.25, 0.5, 0.75, 1.0].map((milestone, i) => {
            const angle = (milestone * Math.PI * 2) - (Math.PI / 2)  // Start from top
            const dotRadius = radius * 0.725
            const x = Math.cos(angle) * dotRadius
            const y = Math.sin(angle) * dotRadius
            const isReached = solveProgress >= milestone
            return (
              <mesh key={i} position={[x, y, 0]}>
                <circleGeometry args={[0.008, 12]} />
                <meshBasicMaterial
                  color={isReached ? new THREE.Color(0.3, 1.0, 0.5) : new THREE.Color(0.3, 0.3, 0.3)}
                  transparent
                  opacity={(isReached ? 1.0 : 0.4) * opacity}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            )
          })}
        </group>
      )}
    </group>
  )
}

// Beacon glow component for agents with beacon trait - attracts nearby agents visually
interface BeaconGlowProps {
  position: [number, number, number]
  color: THREE.Color
  level: number  // 1-5 beacon trait level
  opacity: number
  timeScale: number
}

function BeaconGlow({ position, color, level, opacity, timeScale }: BeaconGlowProps) {
  const glowRef = useRef<THREE.Mesh>(null)
  const ringsRef = useRef<THREE.Group>(null)
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  useFrame(({ clock }) => {
    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
    const time = scaledTimeRef.current

    if (glowRef.current) {
      // Gentle pulsing glow
      const pulse = 1.0 + Math.sin(time * 2.0) * 0.15
      glowRef.current.scale.setScalar(pulse)
    }

    if (ringsRef.current) {
      // Expanding rings animation
      ringsRef.current.children.forEach((ring, i) => {
        const mesh = ring as THREE.Mesh
        const phase = (i / 3) * Math.PI * 2
        const expandProgress = (time * 0.5 + phase) % 1
        const scale = 1 + expandProgress * 2
        mesh.scale.setScalar(scale)
        const material = mesh.material as THREE.MeshBasicMaterial
        material.opacity = (1 - expandProgress) * 0.3 * opacity
      })
    }
  })

  // Radius based on beacon level (level 1 = 0.15, level 5 = 0.35)
  const baseRadius = 0.1 + level * 0.05

  return (
    <group position={position}>
      {/* Central glow */}
      <mesh ref={glowRef}>
        <circleGeometry args={[baseRadius, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.25 * opacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Expanding rings */}
      <group ref={ringsRef}>
        {[0, 1, 2].map(i => (
          <mesh key={i}>
            <ringGeometry args={[baseRadius * 0.9, baseRadius, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.3 * opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>

      {/* Outer soft halo for higher levels */}
      {level >= 3 && (
        <mesh>
          <circleGeometry args={[baseRadius * 1.8, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.1 * opacity * (level / 5)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

// Trail point for tracking agent movement history
interface TrailPoint {
  x: number
  y: number
  z: number
  age: number  // 0 = newest, increases over time
  color: THREE.Color
  fuelIntensity: number  // 0-1 based on agent fuel level when point was created
}

// Maximum trail length and update interval
const TRAIL_MAX_LENGTH = 20
const TRAIL_UPDATE_INTERVAL = 0.15  // seconds between trail point captures
const TRAIL_FADE_RATE = 0.02  // How fast trail points age per frame

// Agent trail component using instanced mesh for performance
interface AgentTrailsProps {
  trails: Map<string, TrailPoint[]>
  opacity: number
}

function AgentTrails({ trails, opacity }: AgentTrailsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Count total trail points
  const totalPoints = useMemo(() => {
    let count = 0
    trails.forEach(trail => { count += trail.length })
    return count
  }, [trails])

  // Update instance matrices and colors
  useFrame(() => {
    if (!meshRef.current || totalPoints === 0) return

    let instanceIndex = 0
    trails.forEach(trail => {
      trail.forEach(point => {
        if (instanceIndex >= totalPoints) return

        // Position
        dummy.position.set(point.x, point.y, point.z)

        // Scale based on age (fade out older points)
        const ageFactor = Math.max(0, 1 - point.age)
        const scale = 0.015 * ageFactor
        dummy.scale.setScalar(scale)

        dummy.updateMatrix()
        meshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)

        // Color with alpha based on age AND fuel intensity
        const color = point.color.clone()
        const fuelIntensity = point.fuelIntensity
        color.multiplyScalar(ageFactor * opacity * fuelIntensity)
        meshRef.current!.setColorAt(instanceIndex, color)

        instanceIndex++
      })
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  if (totalPoints === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, totalPoints]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

// Quick action buttons for agent tooltip
interface QuickActionButtonsProps {
  agent: Agent
}

function QuickActionButtons({ agent }: QuickActionButtonsProps) {
  const { deployRandomly, refuelAgent, repairAgent, userPoints } = useAgentStore()
  const [isDeploying, setIsDeploying] = useState(false)
  const [isRefueling, setIsRefueling] = useState(false)
  const [isRepairing, setIsRepairing] = useState(false)

  // Determine which actions are available
  const canDeploy = agent.state === 'idle' && agent.pointsBalance >= 100 && !agent.needsRepair
  const needsRefuel = agent.pointsBalance < 500 && !agent.needsRepair
  const needsRepair = agent.needsRepair
  const refuelAmount = 500 // Standard refuel amount

  const handleDeploy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDeploying) return
    setIsDeploying(true)
    try {
      await deployRandomly(agent.id)
    } finally {
      setIsDeploying(false)
    }
  }

  const handleRefuel = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRefueling || userPoints < refuelAmount) return
    setIsRefueling(true)
    try {
      await refuelAgent(agent.id, refuelAmount)
    } finally {
      setIsRefueling(false)
    }
  }

  const handleRepair = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRepairing) return
    setIsRepairing(true)
    try {
      await repairAgent(agent.id)
    } finally {
      setIsRepairing(false)
    }
  }

  // No actions needed
  if (!canDeploy && !needsRefuel && !needsRepair) return null

  return (
    <div className="mt-[var(--spacing-3)] pt-[var(--spacing-2-5)] border-t border-[var(--card-border)]/30" style={{ pointerEvents: 'auto' }}>
      <div className="flex gap-[var(--spacing-2)]">
        {/* Deploy button for idle agents */}
        {canDeploy && (
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="flex-1 px-[var(--spacing-3)] py-[var(--spacing-1-5)] rounded-lg text-[10px] font-semibold bg-[var(--brand-teal-1)]/20 text-[var(--brand-teal-1)] border border-[var(--brand-teal-1)]/30 hover:bg-[var(--brand-teal-1)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeploying ? 'Deploying...' : 'Deploy'}
          </button>
        )}

        {/* Repair button for exhausted agents */}
        {needsRepair && (
          <button
            onClick={handleRepair}
            disabled={isRepairing}
            className="flex-1 px-[var(--spacing-3)] py-[var(--spacing-1-5)] rounded-lg text-[10px] font-semibold bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 hover:bg-[hsl(var(--destructive))]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRepairing ? 'Repairing...' : `Repair (${Math.ceil(agent.creationCost * 0.5)})`}
          </button>
        )}

        {/* Refuel button for low fuel */}
        {needsRefuel && !needsRepair && (
          <button
            onClick={handleRefuel}
            disabled={isRefueling || userPoints < refuelAmount}
            className="flex-1 px-[var(--spacing-3)] py-[var(--spacing-1-5)] rounded-lg text-[10px] font-semibold bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border border-[hsl(var(--warning))]/30 hover:bg-[hsl(var(--warning))]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefueling ? 'Refueling...' : `+${refuelAmount} Fuel`}
          </button>
        )}
      </div>
    </div>
  )
}

export function AgentMarkers({
  userAgents,
  agentClusters,
  onAgentClick,
  showPaths = true,
  opacity = 1,
  hideTooltip = false,
}: AgentMarkersProps) {
  const userPointsRef = useRef<THREE.Points>(null)
  const userGeometryRef = useRef<THREE.BufferGeometry>(null)
  const userMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const clusterPointsRef = useRef<THREE.Points>(null)
  const clusterGeometryRef = useRef<THREE.BufferGeometry>(null)
  const clusterMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const [hoveredAgentIndex, setHoveredAgentIndex] = useState<number | null>(null)
  const { camera, raycaster, pointer } = useThree()

  // Trail tracking state
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map())
  const lastTrailUpdateRef = useRef<Map<string, number>>(new Map())
  const [trailsSnapshot, setTrailsSnapshot] = useState<Map<string, TrailPoint[]>>(new Map())

  const brainScale = useMemo(() => ({ x: 1.3, y: 1.0, z: 1.1 }), [])

  // User agent data with unique colors per agent
  const userAgentData = useMemo(() => {
    if (userAgents.length === 0) return null

    const positions = new Float32Array(userAgents.length * 3)
    const colors = new Float32Array(userAgents.length * 3)
    const sizes = new Float32Array(userAgents.length)
    const states = new Float32Array(userAgents.length)
    const agentPositions: THREE.Vector3[] = []

    userAgents.forEach((agent, i) => {
      const x = agent.positionX * brainScale.x
      const y = agent.positionY * brainScale.y
      const z = agent.positionZ * brainScale.z

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      agentPositions.push(new THREE.Vector3(x, y, z))

      // Use unique color per agent based on ID
      const color = getAgentColor(agent.id, agent.state)
      colors[i * 3] = color[0]
      colors[i * 3 + 1] = color[1]
      colors[i * 3 + 2] = color[2]

      // Cache color for travel path
      agentColorCache.set(agent.id, new THREE.Color(color[0], color[1], color[2]))

      // Size based on discoveries - agents grow as they find more spaces
      // Base size: 24, max size: 36 (at 20+ discoveries)
      const discoveryScale = Math.min(1, agent.spacesDiscovered / 20)  // 0-1 based on discoveries
      const baseSize = 24.0
      const maxBonus = 12.0  // Max additional size
      sizes[i] = baseSize + (discoveryScale * maxBonus)

      // State map - maps agent states to visual behavior indices
      // 0: idle/exhausted, 1: wandering, 2: deploying, 3: solving, 4: limping_home
      const stateMap: Record<string, number> = {
        idle: 0,
        deploying: 2,
        wandering: 1,
        solving: 3,
        limping_home: 4,
        exhausted: 0
      }
      const stateIndex = stateMap[agent.state]
      if (stateIndex === undefined) {
        throw new Error(`Unknown agent state: ${agent.state}`)
      }
      states[i] = stateIndex
    })

    return { positions, colors, sizes, states, agentPositions }
  }, [userAgents, brainScale])

  // Cluster data
  const clusterData = useMemo(() => {
    if (agentClusters.length === 0) return null

    const positions = new Float32Array(agentClusters.length * 3)
    const colors = new Float32Array(agentClusters.length * 3)
    const sizes = new Float32Array(agentClusters.length)
    const states = new Float32Array(agentClusters.length)
    const clusterPositions: THREE.Vector3[] = []

    agentClusters.forEach((cluster, i) => {
      const x = cluster.positionX * brainScale.x
      const y = cluster.positionY * brainScale.y
      const z = cluster.positionZ * brainScale.z

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      clusterPositions.push(new THREE.Vector3(x, y, z))

      const color = STATE_COLORS[cluster.dominantState]
      if (!color) {
        throw new Error(`Unknown cluster state: ${cluster.dominantState}`)
      }
      colors[i * 3] = color[0]
      colors[i * 3 + 1] = color[1]
      colors[i * 3 + 2] = color[2]

      const weightScale = 1.0 + Math.log10(Math.max(1, cluster.agentCount)) * 0.5
      sizes[i] = 8.0 * weightScale

      // State map - maps cluster states to visual behavior indices
      const stateMap: Record<string, number> = {
        idle: 0,
        deploying: 2,
        wandering: 1,
        solving: 3,
        limping_home: 4,
        exhausted: 0
      }
      const stateIndex = stateMap[cluster.dominantState]
      if (stateIndex === undefined) {
        throw new Error(`Unknown cluster state: ${cluster.dominantState}`)
      }
      states[i] = stateIndex
    })

    return { positions, colors, sizes, states, clusterPositions }
  }, [agentClusters, brainScale])

  // Update user geometry
  useEffect(() => {
    if (!userGeometryRef.current || !userAgentData) return

    const geom = userGeometryRef.current
    geom.setAttribute('position', new THREE.BufferAttribute(userAgentData.positions, 3))
    geom.setAttribute('aColor', new THREE.BufferAttribute(userAgentData.colors, 3))
    geom.setAttribute('aSize', new THREE.BufferAttribute(userAgentData.sizes, 1))
    geom.setAttribute('aState', new THREE.BufferAttribute(userAgentData.states, 1))
  }, [userAgentData])

  // Update cluster geometry
  useEffect(() => {
    if (!clusterGeometryRef.current || !clusterData) return

    const geom = clusterGeometryRef.current
    geom.setAttribute('position', new THREE.BufferAttribute(clusterData.positions, 3))
    geom.setAttribute('aColor', new THREE.BufferAttribute(clusterData.colors, 3))
    geom.setAttribute('aSize', new THREE.BufferAttribute(clusterData.sizes, 1))
    geom.setAttribute('aState', new THREE.BufferAttribute(clusterData.states, 1))
  }, [clusterData])

  // Travel paths - draw line from start position to current/target position for deploying agents
  const travelPaths = useMemo(() => {
    if (!showPaths) return []

    return userAgents
      .filter((agent) =>
        // Show travel paths for agents that are deploying
        agent.state === 'deploying' &&
        agent.startPositionX !== null &&
        agent.startPositionY !== null &&
        agent.startPositionZ !== null
      )
      .map((agent) => {
        const start = new THREE.Vector3(
          agent.startPositionX! * brainScale.x,
          agent.startPositionY! * brainScale.y,
          agent.startPositionZ! * brainScale.z
        )
        const end = new THREE.Vector3(
          agent.positionX * brainScale.x,
          agent.positionY * brainScale.y,
          agent.positionZ * brainScale.z
        )
        return { agent, start, end }
      })
  }, [userAgents, showPaths, brainScale])

  // Hover detection
  const handlePointerMove = useCallback(() => {
    if (!userAgentData || userAgents.length === 0) return

    raycaster.setFromCamera(pointer, camera)

    let closestIndex: number | null = null
    let closestDist = 0.15

    userAgentData.agentPositions.forEach((pos, i) => {
      const dist = raycaster.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    if (closestIndex !== hoveredAgentIndex) {
      setHoveredAgentIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'
    }
  }, [raycaster, pointer, camera, userAgentData, hoveredAgentIndex, userAgents.length])

  const handleClick = useCallback(() => {
    if (hoveredAgentIndex !== null && onAgentClick) {
      onAgentClick(userAgents[hoveredAgentIndex])
    }
  }, [hoveredAgentIndex, userAgents, onAgentClick])

  // Scaled time for trance effect (server-authoritative)
  const timeScale = userAgents.some(a => a.tranceActive) ? 0.05 : 1.0
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  useFrame(({ clock }) => {
    // Calculate scaled time for trance slowdown
    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
    const time = scaledTimeRef.current

    if (userMaterialRef.current) {
      userMaterialRef.current.uniforms.uTime.value = time
      userMaterialRef.current.uniforms.uHoveredIndex.value = hoveredAgentIndex ?? -1
      userMaterialRef.current.uniforms.uCameraPosition.value.copy(camera.position)
      userMaterialRef.current.uniforms.uOpacity.value = opacity
    }
    if (clusterMaterialRef.current) {
      clusterMaterialRef.current.uniforms.uTime.value = time
      clusterMaterialRef.current.uniforms.uCameraPosition.value.copy(camera.position)
      clusterMaterialRef.current.uniforms.uOpacity.value = opacity * 0.6
    }

    // Update agent trails for active agents
    let trailsChanged = false
    userAgents.forEach(agent => {
      // Only track trails for active (non-idle) agents
      if (agent.state === 'idle') {
        // Clear trail for idle agents
        if (trailsRef.current.has(agent.id)) {
          trailsRef.current.delete(agent.id)
          lastTrailUpdateRef.current.delete(agent.id)
          trailsChanged = true
        }
        return
      }

      const lastUpdate = lastTrailUpdateRef.current.get(agent.id)
      const trail = trailsRef.current.get(agent.id)

      if (lastUpdate === undefined || trail === undefined) {
        return
      }

      // Age existing trail points
      trail.forEach(point => {
        point.age += TRAIL_FADE_RATE * timeScale
      })

      // Remove fully faded points
      const filteredTrail = trail.filter(point => point.age < 1)

      // Add new trail point if enough time has passed
      if (time - lastUpdate > TRAIL_UPDATE_INTERVAL) {
        const agentColor = agentColorCache.get(agent.id)
        if (!agentColor) {
          throw new Error(`Agent color not found in cache for agent ${agent.id}`)
        }
        // Calculate fuel intensity - low fuel = dimmer trails
        const maxFuel = 1000  // Reference max fuel
        const fuelIntensity = Math.min(1, Math.max(0.2, agent.pointsBalance / maxFuel))
        const newPoint: TrailPoint = {
          x: agent.positionX * brainScale.x,
          y: agent.positionY * brainScale.y,
          z: agent.positionZ * brainScale.z,
          age: 0,
          color: agentColor.clone(),
          fuelIntensity,
        }

        // Add to front, keep max length
        filteredTrail.unshift(newPoint)
        if (filteredTrail.length > TRAIL_MAX_LENGTH) {
          filteredTrail.pop()
        }

        lastTrailUpdateRef.current.set(agent.id, time)
        trailsChanged = true
      }

      if (filteredTrail.length !== trail.length) {
        trailsChanged = true
      }

      trailsRef.current.set(agent.id, filteredTrail)
    })

    // Update snapshot periodically for rendering
    if (trailsChanged) {
      setTrailsSnapshot(new Map(trailsRef.current))
    }

    handlePointerMove()
  })

  const hoveredAgent = hoveredAgentIndex !== null ? userAgents[hoveredAgentIndex] : null
  const hoveredPosition = hoveredAgentIndex !== null ? userAgentData?.agentPositions[hoveredAgentIndex] : null

  const vertexShader = `
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aState;

    uniform float uTime;
    uniform float uHoveredIndex;
    uniform vec3 uCameraPosition;

    varying vec3 vColor;
    varying float vState;
    varying float vHovered;
    varying float vDistScale;

    void main() {
      vColor = aColor;
      vState = aState;

      float vertexIndex = float(gl_VertexID);
      vHovered = abs(vertexIndex - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float distToCamera = distance(position, uCameraPosition);

      // Match camera range (1.5 to 6.0) - allow scaling when zoomed in
      float distScale = smoothstep(6.0, 1.5, distToCamera);
      vDistScale = distScale;

      float pulse = 1.0;
      if (aState == 1.0) {
        // Searching - organic wandering pulse
        pulse = 1.0 + 0.12 * sin(uTime * 3.0) + 0.08 * sin(uTime * 5.5);
      } else if (aState == 2.0) {
        // Traveling - forward motion pulse
        pulse = 1.0 + 0.15 * sin(uTime * 6.0);
      } else if (aState == 3.0) {
        // Solving - bright pulsing
        pulse = 1.0 + 0.25 * sin(uTime * 4.0);
      }

      float hoverScale = mix(1.0, 1.4, vHovered);

      gl_PointSize = aSize * max(0.15, distScale) * pulse * hoverScale;
      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform float uOpacity;

    varying vec3 vColor;
    varying float vState;
    varying float vHovered;
    varying float vDistScale;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);

      if (dist > 0.5) discard;

      float core = smoothstep(0.2, 0.0, dist);
      float glow = smoothstep(0.5, 0.1, dist);
      float ring = smoothstep(0.5, 0.4, dist) * smoothstep(0.3, 0.35, dist);

      vec3 color = vColor;

      if (vState > 0.5 && vState < 1.5) {
        // Searching - organic wandering glow
        float wander = 0.5 + 0.3 * sin(uTime * 2.0 - dist * 8.0) + 0.2 * cos(uTime * 3.5);
        color = mix(color, vec3(0.5, 0.9, 1.0), wander * 0.25);
      } else if (vState > 1.5 && vState < 2.5) {
        // Traveling - trail effect
        float trail = 0.5 + 0.5 * sin(uTime * 6.0 - dist * 10.0);
        color = mix(color, vec3(0.4, 0.8, 1.0), trail * 0.3);
      } else if (vState > 2.5 && vState < 3.5) {
        // Solving - bright pulse
        float solvePulse = 0.5 + 0.5 * sin(uTime * 4.0);
        color = mix(color, vec3(1.0, 1.0, 0.5), solvePulse * 0.4);
      }

      color = mix(color, vec3(1.0), core * 0.7);
      color = mix(color, vec3(1.0), vHovered * 0.3);

      // Scale alpha with distance to prevent overexposure when zoomed in
      float alpha = (glow * 0.8 + ring * 0.5) * max(0.2, vDistScale);
      alpha = max(0.05, alpha);  // Tiny minimum

      gl_FragColor = vec4(color, alpha * uOpacity);
    }
  `

  return (
    <group onClick={handleClick}>
      {/* Agent clusters */}
      {agentClusters.length > 0 && (
        <points ref={clusterPointsRef} frustumCulled={false}>
          <bufferGeometry ref={clusterGeometryRef} />
          <shaderMaterial
            ref={clusterMaterialRef}
            uniforms={{
              uTime: { value: 0 },
              uHoveredIndex: { value: -1 },
              uCameraPosition: { value: new THREE.Vector3(0, 0, 3) },
              uOpacity: { value: opacity * 0.6 },
            }}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* User's agents */}
      {userAgents.length > 0 && (
        <points ref={userPointsRef} frustumCulled={false}>
          <bufferGeometry ref={userGeometryRef} />
          <shaderMaterial
            ref={userMaterialRef}
            uniforms={{
              uTime: { value: 0 },
              uHoveredIndex: { value: hoveredAgentIndex ?? -1 },
              uCameraPosition: { value: new THREE.Vector3(0, 0, 3) },
              uOpacity: { value: opacity },
            }}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* Travel paths - using agent's unique color */}
      {travelPaths.map(({ agent, start, end }) => {
        const agentColor = agentColorCache.get(agent.id)
        if (!agentColor) {
          throw new Error(`Agent color not found in cache for agent ${agent.id}`)
        }
        return (
          <Line
            key={`path-${agent.id}`}
            points={[start, end]}
            color={agentColor}
            lineWidth={1.5}
            transparent
            opacity={0.5 * opacity}
            dashed
            dashSize={0.05}
            gapSize={0.03}
          />
        )
      })}

      {/* Agent trails - fading trail behind moving agents */}
      <AgentTrails trails={trailsSnapshot} opacity={opacity} />

      {/* Search/Solving radius rings for active agents */}
      {userAgents
        .filter(agent =>
          // Show radius rings for agents that are wandering or solving
          agent.state === 'wandering' || agent.state === 'solving'
        )
        .map((agent) => {
          const agentColor = agentColorCache.get(agent.id)
          if (!agentColor) {
            throw new Error(`Agent color not found in cache for agent ${agent.id}`)
          }
          const x = agent.positionX * brainScale.x
          const y = agent.positionY * brainScale.y
          const z = agent.positionZ * brainScale.z
          // Wandering has larger radius (exploring wider area)
          const radius = agent.state === 'solving' ? 0.15 : agent.state === 'wandering' ? 0.18 : 0.12

          // Calculate solve progress if agent is solving
          let solveProgress = 0
          if (agent.state === 'solving' && agent.solveStartTime) {
            // Estimate solve time (use 15 seconds as default, adjusted by solver trait)
            const solverTrait = agent.traits.find(t => t.type === 'solver')
            const solverLevel = solverTrait?.level ?? 0
            const baseSolveTime = 15 * 1000  // 15 seconds in ms
            const adjustedSolveTime = baseSolveTime * (1 - solverLevel * 0.15)  // Faster with solver trait
            const elapsed = Date.now() - agent.solveStartTime
            solveProgress = Math.min(1, elapsed / adjustedSolveTime)
          }

          return (
            <SearchRadiusRing
              key={`search-${agent.id}`}
              position={[x, y, z]}
              radius={radius}
              color={agentColor}
              state={agent.state}
              opacity={opacity}
              timeScale={timeScale}
              solveProgress={solveProgress}
            />
          )
        })}

      {/* Beacon glow for agents with beacon trait - visible indicator that attracts others */}
      {userAgents
        .filter(agent => {
          // Only show beacon for non-idle agents with beacon trait
          if (agent.state === 'idle' || agent.state === 'exhausted') return false
          const beaconTrait = agent.traits.find(t => t.type === 'beacon')
          return beaconTrait && beaconTrait.level > 0
        })
        .map(agent => {
          const agentColor = agentColorCache.get(agent.id)
          if (!agentColor) {
            throw new Error(`Agent color not found in cache for agent ${agent.id}`)
          }
          const beaconTrait = agent.traits.find(t => t.type === 'beacon')!
          const x = agent.positionX * brainScale.x
          const y = agent.positionY * brainScale.y
          const z = agent.positionZ * brainScale.z

          return (
            <BeaconGlow
              key={`beacon-${agent.id}`}
              position={[x, y, z]}
              color={agentColor}
              level={beaconTrait.level}
              opacity={opacity}
              timeScale={timeScale}
            />
          )
        })}

      {/* Limp-home indicator for low fuel agents returning */}
      {userAgents
        .filter(agent => agent.state === 'limping_home')
        .map(agent => {
          const x = agent.positionX * brainScale.x
          const y = agent.positionY * brainScale.y
          const z = agent.positionZ * brainScale.z

          return (
            <group key={`limp-${agent.id}`} position={[x, y, z]}>
              {/* Warning glow */}
              <mesh>
                <circleGeometry args={[0.08, 16]} />
                <meshBasicMaterial
                  color={new THREE.Color(1.0, 0.4, 0.1)}
                  transparent
                  opacity={0.3 * opacity}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Arrow pointing to center */}
              <mesh rotation={[0, 0, Math.atan2(-y, -x)]}>
                <coneGeometry args={[0.02, 0.05, 8]} />
                <meshBasicMaterial
                  color={new THREE.Color(1.0, 0.5, 0.2)}
                  transparent
                  opacity={0.7 * opacity}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </group>
          )
        })}

      {/* Tooltip */}
      {hoveredAgent && hoveredPosition && !hideTooltip && (() => {
        const agentColor = agentColorCache.get(hoveredAgent.id)
        const colorRgb = agentColor
          ? `rgb(${Math.round(agentColor.r * 255)}, ${Math.round(agentColor.g * 255)}, ${Math.round(agentColor.b * 255)})`
          : '#888'
        const stateColors: Record<string, string> = {
          idle: 'text-[hsl(var(--muted-foreground))]',
          solving: 'text-[hsl(var(--state-solving))]',
          deploying: 'text-[hsl(var(--accent))]',
          wandering: 'text-[hsl(var(--state-exploring))]',
          limping_home: 'text-[hsl(var(--warning))]',
          exhausted: 'text-[hsl(var(--destructive))]',
        }
        const stateColor = stateColors[hoveredAgent.state]
        if (!stateColor) {
          throw new Error(`Unknown agent state: ${hoveredAgent.state}`)
        }

        // Calculate efficiency metrics
        const efficiency = hoveredAgent.totalPointsBurned > 0
          ? (hoveredAgent.totalLoot / hoveredAgent.totalPointsBurned).toFixed(2)
          : '—'
        const efficiencyColor = hoveredAgent.totalPointsBurned > 0
          ? (hoveredAgent.totalLoot / hoveredAgent.totalPointsBurned >= 1 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning))]')
          : 'text-[var(--text-muted)]'

        // Calculate effective burn rate from traits
        const efficientTrait = hoveredAgent.traits.find(t => t.type === 'efficient')
        const efficientLevel = efficientTrait?.level ?? 0
        const baseBurnRate = hoveredAgent.pointsBurnRate ?? 1.0
        const effectiveBurnRate = baseBurnRate * (1 - efficientLevel * 0.15)
        const burnRateColor = effectiveBurnRate < 0.9 ? 'text-[hsl(var(--success))]' : effectiveBurnRate > 1.1 ? 'text-[hsl(var(--destructive))]' : 'text-[var(--text-muted)]'
        return (
          <Html
            position={[hoveredPosition.x, hoveredPosition.y + 0.2, hoveredPosition.z]}
            center
            style={{ pointerEvents: 'none', zIndex: 10 }}
          >
            <div className="relative">
              {/* Glow effect based on agent color */}
              <div
                className="absolute -inset-1 rounded-xl blur-md opacity-30"
                style={{ backgroundColor: colorRgb }}
              />

              <div className="relative rounded-xl border border-[var(--card-border)] bg-[var(--background-secondary)]/95 backdrop-blur-lg px-[var(--spacing-4)] py-[var(--spacing-3)] shadow-2xl whitespace-nowrap min-w-[160px]">
                {/* Gradient top border */}
                <div
                  className="absolute top-0 left-[var(--spacing-5)] right-[var(--spacing-5)] h-[2px] rounded-full"
                  style={{ background: `linear-gradient(to right, transparent, ${colorRgb}, transparent)` }}
                />

                {/* Header */}
                <div className="flex items-center gap-[var(--spacing-2-5)] mb-[var(--spacing-2-5)] pb-[var(--spacing-2)] border-b border-[var(--card-border)]/50">
                  <div
                    className="h-[var(--spacing-3)] w-[var(--spacing-3)] rounded-full ring-2 ring-offset-1 ring-offset-[var(--background-secondary)]"
                    style={{
                      backgroundColor: colorRgb,
                      '--tw-ring-color': `${colorRgb}40`,
                    } as React.CSSProperties}
                  />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {hoveredAgent.name}
                  </span>
                </div>

                {/* Status badge + Discovery rank */}
                <div className="mb-[var(--spacing-2-5)] flex items-center gap-[var(--spacing-2)]">
                  <span className={`inline-flex items-center gap-[var(--spacing-1-5)] px-[var(--spacing-2)] py-[var(--spacing-0-5)] rounded-full text-[10px] font-medium ${stateColor} bg-current/10`}>
                    <span className={`w-[var(--spacing-1-5)] h-[var(--spacing-1-5)] rounded-full bg-current ${hoveredAgent.state !== 'idle' ? 'animate-pulse' : ''}`} />
                    <span className="capitalize">{hoveredAgent.state}</span>
                  </span>
                  {/* Discovery rank badge */}
                  {hoveredAgent.spacesDiscovered > 0 && (
                    <span className={`inline-flex items-center gap-[var(--spacing-1)] px-[var(--spacing-2)] py-[var(--spacing-0-5)] rounded-full text-[10px] font-medium ${
                      hoveredAgent.spacesDiscovered >= 20 ? 'text-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/10' :
                      hoveredAgent.spacesDiscovered >= 10 ? 'text-[hsl(var(--state-solving))] bg-[hsl(var(--state-solving))]/10' :
                      hoveredAgent.spacesDiscovered >= 5 ? 'text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10' :
                      'text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted-foreground))]/10'
                    }`}>
                      {hoveredAgent.spacesDiscovered >= 20 ? '⭐' :
                       hoveredAgent.spacesDiscovered >= 10 ? '🔥' :
                       hoveredAgent.spacesDiscovered >= 5 ? '✨' : ''}
                      {hoveredAgent.spacesDiscovered >= 20 ? 'Veteran' :
                       hoveredAgent.spacesDiscovered >= 10 ? 'Explorer' :
                       hoveredAgent.spacesDiscovered >= 5 ? 'Scout' : 'Rookie'}
                    </span>
                  )}
                </div>

                {/* Low fuel warning */}
                {hoveredAgent.pointsBalance < 200 && (
                  <div className="mb-[var(--spacing-2-5)] px-[var(--spacing-2-5)] py-[var(--spacing-1-5)] rounded-lg bg-[hsl(var(--destructive))]/15 border border-[hsl(var(--destructive))]/30 flex items-center gap-[var(--spacing-2)]">
                    <span className="w-[var(--spacing-2)] h-[var(--spacing-2)] rounded-full bg-[hsl(var(--destructive))] animate-pulse" />
                    <span className="text-[10px] font-semibold text-[hsl(var(--destructive))] uppercase tracking-wide">Low Fuel</span>
                  </div>
                )}

                {/* Deploying indicator - heading from center to target region */}
                {hoveredAgent.state === 'deploying' && (
                  <div className="mb-[var(--spacing-2-5)] px-[var(--spacing-2-5)] py-[var(--spacing-2)] rounded-lg bg-[hsl(var(--chart-4))]/10 border border-[hsl(var(--chart-4))]/30">
                    <div className="flex items-center gap-[var(--spacing-2)]">
                      <span className="text-[10px] font-semibold text-[hsl(var(--chart-4))] uppercase tracking-wide">Deploying</span>
                      <div className="flex gap-[var(--spacing-0-5)]">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className="w-[var(--spacing-1-5)] h-[var(--spacing-1-5)] rounded-full bg-[hsl(var(--chart-4))]"
                            style={{
                              animation: 'pulse 0.6s ease-in-out infinite',
                              animationDelay: `${i * 0.1}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-[9px] text-[hsl(var(--chart-4))]/70 mt-[var(--spacing-1)]">
                      Heading to target region...
                    </div>
                  </div>
                )}

                {/* Wandering indicator - exploring target region */}
                {hoveredAgent.state === 'wandering' && (
                  <div className="mb-[var(--spacing-2-5)] px-[var(--spacing-2-5)] py-[var(--spacing-2)] rounded-lg bg-[hsl(var(--brand-teal-1))]/10 border border-[hsl(var(--brand-teal-1))]/30">
                    <div className="flex items-center justify-between mb-[var(--spacing-1-5)]">
                      <span className="text-[10px] font-semibold text-[hsl(var(--brand-teal-1))] uppercase tracking-wide">Wandering</span>
                      <div className="flex gap-[var(--spacing-1)]">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-[var(--spacing-1-5)] h-[var(--spacing-1-5)] rounded-full bg-[hsl(var(--brand-teal-1))]"
                            style={{
                              animation: 'pulse 1.5s ease-in-out infinite',
                              animationDelay: `${i * 0.3}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-[9px] text-[hsl(var(--brand-teal-1))]/70">
                      Exploring region, seeking spaces...
                    </div>
                  </div>
                )}

                {/* Limping home indicator - low fuel return */}
                {hoveredAgent.state === 'limping_home' && (
                  <div className="mb-[var(--spacing-2-5)] px-[var(--spacing-2-5)] py-[var(--spacing-2)] rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/30">
                    <div className="flex items-center gap-[var(--spacing-2)]">
                      <span className="w-[var(--spacing-2)] h-[var(--spacing-2)] rounded-full bg-[hsl(var(--warning))] animate-pulse" />
                      <span className="text-[10px] font-semibold text-[hsl(var(--warning))] uppercase tracking-wide">Limping Home</span>
                    </div>
                    <div className="text-[9px] text-[hsl(var(--warning))]/70 mt-[var(--spacing-1)]">
                      Low fuel, slowly returning to base...
                    </div>
                  </div>
                )}

                {/* Exhausted indicator - needs repair */}
                {hoveredAgent.state === 'exhausted' && (
                  <div className="mb-[var(--spacing-2-5)] px-[var(--spacing-2-5)] py-[var(--spacing-2)] rounded-lg bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/30">
                    <div className="flex items-center gap-[var(--spacing-2)]">
                      <span className="w-[var(--spacing-2)] h-[var(--spacing-2)] rounded-full bg-[hsl(var(--destructive))]" />
                      <span className="text-[10px] font-semibold text-[hsl(var(--destructive))] uppercase tracking-wide">Exhausted</span>
                    </div>
                    <div className="text-[9px] text-[hsl(var(--destructive))]/70 mt-[var(--spacing-1)]">
                      Out of fuel, requires repair to redeploy
                    </div>
                  </div>
                )}

                {/* Solve progress indicator */}
                {hoveredAgent.state === 'solving' && hoveredAgent.solveStartTime && (() => {
                  const solverTrait = hoveredAgent.traits.find(t => t.type === 'solver')
                  const solverLevel = solverTrait?.level ?? 0
                  const baseSolveTime = 15 * 1000
                  const adjustedSolveTime = baseSolveTime * (1 - solverLevel * 0.15)
                  const elapsed = Date.now() - hoveredAgent.solveStartTime
                  const progress = Math.min(1, elapsed / adjustedSolveTime)
                  const percent = Math.round(progress * 100)
                  const remaining = Math.max(0, Math.ceil((adjustedSolveTime - elapsed) / 1000))
                  return (
                    <div className="mb-[var(--spacing-2-5)] px-[var(--spacing-2-5)] py-[var(--spacing-2)] rounded-lg bg-[hsl(var(--state-solving))]/10 border border-[hsl(var(--state-solving))]/30">
                      <div className="flex items-center justify-between mb-[var(--spacing-1-5)]">
                        <span className="text-[10px] font-semibold text-[hsl(var(--state-solving))] uppercase tracking-wide">Solving</span>
                        <span className="text-[10px] font-medium text-[hsl(var(--state-solving))]">{percent}%</span>
                      </div>
                      <div className="h-[var(--spacing-1-5)] rounded-full bg-[var(--background-primary)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--state-solving))] to-[hsl(var(--success))] transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="mt-[var(--spacing-1-5)] text-[9px] text-[var(--text-muted)] text-center">
                        ~{remaining}s remaining
                      </div>
                    </div>
                  )
                })()}

                {/* Idle indicator - ready to deploy */}
                {hoveredAgent.state === 'idle' && (
                  <div className="mb-[var(--spacing-2-5)] px-[var(--spacing-2-5)] py-[var(--spacing-2)] rounded-lg bg-[hsl(var(--muted))]/10 border border-[hsl(var(--muted))]/30">
                    <div className="flex items-center gap-[var(--spacing-2)]">
                      <span className="w-[var(--spacing-2)] h-[var(--spacing-2)] rounded-full bg-[hsl(var(--muted-foreground))]" />
                      <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                        {hoveredAgent.pointsBalance > 0 ? 'Ready to Deploy' : 'Out of Fuel'}
                      </span>
                    </div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))]/70 mt-[var(--spacing-1)]">
                      {hoveredAgent.pointsBalance > 0
                        ? 'Click a space cluster to send this agent'
                        : 'Refuel this agent to continue exploring'
                      }
                    </div>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-x-[var(--spacing-4)] gap-y-[var(--spacing-1-5)] text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Fuel</span>
                    <span className={`font-medium ${hoveredAgent.pointsBalance < 200 ? 'text-[hsl(var(--destructive))]' : 'text-[var(--brand-teal-1)]'}`}>
                      {Math.round(hoveredAgent.pointsBalance)} pts
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Discovered</span>
                    <span className="font-medium text-[hsl(var(--state-solving))]">{hoveredAgent.spacesDiscovered}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Efficiency</span>
                    <span className={`font-medium ${efficiencyColor}`}>{efficiency}x</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Burn Rate</span>
                    <span className={`font-medium ${burnRateColor}`}>{effectiveBurnRate.toFixed(1)}/s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Distance</span>
                    <span className="font-medium text-[hsl(var(--chart-4))]">{hoveredAgent.distanceTraveled.toFixed(1)} u</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Find Rate</span>
                    <span className={`font-medium ${
                      hoveredAgent.distanceTraveled > 0
                        ? (hoveredAgent.spacesDiscovered / hoveredAgent.distanceTraveled >= 0.5 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning))]')
                        : 'text-[var(--text-muted)]'
                    }`}>
                      {hoveredAgent.distanceTraveled > 0
                        ? (hoveredAgent.spacesDiscovered / hoveredAgent.distanceTraveled).toFixed(2)
                        : '—'
                      }/u
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-between items-center pt-[var(--spacing-1)] border-t border-[var(--card-border)]/30">
                    <span className="text-[var(--text-tertiary)]">Total Loot</span>
                    <span className="font-medium text-[var(--brand-teal-1)]">{hoveredAgent.totalLoot.toLocaleString()} AGI</span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <QuickActionButtons agent={hoveredAgent} />
              </div>
            </div>
          </Html>
        )
      })()}
    </group>
  )
}
