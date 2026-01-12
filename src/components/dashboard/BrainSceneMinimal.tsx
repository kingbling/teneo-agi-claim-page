/**
 * BrainSceneMinimal - 3D Brain Visualization Scene
 *
 * Main scene composition component for the brain visualization.
 * Migrated from React Three Fiber to vanilla Three.js with SolidJS.
 */

import { createSignal, createEffect, onCleanup, onMount, type Accessor } from 'solid-js'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js'
import { useThree, useFrame } from '@/three/hooks'
import { OrbitControls } from '@/three/components'
import { SynapseParticlesMinimal } from '@/components/brain/SynapseParticlesMinimal'
import { SpaceMarkersNew } from '@/components/brain/SpaceMarkersNew'
import { ShipMarkersNew } from '@/components/brain/AgentMarkersNew'
import { SynapseNetworkNew } from '@/components/brain/SynapseNetworkNew'
import { BurnParticlesNew } from '@/components/brain/BurnParticlesNew'
import { ElectronFlowNew } from '@/components/brain/ElectronFlowNew'
import { DiscoveryBurstNew } from '@/components/brain/DiscoveryBurstNew'
import { PostProcessingEffects } from '@/components/brain/PostProcessingEffects'
import { CAMERA_CONFIG, LOD_THRESHOLDS } from '@/components/brain/core/brainConstants'

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
 */
export function CameraController(props: {
  zoomTarget: Accessor<THREE.Vector3 | null>
  setZoomInfo: (info: { distance: number; lod: number }) => void
  regionCamera: Accessor<RegionCamera | null>
  controlsRef: Accessor<OrbitControlsType | null>
  onCameraUpdate?: (update: CameraUpdate) => void
}) {
  const { camera } = useThree()
  let animationId: number | null = null

  // LOD update loop and camera position reporting
  createEffect(() => {
    const cam = camera()
    const controls = props.controlsRef()
    if (!cam) return

    const updateLODAndCamera = () => {
      const distance = cam.position.distanceTo(new THREE.Vector3(0, 0, 0))
      let lod = 0
      if (distance > LOD_THRESHOLDS.lod1) lod = 2
      else if (distance > LOD_THRESHOLDS.lod0) lod = 1
      props.setZoomInfo({ distance, lod })

      // Report camera position for minimap
      if (props.onCameraUpdate) {
        const target = controls?.target ?? new THREE.Vector3(0, 0, 0)
        props.onCameraUpdate({
          position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
          target: { x: target.x, y: target.y, z: target.z },
        })
      }
    }

    updateLODAndCamera()

    const interval = setInterval(updateLODAndCamera, 100)  // More frequent for smooth minimap
    onCleanup(() => clearInterval(interval))
  })

  // Smooth camera movement to zoom target
  createEffect(() => {
    const zoomTarget = props.zoomTarget()
    const controls = props.controlsRef()
    const cam = camera()

    if (!zoomTarget || !controls || !cam) return

    const startPosition = cam.position.clone()
    const endPosition = zoomTarget.clone().add(new THREE.Vector3(0, 0, 3))
    const duration = 1000
    const startTime = Date.now()

    const animateCamera = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // Ease out cubic

      cam.position.lerpVectors(startPosition, endPosition, eased)
      if (controls.target) {
        controls.target.copy(zoomTarget)
      }

      if (progress < 1) {
        requestAnimationFrame(animateCamera)
      }
    }

    animateCamera()
  })

  // Animate camera to region viewpoint
  createEffect(() => {
    const regionCamera = props.regionCamera()
    const controls = props.controlsRef()
    const cam = camera()

    if (!controls || !cam) return

    // Cancel any ongoing animation
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    // If no region selected, animate back to default view
    const targetPosition = regionCamera
      ? new THREE.Vector3(...regionCamera.position)
      : new THREE.Vector3(...CAMERA_CONFIG.defaultPosition)
    const targetLookAt = regionCamera
      ? new THREE.Vector3(...regionCamera.target)
      : new THREE.Vector3(0, 0, 0)

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
        animationId = requestAnimationFrame(animateToRegion)
      } else {
        animationId = null
      }
    }

    animateToRegion()

    onCleanup(() => {
      if (animationId) {
        cancelAnimationFrame(animationId)
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
      />

      {/* Core particles with region coloring - count adjusts based on zoom level */}
      <SynapseParticlesMinimal
        selectedRegionIndex={selectedRegionIndex()}
        highlightIntensity={highlightIntensity()}
        lodLevel={currentLodLevel()}
      />

      {/* Synapse clusters (Masterplan 2026: renamed from space clusters) */}
      {spaceClusters().length > 0 && (
        <SpaceMarkersNew clusters={spaceClusters()} onSynapseClick={onSpaceClick} />
      )}

      {/* Synapse network connections */}
      {spaceClusters().length > 0 && (
        <SynapseNetworkNew synapseClusters={spaceClusters()} />
      )}

      {/* Ship markers (Masterplan 2026: renamed from agent markers) */}
      {userAgents().length > 0 && (
        <ShipMarkersNew
          userShips={userAgents()}
          shipClusters={agentClusters()}
          onShipClick={onAgentClick}
        />
      )}

      {/* Burn particles for active agents */}
      {userAgents().length > 0 && <BurnParticlesNew userAgents={userAgents()} />}

      {/* Discovery effects */}
      <ElectronFlowNew
        recentDiscoveries={recentDiscoveries()}
        spaceClusters={spaceClusters()}
      />
      <DiscoveryBurstNew recentDiscoveries={recentDiscoveries()} />

      {/* Post-processing effects - bloom glow and vignette */}
      <PostProcessingEffects bloomIntensity={0.6} vignetteIntensity={0.25} />
    </>
  )
}
