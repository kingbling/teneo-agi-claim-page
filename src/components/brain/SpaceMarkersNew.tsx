import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { SpaceCluster, SpaceTier } from '@/types/agent'
import { BRAIN_SCALE } from './core/brainConstants'
import { useScaledTime } from './core/useBrainTime'

// Tier priority for determining dominant tier
const TIER_PRIORITY: Record<SpaceTier, number> = {
  common: 1,
  trait: 2,
  team: 3,
  legendary: 4,
  mythic: 5,
}

// Color mapping for tiers (RGB normalized)
const TIER_COLOR_MAP: Record<SpaceTier, [number, number, number]> = {
  common: [0.61, 0.64, 0.68],
  trait: [0.66, 0.55, 0.98],
  team: [0.18, 0.83, 0.75],
  legendary: [0.98, 0.75, 0.14],
  mythic: [0.96, 0.45, 0.71],
}

function getDominantTier(tierCounts?: Record<SpaceTier, number>): SpaceTier {
  if (!tierCounts) return 'common'

  let dominantTier: SpaceTier = 'common'
  let highestPriority = 0

  for (const [tier, count] of Object.entries(tierCounts)) {
    if (count > 0 && TIER_PRIORITY[tier as SpaceTier] > highestPriority) {
      dominantTier = tier as SpaceTier
      highestPriority = TIER_PRIORITY[tier as SpaceTier]
    }
  }

  return dominantTier
}

// Vertex shader for space markers
const SPACE_VERTEX_SHADER = `
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

    // Pulse for undiscovered/solving clusters
    float pulse = 1.0;
    if (aState < 2.0) {
      pulse = 1.0 + sin(uTime * 2.0 + position.x * 10.0) * 0.15;
    }

    gl_PointSize = aSize * pulse;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for space markers
const SPACE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vState;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular falloff
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

    // Brighter core for discovered
    if (vState > 1.5) {
      alpha *= 1.0 + (1.0 - dist * 2.0) * 0.3;
    }

    gl_FragColor = vec4(vColor, alpha * 0.8);
  }
`

interface SpaceMarkersProps {
  clusters: SpaceCluster[]
  onSpaceClick?: (cluster: SpaceCluster, position: THREE.Vector3) => void
}

export function SpaceMarkersNew({ clusters, onSpaceClick }: SpaceMarkersProps) {
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
  const { positions, colors, sizes, states, clusterPositions } = useMemo(() => {
    const positions = new Float32Array(clusters.length * 3)
    const colors = new Float32Array(clusters.length * 3)
    const sizes = new Float32Array(clusters.length)
    const states = new Float32Array(clusters.length)
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
      const discoveryRatio = cluster.discoveredCount / Math.max(1, cluster.spaceCount)
      const solvingRatio = cluster.beingSolvedCount / Math.max(1, cluster.spaceCount)

      // Get dominant tier
      const dominantTier = getDominantTier(cluster.tierCounts)

      // Size based on space count and tier
      const baseSize = 6.0
      const weightScale = 1.0 + Math.log10(Math.max(1, cluster.spaceCount)) * 0.4
      const tierBoost = 1.0 + (TIER_PRIORITY[dominantTier] - 1) * 0.15
      sizes[i] = baseSize * weightScale * tierBoost

      // State: 0=undiscovered, 1=solving, 2=discovered
      if (discoveryRatio > 0.5) {
        states[i] = 2.0
      } else if (solvingRatio > 0.1 || discoveryRatio > 0) {
        states[i] = 1.0
      } else {
        states[i] = 0.0
      }

      // Colors based on tier and state
      const tierColor = TIER_COLOR_MAP[dominantTier]
      const brightness = states[i] === 2 ? 1.3 : states[i] === 1 ? 1.0 : 0.4

      colors[i * 3] = Math.min(1.0, tierColor[0] * brightness)
      colors[i * 3 + 1] = Math.min(1.0, tierColor[1] * brightness)
      colors[i * 3 + 2] = Math.min(1.0, tierColor[2] * brightness)
    })

    return { positions, colors, sizes, states, clusterPositions }
  }, [clusters])

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
    if (closestIndex !== null && onSpaceClick) {
      const cluster = clusters[closestIndex]
      const pos = clusterPositions[closestIndex]
      onSpaceClick(cluster, pos)
    }
  }, [findClosestCluster, clusters, clusterPositions, onSpaceClick])

  // Get hovered cluster for tooltip
  const hoveredCluster = hoveredIndex !== null ? clusters[hoveredIndex] : null
  const hoveredPosition = hoveredIndex !== null ? clusterPositions[hoveredIndex] : null

  if (clusters.length === 0) return null

  return (
    <group>
      <points ref={pointsRef} frustumCulled={false} onClick={handleClick}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-aState" args={[states, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={SPACE_VERTEX_SHADER}
          fragmentShader={SPACE_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Tooltip */}
      {hoveredCluster && hoveredPosition && (
        <Html position={hoveredPosition} center style={{ pointerEvents: 'none' }}>
          <div className="bg-[var(--card-bg)]/95 backdrop-blur-sm border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium text-[var(--text-primary)]">
              {hoveredCluster.spaceCount} spaces
            </div>
            <div className="text-[var(--text-secondary)]">
              {hoveredCluster.discoveredCount} discovered
            </div>
            {hoveredCluster.beingSolvedCount > 0 && (
              <div className="text-yellow-400">
                {hoveredCluster.beingSolvedCount} solving
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}
