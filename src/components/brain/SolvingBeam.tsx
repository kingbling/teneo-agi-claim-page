/**
 * SolvingBeam - Visualizes the active exploration connection between a ship and a synapse
 *
 * Shows an animated energy beam connecting a ship to the synapse it's exploring.
 * Features:
 * - Dashed line with animated flow toward synapse (energy transfer visual)
 * - Pulsing intensity based on exploration activity
 * - Particle effects flowing along the beam path
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { Ship } from '@/stores/shipStore'
import { constrainToBrainShape } from './core/brainConstants'

interface SolvingBeamProps {
  ship: Ship
  synapsePosition: { x: number; y: number; z: number }
  isActive: boolean
}

const BEAM_PARTICLES = 20 // Particles flowing along the beam

export const SolvingBeam: Component<SolvingBeamProps> = (props) => {
  const { scene } = useThree()

  let beamGroup: THREE.Group | null = null
  let lineRef: THREE.Line | null = null
  let materialRef: THREE.LineDashedMaterial | null = null
  let geometryRef: THREE.BufferGeometry | null = null
  let particleSystemRef: THREE.Points | null = null
  let particleMaterialRef: THREE.ShaderMaterial | null = null
  let particleGeometryRef: THREE.BufferGeometry | null = null

  // Animation state
  const animState = {
    dashOffset: 0,
    time: 0,
    intensity: 0.7,
  }

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    beamGroup = new THREE.Group()

    // Create dashed line material with cyan/teal glow
    materialRef = new THREE.LineDashedMaterial({
      color: 0x00ffff,
      dashSize: 0.08,
      gapSize: 0.04,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false,
    })

    // Create geometry for the beam line
    geometryRef = new THREE.BufferGeometry()
    const positions = new Float32Array(6) // 2 points * 3 coordinates
    geometryRef.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Create line
    lineRef = new THREE.Line(geometryRef, materialRef)
    lineRef.frustumCulled = false
    lineRef.visible = false
    lineRef.renderOrder = 160
    beamGroup.add(lineRef)

    // Create particle system for flowing energy effect
    createParticleSystem()

    sceneObj.add(beamGroup)

    onCleanup(() => {
      if (beamGroup && sceneObj) {
        sceneObj.remove(beamGroup)
      }
      geometryRef?.dispose()
      materialRef?.dispose()
      particleGeometryRef?.dispose()
      particleMaterialRef?.dispose()
    })
  })

  function createParticleSystem() {
    if (!beamGroup) return

    // Particle positions (will be updated in animation)
    particleGeometryRef = new THREE.BufferGeometry()
    const positions = new Float32Array(BEAM_PARTICLES * 3)
    const lifetimes = new Float32Array(BEAM_PARTICLES)
    const speeds = new Float32Array(BEAM_PARTICLES)

    // Initialize particles with random lifetimes
    for (let i = 0; i < BEAM_PARTICLES; i++) {
      lifetimes[i] = Math.random()
      speeds[i] = 0.5 + Math.random() * 0.5
    }

    particleGeometryRef.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeometryRef.setAttribute('aLifetime', new THREE.BufferAttribute(lifetimes, 1))
    particleGeometryRef.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))

    // Shader material for particles
    particleMaterialRef = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.7 },
        uColor: { value: new THREE.Color(0x00ffff) },
      },
      vertexShader: `
        attribute float aLifetime;
        attribute float aSpeed;
        uniform float uTime;
        uniform float uIntensity;

        varying float vAlpha;

        void main() {
          // Calculate progress along beam (0 to 1)
          float progress = mod(aLifetime + uTime * aSpeed * 0.3, 1.0);
          vAlpha = sin(progress * 3.14159) * uIntensity;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Size based on intensity and distance
          gl_PointSize = (4.0 + uIntensity * 2.0) * (80.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 2.0, 12.0);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);

          // Soft circular glow
          float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;

          // Hot white core fading to color
          vec3 color = mix(vec3(1.0), uColor, dist * 2.0);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    particleSystemRef = new THREE.Points(particleGeometryRef, particleMaterialRef)
    particleSystemRef.frustumCulled = false
    particleSystemRef.visible = false
    particleSystemRef.renderOrder = 165
    beamGroup.add(particleSystemRef)
  }

  // Update beam when ship or synapse positions change
  createEffect(() => {
    if (!lineRef || !geometryRef || !particleGeometryRef) return

    const active = props.isActive
    const ship = props.ship
    const synapse = props.synapsePosition

    if (!active || !ship || !synapse || ship.state !== 'exploring') {
      if (lineRef) lineRef.visible = false
      if (particleSystemRef) particleSystemRef.visible = false
      return
    }

    // Get ship world position using constrainToBrainShape for consistency
    const [shipX, shipY, shipZ] = constrainToBrainShape(
      ship.positionX,
      ship.positionY,
      ship.positionZ
    )
    const [synapseX, synapseY, synapseZ] = constrainToBrainShape(
      synapse.x,
      synapse.y,
      synapse.z
    )

    // Update line positions
    const linePositions = geometryRef.getAttribute('position') as THREE.BufferAttribute
    linePositions.setXYZ(0, shipX, shipY, shipZ)
    linePositions.setXYZ(1, synapseX, synapseY, synapseZ)
    linePositions.needsUpdate = true

    // Compute line distances for dash rendering
    lineRef.computeLineDistances()
    lineRef.visible = true

    // Update particle positions along the beam
    const particlePositions = particleGeometryRef.getAttribute('position') as THREE.BufferAttribute
    const lifetimes = particleGeometryRef.getAttribute('aLifetime') as THREE.BufferAttribute

    for (let i = 0; i < BEAM_PARTICLES; i++) {
      // Distribute particles along beam based on their lifetime
      const t = lifetimes.getX(i)
      const x = shipX + (synapseX - shipX) * t
      const y = shipY + (synapseY - shipY) * t
      const z = shipZ + (synapseZ - shipZ) * t
      particlePositions.setXYZ(i, x, y, z)
    }
    particlePositions.needsUpdate = true

    if (particleSystemRef) {
      particleSystemRef.visible = true
    }
  })

  // Animate the beam
  useFrame(({ delta }) => {
    if (!lineRef?.visible) return

    animState.time += delta
    animState.dashOffset += delta * 0.6

    // Update dash animation
    if (materialRef) {
      materialRef.dashOffset = -animState.dashOffset // Negative for flowing toward synapse
      // Pulse opacity
      const pulse = 0.5 + Math.sin(animState.time * 3) * 0.2
      materialRef.opacity = pulse
    }

    // Update particle uniforms
    if (particleMaterialRef) {
      particleMaterialRef.uniforms.uTime.value = animState.time
      // Pulse intensity based on exploration activity
      const intensity = 0.6 + Math.sin(animState.time * 2.5) * 0.3
      particleMaterialRef.uniforms.uIntensity.value = intensity
    }

    // Update particle positions to create flowing effect
    if (particleGeometryRef && props.ship && props.synapsePosition) {
      const [shipX, shipY, shipZ] = constrainToBrainShape(
        props.ship.positionX,
        props.ship.positionY,
        props.ship.positionZ
      )
      const [synapseX, synapseY, synapseZ] = constrainToBrainShape(
        props.synapsePosition.x,
        props.synapsePosition.y,
        props.synapsePosition.z
      )

      const particlePositions = particleGeometryRef.getAttribute('position') as THREE.BufferAttribute
      const lifetimes = particleGeometryRef.getAttribute('aLifetime') as THREE.BufferAttribute
      const speeds = particleGeometryRef.getAttribute('aSpeed') as THREE.BufferAttribute

      for (let i = 0; i < BEAM_PARTICLES; i++) {
        // Animate particles flowing toward synapse
        const speed = speeds.getX(i)
        const t = (lifetimes.getX(i) + animState.time * speed * 0.3) % 1.0
        const x = shipX + (synapseX - shipX) * t
        const y = shipY + (synapseY - shipY) * t
        const z = shipZ + (synapseZ - shipZ) * t
        particlePositions.setXYZ(i, x, y, z)
      }
      particlePositions.needsUpdate = true
    }
  })

  return null
}

export default SolvingBeam
