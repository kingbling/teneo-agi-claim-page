import { onMount, onCleanup, createEffect, createMemo, createSignal, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { SynapseType, UserLevel } from '@/types/game'
import { SYNAPSE_TYPE_COLORS, SYNAPSE_CONFIG, formatPoints, formatETA } from '@/types/game'
import type { SynapseCluster, RawSynapseData } from '@/stores/shipStore'
import { SpatialOctree } from '@/utils/SpatialOctree'
import { getDominantSynapseType } from '@/utils/synapseUtils'
import { SYNAPSE_VERTEX_SHADER, SYNAPSE_FRAGMENT_SHADER } from './shaders/synapseShaders'
import { log } from '@/utils/logger'

// Synapse type priority for determining dominant type (rarity order)
const SYNAPSE_TYPE_PRIORITY: Record<SynapseType, number> = {
  minor: 1,
  complex: 2,
  deep: 3,
  core: 4,
  rare: 5,
  legendary: 6,
  unique: 7,
}

// Phase 2.3: Brightness multipliers by rarity - expanded range for visual hierarchy
// rare/legendary/unique exceed bloom threshold (0.75) to trigger glow
const SYNAPSE_BRIGHTNESS_MULTIPLIERS: Record<SynapseType, number> = {
  minor: 0.5,       // Muted background
  complex: 0.6,     // Slightly brighter
  deep: 0.7,        // Noticeable step up
  core: 0.85,       // Getting bright
  rare: 1.0,        // Full brightness
  legendary: 1.2,   // EXCEEDS 1.0 → triggers bloom!
  unique: 1.5,      // DRAMATICALLY bright → definite bloom
}

// Size multipliers by synapse type - subtle visual hierarchy
const SYNAPSE_SIZE_MULTIPLIERS: Record<SynapseType, number> = {
  minor: 1.0,      // Base size
  complex: 1.1,    // Slightly larger
  deep: 1.2,       // A bit larger
  core: 1.3,       // Noticeable
  rare: 1.4,       // Slightly more
  legendary: 1.5,  // Visible difference
  unique: 1.6,     // Most prominent
}

// Color mapping for 7 synapse types (RGB normalized from SYNAPSE_TYPE_COLORS)
const SYNAPSE_COLOR_MAP: Record<SynapseType, [number, number, number]> = {
  minor:     [SYNAPSE_TYPE_COLORS.minor.r, SYNAPSE_TYPE_COLORS.minor.g, SYNAPSE_TYPE_COLORS.minor.b],         // Blue
  complex:   [SYNAPSE_TYPE_COLORS.complex.r, SYNAPSE_TYPE_COLORS.complex.g, SYNAPSE_TYPE_COLORS.complex.b],   // Purple
  deep:      [SYNAPSE_TYPE_COLORS.deep.r, SYNAPSE_TYPE_COLORS.deep.g, SYNAPSE_TYPE_COLORS.deep.b],           // Teal
  core:      [SYNAPSE_TYPE_COLORS.core.r, SYNAPSE_TYPE_COLORS.core.g, SYNAPSE_TYPE_COLORS.core.b],           // Gold
  rare:      [SYNAPSE_TYPE_COLORS.rare.r, SYNAPSE_TYPE_COLORS.rare.g, SYNAPSE_TYPE_COLORS.rare.b],           // Red-pink
  legendary: [SYNAPSE_TYPE_COLORS.legendary.r, SYNAPSE_TYPE_COLORS.legendary.g, SYNAPSE_TYPE_COLORS.legendary.b], // Bright magenta
  unique:    [SYNAPSE_TYPE_COLORS.unique.r, SYNAPSE_TYPE_COLORS.unique.g, SYNAPSE_TYPE_COLORS.unique.b],     // Brilliant yellow
}

// Synapse type index to type name mapping
const SYNAPSE_TYPE_BY_INDEX: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']

interface SynapseMarkersProps {
  clusters: SynapseCluster[]
  userLevel?: UserLevel  // For showing locked synapse types (Masterplan 2026: USDC-based level)
  onSynapseClick?: (cluster: SynapseCluster, position: THREE.Vector3) => void
  filterType?: string | null  // Filter by synapse type - dims and disables non-matching
  hasIdleShip?: boolean  // Whether user has at least one idle ship available for deployment
  // Individual synapse mode (500k points)
  rawSynapseData?: RawSynapseData | null
  rawSynapseDataVersion?: number  // For reactivity on delta updates
  useIndividualMode?: boolean  // If true, render individual points instead of clusters
  onIndividualSynapseClick?: (index: number, position: THREE.Vector3) => void
  // Solvable density control (performance optimization for LOD 0)
  solvableDensity?: number  // 0.0-1.0, fraction of solvables visible at once (default 0.3)
  forceSolvableOnly?: boolean  // Override auto-detection, always enable density filtering
}

export const SynapseMarkers: Component<SynapseMarkersProps> = (props) => {
  const { scene, gl, camera } = useThree()

  // Three.js objects (imperative refs)
  let pointsObject: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null

  // Raycaster for click/hover detection
  let raycaster: THREE.Raycaster | null = null
  const pointer = new THREE.Vector2()
  const lastPointer = new THREE.Vector2()
  let frameCounter = 0
  const HOVER_CHECK_INTERVAL = 1 // Check hover every frame for responsive feel
  const lastCamPosForTooltip = new THREE.Vector3()
  const TOOLTIP_CAM_THRESHOLD = 0.01

  // Track ALL cluster positions for raycasting (not filtered by frustum)
  let allClusterPositions: THREE.Vector3[] = []

  // Spatial grid for O(1) cluster raycasting (cell size 0.3)
  const CLUSTER_GRID_CELL_SIZE = 0.3
  let clusterSpatialGrid: Map<string, number[]> = new Map()

  // Track cluster positions for raycasting
  let clusterPositions: THREE.Vector3[] = []

  // Mapping from original cluster index to visible cluster index
  const originalToVisibleIndexMap: Map<number, number> = new Map()

  // Octree for individual synapse mode (500k points)
  let octree: SpatialOctree | null = null
  // Cache octree across mode toggles — only rebuild when data changes
  let octreeDataVersion: number | undefined = undefined

  // Frustum culling for viewport optimization
  const frustum = new THREE.Frustum()
  const projScreenMatrix = new THREE.Matrix4()
  const [frustumNeedsUpdate, setFrustumNeedsUpdate] = createSignal(0)
  let frameCounterFrustum = 0

  // Hover attribute buffer (updated each frame)
  let hoveredAttrBuffer: Float32Array | null = null
  let hoveredAttr: THREE.BufferAttribute | null = null

  // Filter attribute buffer (updated when filter changes)
  let filteredAttrBuffer: Float32Array | null = null
  let filteredAttr: THREE.BufferAttribute | null = null

  // Actionable attribute buffer (updated when user state changes)
  let actionableAttrBuffer: Float32Array | null = null
  let actionableAttr: THREE.BufferAttribute | null = null

  // Track drag state
  let pointerDownPos: { x: number; y: number } | null = null
  let isDragging = false
  const DRAG_THRESHOLD = 5


  // Hover state signal for tooltip
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null)
  const [tooltipPosition, setTooltipPosition] = createSignal<{ x: number; y: number } | null>(null)

  // Build ALL cluster positions + spatial grid for raycasting (always all clusters, not filtered)
  // Reuses existing Vector3 objects when possible to reduce GC pressure
  createEffect(() => {
    const clusters = props.clusters
    // Grow or shrink the array to match
    while (allClusterPositions.length < clusters.length) {
      allClusterPositions.push(new THREE.Vector3())
    }
    allClusterPositions.length = clusters.length

    // Rebuild spatial grid
    const grid = new Map<string, number[]>()
    const cellSize = CLUSTER_GRID_CELL_SIZE

    clusters.forEach((cluster, i) => {
      allClusterPositions[i].set(cluster.positionX, cluster.positionY, cluster.positionZ)

      const key = `${Math.floor(cluster.positionX / cellSize)},${Math.floor(cluster.positionY / cellSize)},${Math.floor(cluster.positionZ / cellSize)}`
      let cell = grid.get(key)
      if (!cell) { cell = []; grid.set(key, cell) }
      cell.push(i)
    })

    clusterSpatialGrid = grid
  })

  // Filter clusters by frustum culling (only render visible clusters)
  // Uses a single reusable Vector3 to avoid allocations per cluster
  const _frustumTestPoint = new THREE.Vector3()
  const visibleClusters = createMemo(() => {
    // Trigger recomputation when frustum updates
    void frustumNeedsUpdate()

    const visible: typeof props.clusters = []
    originalToVisibleIndexMap.clear()

    props.clusters.forEach((cluster, originalIndex) => {
      _frustumTestPoint.set(cluster.positionX, cluster.positionY, cluster.positionZ)
      if (frustum.containsPoint(_frustumTestPoint)) {
        const visibleIndex = visible.length
        visible.push(cluster)
        originalToVisibleIndexMap.set(originalIndex, visibleIndex)
      }
    })

    return visible
  })

  // Build geometry data from visible clusters only
  const geometryData = createMemo(() => {
    const clusters = visibleClusters()  // Use filtered clusters
    const userLevel = props.userLevel ?? 1 as UserLevel

    if (clusters.length === 0) {
      return null
    }

    const positions = new Float32Array(clusters.length * 3)
    const colors = new Float32Array(clusters.length * 3)
    const sizes = new Float32Array(clusters.length)
    const states = new Float32Array(clusters.length)
    const synapseTypes = new Float32Array(clusters.length)
    const progress = new Float32Array(clusters.length)  // Exploration progress 0-1
    // Reuse existing Vector3 pool for cluster positions
    while (clusterPositions.length < clusters.length) {
      clusterPositions.push(new THREE.Vector3())
    }
    clusterPositions.length = clusters.length

    clusters.forEach((cluster, i) => {
      positions[i * 3] = cluster.positionX
      positions[i * 3 + 1] = cluster.positionY
      positions[i * 3 + 2] = cluster.positionZ
      clusterPositions[i].set(cluster.positionX, cluster.positionY, cluster.positionZ)

      // Discovery ratios
      const discoveryRatio = cluster.discoveredCount / Math.max(1, cluster.synapseCount)
      const exploringRatio = cluster.beingExploredCount / Math.max(1, cluster.synapseCount)

      // Get dominant synapse type
      const dominantType = getDominantSynapseType(cluster.typeCounts)
      const typeIndex = SYNAPSE_TYPE_PRIORITY[dominantType] - 1  // 0-6 for shader
      synapseTypes[i] = typeIndex

      // Check if this synapse type is locked for the user (Masterplan 2026: USDC-based level gating)
      const unlockLevel = SYNAPSE_CONFIG[dominantType].unlockUserLevel
      const isLocked = userLevel < unlockLevel

      // Size based on synapse count and type rarity - tiny clean markers
      const baseSize = 2.5  // Tiny base for clean look
      const weightScale = 1.0 + Math.log10(Math.max(1, cluster.synapseCount)) * 0.05  // Very subtle scaling
      const typeMultiplier = SYNAPSE_SIZE_MULTIPLIERS[dominantType]
      sizes[i] = baseSize * weightScale * typeMultiplier

      // State: 0=undiscovered, 1=exploring, 2=discovered
      if (discoveryRatio > 0.5) {
        states[i] = 2.0
        progress[i] = 1.0  // Fully complete
      } else if (exploringRatio > 0.1 || discoveryRatio > 0) {
        states[i] = 1.0
        // Progress based on discovery + exploring ratio (0.0-0.99)
        // Use 0.0 to let the shader animate a sweeping progress if no real data
        progress[i] = Math.min(0.99, discoveryRatio + exploringRatio * 0.5)
      } else {
        states[i] = 0.0
        progress[i] = 0.0
      }

      // Colors based on synapse type and state
      const typeColor = SYNAPSE_COLOR_MAP[dominantType]

      // Phase 2.3: Brightness based on rarity tier + state modifier
      const rarityBrightness = SYNAPSE_BRIGHTNESS_MULTIPLIERS[dominantType]
      const stateModifier = states[i] === 2 ? 1.2 : states[i] === 1 ? 1.0 : 0.75
      let brightness = rarityBrightness * stateModifier

      if (isLocked) {
        brightness *= 0.5  // More visible than before (was 0.3), with desaturation in shader
      }

      colors[i * 3] = Math.min(1.0, typeColor[0] * brightness)
      colors[i * 3 + 1] = Math.min(1.0, typeColor[1] * brightness)
      colors[i * 3 + 2] = Math.min(1.0, typeColor[2] * brightness)
    })

    return { positions, colors, sizes, states, synapseTypes, progress }
  })

  // Build geometry data from raw individual synapses (500k points)
  const individualGeometryData = createMemo(() => {
    const data = props.rawSynapseData
    const userLevel = props.userLevel ?? 1 as UserLevel
    // Track version for reactivity on delta updates
    void props.rawSynapseDataVersion

    if (!data || !props.useIndividualMode) {
      return null
    }

    const count = data.count
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const statesFloat = new Float32Array(count)
    const synapseTypes = new Float32Array(count)
    const progress = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const state = data.states[i]
      const typeIdx = data.types[i]
      const synapseType = SYNAPSE_TYPE_BY_INDEX[typeIdx] || 'minor'

      // Check lock status
      const unlockLevel = SYNAPSE_CONFIG[synapseType].unlockUserLevel
      const isLocked = userLevel < unlockLevel

      // Size based on type
      const baseSize = 2.0  // Smaller for individual points
      sizes[i] = baseSize * SYNAPSE_SIZE_MULTIPLIERS[synapseType]

      // State: 0=undiscovered, 1=being_solved, 2=discovered
      statesFloat[i] = state
      synapseTypes[i] = typeIdx
      progress[i] = state === 2 ? 1.0 : state === 1 ? 0.5 : 0.0

      // Colors
      const typeColor = SYNAPSE_COLOR_MAP[synapseType]
      const rarityBrightness = SYNAPSE_BRIGHTNESS_MULTIPLIERS[synapseType]
      const stateModifier = state === 2 ? 1.2 : state === 1 ? 1.0 : 0.75
      let brightness = rarityBrightness * stateModifier

      if (isLocked) {
        brightness *= 0.5
      }

      colors[i * 3] = Math.min(1.0, typeColor[0] * brightness)
      colors[i * 3 + 1] = Math.min(1.0, typeColor[1] * brightness)
      colors[i * 3 + 2] = Math.min(1.0, typeColor[2] * brightness)
    }

    return {
      positions: data.positions,
      colors,
      sizes,
      states: statesFloat,
      synapseTypes,
      progress,
      count,
    }
  })

  // Build octree when individual geometry is ready
  // Cache across mode toggles — only rebuild when underlying data changes
  createEffect(() => {
    const data = individualGeometryData()
    const version = props.rawSynapseDataVersion
    if (data && props.useIndividualMode) {
      if (!octree || octreeDataVersion !== version) {
        octree = new SpatialOctree(data.positions, 8, 64)
        octreeDataVersion = version
      }
    } else if (!props.useIndividualMode) {
      // Don't null out octree on mode toggle — keep cached
    } else {
      octree = null
      octreeDataVersion = undefined
    }
  })

  // Actionable hover tolerance: prefer actionable synapses within this multiplier of closest distance
  const ACTIONABLE_HOVER_TOLERANCE = 1.8

  // Helper: check if a synapse index is actionable
  const isActionable = (idx: number): boolean => {
    return actionableAttrBuffer !== null && actionableAttrBuffer[idx] > 0.5
  }

  // Find closest synapse/cluster to pointer for hover/click
  // Uses octree when in individual mode for O(log n) performance
  // NOTE: Uses allClusterPositions (not filtered by frustum) to allow clicking at viewport edges
  // Implements hysteresis with actionable preference: sticky on actionable, easy snap to actionable
  const findClosestPoint = (currentHoveredIndex: number | null): number | null => {
    const cam = camera()
    if (!raycaster || !cam) return null

    // Larger threshold for easier selection - scales slightly with camera distance
    const camDist = cam.position.length()
    const baseThreshold = Math.max(0.5, 0.3 + camDist * 0.15) // 0.5 minimum, scales up at distance
    // Hysteresis: use 2x threshold to KEEP current hover (sticky hover)
    const keepThreshold = baseThreshold * 2.0
    raycaster.setFromCamera(pointer, cam)

    // Reusable temp vectors for distance calculations (avoids allocation per call)
    const _tempPos = new THREE.Vector3()

    // Helper to get position of an index (writes into _tempPos to avoid allocation)
    const getPosition = (idx: number): THREE.Vector3 | null => {
      if (props.useIndividualMode && octree) {
        const data = individualGeometryData()
        if (data) {
          return _tempPos.set(
            data.positions[idx * 3],
            data.positions[idx * 3 + 1],
            data.positions[idx * 3 + 2]
          )
        }
      } else if (allClusterPositions[idx]) {
        return allClusterPositions[idx]
      }
      return null
    }

    // Helper to check if current hover should be maintained
    const shouldKeepCurrentHover = (currentIdx: number | null): boolean => {
      if (currentIdx === null) return false
      const currentPos = getPosition(currentIdx)
      if (!currentPos) return false
      const dist = raycaster!.ray.distanceToPoint(currentPos)
      return dist < keepThreshold
    }

    // Hysteresis helper: determine switch threshold based on actionable status
    const getHysteresisRatio = (currentIdx: number | null, newIdx: number | null): number => {
      if (currentIdx === null || newIdx === null) return 0.7
      const currentIsActionable = isActionable(currentIdx)
      const newIsActionable = isActionable(newIdx)
      if (currentIsActionable && !newIsActionable) return 0.5  // Sticky on actionable: hard to leave
      if (!currentIsActionable && newIsActionable) return 0.9  // Easy snap to actionable
      return 0.7  // Both same status: normal rule
    }

    // Choose best candidate considering actionable preference
    const pickBest = (
      closestAnyIdx: number | null, closestAnyDist: number,
      closestActionableIdx: number | null, closestActionableDist: number
    ): number | null => {
      // If actionable candidate exists within tolerance of closest-any, prefer it
      if (closestActionableIdx !== null && closestAnyIdx !== null) {
        if (closestActionableDist <= closestAnyDist * ACTIONABLE_HOVER_TOLERANCE) {
          return closestActionableIdx
        }
      }
      // If only actionable found (closestAny might also be actionable)
      if (closestActionableIdx !== null && closestAnyIdx === null) {
        return closestActionableIdx
      }
      return closestAnyIdx
    }

    // Individual mode: use octree with findAllWithinDistance for actionable scoring
    if (props.useIndividualMode && octree) {
      const candidates = octree.findAllWithinDistance(raycaster.ray, baseThreshold)

      let closestAnyIdx: number | null = null
      let closestAnyDist = baseThreshold
      let closestActionableIdx: number | null = null
      let closestActionableDist = baseThreshold

      const _candidatePos = new THREE.Vector3()
      const data = individualGeometryData()
      for (const idx of candidates) {
        // Skip filtered out
        if (filteredAttrBuffer && filteredAttrBuffer[idx] > 0.5) continue

        if (!data) continue
        _candidatePos.set(
          data.positions[idx * 3],
          data.positions[idx * 3 + 1],
          data.positions[idx * 3 + 2]
        )
        const dist = raycaster!.ray.distanceToPoint(_candidatePos)

        if (dist < closestAnyDist) {
          closestAnyDist = dist
          closestAnyIdx = idx
        }
        if (isActionable(idx) && dist < closestActionableDist) {
          closestActionableDist = dist
          closestActionableIdx = idx
        }
      }

      const best = pickBest(closestAnyIdx, closestAnyDist, closestActionableIdx, closestActionableDist)

      if (best !== null) {
        // Apply hysteresis
        if (currentHoveredIndex !== null && shouldKeepCurrentHover(currentHoveredIndex)) {
          const currentPos = getPosition(currentHoveredIndex)
          if (currentPos) {
            const currentDist = raycaster!.ray.distanceToPoint(currentPos)
            const bestPos = getPosition(best)
            const bestDist = bestPos ? raycaster!.ray.distanceToPoint(bestPos) : Infinity
            const ratio = getHysteresisRatio(currentHoveredIndex, best)
            if (best !== currentHoveredIndex && bestDist >= currentDist * ratio) {
              return currentHoveredIndex
            }
          }
        }
        return best
      }

      // Nothing found within base threshold - check if we should keep current hover
      if (shouldKeepCurrentHover(currentHoveredIndex)) {
        return currentHoveredIndex
      }
      return null
    }

    // Cluster mode: use spatial grid for O(1) lookup instead of iterating all clusters
    if (allClusterPositions.length === 0) return null

    let closestAnyIdx: number | null = null
    let closestAnyDist = baseThreshold
    let closestActionableIdx: number | null = null
    let closestActionableDist = baseThreshold

    // Also track distance to current hover for hysteresis comparison
    let currentHoverDist = Infinity
    if (currentHoveredIndex !== null && allClusterPositions[currentHoveredIndex]) {
      currentHoverDist = raycaster!.ray.distanceToPoint(allClusterPositions[currentHoveredIndex])
    }

    // Project ray onto brain center plane to find search origin
    const brainCenter = new THREE.Vector3(0, 0.1, 0)
    const rayToBrain = raycaster!.ray.closestPointToPoint(brainCenter, _tempPos)
    const cellSize = CLUSTER_GRID_CELL_SIZE
    const cx = Math.floor(rayToBrain.x / cellSize)
    const cy = Math.floor(rayToBrain.y / cellSize)
    const cz = Math.floor(rayToBrain.z / cellSize)

    // Search neighborhood: radius depends on threshold / cell size
    const searchRadius = Math.ceil(baseThreshold / cellSize) + 1
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dz = -searchRadius; dz <= searchRadius; dz++) {
          const cell = clusterSpatialGrid.get(`${cx + dx},${cy + dy},${cz + dz}`)
          if (!cell) continue
          for (const i of cell) {
            if (filteredAttrBuffer && filteredAttrBuffer[i] > 0.5) continue
            const dist = raycaster!.ray.distanceToPoint(allClusterPositions[i])
            if (dist < closestAnyDist) {
              closestAnyDist = dist
              closestAnyIdx = i
            }
            if (isActionable(i) && dist < closestActionableDist) {
              closestActionableDist = dist
              closestActionableIdx = i
            }
          }
        }
      }
    }

    const closestIndex = pickBest(closestAnyIdx, closestAnyDist, closestActionableIdx, closestActionableDist)

    // Hysteresis: if we have a current hover, only switch to a new one if it's SIGNIFICANTLY closer
    // This prevents flickering between similarly-distanced clusters
    if (currentHoveredIndex !== null && currentHoverDist < keepThreshold) {
      // Current hover is still valid (within keep threshold)
      if (closestIndex === null || closestIndex === currentHoveredIndex) {
        // No new point found or same point - keep current
        return currentHoveredIndex
      }
      // New point found - use actionable-aware hysteresis ratio
      const ratio = getHysteresisRatio(currentHoveredIndex, closestIndex)
      const significantlyCloser = closestAnyDist < currentHoverDist * ratio
      if (!significantlyCloser) {
        // New point isn't significantly closer - keep current hover
        return currentHoveredIndex
      }
      // New point is significantly closer - switch to it
    }

    // Return the closest point (or null if none found)
    return closestIndex
  }

  // Handle click on synapse - handles both individual and cluster modes
  const handleClick = () => {
    if (isDragging) return

    // Use the tracked hover state instead of finding closest at click time
    // This prevents accidental clicks when looking around
    const currentHovered = hoveredIndex()
    if (currentHovered === null) return

    if (props.useIndividualMode && props.onIndividualSynapseClick) {
      // Individual mode: use octree position
      const data = individualGeometryData()
      if (data) {
        const pos = new THREE.Vector3(
          data.positions[currentHovered * 3],
          data.positions[currentHovered * 3 + 1],
          data.positions[currentHovered * 3 + 2]
        )
        props.onIndividualSynapseClick(currentHovered, pos)
      }
    } else if (props.onSynapseClick) {
      // Cluster mode
      const cluster = props.clusters[currentHovered]
      const pos = clusterPositions[currentHovered]
      if (cluster && pos) {
        props.onSynapseClick(cluster, pos)
      }
    }
  }

  onMount(() => {
    const sceneObj = scene()
    const renderer = gl()

    if (!sceneObj || !renderer) {
      log.brain.warn('SpaceMarkers: Scene or renderer not available')
      return
    }

    // Initialize raycaster
    raycaster = new THREE.Raycaster()

    // Create geometry
    geometry = new THREE.BufferGeometry()

    // Create shader material - using normal blending to prevent bloom blowout
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSolvablePhase: { value: 0 },           // Cycles 0-1 for blinking effect
        uCameraWorldPos: { value: new THREE.Vector3() },  // Camera position for distance calc
        uSolvableDensity: { value: 0.3 },       // 30% of solvables visible at once
        uSolvableOnly: { value: 0 },            // 1 = enable density filtering at close zoom
        uHasActionable: { value: 0 },           // 1 = at least one synapse is actionable
      },
      vertexShader: SYNAPSE_VERTEX_SHADER,
      fragmentShader: SYNAPSE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,  // Changed from Additive to prevent massive glow
    })

    // Create points object
    pointsObject = new THREE.Points(geometry, material)
    pointsObject.frustumCulled = false

    // Add to scene
    sceneObj.add(pointsObject)

    // Canvas event listeners for drag detection
    const canvas = renderer.domElement

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY }
      isDragging = false
    }

    const handlePointerMove = (e: PointerEvent) => {
      // Update pointer for raycasting
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      // Check for drag
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

    const handlePointerLeave = () => {
      setHoveredIndex(null)
      setTooltipPosition(null)
      document.body.style.cursor = 'auto'
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerLeave)

    onCleanup(() => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerLeave)

      // Remove from scene and dispose
      if (pointsObject && sceneObj) {
        sceneObj.remove(pointsObject)
      }
      if (geometry) {
        geometry.dispose()
      }
      if (material) {
        material.dispose()
      }

      // Reset cursor
      document.body.style.cursor = 'auto'
    })
  })

  // Update geometry when data changes (handles both cluster and individual modes)
  createEffect(() => {
    if (!geometry) return

    // Determine which data source to use
    const individualData = individualGeometryData()
    const clusterData = geometryData()

    // Individual mode takes priority if enabled and data available
    if (props.useIndividualMode && individualData) {
      // Clear cluster positions (not used in individual mode)
      clusterPositions = []

      // Initialize attribute buffers
      hoveredAttrBuffer = new Float32Array(individualData.count)
      hoveredAttr = new THREE.BufferAttribute(hoveredAttrBuffer, 1)
      hoveredAttr.setUsage(THREE.DynamicDrawUsage)

      filteredAttrBuffer = new Float32Array(individualData.count)
      filteredAttr = new THREE.BufferAttribute(filteredAttrBuffer, 1)
      filteredAttr.setUsage(THREE.DynamicDrawUsage)

      actionableAttrBuffer = new Float32Array(individualData.count)
      actionableAttr = new THREE.BufferAttribute(actionableAttrBuffer, 1)
      actionableAttr.setUsage(THREE.DynamicDrawUsage)

      // Update geometry attributes
      geometry.setAttribute('position', new THREE.BufferAttribute(individualData.positions, 3))
      geometry.setAttribute('aColor', new THREE.BufferAttribute(individualData.colors, 3))
      geometry.setAttribute('aSize', new THREE.BufferAttribute(individualData.sizes, 1))
      geometry.setAttribute('aState', new THREE.BufferAttribute(individualData.states, 1))
      geometry.setAttribute('aSynapseType', new THREE.BufferAttribute(individualData.synapseTypes, 1))
      geometry.setAttribute('aProgress', new THREE.BufferAttribute(individualData.progress, 1))
      geometry.setAttribute('aHovered', hoveredAttr)
      geometry.setAttribute('aFiltered', filteredAttr)
      geometry.setAttribute('aActionable', actionableAttr)
      geometry.computeBoundingSphere()
      return
    }

    // Cluster mode fallback
    if (!clusterData) return

    // clusterPositions already updated in geometryData memo
    const count = props.clusters.length
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined

    // Reuse existing buffers when count matches (update in-place)
    if (posAttr && posAttr.count === count && hoveredAttrBuffer?.length === count) {
      ;(posAttr.array as Float32Array).set(clusterData.positions)
      posAttr.needsUpdate = true

      const colorAttr = geometry.getAttribute('aColor') as THREE.BufferAttribute
      ;(colorAttr.array as Float32Array).set(clusterData.colors)
      colorAttr.needsUpdate = true

      const sizeAttr = geometry.getAttribute('aSize') as THREE.BufferAttribute
      ;(sizeAttr.array as Float32Array).set(clusterData.sizes)
      sizeAttr.needsUpdate = true

      const stateAttr = geometry.getAttribute('aState') as THREE.BufferAttribute
      ;(stateAttr.array as Float32Array).set(clusterData.states)
      stateAttr.needsUpdate = true

      const typeAttr = geometry.getAttribute('aSynapseType') as THREE.BufferAttribute
      ;(typeAttr.array as Float32Array).set(clusterData.synapseTypes)
      typeAttr.needsUpdate = true

      const progressAttr = geometry.getAttribute('aProgress') as THREE.BufferAttribute
      ;(progressAttr.array as Float32Array).set(clusterData.progress)
      progressAttr.needsUpdate = true

      geometry.computeBoundingSphere()
      return
    }

    // Count changed — allocate new buffers
    hoveredAttrBuffer = new Float32Array(count)
    hoveredAttr = new THREE.BufferAttribute(hoveredAttrBuffer, 1)
    hoveredAttr.setUsage(THREE.DynamicDrawUsage)

    filteredAttrBuffer = new Float32Array(count)
    filteredAttr = new THREE.BufferAttribute(filteredAttrBuffer, 1)
    filteredAttr.setUsage(THREE.DynamicDrawUsage)

    actionableAttrBuffer = new Float32Array(count)
    actionableAttr = new THREE.BufferAttribute(actionableAttrBuffer, 1)
    actionableAttr.setUsage(THREE.DynamicDrawUsage)

    geometry.setAttribute('position', new THREE.BufferAttribute(clusterData.positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(clusterData.colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(clusterData.sizes, 1))
    geometry.setAttribute('aState', new THREE.BufferAttribute(clusterData.states, 1))
    geometry.setAttribute('aSynapseType', new THREE.BufferAttribute(clusterData.synapseTypes, 1))
    geometry.setAttribute('aProgress', new THREE.BufferAttribute(clusterData.progress, 1))
    geometry.setAttribute('aHovered', hoveredAttr)
    geometry.setAttribute('aFiltered', filteredAttr)
    geometry.setAttribute('aActionable', actionableAttr)
    geometry.computeBoundingSphere()
  })

  // Update filtered attribute when filterType changes (handles both modes)
  createEffect(() => {
    const filterType = props.filterType
    const clusters = props.clusters  // Track clusters to re-run when they change
    const individualData = props.rawSynapseData
    if (!filteredAttrBuffer || !filteredAttr) return

    // Individual mode
    if (props.useIndividualMode && individualData) {
      for (let i = 0; i < individualData.count && i < filteredAttrBuffer.length; i++) {
        if (!filterType || filterType === 'all') {
          filteredAttrBuffer[i] = 0.0
        } else {
          const synapseType = SYNAPSE_TYPE_BY_INDEX[individualData.types[i]] || 'minor'
          filteredAttrBuffer[i] = (synapseType === filterType) ? 0.0 : 1.0
        }
      }
      filteredAttr.needsUpdate = true
      return
    }

    // Cluster mode
    clusters.forEach((cluster, i) => {
      if (i >= filteredAttrBuffer!.length) return

      if (!filterType || filterType === 'all') {
        // No filter - all visible
        filteredAttrBuffer![i] = 0.0
      } else {
        // Check if cluster matches filter
        const dominant = getDominantSynapseType(cluster.typeCounts)
        filteredAttrBuffer![i] = (dominant === filterType) ? 0.0 : 1.0
      }
    })

    filteredAttr.needsUpdate = true
  })

  // Update actionable attribute when user state changes (handles both modes)
  createEffect(() => {
    const hasIdleShip = props.hasIdleShip ?? false
    const userLevel = props.userLevel ?? 1 as UserLevel
    const clusters = props.clusters  // Track clusters to re-run when they change
    const individualData = props.rawSynapseData
    if (!actionableAttrBuffer || !actionableAttr) return

    // Track whether any synapse is actionable (for uHasActionable uniform)
    let anyActionable = false

    // Individual mode
    if (props.useIndividualMode && individualData) {
      for (let i = 0; i < individualData.count && i < actionableAttrBuffer.length; i++) {
        const state = individualData.states[i]
        const synapseType = SYNAPSE_TYPE_BY_INDEX[individualData.types[i]] || 'minor'

        // Check if synapse is actionable
        const isUnlocked = userLevel >= SYNAPSE_CONFIG[synapseType].unlockUserLevel
        const isNotCompleted = state !== 2  // state 2 = discovered/completed
        const isActionable = hasIdleShip && isUnlocked && isNotCompleted

        actionableAttrBuffer[i] = isActionable ? 1.0 : 0.0
        if (isActionable && !anyActionable) anyActionable = true
      }
      actionableAttr.needsUpdate = true
      if (material) material.uniforms.uHasActionable.value = anyActionable ? 1.0 : 0.0
      return
    }

    // Cluster mode
    clusters.forEach((cluster, i) => {
      if (i >= actionableAttrBuffer!.length) return

      // Get dominant type and check if unlocked
      const dominant = getDominantSynapseType(cluster.typeCounts)
      const isUnlocked = userLevel >= SYNAPSE_CONFIG[dominant].unlockUserLevel

      // Check if cluster has any undiscovered or partially explored synapses
      const hasAvailableSynapses = cluster.discoveredCount < cluster.synapseCount

      // Check if not at max explorer capacity (simplified - assumes max 1 per synapse)
      const hasAvailableSlots = cluster.beingExploredCount < cluster.synapseCount

      // Synapse is actionable if: user has idle ship, synapse is unlocked, and has available slots
      const isActionable = hasIdleShip && isUnlocked && hasAvailableSynapses && hasAvailableSlots

      actionableAttrBuffer![i] = isActionable ? 1.0 : 0.0
      if (isActionable && !anyActionable) anyActionable = true
    })

    actionableAttr.needsUpdate = true
    if (material) material.uniforms.uHasActionable.value = anyActionable ? 1.0 : 0.0
  })

  // Animation frame for hover detection and time updates
  useFrame(({ clock, camera: cam }) => {
    // Update frustum every 3 frames for culling (throttled for performance)
    if (++frameCounterFrustum % 3 === 0) {
      projScreenMatrix.multiplyMatrices(
        cam.projectionMatrix,
        cam.matrixWorldInverse
      )
      frustum.setFromProjectionMatrix(projScreenMatrix)
      setFrustumNeedsUpdate(prev => prev + 1)
    }

    // Update shader uniforms for animations
    if (material) {
      const elapsed = clock.getElapsedTime()
      material.uniforms.uTime.value = elapsed
      material.uniforms.uSolvablePhase.value = (elapsed * 0.4) % 1.0  // ~2.5s full cycle
      material.uniforms.uCameraWorldPos.value.copy(cam.position)

      // Apply custom density if provided
      if (props.solvableDensity !== undefined) {
        material.uniforms.uSolvableDensity.value = props.solvableDensity
      }

      // Enable solvable density filtering at close zoom (LOD 0 territory)
      // Can be forced via prop or auto-detected based on camera distance
      const distanceFromOrigin = cam.position.length()
      const autoEnable = distanceFromOrigin < 2.5
      material.uniforms.uSolvableOnly.value = (props.forceSolvableOnly || autoEnable) ? 1.0 : 0.0
    }

    // Hover detection - throttled to every N frames and only when pointer moves
    frameCounter++
    const pointerMoved = pointer.x !== lastPointer.x || pointer.y !== lastPointer.y
    const shouldCheckHover = (frameCounter % HOVER_CHECK_INTERVAL === 0) || pointerMoved

    if (shouldCheckHover) {
      lastPointer.copy(pointer)
      const currentHovered = hoveredIndex()
      const closestIndex = findClosestPoint(currentHovered)

      if (closestIndex !== currentHovered) {
        setHoveredIndex(closestIndex)
        document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'

        // Update hovered attribute for shader highlight
        // Map original cluster index to visible cluster index for attribute update
        if (hoveredAttrBuffer && hoveredAttr) {
          // Clear previous hover
          if (currentHovered !== null) {
            const prevVisibleIndex = originalToVisibleIndexMap.get(currentHovered)
            if (prevVisibleIndex !== undefined && prevVisibleIndex < hoveredAttrBuffer.length) {
              hoveredAttrBuffer[prevVisibleIndex] = 0.0
            }
          }
          // Set new hover
          if (closestIndex !== null) {
            const visibleIndex = originalToVisibleIndexMap.get(closestIndex)
            if (visibleIndex !== undefined && visibleIndex < hoveredAttrBuffer.length) {
              hoveredAttrBuffer[visibleIndex] = 1.0
            }
          }
          hoveredAttr.needsUpdate = true
        }

        // Update tooltip position if hovering
        if (closestIndex !== null) {
          const individualData = individualGeometryData()
          let pos: THREE.Vector3 | null = null

          // Get position based on mode
          if (props.useIndividualMode && individualData) {
            pos = new THREE.Vector3(
              individualData.positions[closestIndex * 3],
              individualData.positions[closestIndex * 3 + 1],
              individualData.positions[closestIndex * 3 + 2]
            )
          } else if (clusterPositions[closestIndex]) {
            pos = clusterPositions[closestIndex].clone()
          }

          if (pos) {
            pos.project(cam)
            lastCamPosForTooltip.copy(cam.position)

            const renderer = gl()
            if (renderer) {
              const rect = renderer.domElement.getBoundingClientRect()
              const x = (pos.x * 0.5 + 0.5) * rect.width + rect.left
              const y = (-pos.y * 0.5 + 0.5) * rect.height + rect.top
              setTooltipPosition({ x, y })
            }
          }
        } else {
          setTooltipPosition(null)
        }
      }
    }

    // Update tooltip position only if camera moved significantly while hovering
    const currentHovered = hoveredIndex()
    if (currentHovered !== null) {
      const individualData = individualGeometryData()
      let hasPosition = false
      let pos: THREE.Vector3 | null = null

      if (props.useIndividualMode && individualData) {
        pos = new THREE.Vector3(
          individualData.positions[currentHovered * 3],
          individualData.positions[currentHovered * 3 + 1],
          individualData.positions[currentHovered * 3 + 2]
        )
        hasPosition = true
      } else if (clusterPositions[currentHovered]) {
        pos = clusterPositions[currentHovered].clone()
        hasPosition = true
      }

      if (hasPosition && pos) {
        const camDelta = cam.position.distanceTo(lastCamPosForTooltip)
        if (camDelta > TOOLTIP_CAM_THRESHOLD) {
          pos.project(cam)
          lastCamPosForTooltip.copy(cam.position)

          const renderer = gl()
          if (renderer) {
            const rect = renderer.domElement.getBoundingClientRect()
            const x = (pos.x * 0.5 + 0.5) * rect.width + rect.left
            const y = (-pos.y * 0.5 + 0.5) * rect.height + rect.top
            setTooltipPosition({ x, y })
          }
        }
      }
    }
  })

  // Get hovered cluster for tooltip (cluster mode)
  const hoveredCluster = createMemo(() => {
    if (props.useIndividualMode) return null
    const idx = hoveredIndex()
    return idx !== null ? props.clusters[idx] : null
  })

  // Get hovered individual synapse info (individual mode)
  const hoveredIndividualSynapse = createMemo(() => {
    if (!props.useIndividualMode || !props.rawSynapseData) return null
    const idx = hoveredIndex()
    if (idx === null) return null
    const data = props.rawSynapseData
    return {
      index: idx,
      state: data.states[idx],
      type: SYNAPSE_TYPE_BY_INDEX[data.types[idx]] || 'minor',
      stateName: ['Undiscovered', 'Being Explored', 'Discovered'][data.states[idx]] || 'Unknown',
    }
  })

  const hoveredDominantType = createMemo(() => {
    if (props.useIndividualMode) {
      const synapse = hoveredIndividualSynapse()
      return synapse?.type || null
    }
    const cluster = hoveredCluster()
    return cluster ? getDominantSynapseType(cluster.typeCounts) : null
  })

  const hoveredIsLocked = createMemo(() => {
    const dominantType = hoveredDominantType()
    const userLevel = props.userLevel ?? 1 as UserLevel
    return dominantType ? userLevel < SYNAPSE_CONFIG[dominantType].unlockUserLevel : false
  })

  // Determine if we should show tooltip
  const showTooltip = createMemo(() => {
    if (!tooltipPosition()) return false
    if (props.useIndividualMode) return hoveredIndividualSynapse() !== null
    return hoveredCluster() !== null
  })

  // Return tooltip JSX (rendered as SolidJS component)
  // Note: This tooltip is a DOM overlay, not part of the Three.js scene
  return (
    <>
      {showTooltip() && (
        <div
          class="fixed pointer-events-none bottom-4 left-4"
          style={{
            'z-index': 'var(--z-tooltip, 70)',
          }}
        >
          <div class="bg-[var(--card-background)]/95 backdrop-blur-sm border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs min-w-[200px]">
            {/* Individual synapse mode */}
            {props.useIndividualMode && hoveredIndividualSynapse() && (
              <>
                <div class="font-medium text-[var(--text-primary)] capitalize">
                  {hoveredIndividualSynapse()!.type} Synapse
                </div>
                <div class="text-[var(--text-secondary)] mt-1">
                  {hoveredIndividualSynapse()!.stateName}
                </div>
                {hoveredIsLocked() && (
                  <div class="text-red-400 mt-1">
                    Requires Level {SYNAPSE_CONFIG[hoveredIndividualSynapse()!.type].unlockUserLevel}
                  </div>
                )}
              </>
            )}

            {/* Cluster mode */}
            {!props.useIndividualMode && hoveredCluster() && (() => {
              const cluster = hoveredCluster()!
              const dominantType = hoveredDominantType()
              const config = dominantType ? SYNAPSE_CONFIG[dominantType] : null
              const isLocked = hoveredIsLocked()

              return (
                <>
                  <div class="font-medium text-[var(--text-primary)] capitalize">
                    {cluster.synapseCount} {dominantType || ''} synapses
                  </div>

                  {dominantType && (
                    <div class="text-[var(--text-secondary)] capitalize mt-1">
                      {dominantType} type
                      {isLocked && (
                        <span class="text-red-400 ml-1">(Level {config?.unlockUserLevel} required)</span>
                      )}
                    </div>
                  )}

                  {/* Progress and rewards info */}
                  {config && (
                    <div class="mt-2 space-y-1">
                      <div class="flex justify-between text-[var(--text-secondary)]">
                        <span>Points:</span>
                        <span class="text-[var(--text-primary)]">{formatPoints(config.points)}</span>
                      </div>
                      <div class="flex justify-between text-[var(--text-secondary)]">
                        <span>Reward:</span>
                        <span class="text-yellow-400">{config.agiReward} $AGI</span>
                      </div>
                      <div class="flex justify-between text-[var(--text-secondary)]">
                        <span>ETA:</span>
                        <span class="text-[var(--text-primary)]">{formatETA(config.etaMinutes)}</span>
                      </div>
                    </div>
                  )}

                  {/* Discovery status */}
                  <div class="flex gap-3 mt-2 text-[var(--text-secondary)]">
                    <span>{cluster.discoveredCount} discovered</span>
                    {cluster.beingExploredCount > 0 && (
                      <span class="text-yellow-400">{cluster.beingExploredCount} exploring</span>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </>
  )
}

// Re-export for backward compatibility
export { SynapseMarkers as SpaceMarkers }
