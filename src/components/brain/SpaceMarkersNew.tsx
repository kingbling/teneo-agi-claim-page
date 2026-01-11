import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { SynapseType } from '@/types/game'
import { SYNAPSE_TYPE_COLORS, SYNAPSE_UNLOCK_LEVELS } from '@/types/game'
import { BRAIN_SCALE } from './core/brainConstants'
import { useScaledTime } from './core/useBrainTime'

// Synapse cluster for LOD visualization
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
  // Type breakdown for visualization
  typeCounts: Record<SynapseType, number>
  updatedAt: number
}

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

function getDominantSynapseType(typeCounts?: Record<SynapseType, number>): SynapseType {
  if (!typeCounts) return 'minor'

  let dominantType: SynapseType = 'minor'
  let highestPriority = 0

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > 0 && SYNAPSE_TYPE_PRIORITY[type as SynapseType] > highestPriority) {
      dominantType = type as SynapseType
      highestPriority = SYNAPSE_TYPE_PRIORITY[type as SynapseType]
    }
  }

  return dominantType
}

// Vertex shader for synapse markers with state-based animation
// Exported for future WebGL implementation
export const SYNAPSE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;
  attribute float aSynapseType;

  uniform float uTime;

  varying vec3 vColor;
  varying float vState;
  varying float vSynapseType;

  void main() {
    vColor = aColor;
    vState = aState;
    vSynapseType = aSynapseType;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float pulse = 1.0;
    float sizeMultiplier = 1.0;

    // State-based animation: 0=undiscovered, 1=exploring, 2=discovered
    if (aState < 0.5) {
      // Undiscovered: subtle breathing pulse
      pulse = 1.0 + sin(uTime * 1.5 + position.x * 5.0) * 0.1;
      sizeMultiplier = 1.0;
    } else if (aState < 1.5) {
      // Being explored: active golden pulse, slightly larger
      pulse = 1.0 + sin(uTime * 3.0 + position.y * 8.0) * 0.2;
      sizeMultiplier = 1.15;
    } else {
      // Discovered: stable, full size
      sizeMultiplier = 1.2;
    }

    // Extra glow pulse for unique synapses (type 6)
    if (aSynapseType > 5.5) {
      pulse *= 1.0 + sin(uTime * 4.0) * 0.25;
    }

    gl_PointSize = aSize * pulse * sizeMultiplier;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for synapse markers with distinct state visuals
// Exported for future WebGL implementation
export const SYNAPSE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vState;
  varying float vSynapseType;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular falloff
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

    vec3 finalColor = vColor;

    // State-based visual treatment
    if (vState < 0.5) {
      // Undiscovered: slightly dimmer but still visible
      finalColor *= 0.8;
      alpha *= 0.9;
    } else if (vState < 1.5) {
      // Being explored: golden glow overlay
      finalColor = mix(finalColor, vec3(1.0, 0.8, 0.3), 0.4);
      alpha *= 1.2;
      // Add warm glow core
      float warmCore = smoothstep(0.25, 0.0, dist) * 0.5;
      finalColor += warmCore * vec3(1.0, 0.6, 0.2);
    } else {
      // Discovered: full brightness with white core highlight
      alpha *= 1.0 + (1.0 - dist * 2.0) * 0.3;
      float whiteCore = smoothstep(0.2, 0.0, dist) * 0.5;
      finalColor = mix(finalColor, vec3(1.0), whiteCore);
    }

    // Extra glow for legendary and unique synapses
    if (vSynapseType > 4.5) {
      alpha *= 1.2;
      // Add sparkle
      float sparkle = smoothstep(0.15, 0.0, dist) * 0.3;
      finalColor += sparkle * vec3(1.0, 1.0, 0.9);
    }

    gl_FragColor = vec4(finalColor, alpha * 0.85);
  }
