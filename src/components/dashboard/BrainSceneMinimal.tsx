/**
 * BrainSceneMinimal - 3D Brain Visualization Scene
 *
 * Main scene composition component for the brain visualization.
 * Migrated from React Three Fiber to vanilla Three.js with SolidJS.
 */

import { createSignal, createEffect, onCleanup, onMount, createMemo, type Accessor } from 'solid-js'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js'
import { useThree, useFrame } from '@/three/hooks'
import { OrbitControls } from '@/three/components'
import { SynapseParticlesMinimal } from '@/components/brain/SynapseParticlesMinimal'
import { SpaceMarkers } from '@/components/brain/SpaceMarkers'
import { ShipMarkers } from '@/components/brain/AgentMarkers'
import { SynapseNetwork } from '@/components/brain/SynapseNetwork'
import { BurnParticles } from '@/components/brain/BurnParticles'
import { DiscoveryBurst } from '@/components/brain/DiscoveryBurst'
import { PostProcessingEffects } from '@/components/brain/PostProcessingEffects'
import { ShipModel3D } from '@/components/brain/ShipModel3D'
import { CAMERA_CONFIG, LOD_THRESHOLDS, SHIP_ZOOM_CONFIG, SHIP_FOLLOW_CONFIG, BRAIN_SCALE } from '@/components/brain/core/brainConstants'

/**
 * Region camera target for navigating to brain regions
 */
