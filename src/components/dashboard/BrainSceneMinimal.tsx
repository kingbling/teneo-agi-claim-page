/**
 * BrainSceneMinimal - 3D Brain Visualization Scene
 *
 * Main scene composition component for the brain visualization.
 * Migrated from React Three Fiber to vanilla Three.js with SolidJS.
 */

import { createSignal, createEffect, onCleanup, onMount, createMemo, type Accessor } from 'solid-js'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js'
import { useThree } from '@/three/hooks'
import { OrbitControls } from '@/three/components'
import { SynapseParticlesMinimal } from '@/components/brain/SynapseParticlesMinimal'
import { SpaceMarkers } from '@/components/brain/SpaceMarkers'
import { ShipMarkers } from '@/components/brain/AgentMarkers'
import { SynapseNetwork } from '@/components/brain/SynapseNetwork'
import { DiscoveryBurst } from '@/components/brain/DiscoveryBurst'
import { ShipModel3D } from '@/components/brain/ShipModel3D'
import { TargetBeam } from '@/components/brain/TargetBeam'
import { SolvingBeam } from '@/components/brain/SolvingBeam'
import { SolvingSparks } from '@/components/brain/SolvingSparks'
import { SolvingSynapseHighlight } from '@/components/brain/SolvingSynapseHighlight'
import { ArrivalPulseManager } from '@/components/brain/ArrivalPulseManager'
import { WorldShipMarkers } from '@/components/brain/WorldShipMarkers'
import { CAMERA_CONFIG, LOD_THRESHOLDS, SHIP_ZOOM_CONFIG, SHIP_FOLLOW_CONFIG, constrainToBrainShape } from '@/components/brain/core/brainConstants'
import { TIMING } from '@/constants/timing'
import type { SynapseCluster, ShipCluster, Ship, Synapse, SynapseDiscoveryEvent } from '@/stores/shipStore'
import { log, fmt } from '@/utils/logger'

/**
 * Region camera target for navigating to brain regions
 */
