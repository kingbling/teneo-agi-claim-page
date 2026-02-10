/**
 * SolvingBeam - Visualizes the active exploration connection between a ship and a synapse
 *
 * Shows an animated energy beam connecting a ship to the synapse it's solving.
 * Features:
 * - Dashed line with animated flow toward synapse (energy transfer visual)
 * - Pulsing intensity based on exploration activity
 * - Particle effects flowing along the beam path
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { Ship } from '@/stores/shipStore'
import { SYNAPSE_CONFIG, type SynapseType } from '@/types/game'
import { computeOrbitPosition } from '@/utils/orbitHelper'

interface SolvingBeamProps {
  ship: Ship
  synapsePosition: { x: number; y: number; z: number }
  isActive: boolean
  /** Optional synapse type - affects animation speed (longer solves = slower animation) */
  synapseType?: SynapseType
}

const BEAM_PARTICLES = 30 // Particles flowing along the beam

/**
 * Calculate animation speed multiplier based on synapse type.
 * Longer solving times = slower, more gradual animation.
 * Minor (60min) = fastest, Unique (30 days) = slowest
 */
function getAnimationSpeedMultiplier(synapseType: SynapseType | undefined): number {
  if (!synapseType) return 1.0 // Default speed for minor

  const config = SYNAPSE_CONFIG[synapseType]
  const etaMinutes = config.etaMinutes

  // Base reference: minor at 60 minutes = 1.0x speed
  // Scale inversely with sqrt of ETA ratio for perceptible but not extreme differences
  // minor (60): 1.0, complex (720): 0.29, deep (2880): 0.14, unique (43200): 0.037
  const baseEta = SYNAPSE_CONFIG.minor.etaMinutes // 60
  const ratio = baseEta / etaMinutes

  // Use sqrt to make the scaling more gradual
  // Clamp minimum to 0.1x to keep animation visible
  return Math.max(0.1, Math.sqrt(ratio))
}

// Volumetric beam vertex shader
const BEAM_MESH_VERTEX_SHADER = `
  varying vec2 vUv;
  varying float vDistance;

  void main() {
    vUv = uv;
    // Use Y coordinate for distance along beam (0 = ship end, 1 = synapse end)
    vDistance = uv.y;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Volumetric beam fragment shader
const BEAM_MESH_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uCoreColor;
  uniform vec3 uOuterColor;

  varying vec2 vUv;
  varying float vDistance;

  void main() {
    // Distance from center of beam (UV.x goes from 0-1 across width)
    float centerDist = abs(vUv.x - 0.5) * 2.0;

    // Core glow (bright white center)
    float core = 1.0 - smoothstep(0.0, 0.3, centerDist);

    // Outer glow (colored edges)
    float outer = 1.0 - smoothstep(0.2, 1.0, centerDist);

    // Animated energy flow toward synapse (vDistance = 0 at ship, 1 at synapse)
    float flowSpeed = 3.0;
    float flowScale = 8.0;
    float flow = sin((vDistance * flowScale - uTime * flowSpeed) * 3.14159 * 2.0) * 0.5 + 0.5;
    flow = smoothstep(0.3, 0.7, flow);

    // Pulsing intensity
    float pulse = 0.7 + 0.3 * sin(uTime * 2.5);

    // Combine colors: white core, colored outer
    vec3 coreColor = vec3(1.0, 1.0, 1.0);
    vec3 color = mix(uOuterColor, coreColor, core * 0.8);

    // Apply flow pattern and intensity
    float alpha = outer * (0.3 + flow * 0.4) * pulse * uIntensity;

    // Taper toward synapse (narrower at synapse end)
    float taper = 1.0 - vDistance * 0.3;
    alpha *= taper;

    // Soft edges
    alpha *= smoothstep(1.0, 0.7, centerDist);

    gl_FragColor = vec4(color, alpha * 0.6);
  }
`

