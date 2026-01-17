import { onMount, onCleanup, createEffect, createMemo, createSignal, For } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { SynapseDiscoveryEvent } from '@/stores/shipStore'
import { BRAIN_SCALE, LOOT_THRESHOLDS, constrainToBrainShape } from '@/constants'
import { TRANCE_CONFIG } from './core/brainConstants'

interface DiscoveryBurstProps {
  recentDiscoveries: SynapseDiscoveryEvent[]
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

    // Size shrinks as it fades (with protective clamping for close camera)
    float distScale = 250.0 / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aSize * vAlpha * distScale, 2.0, 64.0);

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

    gl_FragColor = vec4(color, alpha * 0.6);
  }
`

const PARTICLES_PER_BURST = 50

export function DiscoveryBurst(props: DiscoveryBurstProps) {
  const { scene } = useThree()

  // Active bursts signal
  const [activeBursts, setActiveBursts] = createSignal<Burst[]>([])

  // Track processed discoveries to avoid duplicates
  let processedIds = new Set<string>()

  // Time tracking for scaled time (trance mode)
  let scaledTime = 0
  let lastRealTime = 0

  // Create new bursts for significant discoveries
  createEffect(() => {
    const recentDiscoveries = props.recentDiscoveries
    if (recentDiscoveries.length === 0) return

    const latestDiscovery = recentDiscoveries[0]
    if (processedIds.has(latestDiscovery.synapseId)) return

    processedIds.add(latestDiscovery.synapseId)

    // Only keep last 50 processed IDs
    if (processedIds.size > 50) {
      const ids = Array.from(processedIds)
      processedIds = new Set(ids.slice(-25))
    }

    // Use AGI reward for intensity calculation
    const agiReward = latestDiscovery.agiReward ?? 0

    // Only burst for significant discoveries
    if (agiReward < LOOT_THRESHOLDS.MIN_NOTIFY) return

    if (latestDiscovery.positionX !== undefined) {
      // Use same coordinate transformation as synapses for visual consistency
      const [x, y, z] = constrainToBrainShape(
        latestDiscovery.positionX,
        latestDiscovery.positionY,
        latestDiscovery.positionZ
      )
      const position = new THREE.Vector3(x, y, z)

      // Intensity based on synapse reward tier
      const intensity = agiReward >= LOOT_THRESHOLDS.UNIQUE ? 3.0 :
                       agiReward >= LOOT_THRESHOLDS.LEGENDARY ? 2.0 :
                       agiReward >= LOOT_THRESHOLDS.DEEP ? 1.5 : 1.0

      const newBurst: Burst = {
        id: latestDiscovery.synapseId,
        position,
        startTime: Date.now() / 1000,
        duration: 1.5 + intensity * 0.5,
        intensity,
      }

      setActiveBursts(prev => [...prev.slice(-4), newBurst])
    }
  })

  onMount(() => {
    // Remove expired bursts periodically - only filter when bursts exist
    const interval = setInterval(() => {
      const current = activeBursts()
      if (current.length === 0) return // Skip if no bursts to clean

      const now = Date.now() / 1000
      const remaining = current.filter(b => now - b.startTime < b.duration)
      // Only update if something was removed
      if (remaining.length !== current.length) {
        setActiveBursts(remaining)
      }
    }, 500) // Reduced from 200ms

    onCleanup(() => {
      clearInterval(interval)
    })
  })

  // Render individual burst particle systems
  return (
    <For each={activeBursts()}>
      {(burst) => <BurstParticles burst={burst} />}
    </For>
  )
}

// Individual burst particle system
function BurstParticles(props: { burst: Burst }) {
  const { scene } = useThree()

  // Three.js objects (imperative)
  let points: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null

  // Time tracking for scaled time (trance mode)
  let scaledTime = 0
  let lastRealTime = 0

  // Build geometry data for this burst
  const geometryData = createMemo(() => {
    const burst = props.burst
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
  })

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) {
      console.warn('BurstParticles: Scene not available')
      return
    }

    const data = geometryData()

    // Create geometry
    geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(data.velocities, 3))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(data.lives, 1))

    // Create shader material
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uStartTime: { value: props.burst.startTime },
        uDuration: { value: props.burst.duration },
      },
      vertexShader: BURST_VERTEX_SHADER,
      fragmentShader: BURST_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Create points
    points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    sceneObj.add(points)

    onCleanup(() => {
      if (points && sceneObj) {
        sceneObj.remove(points)
      }
      geometry?.dispose()
      material?.dispose()
    })
  })

  // Update shader uniforms with scaled time
  useFrame(({ clock }) => {
    // Update scaled time (trance mode deprecated - always normal scale)
    const timeScale = TRANCE_CONFIG.normalScale

    const realTime = clock.getElapsedTime()
    const delta = realTime - lastRealTime
    lastRealTime = realTime
    scaledTime += delta * timeScale

    if (material) {
      material.uniforms.uTime.value = scaledTime
    }
  })

  return null
}