export interface RegionCamera {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * CameraController - Handles camera zoom, LOD changes, and region navigation
 *
 * Converted to SolidJS patterns:
 * - Uses createEffect instead of useEffect
 * - Uses createSignal for local state
 * - Uses custom useFrame and useThree hooks
 *
 * Ship follow mode: After initial zoom animation completes, camera smoothly
 * follows the ship using lerp interpolation for cinematic movement.
 */
export function CameraController(props: {
  zoomTarget: Accessor<THREE.Vector3 | null>
  setZoomInfo: (info: { distance: number; lod: number }) => void
  regionCamera: Accessor<RegionCamera | null>
  controlsRef: Accessor<OrbitControlsType | null>
  onCameraUpdate?: (update: CameraUpdate) => void
  isShipZoom?: Accessor<boolean>
}) {
  const { camera } = useThree()
  let regionAnimationId: number | null = null
  let zoomAnimationId: number | null = null

  // Track if initial zoom animation is complete for smooth follow mode
  const [isFollowMode, setIsFollowMode] = createSignal(false)
  // Store the current follow target for smooth interpolation
  const [followTarget, setFollowTarget] = createSignal<THREE.Vector3 | null>(null)
  // Track previous zoom target to detect new ship selections
  let lastZoomTargetId = ''

  // LOD update loop and camera position reporting
  createEffect(() => {
    const cam = camera()
    const controls = props.controlsRef()
    if (!cam) return

    // Track previous values to avoid unnecessary updates
    let lastCamX = 0, lastCamY = 0, lastCamZ = 0
    let lastTargetX = 0, lastTargetY = 0, lastTargetZ = 0
    const POSITION_THRESHOLD = 0.01 // Only update if moved more than this

    const updateLODAndCamera = () => {
      const distance = cam.position.distanceTo(new THREE.Vector3(...CAMERA_CONFIG.brainCenter))
      let lod = 0
      if (distance > LOD_THRESHOLDS.lod1) lod = 2
      else if (distance > LOD_THRESHOLDS.lod0) lod = 1
      props.setZoomInfo({ distance, lod })

      // Report camera position for minimap only if position changed significantly
      if (props.onCameraUpdate) {
        const target = controls?.target ?? new THREE.Vector3(...CAMERA_CONFIG.brainCenter)
        const camDelta = Math.abs(cam.position.x - lastCamX) +
                         Math.abs(cam.position.y - lastCamY) +
                         Math.abs(cam.position.z - lastCamZ)
        const targetDelta = Math.abs(target.x - lastTargetX) +
                            Math.abs(target.y - lastTargetY) +
                            Math.abs(target.z - lastTargetZ)

        if (camDelta > POSITION_THRESHOLD || targetDelta > POSITION_THRESHOLD) {
          lastCamX = cam.position.x
          lastCamY = cam.position.y
          lastCamZ = cam.position.z
          lastTargetX = target.x
          lastTargetY = target.y
          lastTargetZ = target.z
          props.onCameraUpdate({
            position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            target: { x: target.x, y: target.y, z: target.z },
          })
        }
      }
    }

    updateLODAndCamera()

    const interval = setInterval(updateLODAndCamera, 500)  // Reduced from 100ms for better performance
    onCleanup(() => clearInterval(interval))
  })

  // Update follow target when zoom target changes (for smooth follow mode)
  createEffect(() => {
    const zoomTarget = props.zoomTarget()
    const isShipZoom = props.isShipZoom?.() ?? false

    if (zoomTarget && isShipZoom) {
      setFollowTarget(zoomTarget.clone())
    } else {
      setFollowTarget(null)
      setIsFollowMode(false)
    }
  })

  // Smooth camera follow using useFrame (runs every frame when in follow mode)
  useFrame(({ delta }) => {
    const controls = props.controlsRef()
    const cam = camera()
    const target = followTarget()
    const isShipZoom = props.isShipZoom?.() ?? false

    // Only follow when in follow mode and ship zoom is active
    if (!isFollowMode() || !isShipZoom || !controls || !cam || !target) return

    // Calculate desired camera position (target + offset)
    const offset = new THREE.Vector3(...SHIP_FOLLOW_CONFIG.followOffset)
    const desiredPosition = target.clone().add(offset)

    // Smooth lerp toward desired position using exponential smoothing
    const lerpFactor = 1.0 - Math.exp(-SHIP_FOLLOW_CONFIG.followLerpSpeed * delta)
    cam.position.lerp(desiredPosition, lerpFactor)

    // Smooth lerp the controls target toward the ship
    controls.target.lerp(target, lerpFactor)
    controls.update()
  })

  // Initial zoom animation to target (only on new ship selection)
  createEffect(() => {
    const zoomTarget = props.zoomTarget()
    const controls = props.controlsRef()
    const cam = camera()
    const isShipZoom = props.isShipZoom?.() ?? false

    if (!zoomTarget || !controls || !cam) return

    // Create a unique ID for this zoom target to detect new selections
    const targetId = `${zoomTarget.x.toFixed(3)}-${zoomTarget.y.toFixed(3)}-${zoomTarget.z.toFixed(3)}-${isShipZoom}`

    // If already in follow mode and target is similar, let follow mode handle it
    if (isFollowMode() && isShipZoom && lastZoomTargetId.startsWith(targetId.substring(0, targetId.lastIndexOf('-')))) {
      // Just update the follow target, don't restart animation
      return
    }

    lastZoomTargetId = targetId
    setIsFollowMode(false) // Disable follow during initial animation

    // Cancel any ongoing region animation
    if (regionAnimationId) {
      cancelAnimationFrame(regionAnimationId)
      regionAnimationId = null
    }
    // Cancel any ongoing zoom animation
    if (zoomAnimationId) {
      cancelAnimationFrame(zoomAnimationId)
      zoomAnimationId = null
    }

    // Use close zoom offset for ship inspection, default for other targets
    const offset = isShipZoom
      ? new THREE.Vector3(...SHIP_ZOOM_CONFIG.zoomOffset)
      : new THREE.Vector3(0, 0, 3)

    const startPosition = cam.position.clone()
    const endPosition = zoomTarget.clone().add(offset)
    const startTarget = controls.target.clone()
    const duration = isShipZoom ? SHIP_ZOOM_CONFIG.animationDuration : 1000
    const startTime = Date.now()

    // Store original minDistance and override for close ship zoom
    const originalMinDistance = controls.minDistance
    if (isShipZoom) {
      controls.minDistance = SHIP_ZOOM_CONFIG.minDistanceOverride
    }

    const animateCamera = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // Ease out cubic

      cam.position.lerpVectors(startPosition, endPosition, eased)
      // Also animate the target for smoother transition
      controls.target.lerpVectors(startTarget, zoomTarget, eased)
      controls.update()

      if (progress < 1) {
        zoomAnimationId = requestAnimationFrame(animateCamera)
      } else {
        zoomAnimationId = null
        if (!isShipZoom) {
          // Restore minDistance after non-ship zoom completes
          controls.minDistance = originalMinDistance
        } else {
          // Enable follow mode after initial zoom completes
          setIsFollowMode(true)
        }
      }
    }

    animateCamera()
  })

