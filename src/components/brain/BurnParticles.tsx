import { onMount, onCleanup, createEffect, createMemo } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { Ship } from '@/stores/shipStore'
import { log } from '@/utils/logger'
import { glslDistanceScale, glslClampPointSize, glslSoftCircle } from './shaders/common'

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
    ${glslDistanceScale(300)}
    ${glslClampPointSize('aSize * lifeFactor * distScale', 2, 48)}

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for burn particles
const BURN_FRAGMENT_SHADER = `
  varying float vLife;

  void main() {
    ${glslSoftCircle(0.2, 0.5)}
    float alpha = circleAlpha;

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
const MAX_BURN_SHIPS = 50
const MAX_BURN_PARTICLES = MAX_BURN_SHIPS * PARTICLES_PER_AGENT

export function BurnParticles(props: BurnParticlesProps) {
  const { scene } = useThree()

  // Three.js objects (imperative)
  let points: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null

  // Pre-allocated buffers
  const preAllocPositions = new Float32Array(MAX_BURN_PARTICLES * 3)
  const preAllocSizes = new Float32Array(MAX_BURN_PARTICLES)
  const preAllocLives = new Float32Array(MAX_BURN_PARTICLES)
  const preAllocVelocities = new Float32Array(MAX_BURN_PARTICLES * 3)
  let buffersInitialized = false

  // Filter to only solving/traveling agents (active burn effect)
  const activeShips = createMemo(() => {
    return props.userAgents.filter(a => a.state === 'solving' || a.state === 'traveling')
  })

  // Build geometry data for burn particles around active agents
  // Writes into pre-allocated buffers and returns the active count
  const geometryData = createMemo(() => {
    const agents = activeShips()
    const agentCount = Math.min(agents.length, MAX_BURN_SHIPS)
    const count = agentCount * PARTICLES_PER_AGENT

    if (count === 0) return null

    for (let a = 0; a < agentCount; a++) {
      const agent = agents[a]
      const baseX = agent.positionX
      const baseY = agent.positionY
      const baseZ = agent.positionZ

      for (let p = 0; p < PARTICLES_PER_AGENT; p++) {
        const i = a * PARTICLES_PER_AGENT + p

        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * 0.08
        preAllocPositions[i * 3] = baseX + Math.cos(angle) * radius
        preAllocPositions[i * 3 + 1] = baseY + (Math.random() - 0.5) * 0.05
        preAllocPositions[i * 3 + 2] = baseZ + Math.sin(angle) * radius

        preAllocSizes[i] = 3.0 + Math.random() * 4.0
        preAllocLives[i] = Math.random()

        preAllocVelocities[i * 3] = (Math.random() - 0.5) * 0.02
        preAllocVelocities[i * 3 + 1] = 0.05 + Math.random() * 0.1
        preAllocVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02
      }
    }

    return { count }
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

  // Update geometry when active agents change — uses pre-allocated buffers with setDrawRange
  createEffect(() => {
    const data = geometryData()
    if (!geometry) return

    if (!buffersInitialized) {
      const posAttr = new THREE.BufferAttribute(preAllocPositions, 3)
      posAttr.setUsage(THREE.DynamicDrawUsage)
      geometry.setAttribute('position', posAttr)

      const sizeAttr = new THREE.BufferAttribute(preAllocSizes, 1)
      sizeAttr.setUsage(THREE.DynamicDrawUsage)
      geometry.setAttribute('aSize', sizeAttr)

      const lifeAttr = new THREE.BufferAttribute(preAllocLives, 1)
      lifeAttr.setUsage(THREE.DynamicDrawUsage)
      geometry.setAttribute('aLife', lifeAttr)

      const velAttr = new THREE.BufferAttribute(preAllocVelocities, 3)
      velAttr.setUsage(THREE.DynamicDrawUsage)
      geometry.setAttribute('aVelocity', velAttr)

      buffersInitialized = true
    }

    if (!data) {
      geometry.setDrawRange(0, 0)
      return
    }

    geometry.setDrawRange(0, data.count)
    ;(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('aVelocity') as THREE.BufferAttribute).needsUpdate = true
  })

  // Update shader uniforms
  useFrame(({ clock }) => {
    if (material) {
      material.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return null
}
