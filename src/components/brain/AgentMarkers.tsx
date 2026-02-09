import { onMount, onCleanup, createEffect, createMemo, createSignal, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import {
  SHIP_MARKER_CONFIG,
  SHIP_STATE_COLORS,
  constrainToBrainShape,
} from './core/brainConstants'
import {
  SHIP_VERTEX_SHADER,
  SHIP_FRAGMENT_SHADER,
  SELECTION_RING_VERTEX_SHADER,
  SELECTION_RING_FRAGMENT_SHADER,
} from './shaders/shipShaders'
import { shipStore, type Ship, type ShipCluster, type ShipStatus } from '@/stores/shipStore'

interface ShipMarkersProps {
  userShips: Ship[]
  shipClusters?: ShipCluster[]
  onShipClick?: (ship: Ship) => void
  showIdleShips?: boolean
  selectedShipId?: string | null  // ID of selected ship for highlight ring
  hideSelectedShipParticle?: boolean  // Hide the selected ship's particle when 3D model is visible
}

// State-based colors (imported from brainConstants for consistency)
const STATE_COLORS = SHIP_STATE_COLORS

export const ShipMarkers: Component<ShipMarkersProps> = (props) => {
  const threeContext = useThree()
  const { scene, gl, camera } = threeContext

  // Points object for ship markers
  let pointsObject: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null

  // Selection ring for selected ship
  let selectionRingMesh: THREE.Mesh | null = null
  let selectionRingGeometry: THREE.RingGeometry | null = null
  let selectionRingMaterial: THREE.ShaderMaterial | null = null

  // Raycaster for click detection
  let raycaster: THREE.Raycaster | null = null
  const pointer = new THREE.Vector2()

  // Track drag state
  let pointerDownPos: { x: number; y: number } | null = null
  let isDragging = false
  const DRAG_THRESHOLD = 5

  // Ship positions for raycasting
  let shipPositions: THREE.Vector3[] = []

  // Smooth position interpolation - tracks rendered position per ship for smooth movement
  const renderedPositions = new Map<string, THREE.Vector3>()

  // Track ship states for force-update detection
  const shipStateTracker = new Map<string, ShipStatus>()

  // Cache animation parameters to prevent glitches during server updates
  interface AnimationCache {
    startX: number
    startY: number
    startZ: number
    targetX: number
    targetY: number
    targetZ: number
    startTime: number
    duration: number
  }
  const deployAnimationCache = new Map<string, AnimationCache>()

  // Hover state signal for tooltip
  const [hoveredShipId, setHoveredShipId] = createSignal<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = createSignal<{ x: number; y: number } | null>(null)

  // Track ship state changes for animation triggers

  // Get ships DIRECTLY from store - props may be stale due to SolidJS reactivity issues
  // The store is the source of truth for ship state and positions
  const visibleShips = createMemo(() => {
    // Read directly from store, not props
    const allShips = shipStore.userShips
    if (!allShips || !Array.isArray(allShips)) {
      return []
    }

    let ships = [...allShips] // Copy to avoid mutating store

    // Filter idle ships if not shown (but always keep selected ship and deploying ships)
    if (!props.showIdleShips) {
      ships = ships.filter(s => {
        // Always show selected ship
        if (s.id === props.selectedShipId) return true
        // Always show deploying ships (they're in motion)
        if (s.state === 'deploying') return true
        // Filter out idle ships
        return s.state !== 'idle'
      })
    }

    return ships
  })

  // Compute buffer data from ships
  const computeBufferData = createMemo(() => {
    const ships = visibleShips()
    if (ships.length === 0) {
      return null
    }

    const positions = new Float32Array(ships.length * 3)
    const colors = new Float32Array(ships.length * 3)
    const sizes = new Float32Array(ships.length)
    const states = new Float32Array(ships.length)
    const positionsArray: THREE.Vector3[] = []

    ships.forEach((ship, i) => {
      // Use same coordinate transformation as synapses for visual consistency
      const [x, y, z] = constrainToBrainShape(
        ship.positionX,
        ship.positionY,
        ship.positionZ
      )

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      positionsArray.push(new THREE.Vector3(x, y, z))

      // Color based on state
      const color = STATE_COLORS[ship.state]
      colors[i * 3] = color[0]
      colors[i * 3 + 1] = color[1]
      colors[i * 3 + 2] = color[2]

      // Size - all ships same size for now
      sizes[i] = SHIP_MARKER_CONFIG.pointSize

      // State as float for shader
      // Map actual ShipStatus to shader state indices
      // Shader expects: 0=idle, 1=solving, 2=(unused), 3=deploying, 4=returning
      const stateMap: Record<ShipStatus, number> = {
        idle: 0,
        solving: 1,      // Ship is at synapse, working on it
        deploying: 3,    // Ship is traveling to synapse
        returning: 4
      }
      states[i] = stateMap[ship.state]
    })

    return { positions, colors, sizes, states, positionsArray }
  })

  // Find closest ship to pointer for hover/click
  const findClosestShip = (): Ship | null => {
    const cam = camera()
    const ships = visibleShips()
    if (!raycaster || !cam || ships.length === 0 || shipPositions.length === 0) return null

    const threshold = 0.2  // Distance threshold for detection
    raycaster.setFromCamera(pointer, cam)

    let closestIndex: number | null = null
    let closestDist = threshold

    shipPositions.forEach((pos, i) => {
      const dist = raycaster!.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    if (closestIndex !== null) {
      return ships[closestIndex] || null
    }
    return null
  }

  // Handle click on ship
  const handleClick = () => {
    if (isDragging) return

    const ship = findClosestShip()
    if (ship && props.onShipClick) {
      props.onShipClick(ship)
    }
  }

  // NOTE: Animation is handled entirely by useFrame below
  // No separate requestAnimationFrame loop needed - useFrame handles all position updates

  onMount(() => {
    const sceneObj = scene()
    const renderer = gl()

    if (!sceneObj || !renderer) {
      return
    }


    // Initialize raycaster
    raycaster = new THREE.Raycaster()

    // Create geometry
    geometry = new THREE.BufferGeometry()

    // Create shader material
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: SHIP_VERTEX_SHADER,
      fragmentShader: SHIP_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,  // NormalBlending so ships stand out from glow
    })

    // Create points object
    pointsObject = new THREE.Points(geometry, material)
    pointsObject.frustumCulled = false
    pointsObject.renderOrder = 100  // Render above other effects
    sceneObj.add(pointsObject)

    // Create selection ring for highlighting selected ship
    selectionRingGeometry = new THREE.RingGeometry(0.06, 0.1, 32)
    selectionRingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: SELECTION_RING_VERTEX_SHADER,
      fragmentShader: SELECTION_RING_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })

    selectionRingMesh = new THREE.Mesh(selectionRingGeometry, selectionRingMaterial)
    selectionRingMesh.rotation.x = -Math.PI / 2  // Horizontal ring
    selectionRingMesh.visible = false  // Hidden until a ship is selected
    selectionRingMesh.renderOrder = 110  // Above ships
    sceneObj.add(selectionRingMesh)

    // Debug sphere removed - was for debugging ship animation

    // Animation is handled by the standalone animation loop below

    // Canvas event listeners
    const canvas = renderer.domElement

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY }
      isDragging = false
    }

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      if (pointerDownPos) {
        const dx = e.clientX - pointerDownPos.x
        const dy = e.clientY - pointerDownPos.y
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          isDragging = true
        }
      }
    }

    const handlePointerUp = () => {
      if (!isDragging) {
        handleClick()
      }
      pointerDownPos = null
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)

    onCleanup(() => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)

      if (pointsObject && sceneObj) {
        sceneObj.remove(pointsObject)
      }
      geometry?.dispose()
      material?.dispose()

      // Clean up selection ring
      if (selectionRingMesh && sceneObj) {
        sceneObj.remove(selectionRingMesh)
      }
      selectionRingGeometry?.dispose()
      selectionRingMaterial?.dispose()

      document.body.style.cursor = 'auto'
    })
  })

  // Update geometry structure when ships change (add/remove/reorder)
  // IMPORTANT: Only recreate buffers when ship COUNT or IDs change, NOT when state changes
  // State/color/position changes are handled by useFrame to avoid overwriting interpolated positions
  let lastShipIds: string[] = []
  createEffect(() => {
    const data = computeBufferData()
    const ships = visibleShips()

    if (!geometry || !data) {
      // Clear geometry if no ships
      if (geometry) {
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
        geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(0), 3))
        geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(0), 1))
        geometry.setAttribute('aState', new THREE.BufferAttribute(new Float32Array(0), 1))
      }
      shipPositions = []
      lastShipIds = []
      return
    }

    // ONLY check if ship ID SET changed (count or which IDs) - NOT order or state
    // Order changes should NOT trigger buffer reset (would break interpolation)
    // State changes are handled by useFrame to preserve interpolated positions
    const currentIds = ships.map(s => s.id)
    const currentIdSet = new Set(currentIds)
    const lastIdSet = new Set(lastShipIds)
    const idsChanged = currentIds.length !== lastShipIds.length ||
      currentIds.some(id => !lastIdSet.has(id)) ||
      lastShipIds.some(id => !currentIdSet.has(id))

    if (idsChanged) {
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
      geometry.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3))
      geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
      geometry.setAttribute('aState', new THREE.BufferAttribute(data.states, 1))
      shipPositions = data.positionsArray

      // Initialize rendered positions for new ships (use constrained positions)
      ships.forEach(ship => {
        if (!renderedPositions.has(ship.id)) {
          const [cx, cy, cz] = constrainToBrainShape(
            ship.positionX,
            ship.positionY,
            ship.positionZ
          )
          renderedPositions.set(ship.id, new THREE.Vector3(cx, cy, cz))
        }
      })

      // Clean up old ship positions
      const currentIdSet = new Set(currentIds)
      for (const id of renderedPositions.keys()) {
        if (!currentIdSet.has(id)) {
          renderedPositions.delete(id)
        }
      }

      // Clean up old ship state tracking
      for (const id of shipStateTracker.keys()) {
        if (!currentIdSet.has(id)) {
          shipStateTracker.delete(id)
        }
      }

      lastShipIds = currentIds
    }
  })

  // === STANDALONE ANIMATION LOOP ===
  // Bypasses useFrame entirely - runs its own requestAnimationFrame
  // FIX: useFrame callbacks weren't reliably being called, so we animate directly
  let animationFrameId: number | null = null
  const animStartTime = Date.now()

  const runStandaloneAnimation = () => {
    const now = Date.now()
    const elapsedTime = (now - animStartTime) / 1000

    // Update shader time uniforms
    if (material) material.uniforms.uTime.value = elapsedTime
    if (selectionRingMaterial) selectionRingMaterial.uniforms.uTime.value = elapsedTime

    // Read FRESH data from store each frame
    const allShips = shipStore.userShips

    if (!geometry || !allShips || !Array.isArray(allShips) || lastShipIds.length === 0) {
      animationFrameId = requestAnimationFrame(runStandaloneAnimation)
      return
    }

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const stateAttr = geometry.getAttribute('aState') as THREE.BufferAttribute
    const colorAttr = geometry.getAttribute('aColor') as THREE.BufferAttribute
    const sizeAttr = geometry.getAttribute('aSize') as THREE.BufferAttribute
    if (!posAttr) {
      animationFrameId = requestAnimationFrame(runStandaloneAnimation)
      return
    }

    const updateCount = Math.min(posAttr.count, lastShipIds.length)
    let positionChanged = false
    let stateChanged = false
    let sizeChanged = false

    for (let i = 0; i < updateCount; i++) {
      const shipId = lastShipIds[i]
      const ship = allShips.find(s => s.id === shipId)
      if (!ship) continue

      // === CLIENT-SIDE INTERPOLATION FOR SMOOTH ANIMATION ===
      let x = ship.positionX
      let y = ship.positionY
      let z = ship.positionZ

      // Check if ship has valid animation data from server
      const hasServerAnimData = ship.state === 'deploying' &&
        ship.startPositionX !== undefined &&
        ship.targetPositionX !== undefined &&
        ship.travelStartTime !== undefined &&
        ship.travelDuration !== undefined &&
        ship.travelDuration > 0

      // Cache animation data when ship starts deploying (prevents glitches from server updates)
      if (hasServerAnimData) {
        // Only update cache if this is new animation data (different start time or not cached)
        const cached = deployAnimationCache.get(shipId)
        if (!cached || cached.startTime !== ship.travelStartTime) {
          deployAnimationCache.set(shipId, {
            startX: ship.startPositionX!,
            startY: ship.startPositionY ?? 0,
            startZ: ship.startPositionZ ?? 0,
            targetX: ship.targetPositionX!,
            targetY: ship.targetPositionY ?? 0,
            targetZ: ship.targetPositionZ ?? 0,
            startTime: ship.travelStartTime!,
            duration: ship.travelDuration!,
          })
        }
      }

      // Use cached animation data for interpolation (immune to server update glitches)
      const animCache = deployAnimationCache.get(shipId)
      if (ship.state === 'deploying' && animCache) {
        const elapsed = now - animCache.startTime
        const progress = Math.min(Math.max(elapsed / animCache.duration, 0), 1)

        // Linear interpolation from start to target
        x = animCache.startX + (animCache.targetX - animCache.startX) * progress
        y = animCache.startY + (animCache.targetY - animCache.startY) * progress
        z = animCache.startZ + (animCache.targetZ - animCache.startZ) * progress
      } else if (ship.state !== 'deploying') {
        // Clear cache when no longer deploying
        deployAnimationCache.delete(shipId)
      }

      // Apply brain constraint first
      let [cx, cy, cz] = constrainToBrainShape(x, y, z)

      // === IDLE ANIMATION: Gentle hover/breathing motion ===
      if (ship.state === 'idle') {
        // Subtle vertical oscillation - "breathing" hover
        // Amplitude: ~0.02 units (subtle), Period: ~6 seconds (slow, calm)
        // Phase offset based on ship ID so ships don't sync
        const idlePhase = ship.id.charCodeAt(0) + ship.id.charCodeAt(ship.id.length - 1)
        const idleOffset = Math.sin(now * 0.001 + idlePhase) * 0.02
        cy += idleOffset
      }

      // === SOLVING ANIMATION: Orbit around target synapse ===
      if (ship.state === 'solving' && ship.targetPositionX !== undefined) {
        // Orbit in XZ plane around synapse position
        const orbitRadius = 0.15  // Increased for visibility
        // Vary orbit speed slightly based on ship ID for visual interest
        const orbitSpeed = 0.002 + (ship.id.charCodeAt(0) % 10) * 0.0003
        const orbitPhase = ship.id.charCodeAt(0)
        const angle = now * orbitSpeed + orbitPhase

        // Get synapse position (target position)
        const [synapseX, synapseY, synapseZ] = constrainToBrainShape(
          ship.targetPositionX,
          ship.targetPositionY ?? 0,
          ship.targetPositionZ ?? 0
        )

        // Orbit around synapse with hover offset above
        cx = synapseX + Math.cos(angle) * orbitRadius
        cz = synapseZ + Math.sin(angle) * orbitRadius
        // More pronounced Y wobble for 3D effect + slight hover above synapse
        cy = synapseY + 0.08 + Math.sin(angle * 2) * 0.04
      }

      // === SMOOTH POSITION JUMPS ===
      // Detect state transitions for tighter smoothing
      const prevState = shipStateTracker.get(shipId)
      const isTransition = prevState !== undefined && prevState !== ship.state
      shipStateTracker.set(shipId, ship.state)

      const lastPos = renderedPositions.get(shipId)
      if (lastPos) {
        const jumpDist = Math.sqrt(
          (cx - lastPos.x) ** 2 + (cy - lastPos.y) ** 2 + (cz - lastPos.z) ** 2
        )
        // Tighter threshold and slower lerp during state transitions (e.g. deploying→solving)
        // to smooth the orbit position pop. Normal movement uses looser values.
        const maxNormalJump = isTransition ? 0.02 : 0.05
        const lerpFactor = isTransition ? 0.15 : 0.3
        if (jumpDist > maxNormalJump) {
          cx = lastPos.x + (cx - lastPos.x) * lerpFactor
          cy = lastPos.y + (cy - lastPos.y) * lerpFactor
          cz = lastPos.z + (cz - lastPos.z) * lerpFactor
        }
      }

      posAttr.setXYZ(i, cx, cy, cz)
      positionChanged = true

      // Hide particle for selected ship when 3D model is visible
      if (sizeAttr) {
        const shouldHide = props.hideSelectedShipParticle && shipId === props.selectedShipId
        const currentSize = sizeAttr.getX(i)
        if (shouldHide && currentSize !== 0) {
          sizeAttr.setX(i, 0)
          sizeChanged = true
        } else if (!shouldHide && currentSize === 0) {
          sizeAttr.setX(i, SHIP_MARKER_CONFIG.pointSize)
          sizeChanged = true
        }
      }

      // Update raycasting position
      if (shipPositions[i]) {
        shipPositions[i].set(cx, cy, cz)
      }

      // Update state attribute for shader
      const stateMap: Record<ShipStatus, number> = { idle: 0, solving: 1, deploying: 3, returning: 4 }
      const newState = stateMap[ship.state]
      if (stateAttr.getX(i) !== newState) {
        stateAttr.setX(i, newState)
        const color = ship.state === 'deploying' ? [1.0, 0.0, 1.0] : STATE_COLORS[ship.state]
        colorAttr.setXYZ(i, color[0], color[1], color[2])
        stateChanged = true
      }
    }

    // Trigger GPU upload
    if (positionChanged) {
      posAttr.needsUpdate = true
    }
    if (stateChanged) {
      stateAttr.needsUpdate = true
      colorAttr.needsUpdate = true
    }
    if (sizeChanged && sizeAttr) {
      sizeAttr.needsUpdate = true
    }

    // Update selection ring
    if (selectionRingMesh && props.selectedShipId) {
      const idx = lastShipIds.indexOf(props.selectedShipId)
      if (idx >= 0 && shipPositions[idx]) {
        selectionRingMesh.position.copy(shipPositions[idx])
        selectionRingMesh.visible = true
      } else {
        selectionRingMesh.visible = false
      }
    } else if (selectionRingMesh) {
      selectionRingMesh.visible = false
    }

    animationFrameId = requestAnimationFrame(runStandaloneAnimation)
  }

  // Start standalone animation loop on mount
  createEffect(() => {
    // Start after geometry is ready
    if (geometry && !animationFrameId) {
      animationFrameId = requestAnimationFrame(runStandaloneAnimation)
    }
  })

  onCleanup(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  })

  // Keep useFrame for hover detection and tooltip (these need camera access)
  useFrame(({ camera: cam }) => {
    // Hover detection
    const renderer = gl()
    const hovered = findClosestShip()
    if (hovered?.id !== hoveredShipId()) {
      setHoveredShipId(hovered?.id || null)
      document.body.style.cursor = hovered ? 'pointer' : 'auto'
    }

    // Tooltip position - use lastShipIds for buffer index lookup
    if (hovered && renderer) {
      const idx = lastShipIds.indexOf(hovered.id)
      if (idx >= 0 && shipPositions[idx]) {
        const pos = shipPositions[idx].clone().project(cam)
        const rect = renderer.domElement.getBoundingClientRect()
        setTooltipPosition({
          x: (pos.x * 0.5 + 0.5) * rect.width + rect.left,
          y: (-pos.y * 0.5 + 0.5) * rect.height + rect.top
        })
      }
    } else {
      setTooltipPosition(null)
    }
  })

  // Get hovered ship for tooltip
  const hoveredShip = createMemo(() => {
    const id = hoveredShipId()
    const ships = visibleShips()
    return id ? ships.find(s => s.id === id) || null : null
  })

  // Return tooltip JSX
  return (
    <>
      {hoveredShip() && tooltipPosition() && (
        <div
          class="fixed pointer-events-none z-50"
          style={{
            left: `${tooltipPosition()!.x}px`,
            top: `${tooltipPosition()!.y}px`,
            transform: 'translate(-50%, -100%) translateY(-12px)',
          }}
        >
          <div class="bg-[var(--card-bg)]/95 backdrop-blur-sm border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs whitespace-nowrap">
            <div class="font-medium text-[var(--text-primary)]">
              {hoveredShip()!.name}
            </div>
            <div class="text-[var(--text-secondary)] capitalize">
              {hoveredShip()!.state}
            </div>
            {hoveredShip()!.autopilotEnabled && (
              <div class="text-green-400 flex items-center gap-1">
                <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Autopilot: {hoveredShip()!.autopilotTargetType || 'Any'}
              </div>
            )}
            {(hoveredShip()!.synapsesExplored ?? 0) > 0 && (
              <div class="text-cyan-400">
                {hoveredShip()!.synapsesExplored} explored
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