  // Animate camera to region viewpoint
  createEffect(() => {
    const regionCamera = props.regionCamera()
    const controls = props.controlsRef()
    const cam = camera()
    const isShipZoom = props.isShipZoom?.() ?? false

    if (!controls || !cam) return

    // Don't animate to default view if in ship zoom mode - let ship zoom handle camera
    if (!regionCamera && isShipZoom) return

    // Don't start region animation if there's an active zoom animation
    if (zoomAnimationId) return

    // Cancel any ongoing region animation
    if (regionAnimationId) {
      cancelAnimationFrame(regionAnimationId)
      regionAnimationId = null
    }

    // Disable follow mode when navigating to region
    setIsFollowMode(false)

    // If no region selected, animate back to default view
    const targetPosition = regionCamera
      ? new THREE.Vector3(...regionCamera.position)
      : new THREE.Vector3(...CAMERA_CONFIG.defaultPosition)
    const targetLookAt = regionCamera
      ? new THREE.Vector3(...regionCamera.target)
      : new THREE.Vector3(...CAMERA_CONFIG.brainCenter)

    const startPosition = cam.position.clone()
    const startTarget = controls.target.clone()

    const duration = 1200 // 1.2s for region transitions
    const startTime = Date.now()

    const animateToRegion = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease-in-out cubic for smooth feel
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

      // Interpolate camera position
      cam.position.lerpVectors(startPosition, targetPosition, eased)

      // Interpolate orbit target
      controls.target.lerpVectors(startTarget, targetLookAt, eased)
      controls.update()

      if (progress < 1) {
        regionAnimationId = requestAnimationFrame(animateToRegion)
      } else {
        regionAnimationId = null
      }
    }

    animateToRegion()

    onCleanup(() => {
      if (regionAnimationId) {
        cancelAnimationFrame(regionAnimationId)
      }
    })
  })

  return null
}

/**
 * SceneLighting - Sets up scene lighting and fog
 */
function SceneLighting() {
  const { scene } = useThree()

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    // Atmospheric fog for depth - pushed far back for better visibility
    sceneObj.fog = new THREE.Fog('#050510', 12, 25)

    // Ambient light - brighter for better contrast
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    sceneObj.add(ambientLight)

    // Main point light - stronger for highlights
    const pointLight1 = new THREE.PointLight(0xffffff, 1.2)
    pointLight1.position.set(10, 10, 10)
    sceneObj.add(pointLight1)

    // Accent point light - slightly stronger cyan
    const pointLight2 = new THREE.PointLight(0x75e6ea, 0.4)
    pointLight2.position.set(-10, -10, -10)
    sceneObj.add(pointLight2)

    onCleanup(() => {
      sceneObj.remove(ambientLight)
      sceneObj.remove(pointLight1)
      sceneObj.remove(pointLight2)
      sceneObj.fog = null
    })
  })

  return null
}

/**
 * CameraSetup - Configures the camera with initial settings
 */
function CameraSetup() {
  const { camera } = useThree()

  onMount(() => {
    const cam = camera()
    if (!cam) return

    // Set initial camera position and FOV
    cam.position.set(...CAMERA_CONFIG.defaultPosition)
    cam.fov = CAMERA_CONFIG.fov
    cam.updateProjectionMatrix()
  })

  return null
}

