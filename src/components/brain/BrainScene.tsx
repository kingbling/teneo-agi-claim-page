import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { BrainParticles } from './BrainParticles'
import { SynapseParticles } from './SynapseParticles'
import { SynapseNodeMarkers } from './SynapseNodeMarkers'
import { ElectronFlow } from './ElectronFlow'
import { SynapseConnectionEffect } from './SynapseConnectionEffect'
import { SynapseSearch } from './SynapseSearch'
import { useClaimStore } from '@/stores/claimStore'
import type { SynapseNode, RevealPhase } from '@/types'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

interface BrainSceneProps {
  autoRotate?: boolean
  interactive?: boolean
}

export function BrainScene({ autoRotate = true, interactive = true }: BrainSceneProps) {
  const user = useClaimStore((state) => state.user)
  const synapseLod0 = useClaimStore((state) => state.synapseLod0)
  const synapseLod1 = useClaimStore((state) => state.synapseLod1)
  const synapseLod2 = useClaimStore((state) => state.synapseLod2)
  const connectedSynapseIds = useClaimStore((state) => state.connectedSynapseIds)
  const revealPhase = useClaimStore((state) => state.revealPhase)
  const pendingSynapseId = useClaimStore((state) => state.pendingSynapseId)
  const navigateToNodeId = useClaimStore((state) => state.navigateToNodeId)
  const progress = user?.journeyProgress ?? 0

  // Zoom level display
  const [zoomInfo, setZoomInfo] = useState({ distance: 5, lod: 0 })

  return (
    <div className="relative h-full w-full bg-[#1d1f23]">
      {/* Zoom level indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded bg-black/40 px-3 py-1 font-mono text-xs text-white/70">
        <span>Zoom: {zoomInfo.distance.toFixed(1)}</span>
        <span className="mx-2">|</span>
        <span>LOD {zoomInfo.lod} ({zoomInfo.lod === 0 ? '500' : zoomInfo.lod === 1 ? '1.5K' : '800'})</span>
      </div>

      {/* Search UI overlay */}
      <SynapseSearch />

      <Canvas
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={1}
        style={{ background: '#1d1f23' }}
        frameloop="always"
      >
        <color attach="background" args={['#1d1f23']} />
        <Suspense fallback={null}>
          <BrainContent
            autoRotate={autoRotate}
            interactive={interactive}
            progress={progress}
            synapseLod0={synapseLod0}
            synapseLod1={synapseLod1}
            synapseLod2={synapseLod2}
            userSynapseIds={connectedSynapseIds}
            revealPhase={revealPhase}
            pendingSynapseId={pendingSynapseId}
            navigateToNodeId={navigateToNodeId}
            onZoomChange={setZoomInfo}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

interface CameraAnimationState {
  isAnimating: boolean
  startTime: number
  duration: number
  startPosition: THREE.Vector3
  targetPosition: THREE.Vector3
  startTarget: THREE.Vector3
  endTarget: THREE.Vector3
}

function BrainContent({
  autoRotate,
  interactive,
  progress,
  synapseLod0,
  synapseLod1,
  synapseLod2,
  userSynapseIds,
  revealPhase,
  pendingSynapseId,
  navigateToNodeId,
  onZoomChange,
}: {
  autoRotate: boolean
  interactive: boolean
  progress: number
  synapseLod0: SynapseNode[]
  synapseLod1: SynapseNode[]
  synapseLod2: SynapseNode[]
  userSynapseIds: string[]
  revealPhase: RevealPhase
  pendingSynapseId: string | null
  navigateToNodeId: string | null
  onZoomChange: (info: { distance: number; lod: number }) => void
}) {
  const controlsRef = useRef<OrbitControlsType>(null)
  const { camera } = useThree()
  const [selectedSynapseId, setSelectedSynapseId] = useState<string | null>(null)

  // LOD state - no animation, just instant switch
  const [currentLod, setCurrentLod] = useState(0)
  const lastZoomReportRef = useRef({ distance: 5, lod: 0, time: 0 })

  // Get nodes for current LOD
  const currentNodes = currentLod === 0 ? synapseLod0 : currentLod === 1 ? synapseLod1 : synapseLod2

  // Animation state
  const animationRef = useRef<CameraAnimationState | null>(null)
  const wasAutoRotating = useRef(autoRotate)
  const hasAnimatedToSynapse = useRef<string | null>(null)

  // Keyboard navigation state
  const keysPressed = useRef<Set<string>>(new Set())

  // Keyboard event handlers for WASD navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed.current.add(key)
        if (controlsRef.current) {
          controlsRef.current.autoRotate = false
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Get setNavigateToNode to clear after processing
  const setNavigateToNode = useClaimStore((state) => state.setNavigateToNode)

  // Handle navigation from search (search through all LODs)
  useEffect(() => {
    if (!navigateToNodeId || !controlsRef.current) return

    // Search through all LODs for the node
    const node = synapseLod2.find((n) => n.id === navigateToNodeId)
      || synapseLod1.find((n) => n.id === navigateToNodeId)
      || synapseLod0.find((n) => n.id === navigateToNodeId)
    if (!node) {
      setNavigateToNode(null)
      return
    }

    // Calculate synapse position
    const rawLen = Math.sqrt(
      node.position[0] * node.position[0] +
      node.position[1] * node.position[1] +
      node.position[2] * node.position[2]
    )
    const nx = node.position[0] / rawLen
    const ny = node.position[1] / rawLen
    const nz = node.position[2] / rawLen

    const x = nx * 1.3 * 1.2 // brainScale.x * brainRadius
    const y = ny * 1.0 * 1.2 // brainScale.y * brainRadius
    const z = nz * 1.1 * 1.2 // brainScale.z * brainRadius
    const len = Math.sqrt(x * x + y * y + z * z)
    const pushOut = 0.05

    const synapsePos = new THREE.Vector3(
      x + (x / len) * pushOut,
      y + (y / len) * pushOut,
      z + (z / len) * pushOut
    )

    // Animate camera to synapse
    const currentCameraDir = camera.position.clone().sub(synapsePos).normalize()
    const zoomDistance = 0.5
    const newCameraPos = synapsePos.clone().add(currentCameraDir.multiplyScalar(zoomDistance))

    animationRef.current = {
      isAnimating: true,
      startTime: performance.now(),
      duration: 1000,
      startPosition: camera.position.clone(),
      targetPosition: newCameraPos,
      startTarget: controlsRef.current.target.clone(),
      endTarget: synapsePos,
    }

    controlsRef.current.autoRotate = false
    setNavigateToNode(null)
  }, [navigateToNodeId, synapseLod0, synapseLod1, synapseLod2, camera, setNavigateToNode])

  // Brain scale factors for position calculation
  const brainScale = useMemo(() => ({ x: 1.3, y: 1.0, z: 1.1 }), [])
  const brainRadius = 1.2

  // Calculate pending synapse position (search all LODs)
  const pendingSynapsePosition = useMemo(() => {
    if (!pendingSynapseId) return null
    const node = synapseLod2.find((n) => n.id === pendingSynapseId)
      || synapseLod1.find((n) => n.id === pendingSynapseId)
      || synapseLod0.find((n) => n.id === pendingSynapseId)
    if (!node) return null

    // Normalize to unit sphere first, then scale to brain surface
    const rawLen = Math.sqrt(
      node.position[0] * node.position[0] +
      node.position[1] * node.position[1] +
      node.position[2] * node.position[2]
    )
    const nx = node.position[0] / rawLen
    const ny = node.position[1] / rawLen
    const nz = node.position[2] / rawLen

    const x = nx * brainScale.x * brainRadius
    const y = ny * brainScale.y * brainRadius
    const z = nz * brainScale.z * brainRadius

    // Push slightly outward
    const len = Math.sqrt(x * x + y * y + z * z)
    const pushOut = 0.05
    return new THREE.Vector3(
      x + (x / len) * pushOut,
      y + (y / len) * pushOut,
      z + (z / len) * pushOut
    )
  }, [pendingSynapseId, synapseLod0, synapseLod1, synapseLod2, brainScale, brainRadius])

  // Auto-animate to pending synapse when reveal starts
  useEffect(() => {
    if (
      revealPhase === 'locating' &&
      pendingSynapsePosition &&
      pendingSynapseId &&
      hasAnimatedToSynapse.current !== pendingSynapseId &&
      controlsRef.current
    ) {
      hasAnimatedToSynapse.current = pendingSynapseId
      setSelectedSynapseId(null)

      // Calculate camera position: offset from synapse toward current camera
      const currentCameraDir = camera.position.clone().sub(pendingSynapsePosition).normalize()
      const zoomDistance = 0.8 // Close zoom for reveal animation
      const newCameraPos = pendingSynapsePosition
        .clone()
        .add(currentCameraDir.multiplyScalar(zoomDistance))

      // Target is the synapse position
      const newTarget = pendingSynapsePosition.clone()

      // Start animation
      animationRef.current = {
        isAnimating: true,
        startTime: performance.now(),
        duration: 1000, // Slower for dramatic effect
        startPosition: camera.position.clone(),
        targetPosition: newCameraPos,
        startTarget: controlsRef.current.target.clone(),
        endTarget: newTarget,
      }

      wasAutoRotating.current = autoRotate
      controlsRef.current.autoRotate = false
    }
  }, [revealPhase, pendingSynapsePosition, pendingSynapseId, camera, autoRotate])

  // Reset camera when reveal completes
  useEffect(() => {
    if (revealPhase === 'idle' && hasAnimatedToSynapse.current && controlsRef.current) {
      // Zoom back out after a short delay
      const timer = setTimeout(() => {
        if (!controlsRef.current) return

        const defaultCameraPos = new THREE.Vector3(0, 0, 1.8)
        const defaultTarget = new THREE.Vector3(0, 0, 0)

        animationRef.current = {
          isAnimating: true,
          startTime: performance.now(),
          duration: 800,
          startPosition: camera.position.clone(),
          targetPosition: defaultCameraPos,
          startTarget: controlsRef.current.target.clone(),
          endTarget: defaultTarget,
        }

        hasAnimatedToSynapse.current = null

        // Re-enable auto-rotate after animation
        setTimeout(() => {
          if (controlsRef.current && wasAutoRotating.current) {
            controlsRef.current.autoRotate = true
          }
        }, 1000)
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [revealPhase, camera])

  // Smooth easing function
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

  const handleSynapseClick = useCallback(
    (node: SynapseNode, synapsePosition: THREE.Vector3) => {
      if (!controlsRef.current) return

      // Toggle selection - if clicking same synapse, zoom out
      if (selectedSynapseId === node.id) {
        // Zoom back out to default view
        setSelectedSynapseId(null)

        const defaultCameraPos = new THREE.Vector3(0, 0, 1.8)
        const defaultTarget = new THREE.Vector3(0, 0, 0)

        animationRef.current = {
          isAnimating: true,
          startTime: performance.now(),
          duration: 800,
          startPosition: camera.position.clone(),
          targetPosition: defaultCameraPos,
          startTarget: controlsRef.current.target.clone(),
          endTarget: defaultTarget,
        }

        wasAutoRotating.current = autoRotate
        controlsRef.current.autoRotate = false
        return
      }

      setSelectedSynapseId(node.id)

      // Calculate camera position: offset from synapse toward current camera direction
      const currentCameraDir = camera.position.clone().sub(synapsePosition).normalize()

      // Zoom distance from synapse - close enough to see detail, far enough to see ~30 connected nodes
      const zoomDistance = 0.5

      // New camera position
      const newCameraPos = synapsePosition.clone().add(currentCameraDir.multiplyScalar(zoomDistance))

      // Target is slightly behind the synapse (so it's visible in front)
      const targetOffset = synapsePosition.clone().normalize().multiplyScalar(-0.1)
      const newTarget = synapsePosition.clone().add(targetOffset)

      // Start animation
      animationRef.current = {
        isAnimating: true,
        startTime: performance.now(),
        duration: 800,
        startPosition: camera.position.clone(),
        targetPosition: newCameraPos,
        startTarget: controlsRef.current.target.clone(),
        endTarget: newTarget,
      }

      // Disable auto-rotate during animation
      wasAutoRotating.current = autoRotate
      controlsRef.current.autoRotate = false
    },
    [camera, autoRotate, selectedSynapseId]
  )

  // Animation frame
  useFrame(() => {
    if (!controlsRef.current) return

    // LOD level switching based on camera distance to origin
    const cameraDistance = camera.position.length()

    // LOD thresholds with hysteresis to prevent flickering at boundaries
    // LOD 0: 300 clusters (far), LOD 1: 2000 clusters (medium), LOD 2: 10000 clusters (close)
    const hysteresis = 0.3
    let targetLod = currentLod

    if (currentLod === 0) {
      // From LOD 0: switch to LOD 1 when close enough
      if (cameraDistance < 3.5) targetLod = 1
    } else if (currentLod === 1) {
      // From LOD 1: switch to LOD 0 when far, LOD 2 when very close
      if (cameraDistance > 3.5 + hysteresis) targetLod = 0
      else if (cameraDistance < 1.2) targetLod = 2  // Reduced from 2.0 - LOD 2 only when very close
    } else {
      // From LOD 2: switch to LOD 1 when zooming out
      if (cameraDistance > 1.2 + hysteresis) targetLod = 1
    }

    if (targetLod !== currentLod) {
      setCurrentLod(targetLod)
    }

    // Report zoom level (only when value changes to avoid re-renders)
    const roundedDistance = Math.round(cameraDistance * 10) / 10
    if (
      roundedDistance !== lastZoomReportRef.current.distance ||
      currentLod !== lastZoomReportRef.current.lod
    ) {
      lastZoomReportRef.current = { distance: roundedDistance, lod: currentLod, time: 0 }
      onZoomChange({ distance: roundedDistance, lod: currentLod })
    }

    // WASD keyboard navigation
    const keys = keysPressed.current
    if (keys.size > 0) {
      const speed = 0.03
      const forward = new THREE.Vector3()
        .subVectors(controlsRef.current.target, camera.position)
        .normalize()
      const right = new THREE.Vector3()
        .crossVectors(forward, camera.up)
        .normalize()

      if (keys.has('w') || keys.has('arrowup')) {
        camera.position.addScaledVector(forward, speed)
        controlsRef.current.target.addScaledVector(forward, speed)
      }
      if (keys.has('s') || keys.has('arrowdown')) {
        camera.position.addScaledVector(forward, -speed)
        controlsRef.current.target.addScaledVector(forward, -speed)
      }
      if (keys.has('a') || keys.has('arrowleft')) {
        camera.position.addScaledVector(right, -speed)
        controlsRef.current.target.addScaledVector(right, -speed)
      }
      if (keys.has('d') || keys.has('arrowright')) {
        camera.position.addScaledVector(right, speed)
        controlsRef.current.target.addScaledVector(right, speed)
      }
      controlsRef.current.update()
    }

    // Camera animation
    if (!animationRef.current) return

    const { isAnimating, startTime, duration, startPosition, targetPosition, startTarget, endTarget } =
      animationRef.current

    if (!isAnimating) return

    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeOutCubic(progress)

    // Lerp camera position
    camera.position.lerpVectors(startPosition, targetPosition, eased)

    // Lerp control target
    controlsRef.current.target.lerpVectors(startTarget, endTarget, eased)
    controlsRef.current.update()

    // Animation complete
    if (progress >= 1) {
      animationRef.current.isAnimating = false

      // Re-enable auto-rotate after zoom out (not when zoomed in)
      if (selectedSynapseId === null && wasAutoRotating.current) {
        setTimeout(() => {
          if (controlsRef.current) {
            controlsRef.current.autoRotate = wasAutoRotating.current
          }
        }, 500)
      }
    }
  })

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={interactive}
        enableRotate={interactive}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        minDistance={0.001}
        maxDistance={8}
        dampingFactor={0.05}
        enableDamping
      />

      {/* Minimal lighting */}
      <ambientLight intensity={0.3} />

      {/* Brain visualization group */}
      <group>
        {/* Subtle wireframe brain outline */}
        <BrainParticles progress={progress} />

        {/* Crisp synapse dots on brain surface */}
        <SynapseParticles count={80000} />

        {/* Synapse node markers */}
        <SynapseNodeMarkers
          synapseNodes={currentNodes}
          userSynapseIds={userSynapseIds}
          onSynapseClick={handleSynapseClick}
          selectedSynapseId={selectedSynapseId}
          revealPhase={revealPhase}
          pendingSynapseId={pendingSynapseId}
        />

        {/* Electron flow connections */}
        <ElectronFlow
          synapseNodes={currentNodes}
        />

        {/* Synapse connection animation effect */}
        <SynapseConnectionEffect
          synapseNodes={currentNodes}
          pendingSynapseId={pendingSynapseId}
          revealPhase={revealPhase}
        />
      </group>
    </>
  )
}
