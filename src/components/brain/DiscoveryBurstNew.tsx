import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpaceDiscoveryEvent } from '@/types/agent'
import { BRAIN_SCALE, LOOT_THRESHOLDS } from '@/constants'
import { useScaledTime } from './core/useBrainTime'

interface DiscoveryBurstProps {
  recentDiscoveries: SpaceDiscoveryEvent[]
}

interface Burst {
  id: string
  position: THREE.Vector3
  startTime: number
  duration: number
  intensity: number // Based on loot amount
}

// Vertex shader for burst particles
const BURST_VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aVelocity;
  attribute float aLife;

  uniform float uTime;
  uniform float uStartTime;
  uniform float uDuration;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float elapsed = uTime - uStartTime;
    float progress = clamp(elapsed / uDuration, 0.0, 1.0);

    // Animate outward with gravity and drag
    vec3 pos = position + aVelocity * elapsed * (1.0 - progress * 0.5);
    pos.y -= elapsed * elapsed * 0.1; // Gravity

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Fade out over time
    vAlpha = 1.0 - progress;

    // Gold to orange gradient based on life
    vColor = mix(
      vec3(1.0, 0.84, 0.0), // Gold
      vec3(1.0, 0.5, 0.1),  // Orange
      aLife
    );

    // Size shrinks as it fades
    gl_PointSize = aSize * vAlpha * (250.0 / -mvPosition.z);

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for burst particles
const BURST_FRAGMENT_SHADER = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular falloff
    float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * vAlpha;

    // Add sparkle at core
    float sparkle = (1.0 - dist * 2.0);
    vec3 color = mix(vColor, vec3(1.0), max(0.0, sparkle * 0.5));

    gl_FragColor = vec4(color, alpha * 0.9);
  }
`

const PARTICLES_PER_BURST = 50

export function DiscoveryBurstNew({ recentDiscoveries }: DiscoveryBurstProps) {
  const [activeBursts, setActiveBursts] = useState<Burst[]>([])
  const processedIds = useRef(new Set<string>())

  // Create new bursts for significant discoveries
  useEffect(() => {
    if (recentDiscoveries.length === 0) return

    const latestDiscovery = recentDiscoveries[0]
    if (processedIds.current.has(latestDiscovery.spaceId)) return

    processedIds.current.add(latestDiscovery.spaceId)

    // Only keep last 50 processed IDs
    if (processedIds.current.size > 50) {
      const ids = Array.from(processedIds.current)
      processedIds.current = new Set(ids.slice(-25))
    }

    // Calculate loot amount for intensity
    const lootAmount = latestDiscovery.lootDistribution.reduce((s, d) => s + d.amount, 0)

    // Only burst for significant discoveries
    if (lootAmount < LOOT_THRESHOLDS.MIN_NOTIFY) return

    if (latestDiscovery.positionX !== undefined) {
      const position = new THREE.Vector3(
        latestDiscovery.positionX * BRAIN_SCALE.x,
        latestDiscovery.positionY * BRAIN_SCALE.y,
        latestDiscovery.positionZ * BRAIN_SCALE.z
      )

      // Intensity based on synapse reward tier
      const intensity = lootAmount >= LOOT_THRESHOLDS.UNIQUE ? 3.0 :
                       lootAmount >= LOOT_THRESHOLDS.LEGENDARY ? 2.0 :
                       lootAmount >= LOOT_THRESHOLDS.DEEP ? 1.5 : 1.0

      const newBurst: Burst = {
        id: latestDiscovery.spaceId,
        position,
        startTime: Date.now() / 1000,
        duration: 1.5 + intensity * 0.5,
        intensity,
      }

      setActiveBursts(prev => [...prev.slice(-4), newBurst])
    }
  }, [recentDiscoveries])

  // Remove expired bursts
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() / 1000
      setActiveBursts(prev => prev.filter(b => now - b.startTime < b.duration))
    }, 200)
    return () => clearInterval(interval)
  }, [])

  if (activeBursts.length === 0) return null

  return (
    <group>
      {activeBursts.map(burst => (
        <BurstParticles key={burst.id} burst={burst} />
      ))}
    </group>
  )
}

// Individual burst particle system
function BurstParticles({ burst }: { burst: Burst }) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const { positions, sizes, velocities, lives } = useMemo(() => {
    const count = Math.floor(PARTICLES_PER_BURST * burst.intensity)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const velocities = new Float32Array(count * 3)
    const lives = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Start at burst position
      positions[i * 3] = burst.position.x
      positions[i * 3 + 1] = burst.position.y
      positions[i * 3 + 2] = burst.position.z

      // Random outward velocity
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const speed = 0.3 + Math.random() * 0.5 * burst.intensity

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
      velocities[i * 3 + 1] = Math.cos(phi) * speed + 0.2 // Bias upward
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed

      sizes[i] = 5.0 + Math.random() * 8.0 * burst.intensity
      lives[i] = Math.random()
    }

    return { positions, sizes, velocities, lives }
  }, [burst])

  const scaledTime = useScaledTime()

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = scaledTime
    }
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aVelocity" args={[velocities, 3]} />
        <bufferAttribute attach="attributes-aLife" args={[lives, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uStartTime: { value: burst.startTime },
          uDuration: { value: burst.duration },
        }}
        vertexShader={BURST_VERTEX_SHADER}
        fragmentShader={BURST_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
