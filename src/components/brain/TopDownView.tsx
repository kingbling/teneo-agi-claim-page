import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, MapControls } from '@react-three/drei'
import * as THREE from 'three'
import type { SpaceCluster, Agent } from '@/types/agent'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { useBrainRegionStore } from '@/stores/brainRegionStore'

interface TopDownViewProps {
  spaceClusters: SpaceCluster[]
  userAgents: Agent[]
  onSpaceClick?: (cluster: SpaceCluster) => void
}

export function TopDownView({
  spaceClusters,
  userAgents,
  onSpaceClick,
}: TopDownViewProps) {
  return (
    <div className="h-full w-full bg-[#1d1f23]">
      <Canvas
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={1}
        style={{ background: '#1d1f23' }}
        frameloop="always"
        orthographic
      >
        <color attach="background" args={['#1d1f23']} />
        <TopDownContent
          spaceClusters={spaceClusters}
          userAgents={userAgents}
          onSpaceClick={onSpaceClick}
        />
      </Canvas>
    </div>
  )
}

interface TopDownContentProps {
  spaceClusters: SpaceCluster[]
  userAgents: Agent[]
  onSpaceClick?: (cluster: SpaceCluster) => void
}

function TopDownContent({
  spaceClusters,
  userAgents,
  onSpaceClick,
}: TopDownContentProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const agentPointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const agentMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { camera, raycaster, pointer, gl } = useThree()

  // Track drag state
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const DRAG_THRESHOLD = 5

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY }
      isDragging.current = false
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (pointerDownPos.current) {
        const dx = e.clientX - pointerDownPos.current.x
        const dy = e.clientY - pointerDownPos.current.y
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          isDragging.current = true
        }
      }
    }

    const handlePointerUp = () => {
      pointerDownPos.current = null
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl])

  // Space cluster data (projected to 2D from top)
  const spaceData = useMemo(() => {
    const positions = new Float32Array(spaceClusters.length * 3)
    const colors = new Float32Array(spaceClusters.length * 3)
    const sizes = new Float32Array(spaceClusters.length)
    const clusterPositions: THREE.Vector3[] = []

    spaceClusters.forEach((cluster, i) => {
      // X-Z plane (looking down Y axis)
      const x = cluster.positionX * 1.3  // Match brain scale
      const z = cluster.positionZ * 1.1

      positions[i * 3] = x
      positions[i * 3 + 1] = 0  // Flattened Y
      positions[i * 3 + 2] = z
      clusterPositions.push(new THREE.Vector3(x, 0, z))

      const discoveryRatio = cluster.discoveredCount / Math.max(1, cluster.spaceCount)
      const solvingRatio = cluster.beingSolvedCount / Math.max(1, cluster.spaceCount)

      // Size based on space count
      const weightScale = 1.0 + Math.log10(Math.max(1, cluster.spaceCount)) * 0.5
      sizes[i] = 8.0 * weightScale

      // Colors - more vivid distinction
      if (discoveryRatio > 0.5) {
        // Fully discovered - bright gold
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.85
        colors[i * 3 + 2] = 0.2
      } else if (discoveryRatio > 0) {
        // Partially discovered - amber/orange
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.6
        colors[i * 3 + 2] = 0.15
      } else if (solvingRatio > 0.1) {
        // Being solved - teal
        colors[i * 3] = 0.2
        colors[i * 3 + 1] = 0.8
        colors[i * 3 + 2] = 0.8
      } else {
        // Undiscovered - dim purple/blue
        colors[i * 3] = 0.25
        colors[i * 3 + 1] = 0.25
        colors[i * 3 + 2] = 0.5
      }
    })

    return { positions, colors, sizes, clusterPositions }
  }, [spaceClusters])

  // Agent data
  const agentData = useMemo(() => {
    const allAgents = [...userAgents]
    const positions = new Float32Array(allAgents.length * 3)
    const colors = new Float32Array(allAgents.length * 3)
    const sizes = new Float32Array(allAgents.length)

    const stateColors: Record<string, [number, number, number]> = {
      idle: [0.5, 0.5, 0.5],
      deploying: [0.4, 0.6, 1.0],
      wandering: [0.2, 0.9, 0.9],  // Cyan for wandering
      solving: [1.0, 0.8, 0.2],
      limping_home: [1.0, 0.6, 0.2],
      exhausted: [0.4, 0.3, 0.3],
    }

    allAgents.forEach((agent, i) => {
      const x = agent.positionX * 1.3
      const z = agent.positionZ * 1.1

      positions[i * 3] = x
      positions[i * 3 + 1] = 0.01  // Slightly above spaces
      positions[i * 3 + 2] = z

      const color = stateColors[agent.state]
      if (!color) {
        throw new Error(`Unknown agent state: ${agent.state}`)
      }
      colors[i * 3] = color[0]
      colors[i * 3 + 1] = color[1]
      colors[i * 3 + 2] = color[2]

      sizes[i] = 22.0  // Larger than space markers for visibility
    })

    return { positions, colors, sizes }
  }, [userAgents])

  // Hover detection
  const handlePointerMove = useCallback(() => {
    if (!pointsRef.current || spaceClusters.length === 0) return

    raycaster.setFromCamera(pointer, camera)

    let closestIndex: number | null = null
    let closestDist = 0.25

    spaceData.clusterPositions.forEach((pos, i) => {
      const dist = raycaster.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    if (closestIndex !== hoveredIndex) {
      setHoveredIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'
    }
  }, [raycaster, pointer, camera, spaceData.clusterPositions, hoveredIndex, spaceClusters.length])

  const handleClick = useCallback(() => {
    if (isDragging.current) return
    if (hoveredIndex !== null && onSpaceClick) {
      onSpaceClick(spaceClusters[hoveredIndex])
    }
  }, [hoveredIndex, spaceClusters, onSpaceClick])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
      materialRef.current.uniforms.uHoveredIndex.value = hoveredIndex ?? -1
    }
    if (agentMaterialRef.current) {
      agentMaterialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
    handlePointerMove()
  })

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

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[0, 5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        zoom={100}
        near={0.1}
        far={100}
      />

      {/* Map controls for pan, zoom, and limited rotation */}
      <MapControls
        enableRotate={true}
        enableZoom={true}
        enablePan={true}
        minZoom={50}
        maxZoom={400}
        maxPolarAngle={Math.PI / 3}
        minPolarAngle={0}
      />

      <group onClick={handleClick}>
        {/* Space clusters */}
        {spaceClusters.length > 0 && (
          <points ref={pointsRef} frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[spaceData.positions, 3]}
              />
              <bufferAttribute
                attach="attributes-aColor"
                args={[spaceData.colors, 3]}
              />
              <bufferAttribute
                attach="attributes-aSize"
                args={[spaceData.sizes, 1]}
              />
            </bufferGeometry>
            <shaderMaterial
              ref={materialRef}
              uniforms={{
                uTime: { value: 0 },
                uHoveredIndex: { value: -1 },
              }}
              vertexShader={spaceVertexShader}
              fragmentShader={spaceFragmentShader}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        )}

        {/* User agents */}
        {userAgents.length > 0 && (
          <points ref={agentPointsRef} frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[agentData.positions, 3]}
              />
              <bufferAttribute
                attach="attributes-aColor"
                args={[agentData.colors, 3]}
              />
              <bufferAttribute
                attach="attributes-aSize"
                args={[agentData.sizes, 1]}
              />
            </bufferGeometry>
            <shaderMaterial
              ref={agentMaterialRef}
              uniforms={{
                uTime: { value: 0 },
              }}
              vertexShader={agentVertexShader}
              fragmentShader={agentFragmentShader}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        )}

        {/* Brain outline (approximate) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <ringGeometry args={[1.3, 1.35, 64]} />
          <meshBasicMaterial color="#333" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Brain regions - clickable areas */}
      <BrainRegions />

      {/* 2D synapse connections with electron flow */}
      <TopDownConnections spaceClusters={spaceClusters} />

      {/* Camera controller for region zoom */}
      <TopDownCameraController />
    </>
  )
}

