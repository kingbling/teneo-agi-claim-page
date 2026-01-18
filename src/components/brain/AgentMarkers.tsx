import { onMount, onCleanup, createEffect, createMemo, createSignal, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import {
  SHIP_MARKER_CONFIG,
  SHIP_STATE_PULSE,
  SHIP_SHAPE_CONFIG,
  SHIP_ENGINE_CONFIG,
  SHIP_STATE_COLORS,
  constrainToBrainShape,
} from './core/brainConstants'
import type { Ship, ShipCluster, ShipStatus } from '@/stores/shipStore'

interface ShipMarkersProps {
  userShips: Ship[]
  shipClusters?: ShipCluster[]
  onShipClick?: (ship: Ship) => void
  showIdleShips?: boolean
  selectedShipId?: string | null  // ID of selected ship for highlight ring
  hideSelectedShipParticle?: boolean  // Hide the selected ship's particle when 3D model is visible
}

// Debug: log props when component mounts
let propsLogCount = 0

// State-based colors (imported from brainConstants for consistency)
const STATE_COLORS: Record<ShipStatus, [number, number, number]> = SHIP_STATE_COLORS as unknown as Record<ShipStatus, [number, number, number]>

// Vertex shader for ship markers - uses constants from brainConstants.ts
// State indices: 0=idle, 1=searching, 2=exploring, 3=deploying, 4=returning
const SHIP_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;

  uniform float uTime;

  varying vec3 vColor;
  varying float vState;

  void main() {
    vColor = aColor;
    vState = aState;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float pulse = 1.0;

    // State-based animation (values from SHIP_STATE_PULSE in brainConstants.ts)
    if (aState < 0.5) {
      // Idle: subtle breathing
      pulse = 1.0 + sin(uTime * ${SHIP_STATE_PULSE.idle.frequency.toFixed(1)}) * ${SHIP_STATE_PULSE.idle.amplitude.toFixed(2)};
    } else if (aState < 1.5) {
      // Searching: wandering pulse
      pulse = 1.0 + sin(uTime * ${SHIP_STATE_PULSE.searching.frequency.toFixed(1)}) * ${SHIP_STATE_PULSE.searching.amplitude.toFixed(2)};
    } else if (aState < 2.5) {
      // Exploring: active pulsing
      pulse = 1.0 + sin(uTime * ${SHIP_STATE_PULSE.exploring.frequency.toFixed(1)}) * ${SHIP_STATE_PULSE.exploring.amplitude.toFixed(2)};
    } else if (aState < 3.5) {
      // Deploying: rapid pulse
      pulse = 1.0 + sin(uTime * ${SHIP_STATE_PULSE.deploying.frequency.toFixed(1)}) * ${SHIP_STATE_PULSE.deploying.amplitude.toFixed(2)};
    } else {
      // Returning: gentle pulse
      pulse = 1.0 + sin(uTime * ${SHIP_STATE_PULSE.returning.frequency.toFixed(1)}) * ${SHIP_STATE_PULSE.returning.amplitude.toFixed(2)};
    }

    // Distance-based scaling for consistent appearance (values from SHIP_MARKER_CONFIG)
    float distScale = ${SHIP_MARKER_CONFIG.distanceScale.toFixed(1)} / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aSize * pulse * distScale, ${SHIP_MARKER_CONFIG.minPointSize.toFixed(1)}, ${SHIP_MARKER_CONFIG.maxPointSize.toFixed(1)});
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for ship markers - uses constants from brainConstants.ts
const SHIP_FRAGMENT_SHADER = `
  uniform float uTime;

  varying vec3 vColor;
  varying float vState;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);

    // Create a diamond/ship shape instead of circle
    // Using rotated square (diamond) as ship silhouette
    vec2 absCoord = abs(coord);
    float diamond = absCoord.x + absCoord.y;

    // SOLID opaque core (values from SHIP_SHAPE_CONFIG)
    float core = 1.0 - smoothstep(${SHIP_SHAPE_CONFIG.coreInner.toFixed(2)}, ${SHIP_SHAPE_CONFIG.coreOuter.toFixed(2)}, diamond);

    // Softer outer glow
    float glow = 1.0 - smoothstep(${SHIP_SHAPE_CONFIG.glowInner.toFixed(2)}, ${SHIP_SHAPE_CONFIG.glowOuter.toFixed(2)}, diamond);

    // Engine glow - ALL ships get it, idle is subtle (values from SHIP_ENGINE_CONFIG)
    float engineGlow = 0.0;
    float engineDist = length(coord - vec2(0.0, 0.2));
    float baseEngine = (1.0 - smoothstep(0.0, ${SHIP_ENGINE_CONFIG.radius.toFixed(2)}, engineDist));

    if (vState < 0.5) {
      // Idle: subtle breathing glow
      engineGlow = baseEngine * ${SHIP_ENGINE_CONFIG.idleIntensity.toFixed(2)} * (0.8 + sin(uTime * ${SHIP_ENGINE_CONFIG.idleFlickerFreq.toFixed(1)}) * ${SHIP_ENGINE_CONFIG.idleFlickerAmp.toFixed(1)});
    } else {
      // Active: strong flickering engine
      engineGlow = baseEngine * ${SHIP_ENGINE_CONFIG.activeIntensity.toFixed(2)} * (0.7 + sin(uTime * ${SHIP_ENGINE_CONFIG.activeFlickerFreq.toFixed(1)}) * ${SHIP_ENGINE_CONFIG.activeFlickerAmp.toFixed(1)});
    }

    // Combine effects - brighter core (values from SHIP_SHAPE_CONFIG)
    vec3 coreColor = vColor * ${SHIP_SHAPE_CONFIG.coreBrightness.toFixed(1)};
    vec3 glowColor = vColor * ${SHIP_SHAPE_CONFIG.glowBrightness.toFixed(1)};
    vec3 finalColor = mix(glowColor, coreColor, core);

    // Add engine glow for ALL ships (colors from SHIP_ENGINE_CONFIG)
    if (vState < 0.5) {
      vec3 engineColor = vec3(${SHIP_ENGINE_CONFIG.idleColor[0].toFixed(1)}, ${SHIP_ENGINE_CONFIG.idleColor[1].toFixed(1)}, ${SHIP_ENGINE_CONFIG.idleColor[2].toFixed(1)});
      finalColor += engineColor * engineGlow;
    } else {
      vec3 engineColor = vec3(${SHIP_ENGINE_CONFIG.activeColor[0].toFixed(1)}, ${SHIP_ENGINE_CONFIG.activeColor[1].toFixed(1)}, ${SHIP_ENGINE_CONFIG.activeColor[2].toFixed(1)});
      finalColor += engineColor * engineGlow;
    }

    // Alpha: SOLID for core, STRONGER glow (was 0.4, now 0.6)
    float alpha = core * 0.95 + glow * 0.6;
    alpha = max(alpha, engineGlow * 0.7);

    if (alpha < 0.05) discard;

    gl_FragColor = vec4(finalColor, alpha);
  }
`

// Selection ring vertex shader
const SELECTION_RING_VERTEX_SHADER = `
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vUv = uv;

    // Rotate the ring slowly
    float angle = uTime * 1.5;
    float c = cos(angle);
    float s = sin(angle);

    vec3 pos = position;
    // Rotate around Y axis
    float newX = pos.x * c - pos.z * s;
    float newZ = pos.x * s + pos.z * c;
    pos.x = newX;
    pos.z = newZ;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

// Selection ring fragment shader - animated dashed cyan ring
const SELECTION_RING_FRAGMENT_SHADER = `
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    // Ring pattern from UV (ring geometry provides this)
    float ringDist = abs(length(vUv - 0.5) - 0.35);
    float ringAlpha = 1.0 - smoothstep(0.0, 0.08, ringDist);

    // Animated dash pattern
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float dash = sin(angle * 8.0 + uTime * 4.0) * 0.5 + 0.5;
    dash = smoothstep(0.3, 0.7, dash);

    // Cyan glow color
    vec3 color = vec3(0.3, 0.95, 1.0);

    // Pulsing intensity
    float pulse = 0.7 + sin(uTime * 3.0) * 0.3;

    float alpha = ringAlpha * dash * pulse;

    gl_FragColor = vec4(color, alpha * 0.8);
  }
