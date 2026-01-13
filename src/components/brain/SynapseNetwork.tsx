import { onMount, onCleanup, createEffect, createMemo, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { SynapseType, UserLevel } from '@/types/game'
import { SYNAPSE_TYPE_COLORS, SYNAPSE_CONFIG, SYNAPSE_TYPE_ORDER } from '@/types/game'
import { TRANCE_CONFIG, constrainToBrainShape } from './core/brainConstants'
import type { SynapseCluster } from '@/stores/shipStore'

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
    // Use same position transform as SpaceMarkers for alignment
    const [x, y, z] = constrainToBrainShape(c.positionX, c.positionY, c.positionZ)
    return {
      position: new THREE.Vector3(x, y, z),
      discoveryRatio: c.discoveredCount / Math.max(1, c.synapseCount),
      dominantType,
      isLocked: userLevel < unlockLevel
    }
  })

  if (discovered.length < 2) return { nodes, connections: [] }

  const connections: Connection[] = []
  const connectionSet = new Set<string>()

  // Connect each node to its nearest neighbor only (chain-like structure)
  for (let i = 0; i < nodes.length; i++) {
    let nearestIdx = -1
    let nearestDist = Infinity

    // Find nearest neighbor
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue
      const dist = nodes[i].position.distanceTo(nodes[j].position)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = j
      }
    }

    if (nearestIdx !== -1) {
      // Normalize key to avoid duplicate connections (A->B same as B->A)
      const key = i < nearestIdx ? `${i}-${nearestIdx}` : `${nearestIdx}-${i}`
      if (!connectionSet.has(key)) {
        connectionSet.add(key)

        const nodeA = nodes[i]
        const nodeB = nodes[nearestIdx]

        // Brightness based on discovery ratio
        const avgRatio = (nodeA.discoveryRatio + nodeB.discoveryRatio) / 2
        const brightness = 0.3 + avgRatio * 0.7

        // Use the rarer type for connection color
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
    }
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

    // Depth-based visibility for ship zoom mode
    if (uIsShipZoom == 1) {
      vec4 shipViewPos = modelViewMatrix * vec4(uShipPosition, 1.0);
      float shipDepth = shipViewPos.z;
      float particleDepth = mvPosition.z;
      vBehindShip = particleDepth < (shipDepth + 0.05) ? 1.0 : 0.0;
    } else {
      vBehindShip = 1.0;
    }

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

    // Depth-based visibility for ship zoom mode
    if (uIsShipZoom == 1) {
      vec4 shipViewPos = modelViewMatrix * vec4(uShipPosition, 1.0);
      float shipDepth = shipViewPos.z;
      float particleDepth = mvPosition.z;
      vBehindShip = particleDepth < (shipDepth + 0.05) ? 1.0 : 0.0;
    } else {
      vBehindShip = 1.0;
    }

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

    // Depth-based visibility for ship zoom mode
    if (uIsShipZoom == 1) {
      vec4 shipViewPos = modelViewMatrix * vec4(uShipPosition, 1.0);
      float shipDepth = shipViewPos.z;
      float particleDepth = mvPosition.z;
      vBehindShip = particleDepth < (shipDepth + 0.05) ? 1.0 : 0.0;
    } else {
      vBehindShip = 1.0;
    }

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
  const { scene, gl, camera } = useThree()

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

  // Time tracking for scaled time (trance mode)
  let scaledTime = 0
  let lastRealTime = 0

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
      console.warn('SynapseNetworkNew: Scene or renderer not available')
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

  // Update node geometry when data changes
  createEffect(() => {
    const data = nodeGeometryData()
    if (!pointsGeometry || !pointsObject) return

    if (!data) {
      // No data - hide the object
      pointsObject.visible = false
      return
    }

    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    pointsGeometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
    pointsGeometry.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3))
    pointsGeometry.computeBoundingSphere()
    pointsObject.visible = true  // Show when we have data
  })

  // Update line geometry when data changes
  createEffect(() => {
    const data = lineGeometryData()
    if (!linesGeometry || !linesObject || !sparklesGeometry || !sparklesObject) return

    if (!data) {
      // No data - hide the objects
      linesObject.visible = false
      sparklesObject.visible = false
      return
    }

    linesGeometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    linesGeometry.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3))
    linesGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(data.opacities, 1))
    linesGeometry.computeBoundingSphere()
    linesObject.visible = true  // Show when we have data

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
  useFrame(({ elapsed, clock }) => {
    // Update scaled time (trance mode deprecated - always normal scale)
    const timeScale = TRANCE_CONFIG.normalScale

    const realTime = clock.getElapsedTime()
    const delta = realTime - lastRealTime
    lastRealTime = realTime
    scaledTime += delta * timeScale

    // Update shader uniforms
    if (pointsMaterial) {
      pointsMaterial.uniforms.uTime.value = scaledTime
    }
    if (sparklesMaterial) {
      sparklesMaterial.uniforms.uTime.value = scaledTime
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
