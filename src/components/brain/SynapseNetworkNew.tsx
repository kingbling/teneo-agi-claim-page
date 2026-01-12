import { onMount, onCleanup, createEffect, createMemo, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { SynapseType } from '@/types/game'
import { SYNAPSE_TYPE_COLORS, SYNAPSE_UNLOCK_LEVELS, SYNAPSE_TYPE_ORDER } from '@/types/game'
import { BRAIN_SCALE, NETWORK_CONFIG, TRANCE_CONFIG } from './core/brainConstants'

// Synapse cluster interface (matches SpaceMarkersNew)
// Masterplan 2026: Updated property names to match shipStore mapping
interface SynapseCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  synapseCount: number
  discoveredCount: number
  beingExploredCount: number  // Renamed from beingSolvedCount
  avgLootPool: number         // Renamed from avgReward
  explorerCount?: number
  typeCounts: Record<SynapseType, number>
  updatedAt: number
}

interface SynapseNetworkProps {
  synapseClusters: SynapseCluster[]
  userBrainLevel?: number  // For showing locked connections
  maxConnectionDistance?: number
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
  maxDistance: number,
  userBrainLevel: number
): { nodes: DiscoveredNode[]; connections: Connection[] } {
  // Filter to clusters with discoveries
  const discovered = clusters.filter(c => c.discoveredCount > 0)

  const nodes: DiscoveredNode[] = discovered.map(c => {
    const dominantType = getDominantSynapseType(c.typeCounts)
    const unlockLevel = SYNAPSE_UNLOCK_LEVELS[dominantType]
    return {
      position: new THREE.Vector3(
        c.positionX * BRAIN_SCALE.x,
        c.positionY * BRAIN_SCALE.y,
        c.positionZ * BRAIN_SCALE.z
      ),
      discoveryRatio: c.discoveredCount / Math.max(1, c.synapseCount),
      dominantType,
      isLocked: userBrainLevel < unlockLevel
    }
  })

  if (discovered.length < 2) return { nodes, connections: [] }

  const connections: Connection[] = []
  const connectionSet = new Set<string>()

  // Connect nearby discovered clusters
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const distance = nodes[i].position.distanceTo(nodes[j].position)

      if (distance <= maxDistance) {
        const key = `${i}-${j}`
        if (!connectionSet.has(key)) {
          connectionSet.add(key)

          // Brightness based on discovery ratio
          const avgRatio = (nodes[i].discoveryRatio + nodes[j].discoveryRatio) / 2
          const brightness = 0.3 + avgRatio * 0.7

          // Use the rarer type for connection color
          const type1Index = SYNAPSE_TYPE_ORDER.indexOf(nodes[i].dominantType)
          const type2Index = SYNAPSE_TYPE_ORDER.indexOf(nodes[j].dominantType)
          const dominantType = type1Index > type2Index ? nodes[i].dominantType : nodes[j].dominantType
          const isLocked = nodes[i].isLocked || nodes[j].isLocked

          connections.push({
            from: nodes[i].position.clone(),
            to: nodes[j].position.clone(),
            brightness,
            dominantType,
            isLocked
          })
        }
      }
    }
  }

  return { nodes, connections }
}

// Node marker vertex shader
const NODE_VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aColor;

  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Node marker fragment shader
const NODE_FRAGMENT_SHADER = `
  varying vec3 vColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(vColor, alpha * 0.9);
  }
`

// Line vertex shader
const LINE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aOpacity;

  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    vColor = aColor;
    vOpacity = aOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Line fragment shader
const LINE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    gl_FragColor = vec4(vColor, vOpacity);
  }
`

// Sparkle particle vertex shader (animated along connections)
const SPARKLE_VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aOffset;  // Position offset along connection

  uniform float uTime;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    // Pulsing glow
    float pulse = 1.0 + sin(uTime * 4.0 + aOffset * 10.0) * 0.3;
    vAlpha = 0.6 + pulse * 0.2;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * pulse * (100.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Sparkle particle fragment shader
const SPARKLE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular falloff with bright core
    float alpha = 1.0 - smoothstep(0.1, 0.5, dist);
    float core = smoothstep(0.2, 0.0, dist) * 0.5;

    vec3 finalColor = vColor + core * vec3(1.0, 1.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha * vAlpha);
  }
`

// Number of sparkle particles per connection
const SPARKLES_PER_CONNECTION = 3

export const SynapseNetworkNew: Component<SynapseNetworkProps> = (props) => {
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
    const maxDistance = props.maxConnectionDistance ?? NETWORK_CONFIG.maxConnectionDistance
    const userBrainLevel = props.userBrainLevel ?? 1
    return buildNetwork(props.synapseClusters, maxDistance, userBrainLevel)
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

      // Opacity
      const opacity = conn.isLocked ? 0.15 : 0.3 + conn.brightness * 0.4
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
      uniforms: { uTime: { value: 0 } },
      vertexShader: NODE_VERTEX_SHADER,
      fragmentShader: NODE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    pointsObject = new THREE.Points(pointsGeometry, pointsMaterial)
    pointsObject.frustumCulled = false
    pointsObject.visible = false  // Start hidden until we have data
    sceneObj.add(pointsObject)

    // Create lines geometry and material
    linesGeometry = new THREE.BufferGeometry()
    linesMaterial = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    linesObject = new THREE.LineSegments(linesGeometry, linesMaterial)
    linesObject.frustumCulled = false
    linesObject.visible = false  // Start hidden until we have data
    sceneObj.add(linesObject)

    // Create sparkle particles geometry and material
    sparklesGeometry = new THREE.BufferGeometry()
    sparklesMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: SPARKLE_VERTEX_SHADER,
      fragmentShader: SPARKLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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

    // Initialize sparkle particles along connections
    const { connections } = networkData()
    if (connections.length > 0) {
      const sparkleCount = connections.length * SPARKLES_PER_CONNECTION
      sparklePositions = new Float32Array(sparkleCount * 3)
      sparkleOffsets = new Float32Array(sparkleCount)
      const sparkleSizes = new Float32Array(sparkleCount)
      const sparkleColors = new Float32Array(sparkleCount * 3)

      sparkleConnections = connections

      connections.forEach((conn, ci) => {
        for (let p = 0; p < SPARKLES_PER_CONNECTION; p++) {
          const i = ci * SPARKLES_PER_CONNECTION + p
          // Initial random offset along the connection
          sparkleOffsets[i] = Math.random()

          // Initial position (will be updated in animation)
          sparklePositions[i * 3] = conn.from.x
          sparklePositions[i * 3 + 1] = conn.from.y
          sparklePositions[i * 3 + 2] = conn.from.z

          // Size with variation
          sparkleSizes[i] = 3.0 + Math.random() * 2.0

          // Color based on connection
          const typeColor = SYNAPSE_TYPE_COLORS[conn.dominantType]
          const brightness = conn.isLocked ? 0.4 : 0.8 + conn.brightness * 0.2
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

    // Animate sparkle particles along connections
    if (sparklesGeometry && sparklePositions && sparkleOffsets && sparkleConnections.length > 0) {
      const speed = 0.3 // Speed of particles along connections

      sparkleConnections.forEach((conn, ci) => {
        for (let p = 0; p < SPARKLES_PER_CONNECTION; p++) {
          const i = ci * SPARKLES_PER_CONNECTION + p
          // Move offset forward, wrapping around
          sparkleOffsets[i] = (sparkleOffsets[i] + delta * speed + (p * 0.33)) % 1.0

          // Interpolate position along connection
          const t = sparkleOffsets[i]
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