/**
 * TopDownCameraController - Animates camera to selected region
 */
function TopDownCameraController() {
  const { camera } = useThree()
  const selectedRegionIndex = useBrainRegionStore((state) => state.selectedRegionIndex)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    const orthoCam = camera as THREE.OrthographicCamera

    // Default view
    let targetX = 0
    let targetZ = 0
    let targetZoom = 100

    // If a region is selected, zoom to it with dynamic zoom based on region size
    if (selectedRegionIndex >= 0 && selectedRegionIndex < FUNCTIONAL_BRAIN_REGIONS.length) {
      const region = FUNCTIONAL_BRAIN_REGIONS[selectedRegionIndex]
      targetX = ((region.bounds.xMin + region.bounds.xMax) / 2) * 1.3
      targetZ = ((region.bounds.zMin + region.bounds.zMax) / 2) * 1.1

      // Dynamic zoom: smaller regions = higher zoom to frame them properly
      const width = (region.bounds.xMax - region.bounds.xMin) * 1.3
      const depth = (region.bounds.zMax - region.bounds.zMin) * 1.1
      const regionSize = Math.max(width, depth)

      // Adaptive zoom: base zoom ~100, scale inversely with region size
      // Small regions (0.5 units) get zoom ~350, large regions (1.5 units) get zoom ~150
      targetZoom = Math.min(350, Math.max(150, 200 / regionSize))
    }

    const startX = camera.position.x
    const startZ = camera.position.z
    const startZoom = orthoCam.zoom

    const duration = 800
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      const newX = startX + (targetX - startX) * eased
      const newZ = startZ + (targetZ - startZ) * eased

      // Move camera position
      camera.position.x = newX
      camera.position.z = newZ

      // CRITICAL: Update lookAt to match new position for orthographic panning
      camera.lookAt(newX, 0, newZ)

      orthoCam.zoom = startZoom + (targetZoom - startZoom) * eased
      orthoCam.updateProjectionMatrix()

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        animationRef.current = null
      }
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [selectedRegionIndex, camera])

  return null
}

