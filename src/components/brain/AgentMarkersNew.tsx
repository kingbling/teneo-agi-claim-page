import { useRef, useMemo, useCallback, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Agent, AgentCluster, AgentState } from '@/types/agent'
import { BRAIN_SCALE } from './core/brainConstants'
import { useScaledTime } from './core/useBrainTime'

interface AgentMarkersProps {
  userAgents: Agent[]
  agentClusters?: AgentCluster[]
  onAgentClick?: (agent: Agent) => void
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

// Generate unique color for agent based on ID and state
function getAgentColor(agentId: string, state: AgentState): [number, number, number] {
  const hue = hashString(agentId) % 360

  const stateModifiers: Record<AgentState, { s: number; l: number }> = {
    idle: { s: 0.4, l: 0.45 },
    solving: { s: 0.95, l: 0.60 },
    deploying: { s: 0.85, l: 0.55 },
    wandering: { s: 0.80, l: 0.55 },
    limping_home: { s: 0.65, l: 0.50 },
    exhausted: { s: 0.25, l: 0.35 },
  }

  const mod = stateModifiers[state] || { s: 0.5, l: 0.5 }
  return hslToRgb(hue, mod.s, mod.l)
}

// Vertex shader for agent markers
const AGENT_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;

  uniform float uTime;

  varying vec3 vColor;
  varying float vState;

  void main() {
    vColor = aColor;
    vState = aState;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Pulse effect for active agents
    float pulse = 1.0;
    if (aState > 0.5 && aState < 3.5) {
      // Solving/deploying/wandering - pulse
      pulse = 1.0 + sin(uTime * 3.0 + position.x * 10.0) * 0.2;
    }

    gl_PointSize = aSize * pulse;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for agent markers
const AGENT_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vState;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular glow
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

    // Brighter core for active states
    if (vState > 0.5) {
      alpha *= 1.2;
    }

    gl_FragColor = vec4(vColor, alpha * 0.9);
  }
`

export function AgentMarkersNew({ userAgents, agentClusters: _agentClusters = [], onAgentClick }: AgentMarkersProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { camera, raycaster, pointer } = useThree()

  // Filter to only active agents (not idle)
  const activeAgents = useMemo(() => {
    return userAgents.filter(a => a.state !== 'idle')
  }, [userAgents])

  // Build geometry data for active agents
  const { positions, colors, sizes, states, agentPositions } = useMemo(() => {
    const count = activeAgents.length
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const states = new Float32Array(count)
    const agentPositions: THREE.Vector3[] = []

    activeAgents.forEach((agent, i) => {
      const x = agent.positionX * BRAIN_SCALE.x
      const y = agent.positionY * BRAIN_SCALE.y
      const z = agent.positionZ * BRAIN_SCALE.z

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      agentPositions.push(new THREE.Vector3(x, y, z))

      // Get color based on agent ID and state
      const color = getAgentColor(agent.id, agent.state)
      colors[i * 3] = color[0]
      colors[i * 3 + 1] = color[1]
      colors[i * 3 + 2] = color[2]

      // Size based on state
      const baseSize = 12.0
      sizes[i] = agent.state === 'solving' ? baseSize * 1.5 : baseSize

      // State encoding: 0=idle, 1=solving, 2=deploying, 3=wandering, 4=limping, 5=exhausted
      const stateMap: Record<AgentState, number> = {
        idle: 0, solving: 1, deploying: 2, wandering: 3, limping_home: 4, exhausted: 5
      }
      states[i] = stateMap[agent.state] || 0
    })

    return { positions, colors, sizes, states, agentPositions }
  }, [activeAgents])

  // Time for animations
  const scaledTime = useScaledTime()

  // Update shader uniforms
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = scaledTime
    }
  })

  // Raycasting for hover detection
  const findClosestAgent = useCallback(() => {
    if (activeAgents.length === 0) return null

    const threshold = 0.15
    raycaster.setFromCamera(pointer, camera)

    let closestIndex: number | null = null
    let closestDist = threshold

    agentPositions.forEach((pos, i) => {
      const dist = raycaster.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    return closestIndex
  }, [raycaster, pointer, camera, agentPositions, activeAgents.length])

  // Hover detection
  useFrame(() => {
    const closestIndex = findClosestAgent()
    if (closestIndex !== hoveredIndex) {
      setHoveredIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'
    }
  })

  // Click handler
  const handleClick = useCallback(() => {
    const closestIndex = findClosestAgent()
    if (closestIndex !== null && onAgentClick) {
      onAgentClick(activeAgents[closestIndex])
    }
  }, [findClosestAgent, activeAgents, onAgentClick])

  // Get hovered agent for tooltip
  const hoveredAgent = hoveredIndex !== null ? activeAgents[hoveredIndex] : null
  const hoveredPosition = hoveredIndex !== null ? agentPositions[hoveredIndex] : null

  if (activeAgents.length === 0) return null

  return (
    <group>
      <points ref={pointsRef} frustumCulled={false} onClick={handleClick}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-aState" args={[states, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={AGENT_VERTEX_SHADER}
          fragmentShader={AGENT_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Agent tooltip */}
      {hoveredAgent && hoveredPosition && (
        <Html position={hoveredPosition} center style={{ pointerEvents: 'none' }}>
          <div className="bg-[var(--card-bg)]/95 backdrop-blur-sm border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium text-[var(--text-primary)]">
              {hoveredAgent.name}
            </div>
            <div className="text-[var(--text-secondary)] capitalize">
              {hoveredAgent.state.replace('_', ' ')}
            </div>
            <div className="text-cyan-400">
              {hoveredAgent.pointsBalance} fuel
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