`

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
  const LERP_SPEED = 4.0  // Lerp factor per second - higher = faster catch up
  let lastFrameTime = 0

  // Hover state signal for tooltip
  const [hoveredShipId, setHoveredShipId] = createSignal<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = createSignal<{ x: number; y: number } | null>(null)

  // Filter ships based on showIdleShips setting and hideSelectedShipParticle
  const visibleShips = createMemo(() => {
    // Safety check for undefined/null userShips
    if (!props.userShips || !Array.isArray(props.userShips)) {
      console.log('[AgentMarkers visibleShips] No userShips array')
      return []
    }

    console.log('[AgentMarkers visibleShips] Total ships:', props.userShips.length, 'showIdleShips:', props.showIdleShips, 'hideSelectedShipParticle:', props.hideSelectedShipParticle, 'selectedShipId:', props.selectedShipId)

    let ships = props.userShips

    // Filter idle ships if not shown
    if (!props.showIdleShips) {
      const before = ships.length
      ships = ships.filter(s => s.state !== 'idle')
      console.log('[AgentMarkers visibleShips] Filtered out', before - ships.length, 'idle ships')
    }

    // Hide selected ship particle when 3D model is visible
    if (props.hideSelectedShipParticle && props.selectedShipId) {
      const before = ships.length
      ships = ships.filter(s => s.id !== props.selectedShipId)
      console.log('[AgentMarkers visibleShips] Hid selected ship particle:', props.selectedShipId?.slice(0, 8), 'filtered:', before - ships.length)
    }

    console.log('[AgentMarkers visibleShips] Returning', ships.length, 'ships:', ships.map(s => ({ id: s.id.slice(0, 8), state: s.state })))

    return ships
  })

  // Compute buffer data from ships
  const computeBufferData = createMemo(() => {
    const ships = visibleShips()
    if (ships.length === 0) {
      console.log('[AgentMarkers] No ships to render')
      return null
    }

    console.log('[AgentMarkers] Computing buffer for', ships.length, 'ships:', ships.map(s => ({ id: s.id.slice(0, 8), state: s.state, rawPos: `(${s.positionX.toFixed(2)},${s.positionY.toFixed(2)},${s.positionZ.toFixed(2)})` })))

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
      const stateMap: Record<ShipStatus, number> = {
        idle: 0,
        searching: 1,
        exploring: 2,
        deploying: 3,
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

  onMount(() => {
    // Debug: log props when component mounts
    propsLogCount++
    console.log(`[AgentMarkers onMount #${propsLogCount}] Props:`, {
      userShipsCount: props.userShips?.length ?? 0,
      userShips: props.userShips?.map(s => ({ id: s.id.slice(0, 8), state: s.state, pos: `(${s.positionX.toFixed(2)},${s.positionY.toFixed(2)},${s.positionZ.toFixed(2)})` })) ?? [],
      showIdleShips: props.showIdleShips,
      selectedShipId: props.selectedShipId?.slice(0, 8) ?? null,
      hideSelectedShipParticle: props.hideSelectedShipParticle
    })

    const sceneObj = scene()
    const renderer = gl()

    if (!sceneObj || !renderer) {
      console.warn('ShipMarkers: Scene or renderer not available')
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
  // Does NOT update positions - that's handled by useFrame with interpolation
  let lastShipIds: string[] = []
  let lastShipStates: ShipStatus[] = []
  createEffect(() => {
    const data = computeBufferData()
    const ships = visibleShips()

    console.log('[AgentMarkers createEffect] Triggered, data:', data ? 'has data' : 'no data', 'ships count:', ships.length)

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

    // Check if ships have changed (count or IDs/order OR STATE)
    const currentIds = ships.map(s => s.id)
    const currentStates = ships.map(s => s.state)
    const shipsChanged = currentIds.length !== lastShipIds.length ||
      currentIds.some((id, i) => id !== lastShipIds[i]) ||
      currentStates.some((state, i) => state !== lastShipStates[i])

    console.log('[AgentMarkers createEffect] Ships changed:', shipsChanged, 'currentIds:', currentIds.length, 'lastIds:', lastShipIds.length, 'states changed:', currentStates.some((state, i) => state !== lastShipStates[i]))

    if (shipsChanged) {
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

      lastShipIds = currentIds
      lastShipStates = currentStates
    }
  })

  // Animation loop
  useFrame(({ clock, camera: cam }) => {
    const elapsedTime = clock.getElapsedTime()

    // Debug log to verify useFrame is running
    if (elapsedTime > 1 && Math.random() < 0.005) { // Log once after 1 second, 0.5% chance
      const ships = visibleShips()
      console.log('[AgentMarkers useFrame] Running! elapsedTime:', elapsedTime.toFixed(1), 'ships.length:', ships.length, 'geometry:', !!geometry, 'posAttr count:', geometry?.getAttribute('position')?.count)
    }

    // Update shader time uniform
    if (material) {
      material.uniforms.uTime.value = elapsedTime
    }

    // Update selection ring time uniform
    if (selectionRingMaterial) {
      selectionRingMaterial.uniforms.uTime.value = elapsedTime
    }

    // Update positions in real-time with smooth interpolation
    // OPTIMIZATION: Only update ships that are actually moving
    const ships = visibleShips()
    if (geometry && ships.length > 0) {
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
      const stateAttr = geometry.getAttribute('aState') as THREE.BufferAttribute
      const colorAttr = geometry.getAttribute('aColor') as THREE.BufferAttribute

      // Handle count mismatch gracefully - update as many ships as buffer allows
      // This prevents ships from disappearing during the frame between visibleShips change and buffer rebuild
      const updateCount = Math.min(posAttr?.count ?? 0, ships.length)
      if (posAttr && updateCount > 0) {
        let positionChanged = false
        let stateChanged = false
        const CONVERGE_THRESHOLD = 0.0001 // Skip updates when position delta is tiny

        // Only iterate over ships that have buffer slots
        for (let i = 0; i < updateCount; i++) {
          const ship = ships[i]
          if (!ship) continue

          // IMPORTANT: Use positionX/Y/Z directly from ship data
          // The backend sends interpolated positions via travel:position WebSocket events
          // We use smooth lerp interpolation between these updates for fluid motion
          let targetX = ship.positionX
          let targetY = ship.positionY
          let targetZ = ship.positionZ

          // CRITICAL FIX: For exploring ships, ALWAYS use targetPosition (synapse location)
          // This prevents ships from disappearing when the state changes from deploying to exploring
          // The ship should be at the synapse location it's exploring
          if (ship.state === 'exploring' && ship.targetPositionX !== undefined) {
            targetX = ship.targetPositionX
            targetY = ship.targetPositionY
            targetZ = ship.targetPositionZ
          }

          // For deploying ships, calculate client-side interpolation if server updates are delayed
          // This ensures smooth "x += formula" animation even with infrequent WebSocket updates
          if (ship.state === 'deploying' && ship.targetPositionX !== undefined &&
              ship.startPositionX !== undefined && ship.travelStartTime && ship.travelDuration) {
            // Calculate current progress based on elapsed time
            const elapsed = Date.now() - ship.travelStartTime
            const progress = Math.min(Math.max(elapsed / ship.travelDuration, 0), 1)

            // Client-side interpolation: x = start + (target - start) * progress
            // This is the "x += formula" approach that ensures smooth movement
            const interpX = ship.startPositionX + (ship.targetPositionX - ship.startPositionX) * progress
            const interpY = ship.startPositionY + (ship.targetPositionY - ship.startPositionY) * progress
            const interpZ = ship.startPositionZ + (ship.targetPositionZ - ship.startPositionZ) * progress

            // Always use client-side interpolation for deploying ships to ensure smooth animation
            // Server updates via travel:position will be used for lerping in the next frame
            targetX = interpX
            targetY = interpY
            targetZ = interpZ
          }

          // Debug log for deploying and exploring ships
          if (ship.state === 'deploying' && Math.random() < 0.02) { // Only log 2% of frames to avoid spam
            console.log(`[AgentMarkers useFrame] Ship ${ship.id.slice(0, 8)} state=${ship.state} rawPos=(${targetX.toFixed(2)},${targetY.toFixed(2)},${targetZ.toFixed(2)}) targetPos=(${ship.targetPositionX?.toFixed(2)},${ship.targetPositionY?.toFixed(2)},${ship.targetPositionZ?.toFixed(2)})`)
          }
          if (ship.state === 'exploring' && Math.random() < 0.02) { // Only log 2% of frames to avoid spam
            console.log(`[AgentMarkers useFrame] Ship ${ship.id.slice(0, 8)} state=${ship.state} pos=(${targetX.toFixed(4)},${targetY.toFixed(4)},${targetZ.toFixed(4)})`)
          }

          // Get or create rendered position for this ship
          let rendered = renderedPositions.get(ship.id)
          if (!rendered) {
            // Initialize at target position (constrained to brain shape)
            const [cx, cy, cz] = constrainToBrainShape(targetX, targetY, targetZ)
            rendered = new THREE.Vector3(cx, cy, cz)
            renderedPositions.set(ship.id, rendered)
            console.log(`[AgentMarkers] Initialized ship ${ship.id.slice(0, 8)} at constrained (${cx.toFixed(2)},${cy.toFixed(2)},${cz.toFixed(2)})`)
            positionChanged = true
          }

          // Validate target position before constraining (prevent NaN from causing disappearance)
          const isValidPosition = isFinite(targetX) && isFinite(targetY) && isFinite(targetZ)

          // CRITICAL FIX: Don't skip ships with invalid positions - use fallback instead
          // This prevents ships from disappearing when position data is stale or invalid
          if (!isValidPosition) {
            // Use targetPosition as fallback if available
            if (ship.targetPositionX !== undefined) {
              targetX = ship.targetPositionX
              targetY = ship.targetPositionY
              targetZ = ship.targetPositionZ
              console.warn(`[AgentMarkers] Ship ${ship.id.slice(0, 8)} has invalid position, using targetPosition as fallback`)
            } else {
              // Last resort: keep previous rendered position
              const prevRendered = renderedPositions.get(ship.id)
              if (prevRendered) {
                targetX = prevRendered.x
                targetY = prevRendered.y
                targetZ = prevRendered.z
                console.warn(`[AgentMarkers] Ship ${ship.id.slice(0, 8)} has invalid position and no target, keeping previous position`)
              } else {
                // No valid position at all - skip this ship (rare edge case)
                console.error(`[AgentMarkers] Ship ${ship.id.slice(0, 8)} has invalid position: (${targetX}, ${targetY}, ${targetZ}) - skipping`)
                continue
              }
            }
          }

          // Constrain target position to brain shape for display
          const [constrainedX, constrainedY, constrainedZ] = constrainToBrainShape(targetX, targetY, targetZ)

          // Calculate delta to check if we need to update
          const deltaX = constrainedX - rendered.x
          const deltaY = constrainedY - rendered.y
          const deltaZ = constrainedZ - rendered.z
          const totalDelta = Math.abs(deltaX) + Math.abs(deltaY) + Math.abs(deltaZ)

          // Only lerp and update if the ship hasn't converged
          if (totalDelta > CONVERGE_THRESHOLD) {
            // Calculate frame-rate independent lerp factor
            const currentTime = elapsedTime
            const deltaTime = lastFrameTime > 0 ? Math.min(currentTime - lastFrameTime, 0.1) : 0.016
            const lerpFactor = 1.0 - Math.exp(-LERP_SPEED * deltaTime)

            // Smoothly lerp rendered position toward constrained target
            rendered.x += deltaX * lerpFactor
            rendered.y += deltaY * lerpFactor
            rendered.z += deltaZ * lerpFactor

            // Use the lerped position directly (already constrained)
            posAttr.setXYZ(i, rendered.x, rendered.y, rendered.z)

            // Update ship positions for raycasting
            if (shipPositions[i]) {
              shipPositions[i].set(rendered.x, rendered.y, rendered.z)
            }

            positionChanged = true

            // Debug log for deploying ships
            if (ship.state === 'deploying' && Math.random() < 0.05) {
              console.log(`[AgentMarkers useFrame] Ship ${ship.id.slice(0, 8)} posAttr=(${rendered.x.toFixed(3)},${rendered.y.toFixed(3)},${rendered.z.toFixed(3)})`)
            }
          }

          // Update state (check if changed)
          const stateMap: Record<ShipStatus, number> = {
            idle: 0,
            searching: 1,
            exploring: 2,
            deploying: 3,
            returning: 4
          }
          const newState = stateMap[ship.state]
          if (stateAttr.getX(i) !== newState) {
            stateAttr.setX(i, newState)
            stateChanged = true

            // Update color only when state changes
            const color = STATE_COLORS[ship.state]
            colorAttr.setXYZ(i, color[0], color[1], color[2])
          }
        }

        // Only trigger GPU upload if something actually changed
        if (positionChanged) {
          posAttr.needsUpdate = true
        }
        if (stateChanged) {
          stateAttr.needsUpdate = true
          colorAttr.needsUpdate = true
        }
      }
    }

    // Update selection ring position
    if (selectionRingMesh) {
      const selectedId = props.selectedShipId
      if (selectedId) {
        const selectedIndex = ships.findIndex(s => s.id === selectedId)
        if (selectedIndex >= 0 && shipPositions[selectedIndex]) {
          const pos = shipPositions[selectedIndex]
          selectionRingMesh.position.copy(pos)
          selectionRingMesh.visible = true
        } else {
          selectionRingMesh.visible = false
        }
      } else {
        selectionRingMesh.visible = false
      }
    }

    // Hover detection
    const renderer = gl()
    const hoveredShip = findClosestShip()
    const currentHovered = hoveredShipId()

    if (hoveredShip?.id !== currentHovered) {
      setHoveredShipId(hoveredShip?.id || null)
      document.body.style.cursor = hoveredShip ? 'pointer' : 'auto'
    }

    // Update tooltip position
    if (hoveredShip && renderer) {
      const shipIndex = visibleShips().findIndex(s => s.id === hoveredShip.id)
      if (shipIndex >= 0 && shipPositions[shipIndex]) {
        const pos = shipPositions[shipIndex].clone()
        pos.project(cam)

        const rect = renderer.domElement.getBoundingClientRect()
        const x = (pos.x * 0.5 + 0.5) * rect.width + rect.left
        const y = (-pos.y * 0.5 + 0.5) * rect.height + rect.top
        setTooltipPosition({ x, y })
      }
    } else {
      setTooltipPosition(null)
    }

    // Update last frame time for delta calculation
    lastFrameTime = elapsedTime
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
            <div class="text-cyan-400">
              {hoveredShip()!.synapsesExplored} explored
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Re-export for backward compatibility
export { ShipMarkers as AgentMarkers }