export interface RegionCamera {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * Helper to validate Vector3 values are finite and not NaN
 */
function isValidVector3(v: THREE.Vector3 | null): boolean {
  if (!v) return false
  return isFinite(v.x) && isFinite(v.y) && isFinite(v.z) &&
         !isNaN(v.x) && !isNaN(v.y) && !isNaN(v.z)
}

/**
 * Camera animation modes - only one can be active at a time
 */
type CameraMode = 'idle' | 'zoom' | 'follow' | 'region'

/**
 * CameraController - Unified camera control with single animation loop
 *
 * Uses a state machine approach:
 * - Single requestAnimationFrame loop handles all camera movement
 * - Clear priority: FOLLOW > ZOOM > REGION > IDLE
 * - Effects only trigger state changes, not animations directly
 */
export function CameraController(props: {
  zoomTarget: Accessor<THREE.Vector3 | null>
  setZoomInfo: (info: { distance: number; lod: number }) => void
  regionCamera: Accessor<RegionCamera | null>
  controlsRef: Accessor<OrbitControlsType | null>
  onCameraUpdate?: (update: CameraUpdate) => void
  isShipZoom?: Accessor<boolean>
  isFollowing?: Accessor<boolean>
}) {
  const { camera } = useThree()

  // Centralized animation state
  const state = {
    loopId: null as number | null,
    mode: 'idle' as CameraMode,
    // Timed animation state (for zoom/region)
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    startTime: 0,
    duration: 0,
    easeType: 'out' as 'out' | 'inout',
    // Tracking to prevent duplicate animations
    lastZoomTargetId: '',
    originalMinDistance: CAMERA_CONFIG.minDistance,
    // LOD reporting state
    lastReportedCam: { x: 0, y: 0, z: 0 },
    lastReportedTarget: { x: 0, y: 0, z: 0 },
  }

  // Easing functions
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

  // Main animation loop - runs continuously, checks state each frame
  const animationLoop = () => {
    const controls = props.controlsRef()
    const cam = camera()

    if (controls && cam) {
      const zoomTarget = props.zoomTarget()
      const isFollowing = props.isFollowing?.() ?? false
      const isShipZoom = props.isShipZoom?.() ?? false

      // Priority 1: FOLLOW MODE - continuous ship tracking
      if (isFollowing && zoomTarget && isValidVector3(zoomTarget)) {
        state.mode = 'follow'
        const offset = new THREE.Vector3(...SHIP_FOLLOW_CONFIG.followOffset)
        const targetCamPos = zoomTarget.clone().add(offset)

        const distToCam = cam.position.distanceTo(targetCamPos)
        const distToTarget = controls.target.distanceTo(zoomTarget)

        // Only lerp if not already at target (prevents drift)
        if (distToCam > 0.01 || distToTarget > 0.01) {
          const lerpFactor = SHIP_FOLLOW_CONFIG.followLerpSpeed / 60
          cam.position.lerp(targetCamPos, lerpFactor)
          controls.target.lerp(zoomTarget, lerpFactor)
          controls.update()
        }
      }
      // Priority 2: ZOOM/REGION - timed animations
      else if (state.mode === 'zoom' || state.mode === 'region') {
        const elapsed = Date.now() - state.startTime
        const progress = Math.min(elapsed / state.duration, 1)
        const eased = state.easeType === 'out'
          ? easeOutCubic(progress)
          : easeInOutCubic(progress)

        cam.position.lerpVectors(state.startPos, state.endPos, eased)
        controls.target.lerpVectors(state.startTarget, state.endTarget, eased)
        controls.update()

        // Animation complete
        if (progress >= 1) {
          // Restore minDistance after non-ship zoom
          if (state.mode === 'zoom' && !isShipZoom) {
            controls.minDistance = state.originalMinDistance
          }
          state.mode = 'idle'
        }
      }

      // Update LOD (runs every frame, cheap calculation)
      const distance = cam.position.distanceTo(new THREE.Vector3(...CAMERA_CONFIG.brainCenter))
      let lod = 0
      if (distance > LOD_THRESHOLDS.lod1) lod = 2
      else if (distance > LOD_THRESHOLDS.lod0) lod = 1
      props.setZoomInfo({ distance, lod })

      // Report camera position for minimap (throttled by delta check)
      if (props.onCameraUpdate) {
        const camDelta = Math.abs(cam.position.x - state.lastReportedCam.x) +
                         Math.abs(cam.position.y - state.lastReportedCam.y) +
                         Math.abs(cam.position.z - state.lastReportedCam.z)
        const targetDelta = Math.abs(controls.target.x - state.lastReportedTarget.x) +
                            Math.abs(controls.target.y - state.lastReportedTarget.y) +
                            Math.abs(controls.target.z - state.lastReportedTarget.z)

        if (camDelta > TIMING.POSITION_THRESHOLD || targetDelta > TIMING.POSITION_THRESHOLD) {
          state.lastReportedCam = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
          state.lastReportedTarget = { x: controls.target.x, y: controls.target.y, z: controls.target.z }
          props.onCameraUpdate({
            position: state.lastReportedCam,
            target: state.lastReportedTarget,
          })
        }
      }
    }

    state.loopId = requestAnimationFrame(animationLoop)
  }

  // Start loop on mount, cleanup on unmount
  onMount(() => {
    state.loopId = requestAnimationFrame(animationLoop)

    onCleanup(() => {
      if (state.loopId) {
        cancelAnimationFrame(state.loopId)
        state.loopId = null
      }
      const controls = props.controlsRef()
      if (controls) {
        controls.minDistance = CAMERA_CONFIG.minDistance
        controls.maxDistance = CAMERA_CONFIG.maxDistance
      }
    })
  })

  // Effect: Trigger zoom animation when target changes
  createEffect(() => {
    const zoomTarget = props.zoomTarget()
    const isShipZoom = props.isShipZoom?.() ?? false
    const isFollowing = props.isFollowing?.() ?? false
    const controls = props.controlsRef()
    const cam = camera()

    // Don't trigger zoom during follow mode
    if (!zoomTarget || !controls || !cam || isFollowing) return
    if (!isValidVector3(zoomTarget)) return

    // Check if this is a new target
    const targetId = `${zoomTarget.x.toFixed(3)}-${zoomTarget.y.toFixed(3)}-${zoomTarget.z.toFixed(3)}-${isShipZoom}`
    if (state.lastZoomTargetId === targetId) return
    state.lastZoomTargetId = targetId

    // Set up zoom animation
    const offset = isShipZoom
      ? new THREE.Vector3(...SHIP_ZOOM_CONFIG.zoomOffset)
      : new THREE.Vector3(0, 0, 3)

    state.startPos.copy(cam.position)
    state.endPos.copy(zoomTarget).add(offset)
    state.startTarget.copy(controls.target)
    state.endTarget.copy(zoomTarget)
    state.startTime = Date.now()
    state.duration = isShipZoom ? SHIP_ZOOM_CONFIG.animationDuration : 1000
    state.easeType = 'out'
    state.mode = 'zoom'

    // Handle minDistance for ship zoom
    if (isShipZoom) {
      state.originalMinDistance = controls.minDistance
      controls.minDistance = SHIP_ZOOM_CONFIG.minDistanceOverride
    }
  })

  // Effect: Trigger region animation
  createEffect(() => {
    const regionCamera = props.regionCamera()
    const isShipZoom = props.isShipZoom?.() ?? false
    const isFollowing = props.isFollowing?.() ?? false
    const controls = props.controlsRef()
    const cam = camera()

    if (!controls || !cam) return
    // Don't animate regions during ship zoom or follow
    if (isShipZoom || isFollowing) return
    // Don't interrupt zoom animation
    if (state.mode === 'zoom') return
    if (!regionCamera) return

    // Set up region animation
    state.startPos.copy(cam.position)
    state.endPos.set(...regionCamera.position)
    state.startTarget.copy(controls.target)
    state.endTarget.set(...regionCamera.target)
    state.startTime = Date.now()
    state.duration = 1200
    state.easeType = 'inout'
    state.mode = 'region'
  })

  // Effect: Handle minDistance restoration when exiting ship zoom
  createEffect(() => {
    const isShipZoom = props.isShipZoom?.() ?? false
    const isFollowing = props.isFollowing?.() ?? false
    const controls = props.controlsRef()

    if (!isShipZoom && !isFollowing && controls && state.mode === 'idle') {
      controls.minDistance = state.originalMinDistance
    }
  })

  // Effect: Set minDistance when entering follow mode
  createEffect(() => {
    const isFollowing = props.isFollowing?.() ?? false
    const controls = props.controlsRef()

    if (isFollowing && controls) {
      state.originalMinDistance = controls.minDistance
      controls.minDistance = SHIP_ZOOM_CONFIG.minDistanceOverride
    }
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

export interface BrainSceneMinimalProps {
  // Cluster data for LOD visualization
  spaceClusters?: SynapseCluster[]
  agentClusters?: ShipCluster[]
  // User's ships for rendering
  userAgents?: Ship[]
  // Recent discovery events for burst effects
  recentDiscoveries?: SynapseDiscoveryEvent[]
  // Camera zoom target
  zoomTarget?: THREE.Vector3 | null
  setZoomInfo?: (info: { distance: number; lod: number }) => void
  // Click handlers
  onSpaceClick?: (cluster: SynapseCluster, position: THREE.Vector3) => void
  onAgentClick?: (agent: Ship) => void
  // Individual synapse click handler (for 500k individual mode)
  onIndividualSynapseClick?: (index: number, position: THREE.Vector3) => void
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
  // Camera following mode - continuous tracking of moving ship
  isFollowing?: boolean
  // Synapse type filter - dims non-matching synapses and makes them non-selectable
  synapseTypeFilter?: string | null
  // Exploration target for visualizing ship-to-synapse connection
  explorationTarget?: Synapse | null
  // Current synapse being explored by the selected ship (for solving beam animation)
  currentExplorationSynapse?: Synapse | null
  // Whether user has at least one idle ship available for deployment
  hasIdleShip?: boolean
  // User level for unlocking synapse types
  userLevel?: number
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
  const onIndividualSynapseClick = props.onIndividualSynapseClick
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
  // Uses constrainToBrainShape to match exact rendered ship position
  const shipWorldPosition = createMemo(() => {
    const ship = selectedShip()
    if (!ship || !showShipModel()) return null
    const [x, y, z] = constrainToBrainShape(ship.positionX, ship.positionY, ship.positionZ)
    return new THREE.Vector3(x, y, z)
  })

  // Compute selected ship position for TargetBeam (always visible if ship selected, even in searching state)
  // Uses constrainToBrainShape to match exact rendered ship position
  const selectedShipPosition = createMemo(() => {
    const ship = selectedShip()
    if (!ship) return null
    const [x, y, z] = constrainToBrainShape(ship.positionX, ship.positionY, ship.positionZ)
    return new THREE.Vector3(x, y, z)
  })

  // Compute exploration target position for TargetBeam
  // Uses constrainToBrainShape to match exact rendered synapse position
  const explorationTargetPosition = createMemo(() => {
    const target = props.explorationTarget
    if (!target) return null
    const [x, y, z] = constrainToBrainShape(target.positionX, target.positionY, target.positionZ)
    return new THREE.Vector3(x, y, z)
  })

  // Determine if TargetBeam should be active (ship is idle and has a target)
  const isTargetBeamActive = () => {
    const ship = selectedShip()
    return ship?.state === 'idle' && props.explorationTarget !== null && props.explorationTarget !== undefined
  }

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
        isFollowing={() => props.isFollowing ?? false}
      />

      {/* Core particles with region coloring */}
      <SynapseParticlesMinimal
        selectedRegionIndex={selectedRegionIndex()}
        highlightIntensity={highlightIntensity()}
        lodLevel={currentLodLevel()}
        shipPosition={shipWorldPosition()}
        isShipZoom={false}  // Disabled: depth cutout looked bad
      />

      {/* Synapse clusters - always visible for selection */}
      {spaceClusters().length > 0 && (
        <SpaceMarkers
          clusters={spaceClusters()}
          onSynapseClick={onSpaceClick}
          onIndividualSynapseClick={onIndividualSynapseClick}
          filterType={props.synapseTypeFilter}
          hasIdleShip={props.hasIdleShip}
          userLevel={props.userLevel}
        />
      )}

      {/* Synapse network connections */}
      {spaceClusters().length > 0 && (
        <SynapseNetwork
          synapseClusters={spaceClusters()}
          shipPosition={shipWorldPosition()}
          isShipZoom={false}  // Disabled: depth cutout looked bad
        />
      )}

      {/* World ships (other users + ambient) */}
      <WorldShipMarkers />

      {/* Ship markers (Masterplan 2026: renamed from agent markers) */}
      {/* Always render - component handles empty array internally. Conditional rendering causes unmount/remount which destroys Three.js objects */}
      <ShipMarkers
        userShips={userAgents()}
        shipClusters={agentClusters()}
        onShipClick={onAgentClick}
        showIdleShips={props.showIdleShips}
        selectedShipId={props.selectedShipId}
        hideSelectedShipParticle={showShipModel()}
      />

      {/* Target beam - visualizes connection between searching ship and selected synapse */}
      <TargetBeam
        shipPosition={selectedShipPosition()}
        targetPosition={explorationTargetPosition()}
        isActive={isTargetBeamActive()}
        color={0x00ffff}
      />

      {/* 3D Ship model - shown when zoomed in close on a ship */}
      {(() => {
        const shouldShowModel = showShipModel()
        const ship = selectedShip()
        // Debug logging
        if (shouldShowModel || ship) {
          log.brain.debug('Ship model check:', {
            showShipModel: shouldShowModel,
            selectedShipId: fmt.shortId(props.selectedShipId),
            hasShip: !!ship,
            shipId: fmt.shortId(ship?.id),
          })
        }
        return shouldShowModel && ship ? (
          <ShipModel3D
            ship={ship}
            isVisible={shouldShowModel}
          />
        ) : null
      })()}

      {/* Solving beams - visualize connection between solving ships and their synapses */}
      {userAgents()
        .filter(ship => {
          if (ship.state !== 'solving') return false
          // Ship has targetPosition from travel
          if (ship.targetPositionX !== undefined) return true
          // Ship is solving and we have synapse data with matching ID
          if (ship.currentSynapseId && props.currentExplorationSynapse?.id === ship.currentSynapseId) return true
          return false
        })
        .map(ship => {
          // Get synapse type for animation speed - use currentExplorationSynapse if it matches this ship
          const matchesSynapse = props.currentExplorationSynapse?.id === ship.currentSynapseId
          const synapseType = matchesSynapse ? props.currentExplorationSynapse?.synapseType : undefined

          // Use ship's targetPosition if available, otherwise fall back to synapse position
          const synapsePos = ship.targetPositionX !== undefined
            ? { x: ship.targetPositionX, y: ship.targetPositionY!, z: ship.targetPositionZ! }
            : matchesSynapse && props.currentExplorationSynapse
              ? { x: props.currentExplorationSynapse.positionX, y: props.currentExplorationSynapse.positionY, z: props.currentExplorationSynapse.positionZ }
              : null

          if (!synapsePos) return null

          return (
            <>
              <SolvingBeam
                ship={ship}
                synapsePosition={synapsePos}
                isActive={true}
                synapseType={synapseType}
              />
              <SolvingSparks
                ship={ship}
                synapsePosition={synapsePos}
                isActive={true}
                synapseType={synapseType}
              />
            </>
          )
        })}

      {/* Highlight synapse being solved */}
      <SolvingSynapseHighlight synapse={props.currentExplorationSynapse} />

      {/* Arrival pulse effects - shown when ships arrive at synapses */}
      <ArrivalPulseManager ships={userAgents()} />

      {/* Discovery effects - hidden when zoomed on ship */}
      {!showShipModel() && <DiscoveryBurst recentDiscoveries={recentDiscoveries()} />}
    </>
  )
}
