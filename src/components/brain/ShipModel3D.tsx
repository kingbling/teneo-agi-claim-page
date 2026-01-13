/**
 * ShipModel3D - Sci-Fi Fighter Ship for close-up inspection
 *
 * Renders a detailed 3D spaceship mesh when the camera is zoomed in close.
 * Design: Sleek fighter with pointed nose, swept-back wings, and glowing engine.
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import { BRAIN_SCALE } from './core/brainConstants'
import type { Ship, ShipStatus } from '@/stores/shipStore'

interface ShipModel3DProps {
  ship: Ship
  isVisible: boolean
}

// State-based colors - bright and contrasting against brain particles
const STATE_COLORS: Record<ShipStatus, number> = {
  idle: 0xffcc44,      // Gold/yellow - contrasts with cyan/blue particles
  exploring: 0x00ffff, // Bright cyan
  deploying: 0xff6633, // Orange-red
  returning: 0x66ff66, // Green
}

// Engine glow colors (extra bright)
const ENGINE_COLORS: Record<ShipStatus, number> = {
  idle: 0xffaa22,      // Warm gold glow
  exploring: 0x00ffff,
  deploying: 0xff4400,
  returning: 0x44ff44,
}

// Ship scale - visible at close zoom
const SHIP_SCALE = 0.1

// Engine trail particle count - keep subtle
const ENGINE_TRAIL_PARTICLES = 20

/**
 * Creates sci-fi fighter ship geometry - all parts connected
 */
function createShipGeometry(): THREE.Group {
  const shipGroup = new THREE.Group()
  const S = SHIP_SCALE

  // === MAIN FUSELAGE ===
  // Central body - all other parts attach to this
  const fuselageGeom = new THREE.BoxGeometry(S * 0.2, S * 0.1, S * 0.6)
  const fuselage = new THREE.Mesh(fuselageGeom)
  fuselage.name = 'hull'
  shipGroup.add(fuselage)

  // === NOSE CONE ===
  // Connects directly to front of fuselage (z = 0.3S)
  const noseGeom = new THREE.ConeGeometry(S * 0.1, S * 0.4, 6)
  const nose = new THREE.Mesh(noseGeom)
  nose.rotation.x = -Math.PI / 2  // Point forward (+Z)
  nose.position.z = S * 0.5       // Tip at 0.7S, base at 0.3S (connects to fuselage)
  nose.name = 'hull'
  shipGroup.add(nose)

  // === WINGS ===
  // Simple flat box wings attached to fuselage sides
  const wingGeom = new THREE.BoxGeometry(S * 0.5, S * 0.02, S * 0.25)

  // Left wing - flush with fuselage
  const leftWing = new THREE.Mesh(wingGeom)
  leftWing.position.set(S * 0.35, 0, -S * 0.05)  // Offset back slightly
  leftWing.rotation.z = -0.1  // Slight anhedral
  leftWing.name = 'wing'
  shipGroup.add(leftWing)

  // Right wing
  const rightWing = new THREE.Mesh(wingGeom)
  rightWing.position.set(-S * 0.35, 0, -S * 0.05)
  rightWing.rotation.z = 0.1
  rightWing.name = 'wing'
  shipGroup.add(rightWing)

  // === VERTICAL STABILIZER ===
  // Single center fin on top at rear
  const finGeom = new THREE.BoxGeometry(S * 0.02, S * 0.15, S * 0.2)
  const fin = new THREE.Mesh(finGeom)
  fin.position.set(0, S * 0.12, -S * 0.2)  // On top, at rear
  fin.name = 'wing'
  shipGroup.add(fin)

  // === ENGINE SECTION ===
  // Tapered rear section connecting to fuselage back (z = -0.3S)
  const engineGeom = new THREE.CylinderGeometry(S * 0.06, S * 0.1, S * 0.2, 8)
  const engine = new THREE.Mesh(engineGeom)
  engine.rotation.x = Math.PI / 2
  engine.position.z = -S * 0.4  // Connects to fuselage back
  engine.name = 'engine'
  shipGroup.add(engine)

  // === ENGINE GLOW ===
  const glowGeom = new THREE.SphereGeometry(S * 0.06, 16, 16)  // Smaller glow
  const glow = new THREE.Mesh(glowGeom)
  glow.position.z = -S * 0.5
  glow.name = 'engineGlow'
  shipGroup.add(glow)

  // Bright core
  const coreGlowGeom = new THREE.SphereGeometry(S * 0.03, 12, 12)  // Smaller core
  const coreGlow = new THREE.Mesh(coreGlowGeom)
  coreGlow.position.z = -S * 0.5
  coreGlow.name = 'engineCore'
  shipGroup.add(coreGlow)

  // === COCKPIT ===
  // Small bubble on top of fuselage, near front
  const cockpitGeom = new THREE.SphereGeometry(S * 0.06, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2)
  const cockpit = new THREE.Mesh(cockpitGeom)
  cockpit.position.set(0, S * 0.05, S * 0.15)  // On top, forward
  cockpit.name = 'cockpit'
  shipGroup.add(cockpit)

  // === POINT LIGHT ===
  const shipLight = new THREE.PointLight(0xffffff, 2, S * 4)
  shipLight.position.set(0, S * 0.2, 0)
  shipGroup.add(shipLight)

  return shipGroup
}

