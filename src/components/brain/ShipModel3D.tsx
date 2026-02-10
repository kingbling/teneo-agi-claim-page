/**
 * ShipModel3D - GLB Model Ship Renderer
 *
 * Renders ships using the GLB model from /models/ship.glb
 * Includes engine trail particle effects
 */

import { onMount, onCleanup, createEffect, createSignal, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree } from '@/three/hooks'
import { loadShipModel, getEngineColor as getEngineColorFromLoader } from '@/three/useShipModel'
import { shipStore, type Ship } from '@/stores/shipStore'
import { constrainToBrainShape } from '@/components/brain/core/brainConstants'
import { computeOrbitPosition } from '@/utils/orbitHelper'
import { log, fmt } from '@/utils/logger'

interface ShipModel3DProps {
  ship: Ship
  isVisible: boolean
}

const SHIP_SCALE = 0.08  // Smaller scale to fit the brain scene
const ENGINE_TRAIL_PARTICLES = 30

// Cached Vector3 for lerp targets — avoids allocation per frame
const _lerpTarget = new THREE.Vector3()

/**
 * Get ship world position (DB stores final visualization coordinates)
 */
function getShipWorldPosition(ship: Ship): THREE.Vector3 {
  return new THREE.Vector3(
    ship.positionX ?? 0,
    ship.positionY ?? 0,
    ship.positionZ ?? 0
  )
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
        float camDist = -mvPosition.z;
        float distScale = min(150.0 / max(camDist, 0.3), 30.0);
        gl_PointSize = clamp(size * sizeMult * distScale * uIntensity, 1.0, 20.0);

        // Fade out trail at distance to prevent glow blob
        float distFade = smoothstep(0.2, 1.0, camDist);
        float farFade = 1.0 - smoothstep(2.0, 4.0, camDist);
        vAlpha = lifeFade * lifeFade * 0.4 * uIntensity * (0.3 + distFade * 0.7) * farFade;

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
      // Check if server has streamed a travel:position update yet
      // (positionX will differ from startPositionX once the first update arrives)
      const hasServerPosition =
        freshShip.positionX !== freshShip.startPositionX! ||
        freshShip.positionZ !== (freshShip.startPositionZ ?? 0)

      let rawX: number, rawY: number, rawZ: number

      if (hasServerPosition) {
        // PRIMARY: Use server-streamed position (updated every ~100ms via travel:position)
        rawX = freshShip.positionX
        rawY = freshShip.positionY
        rawZ = freshShip.positionZ
      } else {
        // FALLBACK: Local interpolation before first travel:position arrives
        const elapsed = now - freshShip.travelStartTime!
        const progress = Math.min(Math.max(elapsed / freshShip.travelDuration!, 0), 1)

        const startX = freshShip.startPositionX!
        const startY = freshShip.startPositionY ?? 0
        const startZ = freshShip.startPositionZ ?? 0
        const targetX = freshShip.targetPositionX!
        const targetY = freshShip.targetPositionY ?? 0
        const targetZ = freshShip.targetPositionZ ?? 0

        rawX = startX + (targetX - startX) * progress
        rawY = startY + (targetY - startY) * progress
        rawZ = startZ + (targetZ - startZ) * progress
      }

      // Lerp toward target position to smooth 100ms server tick jumps
      shipGroup.position.lerp(_lerpTarget.set(rawX, rawY, rawZ), 0.25)

      // Compute rotation from current position toward constrained target
      const targetX = freshShip.targetPositionX!
      const targetZ = freshShip.targetPositionZ ?? 0
      const [ctX, , ctZ] = constrainToBrainShape(targetX, freshShip.targetPositionY ?? 0, targetZ)
      const dirX = ctX - shipGroup.position.x
      const dirZ = ctZ - shipGroup.position.z
      // Only update rotation if there's meaningful distance (avoid jitter near arrival)
      if (dirX * dirX + dirZ * dirZ > 0.0001) {
        const targetRotY = Math.atan2(dirX, -dirZ)  // Ship model faces -Z
        // Angular lerp with wrapping
        let deltaAngle = targetRotY - shipGroup.rotation.y
        deltaAngle = ((deltaAngle + Math.PI) % (Math.PI * 2)) - Math.PI
        if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2
        shipGroup.rotation.y += deltaAngle * 0.15
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
      // === SOLVING ANIMATION: Orbit around target synapse (uses shared helper) ===
      const [orbitX, orbitY, orbitZ] = computeOrbitPosition({
        shipId: freshShip.id,
        centerX: freshShip.targetPositionX,
        centerY: freshShip.targetPositionY ?? 0,
        centerZ: freshShip.targetPositionZ ?? 0,
        radius: 0.15,
        now,
      })

      // Lerp to orbit position — smooth transition when arriving from deploying state
      const isTransition = prevState !== null && prevState !== 'solving'
      const lerpFactor = isTransition ? 0.08 : 0.3
      shipGroup.position.lerp(_lerpTarget.set(orbitX, orbitY, orbitZ), lerpFactor)

      // Rotate ship to face direction of orbit (tangent to orbit path)
      const orbitSpeed = 0.0005 + (freshShip.id.charCodeAt(0) % 10) * 0.0001
      const orbitPhase = freshShip.id.charCodeAt(0)
      const angle = now * orbitSpeed + orbitPhase
      const tangentAngle = angle + Math.PI / 2
      shipGroup.rotation.y = -tangentAngle
    } else {
      const pos = getShipWorldPosition(freshShip)
      const prev = shipGroup.position.clone()
      shipGroup.position.lerp(pos, 0.1)
      // Compute rotation from movement direction
      const moveDirX = shipGroup.position.x - prev.x
      const moveDirZ = shipGroup.position.z - prev.z
      if (moveDirX * moveDirX + moveDirZ * moveDirZ > 0.00001) {
        const targetRotY = Math.atan2(moveDirX, -moveDirZ)
        let deltaAngle = targetRotY - shipGroup.rotation.y
        deltaAngle = ((deltaAngle + Math.PI) % (Math.PI * 2)) - Math.PI
        if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2
        shipGroup.rotation.y += deltaAngle * 0.15
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
