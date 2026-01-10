import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpaceDiscoveryEvent } from '@/types/agent'
import { useAgentStore } from '@/stores/agentStore'

interface DiscoveryBurstProps {
  recentDiscoveries: SpaceDiscoveryEvent[]
  opacity?: number
}

interface BurstEffect {
  id: string
  position: THREE.Vector3
  startTime: number
  color: THREE.Color
}

const BRAIN_SCALE = { x: 1.3, y: 1.0, z: 1.1 }
const BURST_DURATION = 2.0 // seconds
const PARTICLES_PER_BURST = 24

// Gold/yellow discovery colors
const DISCOVERY_COLORS = [
  new THREE.Color(1.0, 0.9, 0.3),  // Bright gold
  new THREE.Color(1.0, 0.7, 0.2),  // Deep gold
  new THREE.Color(1.0, 0.85, 0.5), // Light gold
]

// Deterministic pseudo-random
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function DiscoveryBurst({ recentDiscoveries, opacity = 1 }: DiscoveryBurstProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const [activeBursts, setActiveBursts] = useState<BurstEffect[]>([])
  const lastDiscoveryCountRef = useRef(0)

  // Track new discoveries and spawn bursts
  useEffect(() => {
    if (recentDiscoveries.length > lastDiscoveryCountRef.current) {
      // New discovery detected
      const newDiscovery = recentDiscoveries[0]
      if (newDiscovery.positionX !== undefined &&
          newDiscovery.positionY !== undefined &&
          newDiscovery.positionZ !== undefined) {

        const position = new THREE.Vector3(
          newDiscovery.positionX * BRAIN_SCALE.x,
          newDiscovery.positionY * BRAIN_SCALE.y,
          newDiscovery.positionZ * BRAIN_SCALE.z
        )

        const colorIndex = Math.abs(newDiscovery.spaceId.charCodeAt(0)) % DISCOVERY_COLORS.length

        setActiveBursts(prev => [
          ...prev.slice(-4), // Keep max 5 active bursts
          {
            id: newDiscovery.spaceId + Date.now(),
            position,
            startTime: -1, // Will be set on first frame
            color: DISCOVERY_COLORS[colorIndex]
          }
        ])
      }
    }
    lastDiscoveryCountRef.current = recentDiscoveries.length
  }, [recentDiscoveries.length])

  // Get timeScale for trance effect (server-authoritative)
  const userAgents = useAgentStore((state) => state.userAgents)
  const timeScale = userAgents.some(a => a.tranceActive) ? 0.05 : 1.0
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Generate particle data for all active bursts
  const particleData = useMemo(() => {
    const maxParticles = 5 * PARTICLES_PER_BURST // Max 5 bursts
    const positions = new Float32Array(maxParticles * 3)
    const velocities = new Float32Array(maxParticles * 3)
    const colors = new Float32Array(maxParticles * 3)
    const phases = new Float32Array(maxParticles)
    const burstIndices = new Float32Array(maxParticles)

    // Pre-generate random directions for particles
    for (let i = 0; i < maxParticles; i++) {
      const theta = seededRandom(i * 5 + 1) * Math.PI * 2
      const phi = Math.acos(2 * seededRandom(i * 5 + 2) - 1)
      const speed = 0.15 + seededRandom(i * 5 + 3) * 0.2

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed
      velocities[i * 3 + 2] = Math.cos(phi) * speed

      phases[i] = seededRandom(i * 5 + 4)
      burstIndices[i] = Math.floor(i / PARTICLES_PER_BURST)
    }

    return { positions, velocities, colors, phases, burstIndices, maxParticles }
  }, [])

  // Update burst particles each frame
  useFrame(({ clock }) => {
    if (!pointsRef.current || !materialRef.current) return

    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
    const time = scaledTimeRef.current

    const positionAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const colorAttr = pointsRef.current.geometry.attributes.aColor as THREE.BufferAttribute
    const posArray = positionAttr.array as Float32Array
    const colorArray = colorAttr.array as Float32Array

    // Initialize start times for new bursts
    activeBursts.forEach((burst) => {
      if (burst.startTime < 0) {
        burst.startTime = time
      }
    })

    // Update particles for each active burst
    for (let i = 0; i < particleData.maxParticles; i++) {
      const burstIdx = Math.floor(i / PARTICLES_PER_BURST)
      const burst = activeBursts[burstIdx]

      if (!burst) {
        // Hide unused particles
        posArray[i * 3] = 0
        posArray[i * 3 + 1] = -10 // Off screen
        posArray[i * 3 + 2] = 0
        continue
      }

      const elapsed = time - burst.startTime
      const progress = Math.min(1, elapsed / BURST_DURATION)

      if (progress >= 1) {
        // Burst finished
        posArray[i * 3] = 0
        posArray[i * 3 + 1] = -10
        posArray[i * 3 + 2] = 0
        continue
      }

      // Calculate particle position
      const easeOut = 1 - Math.pow(1 - progress, 2)
      posArray[i * 3] = burst.position.x + particleData.velocities[i * 3] * easeOut
      posArray[i * 3 + 1] = burst.position.y + particleData.velocities[i * 3 + 1] * easeOut
      posArray[i * 3 + 2] = burst.position.z + particleData.velocities[i * 3 + 2] * easeOut

      // Color fades to white then fades out
      const colorFade = 1 - progress
      colorArray[i * 3] = burst.color.r + (1 - burst.color.r) * (1 - colorFade)
      colorArray[i * 3 + 1] = burst.color.g + (1 - burst.color.g) * (1 - colorFade)
      colorArray[i * 3 + 2] = burst.color.b + (1 - burst.color.b) * (1 - colorFade)
    }

    positionAttr.needsUpdate = true
    colorAttr.needsUpdate = true

    // Clean up finished bursts
    const finishedBursts = activeBursts.filter(b => time - b.startTime >= BURST_DURATION)
    if (finishedBursts.length > 0) {
      setActiveBursts(prev => prev.filter(b => time - b.startTime < BURST_DURATION))
    }

    materialRef.current.uniforms.uTime.value = time
    materialRef.current.uniforms.uOpacity.value = opacity
  })

  const vertexShader = `
    attribute vec3 aColor;
    attribute float aPhase;

    uniform float uTime;
    uniform vec3 uCameraPosition;

    varying vec3 vColor;
    varying float vAlpha;
    varying float vDistScale;

    void main() {
      vColor = aColor;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float distToCamera = distance(position, uCameraPosition);

      // Match camera range (1.5 to 6.0) - allow scaling when zoomed in
      float distScale = smoothstep(6.0, 1.5, distToCamera);
      vDistScale = distScale;

      // Size based on distance with sparkle effect
      float sparkle = 0.5 + 0.5 * sin(uTime * 10.0 + aPhase * 20.0);
      float size = (10.0 + sparkle * 8.0) * max(0.15, vDistScale);

      gl_PointSize = size;
      gl_Position = projectionMatrix * mvPosition;

      // Alpha based on y position (hide if below threshold)
      vAlpha = position.y > -5.0 ? 1.0 : 0.0;
    }
  `

  const fragmentShader = `
    uniform float uOpacity;
    uniform float uTime;

    varying vec3 vColor;
    varying float vAlpha;
    varying float vDistScale;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      // Soft glow with bright core
      float core = smoothstep(0.2, 0.0, dist);
      float glow = smoothstep(0.5, 0.0, dist);

      vec3 color = vColor;
      color = mix(color, vec3(1.0), core * 0.8);

      // Add sparkle ring
      float ring = smoothstep(0.5, 0.35, dist) * smoothstep(0.25, 0.35, dist);
      color += ring * vec3(1.0, 0.95, 0.8) * 0.5;

      // Scale alpha with distance to prevent overexposure when zoomed in
      float alpha = glow * vAlpha * uOpacity * max(0.2, vDistScale);
      alpha = max(alpha, 0.02);  // Tiny minimum

      gl_FragColor = vec4(color, alpha);
    }
  `

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particleData.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aColor"
          args={[particleData.colors, 3]}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          args={[particleData.phases, 1]}
        />
        <bufferAttribute
          attach="attributes-aBurstIndex"
          args={[particleData.burstIndices, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: opacity },
          uCameraPosition: { value: new THREE.Vector3(0, 0, 5) },
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
