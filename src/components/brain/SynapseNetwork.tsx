import { onMount, onCleanup, createEffect, createMemo, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { SynapseType, UserLevel } from '@/types/game'
import { SYNAPSE_TYPE_COLORS, SYNAPSE_CONFIG, SYNAPSE_TYPE_ORDER } from '@/types/game'
import type { SynapseCluster } from '@/stores/shipStore'
import { log } from '@/utils/logger'

interface SynapseNetworkProps {
  synapseClusters: SynapseCluster[]
  userLevel?: UserLevel  // For showing locked connections (Masterplan 2026: USDC-based level)
  shipPosition?: THREE.Vector3 | null  // Ship world position when zoomed
  isShipZoom?: boolean  // Enable depth-based visibility
}

interface DiscoveredNode {
  position: THREE.Vector3
  discoveryRatio: number
  dominantType: SynapseType
  isLocked: boolean
}

interface Connection {
  from: THREE.Vector3
  to: THREE.Vector3
  brightness: number
  dominantType: SynapseType
  isLocked: boolean
}

// Get dominant synapse type from type counts
function getDominantSynapseType(typeCounts?: Record<SynapseType, number>): SynapseType {
  if (!typeCounts) return 'minor'

  let dominantType: SynapseType = 'minor'
  let highestCount = 0

  for (const type of SYNAPSE_TYPE_ORDER) {
    const count = typeCounts[type] || 0
    if (count > highestCount) {
      dominantType = type
      highestCount = count
    }
  }

  return dominantType
}

// Simple spatial grid for efficient nearest-neighbor search
// Divides space into cells of given size, only compares within adjacent cells
function buildSpatialGrid(nodes: DiscoveredNode[], cellSize: number) {
  const grid = new Map<string, number[]>()
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i].position
    const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)},${Math.floor(p.z / cellSize)}`
    let cell = grid.get(key)
    if (!cell) { cell = []; grid.set(key, cell) }
    cell.push(i)
  }
  return grid
}

function findNearestNeighbor(
  nodeIdx: number,
  nodes: DiscoveredNode[],
  grid: Map<string, number[]>,
  cellSize: number,
): { idx: number; dist: number } | null {
  const p = nodes[nodeIdx].position
  const cx = Math.floor(p.x / cellSize)
  const cy = Math.floor(p.y / cellSize)
  const cz = Math.floor(p.z / cellSize)

  let nearestIdx = -1
  let nearestDist = Infinity

  // Search 3x3x3 neighborhood of cells
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx},${cy + dy},${cz + dz}`
        const cell = grid.get(key)
        if (!cell) continue
        for (const j of cell) {
          if (j === nodeIdx) continue
          const dist = p.distanceTo(nodes[j].position)
          if (dist < nearestDist) {
            nearestDist = dist
            nearestIdx = j
          }
        }
      }
    }
  }

  // Fallback: if 3x3x3 found nothing (very sparse), do full scan
  if (nearestIdx === -1) {
    for (let j = 0; j < nodes.length; j++) {
      if (j === nodeIdx) continue
      const dist = p.distanceTo(nodes[j].position)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = j
      }
    }
  }

  return nearestIdx !== -1 ? { idx: nearestIdx, dist: nearestDist } : null
}

// Build network of connections between discovered synapse clusters
function buildNetwork(
  clusters: SynapseCluster[],
  userLevel: UserLevel
): { nodes: DiscoveredNode[]; connections: Connection[] } {
  // Filter to clusters with discoveries
  const discovered = clusters.filter(c => c.discoveredCount > 0)

  const nodes: DiscoveredNode[] = discovered.map(c => {
    const dominantType = getDominantSynapseType(c.typeCounts)
    const unlockLevel = SYNAPSE_CONFIG[dominantType].unlockUserLevel
    return {
      position: new THREE.Vector3(c.positionX, c.positionY, c.positionZ),
      discoveryRatio: c.discoveredCount / Math.max(1, c.synapseCount),
      dominantType,
      isLocked: userLevel < unlockLevel
    }
  })

  if (discovered.length < 2) return { nodes, connections: [] }

  // Use spatial grid for O(n) average-case nearest-neighbor search
  // Cell size ~1.0 works well for brain-scale coordinates
  const cellSize = 1.0
  const grid = buildSpatialGrid(nodes, cellSize)

  const connections: Connection[] = []
  const connectionSet = new Set<string>()

  // Connect each node to its nearest neighbor only (chain-like structure)
  for (let i = 0; i < nodes.length; i++) {
    const nearest = findNearestNeighbor(i, nodes, grid, cellSize)
    if (!nearest) continue

    // Normalize key to avoid duplicate connections (A->B same as B->A)
    const key = i < nearest.idx ? `${i}-${nearest.idx}` : `${nearest.idx}-${i}`
    if (connectionSet.has(key)) continue
    connectionSet.add(key)

    const nodeA = nodes[i]
    const nodeB = nodes[nearest.idx]

    const avgRatio = (nodeA.discoveryRatio + nodeB.discoveryRatio) / 2
    const brightness = 0.3 + avgRatio * 0.7

    const type1Index = SYNAPSE_TYPE_ORDER.indexOf(nodeA.dominantType)
    const type2Index = SYNAPSE_TYPE_ORDER.indexOf(nodeB.dominantType)
    const dominantType = type1Index > type2Index ? nodeA.dominantType : nodeB.dominantType
    const isLocked = nodeA.isLocked || nodeB.isLocked

    connections.push({
      from: nodeA.position.clone(),
      to: nodeB.position.clone(),
      brightness,
      dominantType,
      isLocked
    })
  }

  return { nodes, connections }
}

