import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Agent } from '@/types/agent'
import { BRAIN_SCALE } from './core/brainConstants'
import { useScaledTime } from './core/useBrainTime'

interface BurnParticlesProps {
  userAgents: Agent[]
}

// Vertex shader for burn particles
const BURN_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aLife;
  attribute vec3 aVelocity;

  uniform float uTime;

  varying float vLife;

  void main() {
    vLife = aLife;

    // Animate position upward with velocity
    vec3 pos = position + aVelocity * mod(uTime + aLife * 10.0, 2.0);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Size based on life (fade out as it rises)
    float lifeFactor = 1.0 - mod(uTime * 0.5 + aLife, 1.0);
    gl_PointSize = aSize * lifeFactor * (300.0 / -mvPosition.z);

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for burn particles
const BURN_FRAGMENT_SHADER = `
  varying float vLife;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular falloff
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

    // Fire colors: yellow core -> orange -> red edges
    float lifeCycle = mod(vLife * 3.0, 1.0);
    vec3 color;
    if (lifeCycle < 0.3) {
      // Yellow-white core
      color = vec3(1.0, 0.95, 0.7);
    } else if (lifeCycle < 0.6) {
      // Orange
      color = vec3(1.0, 0.6, 0.2);
    } else {
      // Red-orange
      color = vec3(1.0, 0.3, 0.1);
    }

    // Fade alpha based on distance from center
    alpha *= (1.0 - lifeCycle * 0.5);

    gl_FragColor = vec4(color, alpha * 0.8);
  }
`

const PARTICLES_PER_AGENT = 30

export function BurnParticlesNew({ userAgents }: BurnParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Filter to only solving/deploying agents (active burn effect)
  const activeAgents = useMemo(() => {
    return userAgents.filter(a => a.state === 'solving' || a.state === 'deploying')
  }, [userAgents])

  // Build geometry data for burn particles around active agents
  const { positions, sizes, lives, velocities } = useMemo(() => {
    const count = activeAgents.length * PARTICLES_PER_AGENT
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const lives = new Float32Array(count)
    const velocities = new Float32Array(count * 3)

    activeAgents.forEach((agent, agentIndex) => {
      const baseX = agent.positionX * BRAIN_SCALE.x
      const baseY = agent.positionY * BRAIN_SCALE.y
      const baseZ = agent.positionZ * BRAIN_SCALE.z

      for (let p = 0; p < PARTICLES_PER_AGENT; p++) {
        const i = agentIndex * PARTICLES_PER_AGENT + p

        // Random offset around agent position
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * 0.08
        positions[i * 3] = baseX + Math.cos(angle) * radius
        positions[i * 3 + 1] = baseY + (Math.random() - 0.5) * 0.05
        positions[i * 3 + 2] = baseZ + Math.sin(angle) * radius

        // Size variation
        sizes[i] = 3.0 + Math.random() * 4.0

        // Random life offset for staggered animation
        lives[i] = Math.random()

        // Upward velocity with slight horizontal drift
        velocities[i * 3] = (Math.random() - 0.5) * 0.02
        velocities[i * 3 + 1] = 0.05 + Math.random() * 0.1 // Upward
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02
      }
    })

    return { positions, sizes, lives, velocities }
  }, [activeAgents])

  // Time for animations
  const scaledTime = useScaledTime()

  // Update shader uniforms
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = scaledTime
    }
  })

  if (activeAgents.length === 0) return null

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aLife" args={[lives, 1]} />
        <bufferAttribute attach="attributes-aVelocity" args={[velocities, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={BURN_VERTEX_SHADER}
        fragmentShader={BURN_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
