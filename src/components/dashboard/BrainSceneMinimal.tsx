/**
 * BrainSceneMinimal - 3D Brain Visualization Scene
 *
 * Main scene composition component for the brain visualization.
 * Migrated from React Three Fiber to vanilla Three.js with SolidJS.
 */

import { createSignal, createEffect, onCleanup, onMount, createMemo, For } from 'solid-js'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js'
import { useThree } from '@/three/hooks'
import { OrbitControls } from '@/three/components'
import { SynapseParticlesMinimal } from '@/components/brain/SynapseParticlesMinimal'
import { RegionBoundary } from '@/components/brain/RegionBoundary'
import { SpaceMarkers } from '@/components/brain/SpaceMarkers'
import { ShipMarkers } from '@/components/brain/AgentMarkers'
import { SynapseNetwork } from '@/components/brain/SynapseNetwork'
import { DiscoveryBurst } from '@/components/brain/DiscoveryBurst'
import { TargetBeam } from '@/components/brain/TargetBeam'
import { SolvingBeam } from '@/components/brain/SolvingBeam'
import { SolvingSparks } from '@/components/brain/SolvingSparks'
import { SolvingSynapseHighlight } from '@/components/brain/SolvingSynapseHighlight'
import { ArrivalPulseManager } from '@/components/brain/ArrivalPulseManager'
import { CAMERA_CONFIG, LOD_THRESHOLDS } from '@/components/brain/core/brainConstants'
import { TIMING } from '@/constants/timing'
import type { SynapseCluster, ShipCluster, Ship, Synapse, SynapseDiscoveryEvent } from '@/stores/shipStore'

/**
 * CameraFollower - Smoothly animates camera to follow a selected ship
 *
 * When a ship is selected, lerps OrbitControls.target toward the ship position
 * and pulls the camera closer. Continues tracking moving ships each frame.
 * User interaction (drag/scroll) cancels follow mode.
 * Deselecting a ship smoothly returns to brain center.
 */
function CameraFollower(props: {
  controlsRef: () => OrbitControlsType | null
  followShipId: string | null | undefined
  followTrigger?: number
  userShips: Ship[]
}) {
  const { camera } = useThree()
  const brainCenter = new THREE.Vector3(...CAMERA_CONFIG.brainCenter)

  let isFollowing = false
  let isReturning = false
  let userInterrupted = false
  let loopId: number | null = null
  let prevFollowId: string | null = null
  let prevTrigger: number = 0

  const LERP_SPEED = 0.06
  const FOLLOW_DISTANCE = 1.8
  const _tempCamDir = new THREE.Vector3()

  const getShipPosition = (): THREE.Vector3 | null => {
    if (!props.followShipId || !props.userShips) return null
    const ship = props.userShips.find(s => s.id === props.followShipId)
    if (!ship) return null
    return new THREE.Vector3(ship.positionX, ship.positionY, ship.positionZ)
  }

  const loop = () => {
    const controls = props.controlsRef()
    const cam = camera()
    if (!controls || !cam) {
      loopId = requestAnimationFrame(loop)
      return
    }

    const shipPos = getShipPosition()

    if (shipPos && !userInterrupted) {
      isFollowing = true
      isReturning = false

      // Lerp orbit target toward ship position
      controls.target.lerp(shipPos, LERP_SPEED)

      // Pull camera closer to follow distance
      _tempCamDir.copy(cam.position).sub(controls.target).normalize()
      const currentDist = cam.position.distanceTo(controls.target)
      const newDist = currentDist + (FOLLOW_DISTANCE - currentDist) * LERP_SPEED
      cam.position.copy(controls.target).addScaledVector(_tempCamDir, newDist)

      controls.update()
    } else if (isFollowing || isReturning) {
      // No ship selected or user interrupted — return to brain center
      isFollowing = false
      isReturning = true

      const dist = controls.target.distanceTo(brainCenter)
      if (dist > 0.01) {
        controls.target.lerp(brainCenter, LERP_SPEED)
        controls.update()
      } else {
        controls.target.copy(brainCenter)
        controls.update()
        isReturning = false
        userInterrupted = false
      }
    }

    loopId = requestAnimationFrame(loop)
  }

  // Watch for ship selection changes OR follow trigger (re-click same ship)
  createEffect(() => {
    const shipId = props.followShipId ?? null
    const trigger = props.followTrigger ?? 0
    const triggerChanged = trigger !== prevTrigger
    prevTrigger = trigger

    if (shipId && (shipId !== prevFollowId || triggerChanged)) {
      userInterrupted = false
      isFollowing = true
      isReturning = false
    } else if (!shipId && prevFollowId) {
      if (isFollowing) {
        isFollowing = false
        isReturning = true
        userInterrupted = false
      }
    }
    prevFollowId = shipId
  })

  // Listen for user interaction to cancel follow
  onMount(() => {
    const checkControls = () => {
      const controls = props.controlsRef()
      if (!controls) {
        requestAnimationFrame(checkControls)
        return
      }

      const handleUserInteract = () => {
        if (isFollowing) {
          userInterrupted = true
          isFollowing = false
        }
      }
      controls.addEventListener('start', handleUserInteract)
      onCleanup(() => controls.removeEventListener('start', handleUserInteract))
    }
    checkControls()

    loopId = requestAnimationFrame(loop)
    onCleanup(() => { if (loopId) cancelAnimationFrame(loopId) })
  })

  return null
}

