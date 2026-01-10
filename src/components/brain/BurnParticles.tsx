import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Agent } from '@/types/agent'
import { useAgentStore } from '@/stores/agentStore'

interface BurnParticlesProps {
  agents: Agent[]
  maxParticlesPerAgent?: number
}

// Deterministic pseudo-random based on seed (avoids lint issues with Math.random in useMemo)
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function BurnParticles({ agents = [], maxParticlesPerAgent = 5 }: BurnParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Filter to only active agents (burning points)
  const activeAgents = useMemo(() => {
    return agents.filter(a => a.state === 'deploying' || a.state === 'solving')
  }, [agents])

  const particleCount = activeAgents.length * maxParticlesPerAgent

  // Create particle data using deterministic random
  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)
    const lifetimes = new Float32Array(particleCount)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      // Use deterministic random based on particle index
      const r1 = seededRandom(i * 7 + 1)
      const r2 = seededRandom(i * 7 + 2)
      const r3 = seededRandom(i * 7 + 3)
      const r4 = seededRandom(i * 7 + 4)
      const r5 = seededRandom(i * 7 + 5)
      const r6 = seededRandom(i * 7 + 6)
      const r7 = seededRandom(i * 7 + 7)

      // Initial position offset
      positions[i * 3] = (r1 - 0.5) * 0.05
      positions[i * 3 + 1] = (r2 - 0.5) * 0.05
      positions[i * 3 + 2] = (r3 - 0.5) * 0.05

      // Upward velocity with spread
      velocities[i * 3] = (r4 - 0.5) * 0.02
      velocities[i * 3 + 1] = r5 * 0.03 + 0.01  // Upward
      velocities[i * 3 + 2] = (r6 - 0.5) * 0.02

      // Lifetime phase (0-1)
      lifetimes[i] = r7

      // Fire colors: orange to yellow
      const colorPhase = seededRandom(i * 7 + 8)
      colors[i * 3] = 1.0  // R
      colors[i * 3 + 1] = 0.4 + colorPhase * 0.5  // G
      colors[i * 3 + 2] = 0.1 * colorPhase  // B
    }

    return { positions, velocities, lifetimes, colors }
  }, [particleCount])

  // Get timeScale for trance effect (server-authoritative)
  const userAgents = useAgentStore((state) => state.userAgents)
  const timeScale = userAgents.some(a => a.tranceActive) ? 0.05 : 1.0
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Update particle positions based on agent positions
  useFrame(({ clock }) => {
    if (!pointsRef.current || !materialRef.current || activeAgents.length === 0) return

    // Calculate scaled time for trance slowdown
    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
    const time = scaledTimeRef.current
    const positionAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const posArray = positionAttr.array as Float32Array

    for (let i = 0; i < particleCount; i++) {
      const agentIdx = Math.floor(i / maxParticlesPerAgent)
      if (agentIdx >= activeAgents.length) continue

      const agent = activeAgents[agentIdx]

      // Particle lifecycle (loop every 2 seconds, staggered)
      const phase = ((time * 0.5 + lifetimes[i]) % 1)

      // Base position is agent position
      const baseX = agent.positionX * 1.35
      const baseY = agent.positionY * 1.0
      const baseZ = agent.positionZ * 1.15

      // Add velocity-based offset (particles rise and spread)
      const velX = velocities[i * 3] * phase * 3
      const velY = velocities[i * 3 + 1] * phase * 3
      const velZ = velocities[i * 3 + 2] * phase * 3

      posArray[i * 3] = baseX + velX + positions[i * 3]
      posArray[i * 3 + 1] = baseY + velY + positions[i * 3 + 1]
      posArray[i * 3 + 2] = baseZ + velZ + positions[i * 3 + 2]
    }

    positionAttr.needsUpdate = true
    materialRef.current.uniforms.uTime.value = time
  })

  if (activeAgents.length === 0) return null

  const vertexShader = `
    attribute vec3 aColor;
    attribute float aLifetime;

    uniform float uTime;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vColor = aColor;

      // Fade out as particle ages
      float phase = fract(uTime * 0.5 + aLifetime);
      vAlpha = 1.0 - phase;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

      // Size decreases as particle ages
      float size = mix(6.0, 2.0, phase);
      gl_PointSize = size;

      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const fragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      // Circular soft particle
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      float softness = 1.0 - smoothstep(0.2, 0.5, dist);
      float alpha = softness * vAlpha * 0.8;

      gl_FragColor = vec4(vColor, alpha);
    }
  `

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aColor"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-aLifetime"
          args={[lifetimes, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
