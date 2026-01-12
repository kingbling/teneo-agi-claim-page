/**
 * TopDownView - 2D Top-Down Brain Visualization
 *
 * Migrated from React Three Fiber to vanilla Three.js with SolidJS.
 * Provides an orthographic top-down view of the brain with:
 * - Space cluster markers (colored by discovery state)
 * - Agent markers (colored by state, pulsing)
 * - Clickable brain regions
 * - Electron flow connections between discovered clusters
 * - Camera animation to selected regions
 */

import { onMount, onCleanup, createSignal, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { brainRegionStore } from '@/stores/brainRegionStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TopDownViewProps {
  spaceClusters: any[]
  userAgents: any[]
  onSpaceClick?: (cluster: any) => void
}

/**
 * TopDownView - Main component that creates the orthographic 2D view
 */
export const TopDownView: Component<TopDownViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let canvasRef: HTMLCanvasElement | undefined

  // Three.js objects
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.OrthographicCamera | null = null
  let controls: MapControls | null = null
  let clock: THREE.Clock | null = null
  let animationId: number | null = null

  // Points objects for spaces and agents
  let spacePoints: THREE.Points | null = null
  let spaceMaterial: THREE.ShaderMaterial | null = null
  let agentPoints: THREE.Points | null = null
  let agentMaterial: THREE.ShaderMaterial | null = null

  // Connection lines and electron particles
  let connectionGroup: THREE.Group | null = null
  let electronPoints: THREE.Points | null = null
  let electronMaterial: THREE.ShaderMaterial | null = null

  // Brain region meshes
  let regionGroup: THREE.Group | null = null
  let regionMeshes: THREE.Mesh[] = []

  // Raycaster for hover/click detection
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  // Signals for hover state
  const [hoveredSpaceIndex, setHoveredSpaceIndex] = createSignal<number | null>(null)
  const [hoveredRegionIndex, setHoveredRegionIndex] = createSignal<number | null>(null)

  // Track drag state for click vs drag detection
  let pointerDownPos: { x: number; y: number } | null = null
  let isDragging = false
  const DRAG_THRESHOLD = 5

  // Store cluster positions for raycasting
  let clusterPositions: THREE.Vector3[] = []

  // Shaders
  const spaceVertexShader = `
    attribute vec3 aColor;
    attribute float aSize;

    uniform float uTime;
    uniform float uHoveredIndex;

    varying vec3 vColor;
    varying float vHovered;

    void main() {
      vColor = aColor;
      float vertexIndex = float(gl_VertexID);
      vHovered = abs(vertexIndex - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float hoverScale = mix(1.0, 1.5, vHovered);
      gl_PointSize = aSize * hoverScale;
      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const spaceFragmentShader = `
    uniform float uTime;

    varying vec3 vColor;
    varying float vHovered;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      float core = smoothstep(0.3, 0.0, dist);
      float glow = smoothstep(0.5, 0.1, dist);

      vec3 color = vColor;
      color = mix(color, vec3(1.0), vHovered * 0.3);
      color = mix(color, vec3(1.0), core * 0.5);

      gl_FragColor = vec4(color, glow * 0.8);
    }
  `

  const agentVertexShader = `
    attribute vec3 aColor;
    attribute float aSize;

    uniform float uTime;

    varying vec3 vColor;

    void main() {
      vColor = aColor;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float pulse = 1.0 + 0.15 * sin(uTime * 4.0);
      gl_PointSize = aSize * pulse;
      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const agentFragmentShader = `
    varying vec3 vColor;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      float core = smoothstep(0.2, 0.0, dist);
      float ring = smoothstep(0.5, 0.4, dist) * smoothstep(0.3, 0.35, dist);

      vec3 color = mix(vColor, vec3(1.0), core * 0.7);
      float alpha = smoothstep(0.5, 0.1, dist) * 0.9 + ring * 0.5;

      gl_FragColor = vec4(color, alpha);
    }
  `

  const electronVertexShader = `
    attribute float aConnectionIndex;
    attribute float aParticleIndex;
    attribute vec3 aStartPos;
    attribute vec3 aEndPos;
    attribute float aBrightness;

    uniform float uTime;

    varying float vAlpha;
    varying float vBrightness;

    void main() {
      float phase = aConnectionIndex * 0.37 + aParticleIndex * 0.23;
      float speed = 0.5 + aBrightness * 0.5;
      float progress = fract(uTime * speed + phase);

      // Bidirectional flow
      float direction = mod(aParticleIndex, 2.0) < 1.0 ? 1.0 : -1.0;
      if (direction < 0.0) progress = 1.0 - progress;

      vec3 pos = mix(aStartPos, aEndPos, progress);

      // Fade at ends
      float fadeIn = smoothstep(0.0, 0.15, progress);
      float fadeOut = smoothstep(1.0, 0.85, progress);
      vAlpha = fadeIn * fadeOut;
      vBrightness = aBrightness;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = 6.0 + aBrightness * 4.0;
      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const electronFragmentShader = `
    uniform float uTime;

    varying float vAlpha;
    varying float vBrightness;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      float glow = smoothstep(0.5, 0.0, dist);
      float pulse = 0.7 + 0.3 * sin(uTime * 4.0);

      // Cyan to white gradient based on brightness
      vec3 color = mix(vec3(0.2, 0.7, 0.9), vec3(0.8, 1.0, 1.0), vBrightness * glow);

      gl_FragColor = vec4(color, glow * vAlpha * pulse * 0.9);
    }
  `

  // Generate space cluster data
  const generateSpaceData = () => {
    const clusters = props.spaceClusters
    const positions = new Float32Array(clusters.length * 3)
    const colors = new Float32Array(clusters.length * 3)
    const sizes = new Float32Array(clusters.length)
    clusterPositions = []

    clusters.forEach((cluster, i) => {
      const x = cluster.positionX
      const z = cluster.positionZ

      positions[i * 3] = x
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = z
      clusterPositions.push(new THREE.Vector3(x, 0, z))

      const discoveryRatio = cluster.discoveredCount / Math.max(1, cluster.synapseCount)
      const exploringRatio = cluster.beingExploredCount / Math.max(1, cluster.synapseCount)

      const weightScale = 1.0 + Math.log10(Math.max(1, cluster.synapseCount)) * 0.5
      sizes[i] = 8.0 * weightScale

      if (discoveryRatio > 0.5) {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.85
        colors[i * 3 + 2] = 0.2
      } else if (discoveryRatio > 0) {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.6
        colors[i * 3 + 2] = 0.15
      } else if (exploringRatio > 0.1) {
        colors[i * 3] = 0.2
        colors[i * 3 + 1] = 0.8
        colors[i * 3 + 2] = 0.8
      } else {
        colors[i * 3] = 0.25
        colors[i * 3 + 1] = 0.25
        colors[i * 3 + 2] = 0.5
      }
    })

    return { positions, colors, sizes }
  }

  // Generate agent data
  const generateAgentData = () => {
    const allAgents = Array.isArray(props.userAgents) ? [...props.userAgents] : []
    const positions = new Float32Array(allAgents.length * 3)
    const colors = new Float32Array(allAgents.length * 3)
    const sizes = new Float32Array(allAgents.length)

    const stateColors: Record<string, [number, number, number]> = {
      idle: [0.5, 0.5, 0.5],
      deploying: [0.4, 0.6, 1.0],
      wandering: [0.2, 0.9, 0.9],
      solving: [1.0, 0.8, 0.2],
      limping_home: [1.0, 0.6, 0.2],
      exhausted: [0.4, 0.3, 0.3],
    }

    allAgents.forEach((agent, i) => {
      positions[i * 3] = agent.positionX
      positions[i * 3 + 1] = 0.01
      positions[i * 3 + 2] = agent.positionZ

      const color = stateColors[agent.state] ?? [0.5, 0.5, 0.5]
      colors[i * 3] = color[0]
      colors[i * 3 + 1] = color[1]
      colors[i * 3 + 2] = color[2]

      sizes[i] = 22.0
    })

    return { positions, colors, sizes }
  }

  // Generate connection data for electron flow
  const generateConnectionData = () => {
    const clusters = props.spaceClusters
    const discovered = clusters.filter(c => c.discoveredCount > 0)
    if (discovered.length < 2) return null

    const maxDistance = 0.8
    const particlesPerConnection = 8
    const connections: { from: THREE.Vector3; to: THREE.Vector3; brightness: number }[] = []

    for (let i = 0; i < discovered.length; i++) {
      for (let j = i + 1; j < discovered.length; j++) {
        const ax = discovered[i].positionX
        const az = discovered[i].positionZ
        const bx = discovered[j].positionX
        const bz = discovered[j].positionZ

        const dist = Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2)
        if (dist <= maxDistance) {
          const avgRatio = (
            (discovered[i].discoveredCount / Math.max(1, discovered[i].synapseCount)) +
            (discovered[j].discoveredCount / Math.max(1, discovered[j].synapseCount))
          ) / 2
          connections.push({
            from: new THREE.Vector3(ax, 0.005, az),
            to: new THREE.Vector3(bx, 0.005, bz),
            brightness: 0.3 + avgRatio * 0.7
          })
        }
      }
    }

    if (connections.length === 0) return null

    const totalParticles = connections.length * particlesPerConnection
    const positions = new Float32Array(totalParticles * 3)
    const connectionIndices = new Float32Array(totalParticles)
    const particleIndices = new Float32Array(totalParticles)
    const startPositions = new Float32Array(totalParticles * 3)
    const endPositions = new Float32Array(totalParticles * 3)
    const brightnesses = new Float32Array(totalParticles)

    let idx = 0
    connections.forEach((conn, connIdx) => {
      for (let p = 0; p < particlesPerConnection; p++) {
        positions[idx * 3] = conn.from.x
        positions[idx * 3 + 1] = conn.from.y
        positions[idx * 3 + 2] = conn.from.z

        connectionIndices[idx] = connIdx
        particleIndices[idx] = p

        startPositions[idx * 3] = conn.from.x
        startPositions[idx * 3 + 1] = conn.from.y
        startPositions[idx * 3 + 2] = conn.from.z

        endPositions[idx * 3] = conn.to.x
        endPositions[idx * 3 + 1] = conn.to.y
        endPositions[idx * 3 + 2] = conn.to.z

        brightnesses[idx] = conn.brightness

        idx++
      }
    })

    return {
      connections,
      positions,
      connectionIndices,
      particleIndices,
      startPositions,
      endPositions,
      brightnesses,
      count: totalParticles
    }
  }

  // Update space points geometry
  const updateSpacePoints = () => {
    if (!spacePoints || !scene) return

    const { positions, colors, sizes } = generateSpaceData()
    const geometry = spacePoints.geometry as THREE.BufferGeometry

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aColor.needsUpdate = true
    geometry.attributes.aSize.needsUpdate = true
  }

  // Update agent points geometry
  const updateAgentPoints = () => {
    if (!agentPoints || !scene) return

    const { positions, colors, sizes } = generateAgentData()
    const geometry = agentPoints.geometry as THREE.BufferGeometry

    // Recreate geometry if agent count changed
    const currentCount = geometry.attributes.position?.count ?? 0
    if (currentCount !== positions.length / 3) {
      geometry.dispose()
      const newGeometry = new THREE.BufferGeometry()
      newGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      newGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
      newGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
      agentPoints.geometry = newGeometry
    } else {
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
      geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.aColor.needsUpdate = true
      geometry.attributes.aSize.needsUpdate = true
    }
  }

  // Update connections and electron flow
  const updateConnections = () => {
    if (!scene || !connectionGroup) return

    // Clear existing connections
    while (connectionGroup.children.length > 0) {
      const child = connectionGroup.children[0]
      connectionGroup.remove(child)
      if ((child as THREE.Line).geometry) (child as THREE.Line).geometry.dispose()
      if ((child as THREE.Line).material) {
        const mat = (child as THREE.Line).material as THREE.Material
        mat.dispose()
      }
    }

    if (electronPoints) {
      scene.remove(electronPoints)
      electronPoints.geometry.dispose()
      electronMaterial?.dispose()
      electronPoints = null
      electronMaterial = null
    }

    const connectionData = generateConnectionData()
    if (!connectionData) return

    // Create connection lines
    connectionData.connections.forEach((conn) => {
      const lineGeometry = new THREE.BufferGeometry()
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([
          conn.from.x, conn.from.y, conn.from.z,
          conn.to.x, conn.to.y, conn.to.z
        ]), 3
      ))

      const lineMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(0.2 + conn.brightness * 0.3, 0.6 + conn.brightness * 0.4, 0.8),
        transparent: true,
        opacity: 0.3 + conn.brightness * 0.4,
      })

      const line = new THREE.Line(lineGeometry, lineMaterial)
      connectionGroup.add(line)
    })

    // Create electron particles
    const electronGeometry = new THREE.BufferGeometry()
    electronGeometry.setAttribute('position', new THREE.BufferAttribute(connectionData.positions, 3))
    electronGeometry.setAttribute('aConnectionIndex', new THREE.BufferAttribute(connectionData.connectionIndices, 1))
    electronGeometry.setAttribute('aParticleIndex', new THREE.BufferAttribute(connectionData.particleIndices, 1))
    electronGeometry.setAttribute('aStartPos', new THREE.BufferAttribute(connectionData.startPositions, 3))
    electronGeometry.setAttribute('aEndPos', new THREE.BufferAttribute(connectionData.endPositions, 3))
    electronGeometry.setAttribute('aBrightness', new THREE.BufferAttribute(connectionData.brightnesses, 1))

    electronMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: electronVertexShader,
      fragmentShader: electronFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    electronPoints = new THREE.Points(electronGeometry, electronMaterial)
    electronPoints.frustumCulled = false
    scene.add(electronPoints)
  }

  // Update brain region meshes
  const updateRegionMeshes = () => {
    if (!regionGroup) return

    regionMeshes.forEach((mesh, index) => {
      const isSelected = brainRegionStore.selectedRegionIndex === index
      const isHovered = hoveredRegionIndex() === index
      const opacity = isSelected ? 0.6 : isHovered ? 0.4 : 0.2
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = opacity
    })
  }

  // Camera animation state
  let cameraAnimating = false
  let cameraAnimationStart = 0
  let cameraStartPos = new THREE.Vector3()
  let cameraTargetPos = new THREE.Vector3()
  let cameraStartZoom = 100
  let cameraTargetZoom = 100

  // Animate camera to selected region
  const animateCameraToRegion = (regionIndex: number) => {
    if (!camera) return

    let targetX = 0
    let targetZ = 0
    let targetZoom = 100

    if (regionIndex >= 0 && regionIndex < FUNCTIONAL_BRAIN_REGIONS.length) {
      const region = FUNCTIONAL_BRAIN_REGIONS[regionIndex]
      targetX = (region.bounds.xMin + region.bounds.xMax) / 2
      targetZ = (region.bounds.zMin + region.bounds.zMax) / 2

      const width = region.bounds.xMax - region.bounds.xMin
      const depth = region.bounds.zMax - region.bounds.zMin
      const regionSize = Math.max(width, depth)
      targetZoom = Math.min(350, Math.max(150, 200 / regionSize))
    }

    cameraStartPos.set(camera.position.x, camera.position.y, camera.position.z)
    cameraTargetPos.set(targetX, 5, targetZ)
    cameraStartZoom = camera.zoom
    cameraTargetZoom = targetZoom
    cameraAnimationStart = clock?.getElapsedTime() ?? 0
    cameraAnimating = true
  }

  // Handle pointer move for hover detection
  const handlePointerMove = (e: PointerEvent) => {
    if (!containerRef || !camera) return

    const rect = containerRef.getBoundingClientRect()
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

    // Space cluster hover detection
    raycaster.setFromCamera(pointer, camera)

    let closestIndex: number | null = null
    let closestDist = 0.25

    clusterPositions.forEach((pos, i) => {
      const dist = raycaster.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    if (closestIndex !== hoveredSpaceIndex()) {
      setHoveredSpaceIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'
    }

    // Region hover detection
    if (regionMeshes.length > 0) {
      const intersects = raycaster.intersectObjects(regionMeshes)
      if (intersects.length > 0) {
        const index = regionMeshes.indexOf(intersects[0].object as THREE.Mesh)
        if (index !== hoveredRegionIndex()) {
          setHoveredRegionIndex(index)
          document.body.style.cursor = 'pointer'
        }
      } else if (hoveredRegionIndex() !== null && closestIndex === null) {
        setHoveredRegionIndex(null)
        document.body.style.cursor = 'auto'
      }
    }
  }

  const handlePointerDown = (e: PointerEvent) => {
    pointerDownPos = { x: e.clientX, y: e.clientY }
    isDragging = false
  }

  const handlePointerUp = () => {
    pointerDownPos = null
  }

  const handleClick = () => {
    if (isDragging) return

    // Handle space cluster click
    const spaceIdx = hoveredSpaceIndex()
    if (spaceIdx !== null && props.onSpaceClick) {
      props.onSpaceClick(props.spaceClusters[spaceIdx])
      return
    }

    // Handle region click
    const regionIdx = hoveredRegionIndex()
    if (regionIdx !== null) {
      if (brainRegionStore.selectedRegionIndex === regionIdx) {
        brainRegionStore.clearSelection()
      } else {
        brainRegionStore.selectRegion(regionIdx)
      }
    }
  }

  // Animation loop
  const animate = () => {
    if (!renderer || !scene || !camera || !clock) return

    animationId = requestAnimationFrame(animate)

    const elapsed = clock.getElapsedTime()

    // Update space material uniforms
    if (spaceMaterial) {
      spaceMaterial.uniforms.uTime.value = elapsed
      spaceMaterial.uniforms.uHoveredIndex.value = hoveredSpaceIndex() ?? -1
    }

    // Update agent material uniforms
    if (agentMaterial) {
      agentMaterial.uniforms.uTime.value = elapsed
    }

    // Update electron material uniforms
    if (electronMaterial) {
      electronMaterial.uniforms.uTime.value = elapsed
    }

    // Camera animation
    if (cameraAnimating && camera) {
      const animDuration = 0.8
      const progress = Math.min((elapsed - cameraAnimationStart) / animDuration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      camera.position.x = cameraStartPos.x + (cameraTargetPos.x - cameraStartPos.x) * eased
      camera.position.z = cameraStartPos.z + (cameraTargetPos.z - cameraStartPos.z) * eased
      camera.zoom = cameraStartZoom + (cameraTargetZoom - cameraStartZoom) * eased
      camera.lookAt(camera.position.x, 0, camera.position.z)
      camera.updateProjectionMatrix()

      if (progress >= 1) {
        cameraAnimating = false
      }
    }

    // Update controls
    controls?.update()

    // Render
    renderer.render(scene, camera)
  }

  // Handle resize
  const handleResize = () => {
    if (!containerRef || !renderer || !camera) return

    const width = containerRef.clientWidth
    const height = containerRef.clientHeight

    renderer.setSize(width, height)

    const aspect = width / height
    camera.left = -aspect
    camera.right = aspect
    camera.top = 1
    camera.bottom = -1
    camera.updateProjectionMatrix()
  }

  onMount(() => {
    if (!containerRef || !canvasRef) return

    // Initialize Three.js
    clock = new THREE.Clock()

    // Create renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x1d1f23)

    // Create scene
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1d1f23)

    // Create orthographic camera
    const aspect = containerRef.clientWidth / containerRef.clientHeight
    camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100)
    camera.position.set(0, 5, 0)
    camera.lookAt(0, 0, 0)
    camera.zoom = 100
    camera.updateProjectionMatrix()

    // Create controls
    controls = new MapControls(camera, canvasRef)
    controls.enableRotate = true
    controls.enableZoom = true
    controls.enablePan = true
    controls.minZoom = 50
    controls.maxZoom = 400
    controls.maxPolarAngle = Math.PI / 3
    controls.minPolarAngle = 0

    // Create space points
    const spaceData = generateSpaceData()
    const spaceGeometry = new THREE.BufferGeometry()
    spaceGeometry.setAttribute('position', new THREE.BufferAttribute(spaceData.positions, 3))
    spaceGeometry.setAttribute('aColor', new THREE.BufferAttribute(spaceData.colors, 3))
    spaceGeometry.setAttribute('aSize', new THREE.BufferAttribute(spaceData.sizes, 1))

    spaceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHoveredIndex: { value: -1 },
      },
      vertexShader: spaceVertexShader,
      fragmentShader: spaceFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    spacePoints = new THREE.Points(spaceGeometry, spaceMaterial)
    spacePoints.frustumCulled = false
    scene.add(spacePoints)

    // Create agent points
    const agentData = generateAgentData()
    const agentGeometry = new THREE.BufferGeometry()
    agentGeometry.setAttribute('position', new THREE.BufferAttribute(agentData.positions, 3))
    agentGeometry.setAttribute('aColor', new THREE.BufferAttribute(agentData.colors, 3))
    agentGeometry.setAttribute('aSize', new THREE.BufferAttribute(agentData.sizes, 1))

    agentMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: agentVertexShader,
      fragmentShader: agentFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    agentPoints = new THREE.Points(agentGeometry, agentMaterial)
    agentPoints.frustumCulled = false
    scene.add(agentPoints)

    // Create brain outline ring
    const ringGeometry = new THREE.RingGeometry(1.3, 1.35, 64)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.3,
    })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.01
    scene.add(ring)

    // Create brain region meshes
    regionGroup = new THREE.Group()
    regionGroup.position.y = -0.02
    scene.add(regionGroup)

    FUNCTIONAL_BRAIN_REGIONS.forEach((region) => {
      const centerX = (region.bounds.xMin + region.bounds.xMax) / 2
      const centerZ = (region.bounds.zMin + region.bounds.zMax) / 2
      const width = region.bounds.xMax - region.bounds.xMin
      const depth = region.bounds.zMax - region.bounds.zMin

      const circleGeometry = new THREE.CircleGeometry(1, 32)
      const circleMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(region.color.r, region.color.g, region.color.b),
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      })

      const mesh = new THREE.Mesh(circleGeometry, circleMaterial)
      mesh.position.set(centerX, 0, centerZ)
      mesh.rotation.x = -Math.PI / 2
      mesh.scale.set(width / 2, depth / 2, 1)

      regionGroup.add(mesh)
      regionMeshes.push(mesh)
    })

    // Create connection group
    connectionGroup = new THREE.Group()
    scene.add(connectionGroup)

    // Initial connection setup
    updateConnections()

    // Set initial size
    handleResize()

    // Event listeners
    window.addEventListener('resize', handleResize)
    containerRef.addEventListener('pointermove', handlePointerMove)
    containerRef.addEventListener('pointerdown', handlePointerDown)
    containerRef.addEventListener('pointerup', handlePointerUp)
    containerRef.addEventListener('click', handleClick)

    // Start animation loop
    animate()

    onCleanup(() => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
      }

      window.removeEventListener('resize', handleResize)
      containerRef?.removeEventListener('pointermove', handlePointerMove)
      containerRef?.removeEventListener('pointerdown', handlePointerDown)
      containerRef?.removeEventListener('pointerup', handlePointerUp)
      containerRef?.removeEventListener('click', handleClick)

      // Dispose Three.js objects
      spacePoints?.geometry.dispose()
      spaceMaterial?.dispose()
      agentPoints?.geometry.dispose()
      agentMaterial?.dispose()
      electronPoints?.geometry.dispose()
      electronMaterial?.dispose()
      regionMeshes.forEach((mesh) => {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      })
      controls?.dispose()
      renderer?.dispose()

      document.body.style.cursor = 'auto'
    })
  })

  // React to space clusters changes
  createEffect(() => {
    const _ = props.spaceClusters
    updateSpacePoints()
    updateConnections()
  })

  // React to agent changes
  createEffect(() => {
    const _ = props.userAgents
    updateAgentPoints()
  })

  // React to region selection changes
  createEffect(() => {
    const selectedIndex = brainRegionStore.selectedRegionIndex
    animateCameraToRegion(selectedIndex)
    updateRegionMeshes()
  })

  // React to region hover changes
  createEffect(() => {
    const _ = hoveredRegionIndex()
    updateRegionMeshes()
  })

  return (
    <div ref={containerRef} class="h-full w-full bg-[#1d1f23]">
      <canvas ref={canvasRef} class="block w-full h-full" style="touch-action: none;" />
    </div>
  )
}
