import { useRef, useMemo, useCallback, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BRAIN_SCALE } from './core/brainConstants'
import { useScaledTime } from './core/useBrainTime'

// Ship states (replacing agent states)
export type ShipState = 'idle' | 'exploring' | 'deploying' | 'returning'

// Ship interface for Masterplan 2026
export interface Ship {
  id: string
  ownerId: string
  name: string
  state: ShipState

  // Current position
  positionX: number
  positionY: number
  positionZ: number

  // Target synapse position (when exploring)
  targetX: number | null
  targetY: number | null
  targetZ: number | null

  // Current synapse being explored
  currentSynapseId: string | null
  exploreStartTime: number | null

  // Autopilot - ships don't have fuel, they have autopilot
  autopilotEnabled: boolean
  autopilotTargetType: 'minor' | 'complex' | 'deep' | 'core' | 'rare' | 'legendary' | 'unique' | null

  // Stats
  synapsesExplored: number
  totalAgiEarned: number
  totalXpEarned: number

  // Timestamps
  createdAt: number
  deployedAt: number | null
}

// Ship cluster for LOD visualization
export interface ShipCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  shipCount: number
  dominantState: ShipState
  avgProgress: number
  updatedAt: number
}

interface ShipMarkersProps {
  userShips: Ship[]
  shipClusters?: ShipCluster[]
  onShipClick?: (ship: Ship) => void
}

// Hash string for consistent color generation
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// HSL to RGB conversion
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

// Generate unique color for ship based on ID and state
function getShipColor(shipId: string, state: ShipState): [number, number, number] {
  const hue = hashString(shipId) % 360

  // Ship state color modifiers
  const stateModifiers: Record<ShipState, { s: number; l: number }> = {
    idle: { s: 0.4, l: 0.45 },
    exploring: { s: 0.95, l: 0.60 },    // Bright when actively exploring
    deploying: { s: 0.85, l: 0.55 },    // Traveling to synapse
    returning: { s: 0.65, l: 0.50 },    // Heading back
  }

  const mod = stateModifiers[state] || { s: 0.5, l: 0.5 }
  return hslToRgb(hue, mod.s, mod.l)
}

// Vertex shader for ship markers
const SHIP_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;
  attribute float aAutopilot;

  uniform float uTime;

  varying vec3 vColor;
  varying float vState;
  varying float vAutopilot;

  void main() {
    vColor = aColor;
    vState = aState;
    vAutopilot = aAutopilot;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Pulse effect for active ships
    float pulse = 1.0;
    if (aState > 0.5 && aState < 2.5) {
      // Exploring/deploying - pulse
      pulse = 1.0 + sin(uTime * 3.0 + position.x * 10.0) * 0.2;
    }

    // Extra glow for autopilot ships
    if (aAutopilot > 0.5) {
      pulse *= 1.0 + sin(uTime * 5.0) * 0.1;
    }

    gl_PointSize = aSize * pulse;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for ship markers
const SHIP_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vState;
  varying float vAutopilot;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular glow
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

    // Brighter core for active states
    if (vState > 0.5) {
      alpha *= 1.2;
    }

    // Slight ring effect for autopilot
    if (vAutopilot > 0.5) {
      float ringDist = abs(dist - 0.35);
      if (ringDist < 0.05) {
        alpha += 0.3 * (1.0 - ringDist / 0.05);
      }
    }

    gl_FragColor = vec4(vColor, alpha * 0.9);
  }
`

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ShipMarkersNew({ userShips, shipClusters: _shipClusters = [], onShipClick }: ShipMarkersProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { camera, raycaster, pointer } = useThree()

  // Filter to only active ships (not idle)
  const activeShips = useMemo(() => {
    return userShips.filter(s => s.state !== 'idle')
  }, [userShips])

  // Build geometry data for active ships
  const { positions, colors, sizes, states, autopilots, shipPositions } = useMemo(() => {
    const count = activeShips.length
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const states = new Float32Array(count)
    const autopilots = new Float32Array(count)
    const shipPositions: THREE.Vector3[] = []

    activeShips.forEach((ship, i) => {
      const x = ship.positionX * BRAIN_SCALE.x
      const y = ship.positionY * BRAIN_SCALE.y
      const z = ship.positionZ * BRAIN_SCALE.z

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      shipPositions.push(new THREE.Vector3(x, y, z))

      // Get color based on ship ID and state
      const color = getShipColor(ship.id, ship.state)
      colors[i * 3] = color[0]
      colors[i * 3 + 1] = color[1]
      colors[i * 3 + 2] = color[2]

      // Size based on state
      const baseSize = 12.0
      sizes[i] = ship.state === 'exploring' ? baseSize * 1.5 : baseSize

      // State encoding: 0=idle, 1=exploring, 2=deploying, 3=returning
      const stateMap: Record<ShipState, number> = {
        idle: 0, exploring: 1, deploying: 2, returning: 3
      }
      states[i] = stateMap[ship.state] || 0

      // Autopilot flag
      autopilots[i] = ship.autopilotEnabled ? 1.0 : 0.0
    })

    return { positions, colors, sizes, states, autopilots, shipPositions }
  }, [activeShips])

  // Time for animations
  const scaledTime = useScaledTime()

  // Update shader uniforms
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = scaledTime
    }
  })

  // Raycasting for hover detection
  const findClosestShip = useCallback(() => {
    if (activeShips.length === 0) return null

    const threshold = 0.15
    raycaster.setFromCamera(pointer, camera)

    let closestIndex: number | null = null
    let closestDist = threshold

    shipPositions.forEach((pos, i) => {
      const dist = raycaster.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    return closestIndex
  }, [raycaster, pointer, camera, shipPositions, activeShips.length])

  // Hover detection
  useFrame(() => {
    const closestIndex = findClosestShip()
    if (closestIndex !== hoveredIndex) {
      setHoveredIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'
    }
  })

  // Click handler
  const handleClick = useCallback(() => {
    const closestIndex = findClosestShip()
    if (closestIndex !== null && onShipClick) {
      onShipClick(activeShips[closestIndex])
    }
  }, [findClosestShip, activeShips, onShipClick])

  // Get hovered ship for tooltip
  const hoveredShip = hoveredIndex !== null ? activeShips[hoveredIndex] : null
  const hoveredPosition = hoveredIndex !== null ? shipPositions[hoveredIndex] : null

  if (activeShips.length === 0) return null

  return (
    <group>
      <points ref={pointsRef} frustumCulled={false} onClick={handleClick}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-aState" args={[states, 1]} />
          <bufferAttribute attach="attributes-aAutopilot" args={[autopilots, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={SHIP_VERTEX_SHADER}
          fragmentShader={SHIP_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Ship tooltip */}
      {hoveredShip && hoveredPosition && (
        <Html position={hoveredPosition} center style={{ pointerEvents: 'none' }}>
          <div className="bg-[var(--card-bg)]/95 backdrop-blur-sm border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium text-[var(--text-primary)]">
              {hoveredShip.name}
            </div>
            <div className="text-[var(--text-secondary)] capitalize">
              {hoveredShip.state}
            </div>
            {hoveredShip.autopilotEnabled && (
              <div className="text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Autopilot: {hoveredShip.autopilotTargetType || 'Any'}
              </div>
            )}
            <div className="text-cyan-400">
              {hoveredShip.synapsesExplored} explored
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// Re-export for backward compatibility
export { ShipMarkersNew as AgentMarkersNew }