// Node marker vertex shader
const NODE_VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aColor;

  uniform vec3 uShipPosition;
  uniform int uIsShipZoom;

  varying vec3 vColor;
  varying float vBehindShip;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Depth-based visibility DISABLED - caused white sphere artifact
    vBehindShip = 1.0;

    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Node marker fragment shader (sharp circles)
const NODE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vBehindShip;

  void main() {
    // Discard particles in front of ship when in ship zoom mode
    if (vBehindShip < 0.5) discard;

    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Hard edge circle
    if (dist > 0.4) discard;

    gl_FragColor = vec4(vColor, 0.85);
  }
`

// Line vertex shader
const LINE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aOpacity;

  uniform vec3 uShipPosition;
  uniform int uIsShipZoom;

  varying vec3 vColor;
  varying float vOpacity;
  varying float vBehindShip;

  void main() {
    vColor = aColor;
    vOpacity = aOpacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Depth-based visibility DISABLED - caused white sphere artifact
    vBehindShip = 1.0;

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Line fragment shader
const LINE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vOpacity;
  varying float vBehindShip;

  void main() {
    // Discard lines in front of ship when in ship zoom mode
    if (vBehindShip < 0.5) discard;

    // Boost brightness for visibility
    gl_FragColor = vec4(vColor * 2.5, vOpacity);
  }
`