/**
 * CameraObserver - Lightweight per-frame LOD + minimap reporter
 *
 * Orbit always stays centered on brain center [0, 0.1, 0].
 * This component only reads camera position each frame to:
 * 1. Calculate LOD from distance to brain center
 * 2. Report camera position for minimap (throttled by delta)
 */
function CameraObserver(props: {
  setZoomInfo: (info: { distance: number; lod: number }) => void
  controlsRef: () => OrbitControlsType | null
  onCameraUpdate?: (update: CameraUpdate) => void
}) {
  const { camera } = useThree()
  const brainCenter = new THREE.Vector3(...CAMERA_CONFIG.brainCenter)

  let loopId: number | null = null
  let lastReportedCam = { x: 0, y: 0, z: 0 }

  const loop = () => {
    const cam = camera()
    if (cam) {
      const distance = cam.position.distanceTo(brainCenter)
      let lod = 0
      if (distance > LOD_THRESHOLDS.lod1) lod = 2
      else if (distance > LOD_THRESHOLDS.lod0) lod = 1
      props.setZoomInfo({ distance, lod })

      if (props.onCameraUpdate) {
        const delta = Math.abs(cam.position.x - lastReportedCam.x) +
                      Math.abs(cam.position.y - lastReportedCam.y) +
                      Math.abs(cam.position.z - lastReportedCam.z)
        if (delta > TIMING.POSITION_THRESHOLD) {
          lastReportedCam = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
          const controls = props.controlsRef()
          props.onCameraUpdate({
            position: lastReportedCam,
            target: controls
              ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
              : { x: 0, y: 0.1, z: 0 },
          })
        }
      }
    }
    loopId = requestAnimationFrame(loop)
  }

  onMount(() => {
    loopId = requestAnimationFrame(loop)
    onCleanup(() => { if (loopId) cancelAnimationFrame(loopId) })
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
  setZoomInfo?: (info: { distance: number; lod: number }) => void
  // Click handlers
  onSpaceClick?: (cluster: SynapseCluster, position: THREE.Vector3) => void
  onAgentClick?: (agent: Ship) => void
  // Individual synapse click handler (for 500k individual mode)
  onIndividualSynapseClick?: (index: number, position: THREE.Vector3) => void
  // Region navigation props
  selectedRegionIndex?: number
  highlightIntensity?: number
  // Camera update callback for minimap
  onCameraUpdate?: (update: CameraUpdate) => void
  // Ship visibility settings
  showIdleShips?: boolean
  // Selected ship for highlight ring
  selectedShipId?: string | null
  // Counter that increments on every ship click — forces re-zoom even for same ship
  followTrigger?: number
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
  const setZoomInfo = props.setZoomInfo ?? (() => {})
  const onSpaceClick = props.onSpaceClick
  const onAgentClick = props.onAgentClick
  const onIndividualSynapseClick = props.onIndividualSynapseClick
  const selectedRegionIndex = () => props.selectedRegionIndex ?? -1
  const highlightIntensity = () => props.highlightIntensity ?? 0
  const onCameraUpdate = props.onCameraUpdate

  // Track LOD level for particle count adjustment
  const [currentLodLevel, setCurrentLodLevel] = createSignal(1)

  // Store reference to OrbitControls for camera animations
  const [controlsRef, setControlsRef] = createSignal<OrbitControlsType | null>(null)

  // Get the selected ship object for 3D model rendering
  const selectedShip = () => {
    if (!props.selectedShipId) return null
    return userAgents().find(s => s.id === props.selectedShipId) ?? null
  }

  // Compute selected ship position for TargetBeam (always visible if ship selected, even in searching state)
  const selectedShipPosition = createMemo(() => {
    const ship = selectedShip()
    if (!ship) return null
    return new THREE.Vector3(ship.positionX, ship.positionY, ship.positionZ)
  })

  // Compute exploration target position for TargetBeam
  const explorationTargetPosition = createMemo(() => {
    const target = props.explorationTarget
    if (!target) return null
    return new THREE.Vector3(target.positionX, target.positionY, target.positionZ)
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

      {/* Camera observer for LOD + minimap reporting */}
      <CameraObserver
        setZoomInfo={handleZoomInfo}
        controlsRef={controlsRef}
        onCameraUpdate={onCameraUpdate}
      />

      {/* Camera follower - zooms to and tracks selected ship */}
      <CameraFollower
        controlsRef={controlsRef}
        followShipId={props.selectedShipId}
        followTrigger={props.followTrigger}
        userShips={userAgents()}
      />

      {/* Core particles with region coloring */}
      <SynapseParticlesMinimal
        selectedRegionIndex={selectedRegionIndex()}
        highlightIntensity={highlightIntensity()}
        lodLevel={currentLodLevel()}
        shipPosition={null}
        isShipZoom={false}
      />

      {/* Region boundary wireframe */}
      <RegionBoundary selectedRegionIndex={selectedRegionIndex()} />

      {/* Synapse clusters - always mounted to avoid Three.js object destroy/recreate */}
      <SpaceMarkers
        clusters={spaceClusters()}
        onSynapseClick={onSpaceClick}
        onIndividualSynapseClick={onIndividualSynapseClick}
        filterType={props.synapseTypeFilter}
        hasIdleShip={props.hasIdleShip}
        userLevel={props.userLevel}
      />

      {/* Synapse network connections - always mounted */}
      <SynapseNetwork
        synapseClusters={spaceClusters()}
        shipPosition={null}
        isShipZoom={false}
        lodLevel={currentLodLevel()}
      />

      {/* Ship markers (instanced GLB models for all ships) */}
      <ShipMarkers
        userShips={userAgents()}
        shipClusters={agentClusters()}
        onShipClick={onAgentClick}
        showIdleShips={props.showIdleShips}
        selectedShipId={props.selectedShipId}
      />

      {/* Target beam - visualizes connection between searching ship and selected synapse */}
      <TargetBeam
        shipPosition={selectedShipPosition()}
        targetPosition={explorationTargetPosition()}
        isActive={isTargetBeamActive()}
        color={0x00ffff}
      />

      {/* Solving beams - visualize connection between solving ships and their synapses */}
      <For each={userAgents().filter(ship => {
        if (ship.state !== 'solving') return false
        if (ship.targetPositionX !== undefined) return true
        if (ship.currentSynapseId && props.currentExplorationSynapse?.id === ship.currentSynapseId) return true
        return false
      })}>
        {(ship) => {
          const matchesSynapse = props.currentExplorationSynapse?.id === ship.currentSynapseId
          const synapseType = matchesSynapse ? props.currentExplorationSynapse?.synapseType : undefined
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
        }}
      </For>

      {/* Highlight synapse being solved */}
      <SolvingSynapseHighlight synapse={props.currentExplorationSynapse} />

      {/* Arrival pulse effects - shown when ships arrive at synapses */}
      <ArrivalPulseManager ships={userAgents()} />

      {/* Discovery effects */}
      <DiscoveryBurst recentDiscoveries={recentDiscoveries()} />
    </>
  )
}
