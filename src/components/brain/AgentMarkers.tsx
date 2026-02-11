/**
 * AgentMarkers - InstancedMesh Ship Renderer
 *
 * Renders ALL ships (user + world) using per-type InstancedMesh groups.
 * Each ship type (neuron, synapse, dendrite) gets its own set of instanced meshes
 * for distinct 3D models. Handles click detection, selection ring, tooltips, and animations.
 */

import { onMount, onCleanup, createEffect, createMemo, createSignal, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import { loadAllShipModels } from '@/three/useShipModel'
import {
  SELECTION_RING_VERTEX_SHADER,
  SELECTION_RING_FRAGMENT_SHADER,
} from './shaders/shipShaders'
import { shipStore, type Ship, type ShipCluster, type ShipStatus, type ShipType, type WorldShip } from '@/stores/shipStore'
import { computeOrbitPosition } from '@/utils/orbitHelper'

interface ShipMarkersProps {
  userShips: Ship[]
  shipClusters?: ShipCluster[]
  onShipClick?: (ship: Ship) => void
  showIdleShips?: boolean
  selectedShipId?: string | null
}

const SHIP_SCALE = 0.08
const MAX_SHIPS_PER_TYPE = 150
const ALL_TYPES: ShipType[] = ['neuron', 'synapse', 'dendrite', 'axon', 'cortex']

interface TypeMeshGroup {
  meshes: THREE.InstancedMesh[]
  count: number
}

export const ShipMarkers: Component<ShipMarkersProps> = (props) => {
  const threeContext = useThree()
  const { scene, gl, camera } = threeContext

  // Per-type InstancedMesh groups
  const typeMeshGroups = new Map<string, TypeMeshGroup>()
  let shipGroup: THREE.Group | null = null

  // Selection ring
  let selectionRingMesh: THREE.Mesh | null = null
  let selectionRingGeometry: THREE.RingGeometry | null = null
  let selectionRingMaterial: THREE.ShaderMaterial | null = null

  // Raycaster for click detection (user ships only)
  let raycaster: THREE.Raycaster | null = null
  const pointer = new THREE.Vector2()

  // Drag state
  let pointerDownPos: { x: number; y: number } | null = null
  let isDragging = false
  const DRAG_THRESHOLD = 5

  // Ship positions for raycasting (user ships only)
  let userShipPositions: THREE.Vector3[] = []

  // Smooth position interpolation
  const renderedPositions = new Map<string, THREE.Vector3>()
  const shipStateTracker = new Map<string, ShipStatus>()
  const worldShipRendered = new Map<string, THREE.Vector3>()
  const worldShipTrajectory = new Map<string, AnimationCache>()

  // Cache deploy animation parameters to prevent glitches during server updates
  interface AnimationCache {
    startX: number; startY: number; startZ: number
    targetX: number; targetY: number; targetZ: number
    startTime: number; duration: number
  }
  const deployAnimationCache = new Map<string, AnimationCache>()

  // Rotation tracking per ship
  const shipRotations = new Map<string, number>()

  // Selection ring tracking
  let prevSelectedShipId: string | null = null
  const prevSelectedPos = new THREE.Vector3()

  // Hover state
  const [hoveredShipId, setHoveredShipId] = createSignal<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = createSignal<{ x: number; y: number } | null>(null)

  // Model loaded signal
  const [modelReady, setModelReady] = createSignal(false)

  // Temp objects for matrix computation (allocated once, reused per frame)
  const _matrix = new THREE.Matrix4()
  const _quat = new THREE.Quaternion()
  const _pos = new THREE.Vector3()
  const _scale = new THREE.Vector3(SHIP_SCALE, SHIP_SCALE, SHIP_SCALE)
  const _euler = new THREE.Euler()

  // Find closest user ship to pointer for hover/click
  const findClosestShip = (): Ship | null => {
    const cam = camera()
    const ships = shipStore.userShips
    if (!raycaster || !cam || !ships?.length || !userShipPositions.length) return null

    const threshold = 0.2
    raycaster.setFromCamera(pointer, cam)

    let closestIndex: number | null = null
    let closestDist = threshold

    for (let i = 0; i < userShipPositions.length; i++) {
      if (!userShipPositions[i]) continue
      const dist = raycaster.ray.distanceToPoint(userShipPositions[i])
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    }

    if (closestIndex !== null) {
      // Map back to filtered user ships
      const visible = getVisibleUserShips()
      return visible[closestIndex] || null
    }
    return null
  }

  const handleClick = () => {
    if (isDragging) return
    const ship = findClosestShip()
    if (ship && props.onShipClick) props.onShipClick(ship)
  }

  // Helper to filter visible user ships (used in animation loop, not reactive)
  const getVisibleUserShips = (): Ship[] => {
    const allShips = shipStore.userShips
    if (!allShips || !Array.isArray(allShips)) return []
    let ships = [...allShips]
    if (!props.showIdleShips) {
      ships = ships.filter(s => {
        if (s.id === props.selectedShipId) return true
        if (s.state === 'traveling') return true
        return s.state !== 'idle'
      })
    }
    return ships
  }

  // Extract sub-meshes from a loaded model and create InstancedMeshes
  const createMeshGroupFromModel = (model: THREE.Group): THREE.InstancedMesh[] => {
    const meshInfos: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = []
    model.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const mat of mats) {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            if (mat.map) {
              mat.emissiveMap = mat.map
              mat.emissive = new THREE.Color(1, 1, 1)
              mat.emissiveIntensity = 0.6
            } else {
              mat.emissive = mat.color.clone()
              mat.emissiveIntensity = 0.3
            }
          }
        }
        meshInfos.push({ geometry: child.geometry, material: child.material })
      }
    })

    return meshInfos.map(({ geometry, material }) => {
      const im = new THREE.InstancedMesh(geometry, material, MAX_SHIPS_PER_TYPE)
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      im.frustumCulled = false
      im.count = 0
      im.renderOrder = 100
      return im
    })
  }

  onMount(async () => {
    const sceneObj = scene()
    const renderer = gl()
    if (!sceneObj || !renderer) return

    raycaster = new THREE.Raycaster()

    // Load all ship type models in parallel
    const models = await loadAllShipModels()

    shipGroup = new THREE.Group()

    // Create per-type InstancedMesh groups
    for (const type of ALL_TYPES) {
      const model = models.get(type)
      if (!model) continue
      const meshes = createMeshGroupFromModel(model)
      typeMeshGroups.set(type, { meshes, count: 0 })
      meshes.forEach(im => shipGroup!.add(im))
    }

    // Directional lights to illuminate all ship instances
    const keyLight = new THREE.DirectionalLight(0xffffff, 3)
    keyLight.position.set(1, 1.5, -1)
    shipGroup.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xaaccff, 1.2)
    fillLight.position.set(-1, 0.3, 0.5)
    shipGroup.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0x88ddff, 0.8)
    rimLight.position.set(0, -0.5, 1)
    shipGroup.add(rimLight)

    sceneObj.add(shipGroup)

    // Selection ring
    selectionRingGeometry = new THREE.RingGeometry(0.06, 0.1, 32)
    selectionRingMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: SELECTION_RING_VERTEX_SHADER,
      fragmentShader: SELECTION_RING_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    selectionRingMesh = new THREE.Mesh(selectionRingGeometry, selectionRingMaterial)
    selectionRingMesh.rotation.x = -Math.PI / 2
    selectionRingMesh.visible = false
    selectionRingMesh.renderOrder = 110
    sceneObj.add(selectionRingMesh)

    setModelReady(true)

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
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) isDragging = true
      }
    }
    const handlePointerUp = () => {
      if (!isDragging) handleClick()
      pointerDownPos = null
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)

    onCleanup(() => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)

      if (shipGroup && sceneObj) sceneObj.remove(shipGroup)
      for (const group of typeMeshGroups.values()) {
        group.meshes.forEach(im => im.dispose())
      }

      if (selectionRingMesh && sceneObj) sceneObj.remove(selectionRingMesh)
      selectionRingGeometry?.dispose()
      selectionRingMaterial?.dispose()

      document.body.style.cursor = 'auto'
    })
  })

  // Helper: assign a matrix to the correct type group
  const assignToTypeGroup = (type: string) => {
    const group = typeMeshGroups.get(type) || typeMeshGroups.get('neuron')
    if (!group) return
    const idx = group.count
    if (idx >= MAX_SHIPS_PER_TYPE) return
    group.meshes.forEach(im => im.setMatrixAt(idx, _matrix))
    group.count++
  }

  // === STANDALONE ANIMATION LOOP ===
  let animFrameId: number | null = null
  const animStartTime = Date.now()

  const runAnimation = () => {
    const now = Date.now()
    const elapsedTime = (now - animStartTime) / 1000

    if (selectionRingMaterial) selectionRingMaterial.uniforms.uTime.value = elapsedTime

    if (typeMeshGroups.size === 0) {
      animFrameId = requestAnimationFrame(runAnimation)
      return
    }

    // Reset all type group counts
    for (const group of typeMeshGroups.values()) {
      group.count = 0
    }

    // Read fresh data from store each frame
    const worldShips: WorldShip[] = shipStore.worldShips || []
    const visibleUser = getVisibleUserShips()

    // Ensure userShipPositions array is properly sized
    while (userShipPositions.length < visibleUser.length) {
      userShipPositions.push(new THREE.Vector3())
    }
    userShipPositions.length = visibleUser.length

    // === RENDER USER SHIPS ===
    for (let i = 0; i < visibleUser.length; i++) {
      const ship = visibleUser[i]
      let x = ship.positionX, y = ship.positionY, z = ship.positionZ
      let rotY = shipRotations.get(ship.id) ?? 0

      // Deploy animation with cached parameters
      const hasAnimData = ship.state === 'traveling' &&
        ship.startPositionX !== undefined &&
        ship.targetPositionX !== undefined &&
        ship.travelStartTime !== undefined &&
        ship.travelDuration !== undefined &&
        ship.travelDuration > 0

      if (hasAnimData) {
        const cached = deployAnimationCache.get(ship.id)
        if (!cached || cached.startTime !== ship.travelStartTime) {
          deployAnimationCache.set(ship.id, {
            startX: ship.startPositionX!, startY: ship.startPositionY ?? 0, startZ: ship.startPositionZ ?? 0,
            targetX: ship.targetPositionX!, targetY: ship.targetPositionY ?? 0, targetZ: ship.targetPositionZ ?? 0,
            startTime: ship.travelStartTime!, duration: ship.travelDuration!,
          })
        }
      }

      const animCache = deployAnimationCache.get(ship.id)
      if (ship.state === 'traveling' && animCache) {
        const elapsed = now - animCache.startTime
        const progress = Math.min(Math.max(elapsed / animCache.duration, 0), 1)
        x = animCache.startX + (animCache.targetX - animCache.startX) * progress
        y = animCache.startY + (animCache.targetY - animCache.startY) * progress
        z = animCache.startZ + (animCache.targetZ - animCache.startZ) * progress

        // Face travel direction
        const dirX = animCache.targetX - x
        const dirZ = animCache.targetZ - z
        if (dirX * dirX + dirZ * dirZ > 0.0001) {
          const targetRotY = Math.atan2(dirX, -dirZ)
          let deltaAngle = targetRotY - rotY
          deltaAngle = ((deltaAngle + Math.PI) % (Math.PI * 2)) - Math.PI
          if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2
          rotY += deltaAngle * 0.15
        }
      } else if (ship.state !== 'traveling') {
        deployAnimationCache.delete(ship.id)
      }

      // Idle animation: gentle hover + rotation wobble
      if (ship.state === 'idle') {
        const idlePhase = ship.id.charCodeAt(0) + ship.id.charCodeAt(ship.id.length - 1)
        y += Math.sin(now * 0.001 + idlePhase) * 0.02
        rotY = (ship.rotationY ?? 0) + Math.sin(now * 0.0008 + idlePhase * 0.5) * 0.05
      }

      // Solving orbit animation
      if (ship.state === 'solving' && ship.targetPositionX !== undefined) {
        const [ox, oy, oz] = computeOrbitPosition({
          shipId: ship.id,
          centerX: ship.targetPositionX, centerY: ship.targetPositionY ?? 0, centerZ: ship.targetPositionZ ?? 0,
          radius: 0.15, now,
        })
        x = ox; y = oy; z = oz

        // Face orbit tangent direction
        const orbitSpeed = 0.0005 + (ship.id.charCodeAt(0) % 10) * 0.0001
        const orbitPhase = ship.id.charCodeAt(0)
        const angle = now * orbitSpeed + orbitPhase
        rotY = -(angle + Math.PI / 2)
      }

      // Returning: face movement direction
      if (ship.state === 'returning') {
        const lastPos = renderedPositions.get(ship.id)
        if (lastPos) {
          const moveDirX = x - lastPos.x
          const moveDirZ = z - lastPos.z
          if (moveDirX * moveDirX + moveDirZ * moveDirZ > 0.00001) {
            const targetRotY = Math.atan2(moveDirX, -moveDirZ)
            let deltaAngle = targetRotY - rotY
            deltaAngle = ((deltaAngle + Math.PI) % (Math.PI * 2)) - Math.PI
            if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2
            rotY += deltaAngle * 0.15
          }
        }
      }

      // Smooth position jumps during state transitions
      const prevState = shipStateTracker.get(ship.id)
      const isTransition = prevState !== undefined && prevState !== ship.state
      shipStateTracker.set(ship.id, ship.state)

      const lastPos = renderedPositions.get(ship.id)
      if (lastPos) {
        const jumpDist = Math.sqrt((x - lastPos.x) ** 2 + (y - lastPos.y) ** 2 + (z - lastPos.z) ** 2)
        const maxJump = isTransition ? 0.02 : 0.05
        const lerpFactor = isTransition ? 0.15 : 0.3
        if (jumpDist > maxJump) {
          x = lastPos.x + (x - lastPos.x) * lerpFactor
          y = lastPos.y + (y - lastPos.y) * lerpFactor
          z = lastPos.z + (z - lastPos.z) * lerpFactor
        }
      }

      if (!renderedPositions.has(ship.id)) {
        renderedPositions.set(ship.id, new THREE.Vector3(x, y, z))
      } else {
        renderedPositions.get(ship.id)!.set(x, y, z)
      }

      shipRotations.set(ship.id, rotY)
      userShipPositions[i].set(x, y, z)

      // Set instance matrix and assign to correct type group
      _pos.set(x, y, z)
      _euler.set(0, rotY, 0)
      _quat.setFromEuler(_euler)
      _matrix.compose(_pos, _quat, _scale)
      assignToTypeGroup(ship.shipType)
    }

    // === RENDER WORLD SHIPS ===
    for (let i = 0; i < worldShips.length; i++) {
      const ws = worldShips[i]
      let x: number, y: number, z: number
      let rotY = shipRotations.get('w_' + ws.id) ?? 0

      if (ws.s === 0 && ws.ts && ws.td && ws.td > 0) {
        // Traveling: cache trajectory, then interpolate locally using time
        const cached = worldShipTrajectory.get(ws.id)
        if (!cached || cached.startTime !== ws.ts) {
          worldShipTrajectory.set(ws.id, {
            startX: ws.sx ?? ws.x, startY: ws.sy ?? ws.y, startZ: ws.sz ?? ws.z,
            targetX: ws.tx ?? ws.x, targetY: ws.ty ?? ws.y, targetZ: ws.tz ?? ws.z,
            startTime: ws.ts, duration: ws.td,
          })
        }

        const traj = worldShipTrajectory.get(ws.id)!
        const progress = Math.min(Math.max((now - traj.startTime) / traj.duration, 0), 1)
        x = traj.startX + (traj.targetX - traj.startX) * progress
        y = traj.startY + (traj.targetY - traj.startY) * progress
        z = traj.startZ + (traj.targetZ - traj.startZ) * progress

        // Face travel direction
        const dx = traj.targetX - x
        const dz = traj.targetZ - z
        if (dx * dx + dz * dz > 0.0001) {
          const targetRotY = Math.atan2(dx, -dz)
          let deltaAngle = targetRotY - rotY
          deltaAngle = ((deltaAngle + Math.PI) % (Math.PI * 2)) - Math.PI
          if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2
          rotY += deltaAngle * 0.15
        }
      } else {
        // Idle: server position with gentle hover
        x = ws.x
        y = ws.y
        z = ws.z
        const idlePhase = ws.id.charCodeAt(ws.id.length - 1)
        y += Math.sin(now * 0.001 + idlePhase) * 0.02
        worldShipTrajectory.delete(ws.id)
      }

      // Smooth rendered position to avoid hard jumps on data changes
      let rendered = worldShipRendered.get(ws.id)
      if (!rendered) {
        rendered = new THREE.Vector3(x, y, z)
        worldShipRendered.set(ws.id, rendered)
      } else {
        rendered.x += (x - rendered.x) * 0.2
        rendered.y += (y - rendered.y) * 0.2
        rendered.z += (z - rendered.z) * 0.2
      }

      shipRotations.set('w_' + ws.id, rotY)

      _pos.set(rendered.x, rendered.y, rendered.z)
      _euler.set(0, rotY, 0)
      _quat.setFromEuler(_euler)
      _matrix.compose(_pos, _quat, _scale)
      assignToTypeGroup(ws.tp || 'neuron')
    }

    // Update instance counts and trigger GPU upload
    for (const group of typeMeshGroups.values()) {
      group.meshes.forEach(im => {
        im.count = group.count
        im.instanceMatrix.needsUpdate = true
      })
    }

    // Clean up stale world ship tracking data
    const currentWorldIds = new Set(worldShips.map(s => s.id))
    for (const id of worldShipRendered.keys()) {
      if (!currentWorldIds.has(id)) {
        worldShipRendered.delete(id)
        worldShipTrajectory.delete(id)
        shipRotations.delete('w_' + id)
      }
    }

    // Update selection ring
    if (selectionRingMesh && props.selectedShipId) {
      const idx = visibleUser.findIndex(s => s.id === props.selectedShipId)
      if (idx >= 0 && userShipPositions[idx]) {
        const idChanged = prevSelectedShipId !== props.selectedShipId
        const posChanged = !prevSelectedPos.equals(userShipPositions[idx])
        if (idChanged || posChanged) {
          selectionRingMesh.position.copy(userShipPositions[idx])
          prevSelectedPos.copy(userShipPositions[idx])
          prevSelectedShipId = props.selectedShipId
        }
        selectionRingMesh.visible = true
      } else {
        selectionRingMesh.visible = false
      }
    } else if (selectionRingMesh) {
      selectionRingMesh.visible = false
      prevSelectedShipId = null
    }

    animFrameId = requestAnimationFrame(runAnimation)
  }

  // Start animation loop once model is ready
  createEffect(() => {
    if (modelReady() && !animFrameId) {
      animFrameId = requestAnimationFrame(runAnimation)
    }
  })

  onCleanup(() => {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
  })

  // Hover detection via useFrame (needs camera access)
  useFrame(({ camera: cam }) => {
    const hovered = findClosestShip()
    if (hovered?.id !== hoveredShipId()) {
      setHoveredShipId(hovered?.id || null)
      document.body.style.cursor = hovered ? 'pointer' : 'auto'
    }

    const renderer = gl()
    if (hovered && renderer) {
      const visible = getVisibleUserShips()
      const idx = visible.findIndex(s => s.id === hovered.id)
      if (idx >= 0 && userShipPositions[idx]) {
        const pos = userShipPositions[idx].clone().project(cam)
        const rect = renderer.domElement.getBoundingClientRect()
        setTooltipPosition({
          x: (pos.x * 0.5 + 0.5) * rect.width + rect.left,
          y: (-pos.y * 0.5 + 0.5) * rect.height + rect.top,
        })
      }
    } else {
      setTooltipPosition(null)
    }
  })

  const hoveredShip = createMemo(() => {
    const id = hoveredShipId()
    const ships = shipStore.userShips
    return id && ships ? ships.find(s => s.id === id) || null : null
  })

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
