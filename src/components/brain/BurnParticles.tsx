import { onMount, onCleanup, createEffect, createMemo } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { Ship } from '@/stores/shipStore'
import { constrainToBrainShape } from './core/brainConstants'
import { log } from '@/utils/logger'

interface BurnParticlesProps {
  userAgents: Ship[]
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

    // Size based on life (fade out as it rises, with protective clamping for close camera)
    float lifeFactor = 1.0 - mod(uTime * 0.5 + aLife, 1.0);
    float distScale = 300.0 / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aSize * lifeFactor * distScale, 2.0, 48.0);

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

    gl_FragColor = vec4(color, alpha * 0.5);
  }
`

const PARTICLES_PER_AGENT = 30

export function BurnParticles(props: BurnParticlesProps) {
  const { scene } = useThree()

  // Three.js objects (imperative)
  let points: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null


  // Filter to only solving/deploying agents (active burn effect)
  const activeShips = createMemo(() => {
    return props.userAgents.filter(a => a.state === 'solving' || a.state === 'deploying')
  })

  // Build geometry data for burn particles around active agents
  const geometryData = createMemo(() => {
    const agents = activeShips()
    const count = agents.length * PARTICLES_PER_AGENT

    if (count === 0) return null

    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const lives = new Float32Array(count)
    const velocities = new Float32Array(count * 3)

    agents.forEach((agent, agentIndex) => {
      // Use same coordinate transformation as synapses for visual consistency
      const [baseX, baseY, baseZ] = constrainToBrainShape(
        agent.positionX,
        agent.positionY,
        agent.positionZ
      )

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
  })

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) {
      log.brain.warn('BurnParticles: Scene not available')
      return
    }

    // Create geometry
    geometry = new THREE.BufferGeometry()

    // Create shader material
    material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: BURN_VERTEX_SHADER,
      fragmentShader: BURN_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Create points
    points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = 50  // Lower than ships (100) so ships render on top
    sceneObj.add(points)

    onCleanup(() => {
      if (points && sceneObj) {
        sceneObj.remove(points)
      }
      geometry?.dispose()
      material?.dispose()
    })
  })

  // Update geometry when active agents change
  createEffect(() => {
    const data = geometryData()
    if (!geometry) return

    if (!data) {
      // No active agents - clear geometry
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
      geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(0), 1))
      geometry.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(0), 1))
      geometry.setAttribute('aVelocity', new THREE.BufferAttribute(new Float32Array(0), 3))
      return
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(data.lives, 1))
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(data.velocities, 3))
  })

  // Update shader uniforms
  useFrame(({ clock }) => {
    if (material) {
      material.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return null
}