/**
 * Creates bright, highly visible materials for the ship
 */
function createShipMaterials(state: ShipStatus) {
  const baseColor = STATE_COLORS[state]
  const engineColor = ENGINE_COLORS[state]

  return {
    // Hull - BRIGHT and self-illuminating
    hull: new THREE.MeshBasicMaterial({
      color: baseColor,
    }),
    // Wings - slightly darker but still visible
    wing: new THREE.MeshStandardMaterial({
      color: 0x556677,
      emissive: baseColor,
      emissiveIntensity: 0.7,
      metalness: 0.5,
      roughness: 0.3,
      side: THREE.DoubleSide,
    }),
    // Engine housing
    engine: new THREE.MeshStandardMaterial({
      color: 0x334455,
      emissive: baseColor,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2,
    }),
    // Engine glow - subtle
    engineGlow: new THREE.MeshBasicMaterial({
      color: engineColor,
      transparent: true,
      opacity: 0.6,
    }),
    // Engine core - bright but smaller
    engineCore: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    }),
    // Cockpit - glowing canopy
    cockpit: new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.7,
    }),
  }
}

/**
 * Creates engine trail particle system
 */
function createEngineTrail(engineColor: number): {
  points: THREE.Points
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  particleData: Float32Array
} {
  const S = SHIP_SCALE
  const count = ENGINE_TRAIL_PARTICLES

  const positions = new Float32Array(count * 3)
  const particleData = new Float32Array(count * 4) // x: life offset, y: speed, z: size, w: radial offset

  for (let i = 0; i < count; i++) {
    // Start at engine position
    positions[i * 3] = 0
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = -S * 0.5

    // Random particle data
    particleData[i * 4] = Math.random()           // life offset
    particleData[i * 4 + 1] = 0.5 + Math.random() // speed multiplier
    particleData[i * 4 + 2] = 1 + Math.random() * 2 // size - smaller
    particleData[i * 4 + 3] = Math.random() * Math.PI * 2 // radial angle
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aParticleData', new THREE.BufferAttribute(particleData, 4))

  const color = new THREE.Color(engineColor)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uEngineZ: { value: -S * 0.5 },
    },
    vertexShader: `
      attribute vec4 aParticleData;
      uniform float uTime;
      uniform float uEngineZ;

      varying float vAlpha;
      varying float vLife;

      void main() {
        float lifeOffset = aParticleData.x;
        float speed = aParticleData.y;
        float size = aParticleData.z;
        float angle = aParticleData.w;

        // Particle life cycle (0 to 1)
        float life = mod(uTime * speed * 0.8 + lifeOffset, 1.0);
        vLife = life;

        // Flow backward from engine
        float trailLength = 0.15;
        float z = uEngineZ - life * trailLength;

        // Expand outward as it flows
        float spread = life * 0.02;
        float x = cos(angle) * spread;
        float y = sin(angle) * spread;

        vec3 pos = vec3(x, y, z);

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

        // Size decreases with distance
        float lifeFade = 1.0 - life;
        gl_PointSize = size * lifeFade * (100.0 / -mvPosition.z);

        // Alpha based on life - keep subtle
        vAlpha = lifeFade * 0.4;

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      varying float vLife;

      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);

        // Soft circular shape
        float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;

        // Color fades from white core to engine color
        vec3 color = mix(vec3(1.0), uColor, vLife * 0.7);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,  // Normal blending to prevent blow-out
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 200  // Render after ship

  return { points, geometry, material, particleData }
}

export const ShipModel3D: Component<ShipModel3DProps> = (props) => {
  const { scene } = useThree()
  let shipGroup: THREE.Group | null = null
  let materials: ReturnType<typeof createShipMaterials> | null = null
  let engineTrail: ReturnType<typeof createEngineTrail> | null = null

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    // Create ship geometry
    shipGroup = createShipGeometry()
    materials = createShipMaterials(props.ship.state)

    // Create engine trail particles
    engineTrail = createEngineTrail(ENGINE_COLORS[props.ship.state])
    shipGroup.add(engineTrail.points)

    // Apply materials to meshes
    shipGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && materials) {
        const materialKey = child.name as keyof typeof materials
        if (materials[materialKey]) {
          child.material = materials[materialKey]
        }
      }
    })

    // Set initial position
    const pos = getShipWorldPosition(props.ship)
    shipGroup.position.copy(pos)

    // Set visibility
    shipGroup.visible = props.isVisible

    sceneObj.add(shipGroup)
  })

  onCleanup(() => {
    const sceneObj = scene()
    if (sceneObj && shipGroup) {
      sceneObj.remove(shipGroup)
      // Dispose geometries and materials
      shipGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
        if (child instanceof THREE.Points) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
    }
    // Dispose engine trail
    if (engineTrail) {
      engineTrail.geometry.dispose()
      engineTrail.material.dispose()
    }
  })

  // Update position when ship moves
  createEffect(() => {
    if (!shipGroup) return
    const pos = getShipWorldPosition(props.ship)
    shipGroup.position.copy(pos)
  })

  // Update visibility
  createEffect(() => {
    if (!shipGroup) return
    shipGroup.visible = props.isVisible
  })

  // Update materials when state changes
  createEffect(() => {
    if (!shipGroup) return

    const newMaterials = createShipMaterials(props.ship.state)
    materials = newMaterials

    // Update point light color to match state
    shipGroup.traverse((child) => {
      if (child instanceof THREE.PointLight) {
        child.color.setHex(STATE_COLORS[props.ship.state])
      }
      if (child instanceof THREE.Mesh) {
        const materialKey = child.name as keyof typeof newMaterials
        if (newMaterials[materialKey]) {
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
          child.material = newMaterials[materialKey]
        }
      }
    })

    // Update engine trail color
    if (engineTrail) {
      const newColor = new THREE.Color(ENGINE_COLORS[props.ship.state])
      engineTrail.material.uniforms.uColor.value = newColor
    }
  })

  // Animation loop - gentle hover and engine pulse
  useFrame(() => {
    if (!shipGroup || !props.isVisible) return

    const time = performance.now() * 0.001

    // Gentle hover motion
    shipGroup.rotation.x = Math.sin(time * 0.7) * 0.03
    shipGroup.rotation.z = Math.sin(time * 0.5) * 0.02
    shipGroup.position.y += Math.sin(time * 1.2) * 0.0001

    // Engine glow pulse based on state
    let pulseSpeed = 2.0
    let pulseMin = 0.5
    let pulseMax = 0.9

    switch (props.ship.state) {
      case 'idle':
        pulseSpeed = 1.5
        pulseMin = 0.4
        pulseMax = 0.7
        break
      case 'exploring':
        pulseSpeed = 3.0
        pulseMin = 0.6
        pulseMax = 1.0
        break
      case 'deploying':
        pulseSpeed = 5.0
        pulseMin = 0.7
        pulseMax = 1.0
        break
      case 'returning':
        pulseSpeed = 2.5
        pulseMin = 0.5
        pulseMax = 0.85
        break
    }

    const pulse = pulseMin + (Math.sin(time * pulseSpeed) * 0.5 + 0.5) * (pulseMax - pulseMin)

    // Update engine glow
    const glowMesh = shipGroup.getObjectByName('engineGlow') as THREE.Mesh | undefined
    if (glowMesh && glowMesh.material instanceof THREE.MeshBasicMaterial) {
      glowMesh.material.opacity = pulse
      glowMesh.scale.setScalar(0.9 + pulse * 0.2)
    }

    // Update core glow (faster pulse)
    const coreMesh = shipGroup.getObjectByName('engineCore') as THREE.Mesh | undefined
    if (coreMesh && coreMesh.material instanceof THREE.MeshBasicMaterial) {
      const corePulse = 0.7 + Math.sin(time * pulseSpeed * 2) * 0.3
      coreMesh.material.opacity = corePulse
    }

    // Update engine trail particles
    if (engineTrail) {
      engineTrail.material.uniforms.uTime.value = time
    }
  })

  return null
}

/**
 * Helper to get ship world position with BRAIN_SCALE applied
 */
function getShipWorldPosition(ship: Ship): THREE.Vector3 {
  return new THREE.Vector3(
    ship.positionX * BRAIN_SCALE.x,
    ship.positionY * BRAIN_SCALE.y,
    ship.positionZ * BRAIN_SCALE.z
  )
}

export default ShipModel3D