// Camera position update callback for minimap
export interface CameraUpdate {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface BrainSceneMinimalProps {
  // Masterplan 2026: Accept any cluster/entity types for forward compatibility
  // The visualization layer works with both old and new types since structure is similar
  spaceClusters?: any[]
  agentClusters?: any[]
  userAgents?: any[]
  recentDiscoveries?: any[]
  zoomTarget?: THREE.Vector3 | null
  setZoomInfo?: (info: { distance: number; lod: number }) => void
  onSpaceClick?: (cluster: any, position: THREE.Vector3) => void
  onAgentClick?: (agent: any) => void
  // Region navigation props
  regionCamera?: RegionCamera | null
  selectedRegionIndex?: number
  highlightIntensity?: number
  // Camera update callback for minimap
  onCameraUpdate?: (update: CameraUpdate) => void
  // Ship visibility settings
  showIdleShips?: boolean
  // Selected ship for highlight ring
  selectedShipId?: string | null
  // Ship zoom mode - triggers close camera zoom for ship inspection
  isShipZoom?: boolean
  // Synapse type filter - dims non-matching synapses and makes them non-selectable
  synapseTypeFilter?: string | null
}

/**
 * BrainSceneMinimal - 3D brain visualization with region coloring and navigation
 *
 * This component composes the entire brain visualization scene.
 * The parent component (ThreeCanvas) provides the WebGL context.
 *
 * Converted from React Three Fiber to vanilla Three.js with SolidJS:
 * - Removed R3F Canvas wrapper (parent provides ThreeCanvas)
 * - Replaced R3F's useFrame/useThree with custom hooks from @/three/hooks
 * - Replaced drei's PerspectiveCamera/OrbitControls with custom implementations
 * - Uses SolidJS reactivity (createSignal, createEffect) instead of React hooks
 */
export function BrainSceneMinimal(props: BrainSceneMinimalProps) {
  // Default props
  const spaceClusters = () => props.spaceClusters ?? []
  const agentClusters = () => props.agentClusters ?? []
  const userAgents = () => props.userAgents ?? []
  const recentDiscoveries = () => props.recentDiscoveries ?? []
  const zoomTarget = () => props.zoomTarget ?? null
  const setZoomInfo = props.setZoomInfo ?? (() => {})
  const onSpaceClick = props.onSpaceClick
  const onAgentClick = props.onAgentClick
  const regionCamera = () => props.regionCamera ?? null
  const selectedRegionIndex = () => props.selectedRegionIndex ?? -1
  const highlightIntensity = () => props.highlightIntensity ?? 0
  const onCameraUpdate = props.onCameraUpdate

  // Track LOD level for particle count adjustment
  const [currentLodLevel, setCurrentLodLevel] = createSignal(1)

  // Store reference to OrbitControls for camera animations
  const [controlsRef, setControlsRef] = createSignal<OrbitControlsType | null>(null)

  // Track whether to show the 3D ship model (when zoomed in close)
  const showShipModel = () => props.isShipZoom ?? false

  // Get the selected ship object for 3D model rendering
  const selectedShip = () => {
    if (!props.selectedShipId) return null
    return userAgents().find(s => s.id === props.selectedShipId) ?? null
  }

  // Compute ship world position for depth-based particle visibility
  const shipWorldPosition = createMemo(() => {
    const ship = selectedShip()
    if (!ship || !showShipModel()) return null
    return new THREE.Vector3(
      ship.positionX * BRAIN_SCALE.x,
      ship.positionY * BRAIN_SCALE.y,
      ship.positionZ * BRAIN_SCALE.z
    )
  })

  // Wrapper to update both parent and local LOD state
  const handleZoomInfo = (info: { distance: number; lod: number }) => {
    setCurrentLodLevel(info.lod)
    setZoomInfo(info)
  }

  return (
    <>
      {/* Camera setup */}
      <CameraSetup />

      {/* Orbit controls for camera manipulation */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        enableRotate={true}
        minDistance={CAMERA_CONFIG.minDistance}
        maxDistance={CAMERA_CONFIG.maxDistance}
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI * 0.75}
        target={CAMERA_CONFIG.brainCenter}
        ref={setControlsRef}
      />

      {/* Scene lighting and fog */}
      <SceneLighting />

      {/* Camera controller for zoom/LOD and region navigation */}
      <CameraController
        zoomTarget={zoomTarget}
        setZoomInfo={handleZoomInfo}
        regionCamera={regionCamera}
        controlsRef={controlsRef}
        onCameraUpdate={onCameraUpdate}
        isShipZoom={() => props.isShipZoom ?? false}
      />

      {/* Core particles with region coloring - depth-filtered when zoomed on ship */}
      <SynapseParticlesMinimal
        selectedRegionIndex={selectedRegionIndex()}
        highlightIntensity={highlightIntensity()}
        lodLevel={currentLodLevel()}
        shipPosition={shipWorldPosition()}
        isShipZoom={showShipModel()}
      />

      {/* Synapse clusters - always visible for selection */}
      {spaceClusters().length > 0 && (
        <SpaceMarkers
          clusters={spaceClusters()}
          onSynapseClick={onSpaceClick}
          filterType={props.synapseTypeFilter}
        />
      )}

      {/* Synapse network connections - depth-filtered when zoomed on ship */}
      {spaceClusters().length > 0 && (
        <SynapseNetwork
          synapseClusters={spaceClusters()}
          shipPosition={shipWorldPosition()}
          isShipZoom={showShipModel()}
        />
      )}

      {/* Ship markers (Masterplan 2026: renamed from agent markers) */}
      {userAgents().length > 0 && (
        <ShipMarkers
          userShips={userAgents()}
          shipClusters={agentClusters()}
          onShipClick={onAgentClick}
          showIdleShips={props.showIdleShips}
          selectedShipId={props.selectedShipId}
          hideSelectedShipParticle={showShipModel()}
        />
      )}

      {/* 3D Ship model - shown when zoomed in close on a ship */}
      {showShipModel() && selectedShip() && (
        <ShipModel3D
          ship={selectedShip()!}
          isVisible={showShipModel()}
        />
      )}

      {/* Burn particles for active agents */}
      {userAgents().length > 0 && <BurnParticles userAgents={userAgents()} />}

      {/* Discovery effects - hidden when zoomed on ship */}
      {!showShipModel() && <DiscoveryBurst recentDiscoveries={recentDiscoveries()} />}

      {/* Post-processing effects - minimal bloom to keep particles crisp */}
      <PostProcessingEffects bloomIntensity={0.08} vignetteIntensity={0.2} />
    </>
  )
}
