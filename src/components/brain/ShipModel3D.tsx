/**
 * ShipModel3D - GLB Model Ship Renderer
 *
 * Renders ships using the GLB model from /models/ship.glb
 * Includes engine trail particle effects
 */

import { onMount, onCleanup, createEffect, createSignal, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree } from '@/three/hooks'
import { constrainToBrainShape } from './core/brainConstants'
import { loadShipModel, getEngineColor as getEngineColorFromLoader } from '@/three/useShipModel'
import { shipStore, type Ship } from '@/stores/shipStore'
import { log, fmt } from '@/utils/logger'

interface ShipModel3DProps {
  ship: Ship
  isVisible: boolean
}

const SHIP_SCALE = 0.08  // Smaller scale to fit the brain scene
const ENGINE_TRAIL_PARTICLES = 30

/**
 * Get ship world position with brain shape constraint
 */
function getShipWorldPosition(ship: Ship): THREE.Vector3 {
  const [x, y, z] = constrainToBrainShape(
    ship.positionX ?? 0,
    ship.positionY ?? 0,
    ship.positionZ ?? 0
  )
  return new THREE.Vector3(x, y, z)
}

/**
 * Creates twin engine trail particle system
 */
function createEngineTrail(engineColor: number): {
  points: THREE.Points
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
} {
  const S = SHIP_SCALE
  const count = ENGINE_TRAIL_PARTICLES
  const engineSpacing = S * 0.055

  const positions = new Float32Array(count * 3)
  const particleData = new Float32Array(count * 4)

  for (let i = 0; i < count; i++) {
    // Alternate between left and right engine
    const isLeft = i % 2 === 0
    const engineX = isLeft ? engineSpacing : -engineSpacing

    positions[i * 3] = engineX
    positions[i * 3 + 1] = -S * 0.01
    positions[i * 3 + 2] = S * 0.52

    particleData[i * 4] = Math.random()
    particleData[i * 4 + 1] = 0.6 + Math.random() * 1.0
    particleData[i * 4 + 2] = 3 + Math.random() * 4
    particleData[i * 4 + 3] = Math.random() * Math.PI * 2
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aParticleData', new THREE.BufferAttribute(particleData, 4))

  const color = new THREE.Color(engineColor)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uIntensity: { value: 1.0 },
    },
    vertexShader: `
      attribute vec4 aParticleData;
      uniform float uTime;
      uniform float uIntensity;

      varying float vAlpha;
      varying float vLife;

      void main() {
        float lifeOffset = aParticleData.x;
        float speed = aParticleData.y;
        float size = aParticleData.z;
        float angle = aParticleData.w;

        float life = mod(uTime * speed * 1.8 + lifeOffset, 1.0);
        vLife = life;

        float trailLength = 0.35;
        vec3 pos = position;
        pos.z += life * trailLength;

        float spread = life * 0.025;
        pos.x += cos(angle) * spread;
        pos.y += sin(angle) * spread;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

        float lifeFade = 1.0 - life;
        float sizeMult = lifeFade * (1.0 + lifeFade * 0.3);
        float distScale = min(150.0 / max(-mvPosition.z, 0.3), 80.0);
        gl_PointSize = clamp(size * sizeMult * distScale * uIntensity, 1.0, 40.0);

        float distFade = smoothstep(0.2, 1.0, -mvPosition.z);
        vAlpha = lifeFade * lifeFade * 0.4 * uIntensity * (0.3 + distFade * 0.7);

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

        float alpha = smoothstep(0.5, 0.05, dist) * vAlpha;

        vec3 coreColor = vec3(1.0, 0.95, 0.8);
        vec3 color = mix(coreColor, uColor, vLife * 0.5 + 0.3);
        color += (1.0 - vLife) * 0.3;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 200

  return { points, geometry, material }
}

export const ShipModel3D: Component<ShipModel3DProps> = (props) => {
  const { scene } = useThree()
  let shipGroup: THREE.Group | null = null
  let engineTrail: ReturnType<typeof createEngineTrail> | null = null
  let shipLight: THREE.PointLight | null = null
  let rimLight: THREE.PointLight | null = null
  let prevState: string | null = null
  const [modelLoaded, setModelLoaded] = createSignal(false)

  // Debug: Log when component is rendered
  log.agent.debug('ShipModel3D rendered:', {
    id: fmt.shortId(props.ship?.id),
    name: props.ship?.name,
    state: props.ship?.state,
    isVisible: props.isVisible,
    position: props.ship ? fmt.pos(props.ship.positionX, props.ship.positionY, props.ship.positionZ) : 'no ship',
  })

  onMount(async () => {
    log.agent.debug('ShipModel3D onMount called')
    const sceneObj = scene()
    if (!sceneObj) return

    try {
      // Load the GLB model
      shipGroup = await loadShipModel()

      // Guard against ship being null after async load
      if (!props.ship) {
        return
      }

      shipGroup.scale.setScalar(SHIP_SCALE)

      // Three-point lighting setup for proper ship illumination
      // Key light - main illumination from front-above
      shipLight = new THREE.PointLight(0xffffff, 5, 3)
      shipLight.position.set(0.5, 0.5, -0.8)
      shipGroup.add(shipLight)

      // Fill light - softer light from the side to reduce harsh shadows
      const fillLight = new THREE.PointLight(0xaaccff, 2, 2)
      fillLight.position.set(-0.6, 0.2, -0.2)
      shipGroup.add(fillLight)

      // Rim/back light - colored by ship state for visual feedback
      rimLight = new THREE.PointLight(getEngineColorFromLoader(props.ship.state), 3, 1.5)
      rimLight.position.set(0, 0.1, 0.5)
      shipGroup.add(rimLight)

      // Add engine trail particles
      engineTrail = createEngineTrail(getEngineColorFromLoader(props.ship.state))
      engineTrail.points.position.set(0, 0, SHIP_SCALE * 0.4)
      shipGroup.add(engineTrail.points)

      const pos = getShipWorldPosition(props.ship)
      shipGroup.position.copy(pos)
      shipGroup.visible = props.isVisible

      sceneObj.add(shipGroup)
      setModelLoaded(true)
      log.agent.success('GLB model mounted at:', fmt.pos(shipGroup.position.x, shipGroup.position.y, shipGroup.position.z))
    } catch (error) {
      log.agent.error('Failed to load ship model:', error)
    }
  })

  // Standalone animation loop
  let animationId: number | null = null

  const runAnimation = () => {
    if (!shipGroup || !props.isVisible || !modelLoaded()) {
      animationId = requestAnimationFrame(runAnimation)
      return
    }

    const now = Date.now()
    const time = now * 0.001

    // Read fresh ship data from store
    const freshShip = shipStore.userShips?.find(s => s.id === props.ship.id)
    if (!freshShip) {
      animationId = requestAnimationFrame(runAnimation)
      return
    }

    // Check for animation data
    const hasAnimationData = freshShip.state === 'deploying' &&
      freshShip.startPositionX !== undefined &&
      freshShip.targetPositionX !== undefined &&
      freshShip.travelStartTime !== undefined &&
      freshShip.travelDuration !== undefined &&
      freshShip.travelDuration > 0

    if (hasAnimationData) {
      const elapsed = now - freshShip.travelStartTime!
      const progress = Math.min(Math.max(elapsed / freshShip.travelDuration!, 0), 1)

      // Linear interpolation from start to target
      const startX = freshShip.startPositionX!
      const startY = freshShip.startPositionY ?? 0
      const startZ = freshShip.startPositionZ ?? 0
      const targetX = freshShip.targetPositionX!
      const targetY = freshShip.targetPositionY ?? 0
      const targetZ = freshShip.targetPositionZ ?? 0

      const interpX = startX + (targetX - startX) * progress
      const interpY = startY + (targetY - startY) * progress
      const interpZ = startZ + (targetZ - startZ) * progress

      const [cx, cy, cz] = constrainToBrainShape(interpX, interpY, interpZ)
      shipGroup.position.set(cx, cy, cz)

      // Calculate rotation to face target
      const dx = targetX - startX
      const dz = targetZ - startZ
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        const targetRotationY = Math.atan2(dx, -dz)
        shipGroup.rotation.y = targetRotationY
      }
    } else if (freshShip.state === 'idle') {
      // === IDLE ANIMATION: Gentle hover/breathing motion ===
      const pos = getShipWorldPosition(freshShip)

      // Subtle vertical oscillation - "breathing" hover
      // Amplitude: ~0.02 units (subtle), Period: ~6 seconds (slow, calm)
      // Phase offset based on ship ID so ships don't sync
      const idlePhase = freshShip.id.charCodeAt(0) + freshShip.id.charCodeAt(freshShip.id.length - 1)
      const idleOffset = Math.sin(now * 0.001 + idlePhase) * 0.02

      shipGroup.position.set(pos.x, pos.y + idleOffset, pos.z)

      // Gentle rotation wobble for idle ships
      const rotationWobble = Math.sin(now * 0.0008 + idlePhase * 0.5) * 0.05
      shipGroup.rotation.y = (freshShip.rotationY ?? 0) + rotationWobble
    } else if (freshShip.state === 'solving' && freshShip.targetPositionX !== undefined) {
      // === SOLVING ANIMATION: Orbit around target synapse ===
      const orbitRadius = 0.05
      // Vary orbit speed slightly based on ship ID for visual interest
      const orbitSpeed = 0.0005 + (freshShip.id.charCodeAt(0) % 10) * 0.0001
      const orbitPhase = freshShip.id.charCodeAt(0)
      const angle = now * orbitSpeed + orbitPhase

      // Get synapse position (target position)
      const [synapseX, synapseY, synapseZ] = constrainToBrainShape(
        freshShip.targetPositionX,
        freshShip.targetPositionY ?? 0,
        freshShip.targetPositionZ ?? 0
      )

      // Orbit around synapse
      const orbitX = synapseX + Math.cos(angle) * orbitRadius
      const orbitZ = synapseZ + Math.sin(angle) * orbitRadius
      // Slight Y wobble for 3D effect
      const orbitY = synapseY + Math.sin(angle * 2) * 0.01

      // Lerp to orbit position — smooth transition when arriving from deploying state
      const isTransition = prevState !== null && prevState !== 'solving'
      const lerpFactor = isTransition ? 0.08 : 0.3
      const target = new THREE.Vector3(orbitX, orbitY, orbitZ)
      shipGroup.position.lerp(target, lerpFactor)

      // Rotate ship to face direction of orbit (tangent to orbit path)
      const tangentAngle = angle + Math.PI / 2 // 90 degrees ahead in orbit
      shipGroup.rotation.y = -tangentAngle // Negative because ship faces -Z
    } else {
      // Use current position from store
      const pos = getShipWorldPosition(freshShip)
      shipGroup.position.lerp(pos, 0.1)

      // Use rotation from store if available
      if (freshShip.rotationY !== undefined) {
        shipGroup.rotation.y = freshShip.rotationY
      }
    }

    // Track state for transition detection
    prevState = freshShip.state

    // Update engine trail
    if (engineTrail) {
      engineTrail.material.uniforms.uTime.value = time

      // Adjust intensity based on state
      const isMoving = freshShip.state === 'deploying' || freshShip.state === 'returning'
      const targetIntensity = isMoving ? 1.5 : 0.6
      const currentIntensity = engineTrail.material.uniforms.uIntensity.value
      engineTrail.material.uniforms.uIntensity.value = currentIntensity + (targetIntensity - currentIntensity) * 0.1

      // Update engine color based on state
      const newColor = getEngineColorFromLoader(freshShip.state)
      engineTrail.material.uniforms.uColor.value.setHex(newColor)

      // Update rim light color
      if (rimLight) {
        rimLight.color.setHex(newColor)
      }
    }

    animationId = requestAnimationFrame(runAnimation)
  }

  // Start animation loop
  createEffect(() => {
    if (modelLoaded() && !animationId) {
      animationId = requestAnimationFrame(runAnimation)
    }
  })

  // Update visibility
  createEffect(() => {
    if (shipGroup) {
      shipGroup.visible = props.isVisible
    }
  })

  // Cleanup
  onCleanup(() => {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    if (shipGroup) {
      const sceneObj = scene()
      if (sceneObj) {
        sceneObj.remove(shipGroup)
      }

      // Dispose of geometries and materials
      shipGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material?.dispose()
          }
        }
      })
    }

    if (engineTrail) {
      engineTrail.geometry.dispose()
      engineTrail.material.dispose()
    }
  })

  return null
}

export default ShipModel3D