// Sparkle particle vertex shader (flowing river style - no pulsing)
const SPARKLE_VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aOffset;  // Position offset along connection

  uniform float uTime;
  uniform vec3 uShipPosition;
  uniform int uIsShipZoom;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vBehindShip;

  void main() {
    vColor = aColor;

    // Smooth flow - no pulsing for calm river effect
    vAlpha = 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Depth-based visibility DISABLED - caused white sphere artifact
    vBehindShip = 1.0;

    gl_PointSize = clamp(aSize * (100.0 / -mvPosition.z), 1.0, 8.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Sparkle particle fragment shader (bright visible dots)
const SPARKLE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBehindShip;

  void main() {
    // Discard sparkles in front of ship when in ship zoom mode
    if (vBehindShip < 0.5) discard;

    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Hard edge - discard pixels outside radius
    if (dist > 0.4) discard;

    // Bright dot with glow
    gl_FragColor = vec4(vColor * 1.5, 1.0);
  }
`

// Sparkle configuration - with nearest-neighbor connections we can have more sparkles
const SPARKLES_PER_CONNECTION = 3  // Multiple particles per connection for visible flow
const SPARKLE_CONNECTION_RATIO = 1.0  // All connections get sparkles (fewer connections now)

export const SynapseNetwork: Component<SynapseNetworkProps> = (props) => {
  const { scene, gl } = useThree()

  // Three.js objects (imperative refs)
  let pointsObject: THREE.Points | null = null
  let linesObject: THREE.LineSegments | null = null
  let sparklesObject: THREE.Points | null = null
  let pointsGeometry: THREE.BufferGeometry | null = null
  let linesGeometry: THREE.BufferGeometry | null = null
  let sparklesGeometry: THREE.BufferGeometry | null = null
  let pointsMaterial: THREE.ShaderMaterial | null = null
  let linesMaterial: THREE.ShaderMaterial | null = null
  let sparklesMaterial: THREE.ShaderMaterial | null = null

  // Sparkle animation data
  let sparklePositions: Float32Array | null = null
  let sparkleConnections: Connection[] = []
  let sparkleOffsets: Float32Array | null = null


  // Build network
  const networkData = createMemo(() => {
    const userLevel = props.userLevel ?? 1 as UserLevel
    return buildNetwork(props.synapseClusters, userLevel)
  })

  // Node marker geometry with synapse type colors
  const nodeGeometryData = createMemo(() => {
    const { nodes } = networkData()
    if (nodes.length === 0) return null

    const positions = new Float32Array(nodes.length * 3)
    const sizes = new Float32Array(nodes.length)
    const colors = new Float32Array(nodes.length * 3)

    nodes.forEach((node, i) => {
      positions[i * 3] = node.position.x
      positions[i * 3 + 1] = node.position.y
      positions[i * 3 + 2] = node.position.z

      // Color based on synapse type
      const typeColor = SYNAPSE_TYPE_COLORS[node.dominantType]
      let brightness = 0.6 + node.discoveryRatio * 0.4

      // Dim locked nodes
      if (node.isLocked) {
        brightness *= 0.3
      }

      colors[i * 3] = typeColor.r * brightness
      colors[i * 3 + 1] = typeColor.g * brightness
      colors[i * 3 + 2] = typeColor.b * brightness

      sizes[i] = 8.0 + node.discoveryRatio * 4.0
    })

    return { positions, sizes, colors }
  })

  // Line geometry data
  const lineGeometryData = createMemo(() => {
    const { connections } = networkData()
    if (connections.length === 0) return null

    // Each connection is 2 vertices (from and to)
    const positions = new Float32Array(connections.length * 6)
    const colors = new Float32Array(connections.length * 6)
    const opacities = new Float32Array(connections.length * 2)

    connections.forEach((conn, i) => {
      // From vertex
      positions[i * 6] = conn.from.x
      positions[i * 6 + 1] = conn.from.y
      positions[i * 6 + 2] = conn.from.z

      // To vertex
      positions[i * 6 + 3] = conn.to.x
      positions[i * 6 + 4] = conn.to.y
      positions[i * 6 + 5] = conn.to.z

      // Color based on synapse type
      const typeColor = SYNAPSE_TYPE_COLORS[conn.dominantType]
      const brightness = conn.isLocked ? 0.2 : conn.brightness

      // From color
      colors[i * 6] = typeColor.r * brightness
      colors[i * 6 + 1] = typeColor.g * brightness
      colors[i * 6 + 2] = typeColor.b * brightness

      // To color (same)
      colors[i * 6 + 3] = typeColor.r * brightness
      colors[i * 6 + 4] = typeColor.g * brightness
      colors[i * 6 + 5] = typeColor.b * brightness

      // Opacity - bright visible lines showing the flow path
      const opacity = conn.isLocked ? 0.4 : 0.9
      opacities[i * 2] = opacity
      opacities[i * 2 + 1] = opacity
    })

    return { positions, colors, opacities }
  })

  onMount(() => {
    const sceneObj = scene()
    const renderer = gl()

    if (!sceneObj || !renderer) {
      log.brain.warn('SynapseNetwork: Scene or renderer not available')
      return
    }

    // Create points geometry and material
    pointsGeometry = new THREE.BufferGeometry()
    pointsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShipPosition: { value: new THREE.Vector3() },
        uIsShipZoom: { value: 0 },
      },
      vertexShader: NODE_VERTEX_SHADER,
      fragmentShader: NODE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    pointsObject = new THREE.Points(pointsGeometry, pointsMaterial)
    pointsObject.frustumCulled = false
    pointsObject.visible = false  // Start hidden until we have data
    sceneObj.add(pointsObject)

    // Create lines geometry and material
    linesGeometry = new THREE.BufferGeometry()
    linesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uShipPosition: { value: new THREE.Vector3() },
        uIsShipZoom: { value: 0 },
      },
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,  // Glow effect for visibility
    })

    linesObject = new THREE.LineSegments(linesGeometry, linesMaterial)
    linesObject.frustumCulled = false
    linesObject.visible = false  // Start hidden until we have data
    sceneObj.add(linesObject)

    // Create sparkle particles geometry and material
    sparklesGeometry = new THREE.BufferGeometry()
    sparklesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShipPosition: { value: new THREE.Vector3() },
        uIsShipZoom: { value: 0 },
      },
      vertexShader: SPARKLE_VERTEX_SHADER,
      fragmentShader: SPARKLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,  // Normal blending to prevent compounding in dense areas
    })

    sparklesObject = new THREE.Points(sparklesGeometry, sparklesMaterial)
    sparklesObject.frustumCulled = false
    sparklesObject.visible = false  // Start hidden until we have data
    sceneObj.add(sparklesObject)

    onCleanup(() => {
      // Remove from scene and dispose
      if (pointsObject && sceneObj) {
        sceneObj.remove(pointsObject)
      }
      if (linesObject && sceneObj) {
        sceneObj.remove(linesObject)
      }
      if (pointsGeometry) {
        pointsGeometry.dispose()
      }
      if (linesGeometry) {
        linesGeometry.dispose()
      }
      if (pointsMaterial) {
        pointsMaterial.dispose()
      }
      if (linesMaterial) {
        linesMaterial.dispose()
      }
      if (sparklesObject && sceneObj) {
        sceneObj.remove(sparklesObject)
      }
      if (sparklesGeometry) {
        sparklesGeometry.dispose()
      }
      if (sparklesMaterial) {
        sparklesMaterial.dispose()
      }
    })
  })

  // Update node geometry when data changes — reuse attributes with needsUpdate
  let nodeAttrsInit = false
  createEffect(() => {
    const data = nodeGeometryData()
    if (!pointsGeometry || !pointsObject) return

    if (!data) {
      pointsObject.visible = false
      return
    }

    if (!nodeAttrsInit || pointsGeometry.getAttribute('position')?.count !== data.positions.length / 3) {
      // Need new attributes (size changed or first init)
      const posAttr = new THREE.BufferAttribute(data.positions, 3)
      posAttr.setUsage(THREE.DynamicDrawUsage)
      pointsGeometry.setAttribute('position', posAttr)

      const sizeAttr = new THREE.BufferAttribute(data.sizes, 1)
      sizeAttr.setUsage(THREE.DynamicDrawUsage)
      pointsGeometry.setAttribute('aSize', sizeAttr)

      const colorAttr = new THREE.BufferAttribute(data.colors, 3)
      colorAttr.setUsage(THREE.DynamicDrawUsage)
      pointsGeometry.setAttribute('aColor', colorAttr)

      nodeAttrsInit = true
    } else {
      // Same size — update in place
      const posAttr = pointsGeometry.getAttribute('position') as THREE.BufferAttribute
      posAttr.array.set(data.positions)
      posAttr.needsUpdate = true

      const sizeAttr = pointsGeometry.getAttribute('aSize') as THREE.BufferAttribute
      sizeAttr.array.set(data.sizes)
      sizeAttr.needsUpdate = true

      const colorAttr = pointsGeometry.getAttribute('aColor') as THREE.BufferAttribute
      colorAttr.array.set(data.colors)
      colorAttr.needsUpdate = true
    }

    pointsGeometry.computeBoundingSphere()
    pointsObject.visible = true
  })

  // Update line geometry when data changes — reuse attributes with needsUpdate
  let lineAttrsInit = false
  createEffect(() => {
    const data = lineGeometryData()
    if (!linesGeometry || !linesObject || !sparklesGeometry || !sparklesObject) return

    if (!data) {
      linesObject.visible = false
      sparklesObject.visible = false
      return
    }

    if (!lineAttrsInit || linesGeometry.getAttribute('position')?.count !== data.positions.length / 3) {
      const posAttr = new THREE.BufferAttribute(data.positions, 3)
      posAttr.setUsage(THREE.DynamicDrawUsage)
      linesGeometry.setAttribute('position', posAttr)

      const colorAttr = new THREE.BufferAttribute(data.colors, 3)
      colorAttr.setUsage(THREE.DynamicDrawUsage)
      linesGeometry.setAttribute('aColor', colorAttr)

      const opacityAttr = new THREE.BufferAttribute(data.opacities, 1)
      opacityAttr.setUsage(THREE.DynamicDrawUsage)
      linesGeometry.setAttribute('aOpacity', opacityAttr)

      lineAttrsInit = true
    } else {
      const posAttr = linesGeometry.getAttribute('position') as THREE.BufferAttribute
      posAttr.array.set(data.positions)
      posAttr.needsUpdate = true

      const colorAttr = linesGeometry.getAttribute('aColor') as THREE.BufferAttribute
      colorAttr.array.set(data.colors)
      colorAttr.needsUpdate = true

      const opacityAttr = linesGeometry.getAttribute('aOpacity') as THREE.BufferAttribute
      opacityAttr.array.set(data.opacities)
      opacityAttr.needsUpdate = true
    }

    linesGeometry.computeBoundingSphere()
    linesObject.visible = true

    // Initialize sparkle particles along sparse selection of connections
    const { connections } = networkData()
    if (connections.length > 0) {
      // Sparse selection - only 10% of connections get sparkles
      const selectedConnections = connections.filter(() => Math.random() < SPARKLE_CONNECTION_RATIO)

      // Ensure at least 1 connection has sparkles if there are any connections
      if (selectedConnections.length === 0 && connections.length > 0) {
        selectedConnections.push(connections[Math.floor(Math.random() * connections.length)])
      }

      const sparkleCount = selectedConnections.length * SPARKLES_PER_CONNECTION
      sparklePositions = new Float32Array(sparkleCount * 3)
      sparkleOffsets = new Float32Array(sparkleCount)
      const sparkleSizes = new Float32Array(sparkleCount)
      const sparkleColors = new Float32Array(sparkleCount * 3)

      sparkleConnections = selectedConnections

      selectedConnections.forEach((conn, ci) => {
        for (let p = 0; p < SPARKLES_PER_CONNECTION; p++) {
          const i = ci * SPARKLES_PER_CONNECTION + p
          // Initial random offset along the connection
          sparkleOffsets[i] = Math.random()

          // Initial position (will be updated in animation)
          sparklePositions[i * 3] = conn.from.x
          sparklePositions[i * 3 + 1] = conn.from.y
          sparklePositions[i * 3 + 2] = conn.from.z

          // Size with variation - larger for visibility
          sparkleSizes[i] = 4.0 + Math.random() * 3.0

          // Color based on connection - visible sparkles
          const typeColor = SYNAPSE_TYPE_COLORS[conn.dominantType]
          const brightness = conn.isLocked ? 0.3 : 0.6 + conn.brightness * 0.3
          sparkleColors[i * 3] = typeColor.r * brightness
          sparkleColors[i * 3 + 1] = typeColor.g * brightness
          sparkleColors[i * 3 + 2] = typeColor.b * brightness
        }
      })

      sparklesGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3))
      sparklesGeometry.setAttribute('aSize', new THREE.BufferAttribute(sparkleSizes, 1))
      sparklesGeometry.setAttribute('aColor', new THREE.BufferAttribute(sparkleColors, 3))
      sparklesGeometry.setAttribute('aOffset', new THREE.BufferAttribute(sparkleOffsets, 1))
      sparklesGeometry.computeBoundingSphere()
      sparklesObject.visible = true  // Show sparkles when we have connections
    } else {
      sparklesObject.visible = false  // Hide sparkles when no connections
    }
  })

  // Update ship zoom uniforms for depth-based visibility
  createEffect(() => {
    const isZoom = props.isShipZoom ? 1 : 0
    const shipPos = props.shipPosition

    if (pointsMaterial) {
      pointsMaterial.uniforms.uIsShipZoom.value = isZoom
      if (shipPos) pointsMaterial.uniforms.uShipPosition.value.copy(shipPos)
    }
    if (linesMaterial) {
      linesMaterial.uniforms.uIsShipZoom.value = isZoom
      if (shipPos) linesMaterial.uniforms.uShipPosition.value.copy(shipPos)
    }
    if (sparklesMaterial) {
      sparklesMaterial.uniforms.uIsShipZoom.value = isZoom
      if (shipPos) sparklesMaterial.uniforms.uShipPosition.value.copy(shipPos)
    }
  })

  // Animation frame for time updates and sparkle animation
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const delta = clock.getDelta()

    // Update shader uniforms
    if (pointsMaterial) {
      pointsMaterial.uniforms.uTime.value = time
    }
    if (sparklesMaterial) {
      sparklesMaterial.uniforms.uTime.value = time
    }

    // Animate sparkle particles along connections (flowing river style)
    if (sparklesGeometry && sparklePositions && sparkleOffsets && sparkleConnections.length > 0) {
      const speed = 0.15 // Slower, calmer flow for river effect

      sparkleConnections.forEach((conn, ci) => {
        for (let p = 0; p < SPARKLES_PER_CONNECTION; p++) {
          const i = ci * SPARKLES_PER_CONNECTION + p
          // Move offset forward, wrapping around - evenly spaced particles
          const baseOffset = p / SPARKLES_PER_CONNECTION
          sparkleOffsets[i] = (sparkleOffsets[i] + delta * speed) % 1.0

          // Interpolate position along connection with even distribution
          const t = (sparkleOffsets[i] + baseOffset) % 1.0
          sparklePositions[i * 3] = conn.from.x + (conn.to.x - conn.from.x) * t
          sparklePositions[i * 3 + 1] = conn.from.y + (conn.to.y - conn.from.y) * t
          sparklePositions[i * 3 + 2] = conn.from.z + (conn.to.z - conn.from.z) * t
        }
      })

      // Update geometry
      const posAttr = sparklesGeometry.attributes.position as THREE.BufferAttribute
      if (posAttr) {
        posAttr.needsUpdate = true
      }
    }
  })

  // No DOM elements to render
  return null
}