`

interface SynapseMarkersProps {
  clusters: SynapseCluster[]
  userBrainLevel?: number  // For showing locked synapse types
  onSynapseClick?: (cluster: SynapseCluster, position: THREE.Vector3) => void
}

export function SynapseMarkersNew({ clusters, userBrainLevel = 1, onSynapseClick }: SynapseMarkersProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
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

  // Build geometry data
  const { positions, colors, sizes, states, synapseTypes, clusterPositions } = useMemo(() => {
    const positions = new Float32Array(clusters.length * 3)
    const colors = new Float32Array(clusters.length * 3)
    const sizes = new Float32Array(clusters.length)
    const states = new Float32Array(clusters.length)
    const synapseTypes = new Float32Array(clusters.length)
    const clusterPositions: THREE.Vector3[] = []

    clusters.forEach((cluster, i) => {
      const x = cluster.positionX * BRAIN_SCALE.x
      const y = cluster.positionY * BRAIN_SCALE.y
      const z = cluster.positionZ * BRAIN_SCALE.z

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      clusterPositions.push(new THREE.Vector3(x, y, z))

      // Discovery ratios
      const discoveryRatio = cluster.discoveredCount / Math.max(1, cluster.synapseCount)
      const exploringRatio = cluster.beingExploredCount / Math.max(1, cluster.synapseCount)

      // Get dominant synapse type
      const dominantType = getDominantSynapseType(cluster.typeCounts)
      const typeIndex = SYNAPSE_TYPE_PRIORITY[dominantType] - 1  // 0-6 for shader
      synapseTypes[i] = typeIndex

      // Check if this synapse type is locked for the user
      const unlockLevel = SYNAPSE_UNLOCK_LEVELS[dominantType]
      const isLocked = userBrainLevel < unlockLevel

      // Size based on synapse count and type rarity
      // DEBUG: Increase base size for visibility (was 6.0)
      const baseSize = 15.0
      const weightScale = 1.0 + Math.log10(Math.max(1, cluster.synapseCount)) * 0.4
      const typeBoost = 1.0 + typeIndex * 0.12  // Rarer types are slightly larger
      sizes[i] = baseSize * weightScale * typeBoost

      // State: 0=undiscovered, 1=exploring, 2=discovered
      if (discoveryRatio > 0.5) {
        states[i] = 2.0
      } else if (exploringRatio > 0.1 || discoveryRatio > 0) {
        states[i] = 1.0
      } else {
        states[i] = 0.0
      }

      // Colors based on synapse type and state
      const typeColor = SYNAPSE_COLOR_MAP[dominantType]

      // Brightness based on state, dimmed if locked
      // DEBUG: Increase visibility for undiscovered synapses (was 0.4)
      let brightness = states[i] === 2 ? 1.3 : states[i] === 1 ? 1.0 : 0.8
      if (isLocked) {
        brightness *= 0.3  // Gray out locked synapse types
      }

      colors[i * 3] = Math.min(1.0, typeColor[0] * brightness)
      colors[i * 3 + 1] = Math.min(1.0, typeColor[1] * brightness)
      colors[i * 3 + 2] = Math.min(1.0, typeColor[2] * brightness)
    })

    return { positions, colors, sizes, states, synapseTypes, clusterPositions }
  }, [clusters, userBrainLevel])

  // Time for animations
  const scaledTime = useScaledTime()

  // Update shader time
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = scaledTime
    }
  })

  // Raycasting for hover
  const findClosestCluster = useCallback(() => {
    if (clusters.length === 0) return null

    const threshold = 0.35
    raycaster.setFromCamera(pointer, camera)

    let closestIndex: number | null = null
    let closestDist = threshold

    clusterPositions.forEach((pos, i) => {
      const dist = raycaster.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    return closestIndex
  }, [raycaster, pointer, camera, clusterPositions, clusters.length])

  // Hover detection
  useFrame(() => {
    const closestIndex = findClosestCluster()
    if (closestIndex !== hoveredIndex) {
      setHoveredIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'
    }
  })

  // Click handler
  const handleClick = useCallback(() => {
    if (isDragging.current) return

    const closestIndex = findClosestCluster()
    if (closestIndex !== null && onSynapseClick) {
      const cluster = clusters[closestIndex]
      const pos = clusterPositions[closestIndex]
      onSynapseClick(cluster, pos)
    }
  }, [findClosestCluster, clusters, clusterPositions, onSynapseClick])

  // Build geometry with proper bounds computation - MUST be before any early returns
  const geometry = useMemo(() => {
    if (clusters.length === 0) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))  // Standard 'color' attribute
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aState', new THREE.BufferAttribute(states, 1))
    geo.setAttribute('aSynapseType', new THREE.BufferAttribute(synapseTypes, 1))
    geo.computeBoundingSphere()
    return geo
  }, [positions, colors, sizes, states, synapseTypes, clusters.length])

  // Get hovered cluster for tooltip
  const hoveredCluster = hoveredIndex !== null ? clusters[hoveredIndex] : null
  const hoveredPosition = hoveredIndex !== null ? clusterPositions[hoveredIndex] : null

  if (clusters.length === 0 || !geometry) {
    return null
  }

  // Get dominant type for tooltip
  const hoveredDominantType = hoveredCluster ? getDominantSynapseType(hoveredCluster.typeCounts) : null
  const hoveredIsLocked = hoveredDominantType
    ? userBrainLevel < SYNAPSE_UNLOCK_LEVELS[hoveredDominantType]
    : false

  return (
    <group>
      <points ref={pointsRef} geometry={geometry} frustumCulled={false} onClick={handleClick}>
        <pointsMaterial
          size={0.03}
          vertexColors
          transparent
          opacity={1.0}
          sizeAttenuation={true}
        />
      </points>

      {/* Tooltip */}
      {hoveredCluster && hoveredPosition && (
        <Html position={hoveredPosition} center style={{ pointerEvents: 'none' }}>
          <div className="bg-[var(--card-bg)]/95 backdrop-blur-sm border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium text-[var(--text-primary)]">
              {hoveredCluster.synapseCount} synapses
            </div>
            {hoveredDominantType && (
              <div className="text-[var(--text-secondary)] capitalize">
                {hoveredDominantType} type
                {hoveredIsLocked && (
                  <span className="text-red-400 ml-1">(Locked - Lvl {SYNAPSE_UNLOCK_LEVELS[hoveredDominantType]})</span>
                )}
              </div>
            )}
            <div className="text-[var(--text-secondary)]">
              {hoveredCluster.discoveredCount} discovered
            </div>
            {hoveredCluster.beingExploredCount > 0 && (
              <div className="text-yellow-400">
                {hoveredCluster.beingExploredCount} exploring
              </div>
            )}
            {hoveredCluster.explorerCount !== undefined && hoveredCluster.explorerCount > 0 && (
              <div className="text-cyan-400">
                {hoveredCluster.explorerCount} explorers
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// Re-export for backward compatibility
export { SynapseMarkersNew as SpaceMarkersNew }