/**
 * BrainRegions - Renders clickable brain region shapes in top-down view
 */
function BrainRegions() {
  const selectedRegionIndex = useBrainRegionStore((state) => state.selectedRegionIndex)
  const selectRegion = useBrainRegionStore((state) => state.selectRegion)
  const clearSelection = useBrainRegionStore((state) => state.clearSelection)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const handleRegionClick = useCallback((index: number) => {
    if (selectedRegionIndex === index) {
      clearSelection()
    } else {
      selectRegion(index)
    }
  }, [selectedRegionIndex, selectRegion, clearSelection])

  return (
    <group position={[0, -0.02, 0]}>
      {FUNCTIONAL_BRAIN_REGIONS.map((region, index) => {
        // Project bounds to X-Z plane (top-down view)
        const centerX = ((region.bounds.xMin + region.bounds.xMax) / 2) * 1.3
        const centerZ = ((region.bounds.zMin + region.bounds.zMax) / 2) * 1.1
        const width = (region.bounds.xMax - region.bounds.xMin) * 1.3
        const depth = (region.bounds.zMax - region.bounds.zMin) * 1.1

        const isSelected = selectedRegionIndex === index
        const isHovered = hoveredIndex === index

        const color = new THREE.Color(region.color.r, region.color.g, region.color.b)
        const opacity = isSelected ? 0.6 : isHovered ? 0.4 : 0.2

        return (
          <mesh
            key={region.id}
            position={[centerX, 0, centerZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[width / 2, depth / 2, 1]}
            onClick={(e) => {
              e.stopPropagation()
              handleRegionClick(index)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHoveredIndex(index)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              setHoveredIndex(null)
              document.body.style.cursor = 'auto'
            }}
          >
            <circleGeometry args={[1, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={opacity}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * TopDownConnections - 2D synapse network with flowing electrons
 */
function TopDownConnections({ spaceClusters }: { spaceClusters: SpaceCluster[] }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Build 2D network of connections between discovered clusters
  const connectionData = useMemo(() => {
    const discovered = spaceClusters.filter(c => c.discoveredCount > 0)
    if (discovered.length < 2) return null

    const maxDistance = 0.8 // Connection distance in 2D space
    const particlesPerConnection = 8
    const connections: { from: THREE.Vector3; to: THREE.Vector3; brightness: number }[] = []

    // Find nearby discovered clusters
    for (let i = 0; i < discovered.length; i++) {
      for (let j = i + 1; j < discovered.length; j++) {
        const ax = discovered[i].positionX * 1.3
        const az = discovered[i].positionZ * 1.1
        const bx = discovered[j].positionX * 1.3
        const bz = discovered[j].positionZ * 1.1

        const dist = Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2)
        if (dist <= maxDistance) {
          const avgRatio = (
            (discovered[i].discoveredCount / Math.max(1, discovered[i].spaceCount)) +
            (discovered[j].discoveredCount / Math.max(1, discovered[j].spaceCount))
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

    // Generate particle data for electron flow
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
  }, [spaceClusters])

  // Update time uniform for animation
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  if (!connectionData) return null

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

  return (
    <group>
      {/* Connection lines */}
      {connectionData.connections.map((conn, i) => (
        <line key={`conn-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([
                conn.from.x, conn.from.y, conn.from.z,
                conn.to.x, conn.to.y, conn.to.z
              ]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={new THREE.Color(0.2 + conn.brightness * 0.3, 0.6 + conn.brightness * 0.4, 0.8)}
            transparent
            opacity={0.3 + conn.brightness * 0.4}
          />
        </line>
      ))}

      {/* Flowing electron particles */}
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[connectionData.positions, 3]} />
          <bufferAttribute attach="attributes-aConnectionIndex" args={[connectionData.connectionIndices, 1]} />
          <bufferAttribute attach="attributes-aParticleIndex" args={[connectionData.particleIndices, 1]} />
          <bufferAttribute attach="attributes-aStartPos" args={[connectionData.startPositions, 3]} />
          <bufferAttribute attach="attributes-aEndPos" args={[connectionData.endPositions, 3]} />
          <bufferAttribute attach="attributes-aBrightness" args={[connectionData.brightnesses, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={electronVertexShader}
          fragmentShader={electronFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}