export const SolvingBeam: Component<SolvingBeamProps> = (props) => {
  const { scene } = useThree()

  let beamGroup: THREE.Group | null = null
  let lineRef: THREE.Line | null = null
  let materialRef: THREE.LineDashedMaterial | null = null
  let geometryRef: THREE.BufferGeometry | null = null
  let particleSystemRef: THREE.Points | null = null
  let particleMaterialRef: THREE.ShaderMaterial | null = null
  let particleGeometryRef: THREE.BufferGeometry | null = null

  // Volumetric beam mesh
  let beamMeshRef: THREE.Mesh | null = null
  let beamMeshGeometryRef: THREE.CylinderGeometry | null = null
  let beamMeshMaterialRef: THREE.ShaderMaterial | null = null

  // Animation state
  const animState = {
    dashOffset: 0,
    time: 0,
    intensity: 0.7,
  }

  // Cached Vector3 objects to avoid per-frame allocation
  const _shipPos = new THREE.Vector3()
  const _synapsePos = new THREE.Vector3()
  const _midpoint = new THREE.Vector3()
  const _direction = new THREE.Vector3()
  const _up = new THREE.Vector3(0, 1, 0)
  const _quaternion = new THREE.Quaternion()

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    beamGroup = new THREE.Group()

    // Create dashed line material with cyan/teal glow
    materialRef = new THREE.LineDashedMaterial({
      color: 0x00ffff,
      dashSize: 0.02,
      gapSize: 0.01,
      transparent: true,
      opacity: 0.5,
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

    // Create volumetric beam mesh
    createBeamMesh()

    sceneObj.add(beamGroup)

    onCleanup(() => {
      if (beamGroup && sceneObj) {
        sceneObj.remove(beamGroup)
      }
      geometryRef?.dispose()
      materialRef?.dispose()
      particleGeometryRef?.dispose()
      particleMaterialRef?.dispose()
      beamMeshGeometryRef?.dispose()
      beamMeshMaterialRef?.dispose()
    })
  })

  function createBeamMesh() {
    if (!beamGroup) return

    // Create cylinder geometry for the beam (will be positioned/oriented in update)
    // Height of 1, will be scaled to match actual beam length
    beamMeshGeometryRef = new THREE.CylinderGeometry(0.015, 0.025, 1, 8, 1, true)

    // Create shader material for volumetric effect
    beamMeshMaterialRef = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.7 },
        uCoreColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
        uOuterColor: { value: new THREE.Color(0.3, 0.95, 1.0) },
      },
      vertexShader: BEAM_MESH_VERTEX_SHADER,
      fragmentShader: BEAM_MESH_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })

    beamMeshRef = new THREE.Mesh(beamMeshGeometryRef, beamMeshMaterialRef)
    beamMeshRef.frustumCulled = false
    beamMeshRef.visible = false
    beamMeshRef.renderOrder = 158  // Slightly below the line
    beamGroup.add(beamMeshRef)
  }

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

          // Size based on intensity and distance - smaller for subtler effect
          gl_PointSize = (2.0 + uIntensity * 1.0) * (40.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 6.0);

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

  // Calculate ship's animated orbit position using shared helper
  function getShipOrbitPosition(ship: Ship, now: number): [number, number, number] {
    return computeOrbitPosition({
      shipId: ship.id,
      centerX: ship.targetPositionX ?? ship.positionX,
      centerY: ship.targetPositionY ?? ship.positionY,
      centerZ: ship.targetPositionZ ?? ship.positionZ,
      radius: 0.15,
      now,
    })
  }

  // Handle visibility changes only - position updates happen in useFrame
  createEffect(() => {
    const active = props.isActive
    const ship = props.ship
    const synapse = props.synapsePosition

    const shouldShow = active && ship && synapse && ship.state === 'solving'

    if (lineRef) lineRef.visible = shouldShow
    if (particleSystemRef) particleSystemRef.visible = shouldShow
    if (beamMeshRef) beamMeshRef.visible = shouldShow
  })

  // Animate the beam
  useFrame(({ delta }) => {
    if (!lineRef?.visible) return

    // Get animation speed based on synapse type (longer solves = slower animation)
    const speedMult = getAnimationSpeedMultiplier(props.synapseType)

    animState.time += delta * speedMult
    animState.dashOffset += delta * 0.6 * speedMult

    // Update dash animation
    if (materialRef) {
      materialRef.dashOffset = -animState.dashOffset // Negative for flowing toward synapse
      // Pulse opacity - scaled by speed multiplier
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

    // Update volumetric beam uniforms
    if (beamMeshMaterialRef && beamMeshRef?.visible) {
      beamMeshMaterialRef.uniforms.uTime.value = animState.time
      const beamIntensity = 0.6 + Math.sin(animState.time * 2.0) * 0.3
      beamMeshMaterialRef.uniforms.uIntensity.value = beamIntensity
    }

    // Update all positions every frame (for solving ships with orbit)
    if (!lineRef?.visible || !props.ship || !props.synapsePosition || props.ship.state !== 'solving') return
    if (!geometryRef || !particleGeometryRef) return

    const now = Date.now()
    const [shipX, shipY, shipZ] = getShipOrbitPosition(props.ship, now)
    const synapseX = props.synapsePosition.x
    const synapseY = props.synapsePosition.y
    const synapseZ = props.synapsePosition.z

    // Update line positions
    const linePositions = geometryRef.getAttribute('position') as THREE.BufferAttribute
    linePositions.setXYZ(0, shipX, shipY, shipZ)
    linePositions.setXYZ(1, synapseX, synapseY, synapseZ)
    linePositions.needsUpdate = true
    lineRef.computeLineDistances()

    // Update volumetric beam mesh — reuse cached Vector3/Quaternion
    if (beamMeshRef) {
      _shipPos.set(shipX, shipY, shipZ)
      _synapsePos.set(synapseX, synapseY, synapseZ)
      const beamLength = _shipPos.distanceTo(_synapsePos)
      _midpoint.addVectors(_shipPos, _synapsePos).multiplyScalar(0.5)

      beamMeshRef.position.copy(_midpoint)
      beamMeshRef.scale.set(1, beamLength, 1)

      _direction.subVectors(_synapsePos, _shipPos).normalize()
      _quaternion.setFromUnitVectors(_up, _direction)
      beamMeshRef.quaternion.copy(_quaternion)
    }

    // Update particle positions
    const particlePositions = particleGeometryRef.getAttribute('position') as THREE.BufferAttribute
    const lifetimes = particleGeometryRef.getAttribute('aLifetime') as THREE.BufferAttribute
    const speeds = particleGeometryRef.getAttribute('aSpeed') as THREE.BufferAttribute

    for (let i = 0; i < BEAM_PARTICLES; i++) {
      const speed = speeds.getX(i)
      const t = (lifetimes.getX(i) + animState.time * speed * 0.3) % 1.0
      const x = shipX + (synapseX - shipX) * t
      const y = shipY + (synapseY - shipY) * t
      const z = shipZ + (synapseZ - shipZ) * t
      particlePositions.setXYZ(i, x, y, z)
    }
    particlePositions.needsUpdate = true
  })

  return null
}

export default SolvingBeam
