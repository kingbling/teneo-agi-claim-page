import { useEffect, useRef, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { SynapseParticlesMinimal } from '@/components/brain/SynapseParticlesMinimal'
import { SpaceMarkersNew } from '@/components/brain/SpaceMarkersNew'
import { ShipMarkersNew } from '@/components/brain/AgentMarkersNew'
import { SynapseNetworkNew } from '@/components/brain/SynapseNetworkNew'
import { BurnParticlesNew } from '@/components/brain/BurnParticlesNew'
import { ElectronFlowNew } from '@/components/brain/ElectronFlowNew'
import { DiscoveryBurstNew } from '@/components/brain/DiscoveryBurstNew'
import { PostProcessingEffects } from '@/components/brain/PostProcessingEffects'
import { CAMERA_CONFIG, LOD_THRESHOLDS } from '@/components/brain/core/brainConstants'
// Masterplan 2026: Types no longer imported - using 'any' for compatibility
// Old types: SpaceCluster, Agent, AgentCluster, SpaceDiscoveryEvent from @/types/agent
// New types: SynapseCluster, Ship, ShipCluster, SynapseDiscoveryEvent from @/stores/shipStore

/**
 * Region camera target for navigating to brain regions
 */
export interface RegionCamera {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * CameraController - Handles camera zoom, LOD changes, and region navigation
 */
export function CameraController({
  zoomTarget,
  setZoomInfo,
  regionCamera,
}: {
  zoomTarget: THREE.Vector3 | null
  setZoomInfo: (info: { distance: number; lod: number }) => void
  regionCamera?: RegionCamera | null
}) {
  const { camera, controls } = useThree()
  const animationRef = useRef<number | null>(null)

  useFrame(() => {
    if (controls && (controls as OrbitControlsType).update) {
      ;(controls as OrbitControlsType).update()
    }
  })

  useEffect(() => {
    if (!camera) return

    const updateLOD = () => {
      const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0))
      let lod = 0
      if (distance > LOD_THRESHOLDS.lod1) lod = 2
      else if (distance > LOD_THRESHOLDS.lod0) lod = 1
      setZoomInfo({ distance, lod })
    }

    updateLOD()

    const interval = setInterval(updateLOD, 500)
    return () => clearInterval(interval)
  }, [camera, setZoomInfo])

  // Smooth camera movement to zoom target
  useEffect(() => {
    if (!zoomTarget || !controls) return

    const startPosition = camera.position.clone()
    const endPosition = zoomTarget.clone().add(new THREE.Vector3(0, 0, 3))
    const duration = 1000
    const startTime = Date.now()

    const animateCamera = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // Ease out cubic

      camera.position.lerpVectors(startPosition, endPosition, eased)
      if (controls && (controls as OrbitControlsType).target) {
        ;(controls as OrbitControlsType).target.copy(zoomTarget)
      }

      if (progress < 1) {
        requestAnimationFrame(animateCamera)
      }
    }

    animateCamera()
  }, [zoomTarget, camera, controls])

  // Animate camera to region viewpoint
  useEffect(() => {
    if (!controls) return

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    // If no region selected, animate back to default view
    const targetPosition = regionCamera
      ? new THREE.Vector3(...regionCamera.position)
      : new THREE.Vector3(...CAMERA_CONFIG.defaultPosition)
    const targetLookAt = regionCamera
      ? new THREE.Vector3(...regionCamera.target)
      : new THREE.Vector3(0, 0, 0)

    const startPosition = camera.position.clone()
    const orbitControls = controls as OrbitControlsType
    const startTarget = orbitControls.target.clone()

    const duration = 1200  // 1.2s for region transitions
    const startTime = Date.now()

    const animateToRegion = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease-in-out cubic for smooth feel
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2

      // Interpolate camera position
      camera.position.lerpVectors(startPosition, targetPosition, eased)

      // Interpolate orbit target
      orbitControls.target.lerpVectors(startTarget, targetLookAt, eased)
      orbitControls.update()

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateToRegion)
      } else {
        animationRef.current = null
      }
    }

    animateToRegion()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [regionCamera, camera, controls])

  return null
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
}

/**
 * BrainSceneMinimal - 3D brain visualization with region coloring and navigation
 */
export function BrainSceneMinimal({
  spaceClusters = [],
  agentClusters = [],
  userAgents = [],
  recentDiscoveries = [],
  zoomTarget = null,
  setZoomInfo = () => {},
  onSpaceClick,
  onAgentClick,
  regionCamera = null,
  selectedRegionIndex = -1,
  highlightIntensity = 0,
}: BrainSceneMinimalProps) {
  // Track LOD level for particle count adjustment
  const [currentLodLevel, setCurrentLodLevel] = useState(1)

  // Wrapper to update both parent and local LOD state
  const handleZoomInfo = useCallback((info: { distance: number; lod: number }) => {
    setCurrentLodLevel(info.lod)
    setZoomInfo(info)
  }, [setZoomInfo])

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={CAMERA_CONFIG.defaultPosition}
        fov={CAMERA_CONFIG.fov}
      />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        enableRotate={true}
        minDistance={CAMERA_CONFIG.minDistance}
        maxDistance={CAMERA_CONFIG.maxDistance}
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI * 0.75}
      />

      {/* Atmospheric fog for depth - subtle fog to avoid washing out scene */}
      <fog attach="fog" args={['#0a0a1a', 4, 10]} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#75e6ea" />

      {/* Camera controller for zoom/LOD and region navigation */}
      <CameraController
        zoomTarget={zoomTarget}
        setZoomInfo={handleZoomInfo}
        regionCamera={regionCamera}
      />

      {/* Core particles with region coloring - count adjusts based on zoom level */}
      <SynapseParticlesMinimal
        selectedRegionIndex={selectedRegionIndex}
        highlightIntensity={highlightIntensity}
        lodLevel={currentLodLevel}
      />

      {/* Synapse clusters (Masterplan 2026: renamed from space clusters) */}
      {spaceClusters.length > 0 && (
        <SpaceMarkersNew clusters={spaceClusters} onSynapseClick={onSpaceClick} />
      )}

      {/* Synapse network connections */}
      {spaceClusters.length > 0 && (
        <SynapseNetworkNew synapseClusters={spaceClusters} />
      )}

      {/* Ship markers (Masterplan 2026: renamed from agent markers) */}
      {userAgents.length > 0 && (
        <ShipMarkersNew
          userShips={userAgents}
          shipClusters={agentClusters}
          onShipClick={onAgentClick}
        />
      )}

      {/* Burn particles for active agents */}
      {userAgents.length > 0 && (
        <BurnParticlesNew userAgents={userAgents} />
      )}

      {/* Discovery effects */}
      <ElectronFlowNew recentDiscoveries={recentDiscoveries} spaceClusters={spaceClusters} />
      <DiscoveryBurstNew recentDiscoveries={recentDiscoveries} />

      {/* Post-processing effects - bloom glow and vignette */}
      <PostProcessingEffects bloomIntensity={1.5} vignetteIntensity={0.5} />
    </>
  )
}
