import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { SpaceCluster, SpaceTier } from '@/types/agent'
import { useAgentStore } from '@/stores/agentStore'

// Brain coordinate scaling - applied to normalize cluster positions
const BRAIN_SCALE = { x: 1.3, y: 1.0, z: 1.1 }

// Tier colors based on CSS variables - maps to visual importance
// Using RGB normalized values from CSS tier colors
const TIER_COLORS: Record<SpaceTier, [number, number, number]> = {
  common: [0.61, 0.64, 0.68],     // --tier-common #9ca3af
  trait: [0.66, 0.55, 0.98],      // --tier-trait #a78bfa
  team: [0.18, 0.83, 0.75],       // --tier-team #2dd4bf
  legendary: [0.98, 0.75, 0.14],  // --tier-legendary #fbbf24
  mythic: [0.96, 0.45, 0.71],     // --tier-mythic #f472b6
}

// Tier priority for determining dominant tier (higher = more important)
const TIER_PRIORITY: Record<SpaceTier, number> = {
  common: 1,
  trait: 2,
  team: 3,
  legendary: 4,
  mythic: 5,
}

// Get the dominant tier from tier counts
function getDominantTier(tierCounts?: Record<SpaceTier, number>): SpaceTier {
  if (!tierCounts) return 'common'

  // Find the highest priority tier that has spaces
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

// Light Pillars component for legendary/mythic spaces
interface LightPillarsProps {
  clusters: SpaceCluster[]
  opacity?: number
}

function LightPillars({ clusters, opacity = 1 }: LightPillarsProps) {
  const pillarMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const brainScale = useMemo(() => BRAIN_SCALE, [])

  // Get scaled time for trance effect
  const TRANCE_TIME_SCALE = 0.05  // Slow down time during trance
  const NORMAL_TIME_SCALE = 1.0   // Normal time progression
  const userAgents = useAgentStore((state) => state.userAgents)
  const timeScale = userAgents.some(a => a.tranceActive) ? TRANCE_TIME_SCALE : NORMAL_TIME_SCALE
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Find legendary and mythic clusters
  const pillarData = useMemo(() => {
    const pillars: {
      position: THREE.Vector3
      tier: SpaceTier
      height: number
      color: [number, number, number]
    }[] = []

    clusters.forEach(cluster => {
      const dominantTier = getDominantTier(cluster.tierCounts)

      // Only create pillars for legendary (tier 3) and mythic (tier 4)
      if (dominantTier === 'legendary' || dominantTier === 'mythic') {
        const x = cluster.positionX * brainScale.x
        const y = cluster.positionY * brainScale.y
        const z = cluster.positionZ * brainScale.z

        // Height based on tier and space count
        const MYTHIC_BASE_HEIGHT = 1.5
        const LEGENDARY_BASE_HEIGHT = 0.8
        const HEIGHT_SCALE_FACTOR = 0.2
        const baseHeight = dominantTier === 'mythic' ? MYTHIC_BASE_HEIGHT : LEGENDARY_BASE_HEIGHT
        const height = baseHeight + Math.log10(Math.max(1, cluster.spaceCount)) * HEIGHT_SCALE_FACTOR

        pillars.push({
          position: new THREE.Vector3(x, y, z),
          tier: dominantTier,
          height,
          color: TIER_COLORS[dominantTier]
        })
      }
    })

    return pillars
  }, [clusters, brainScale])

  useFrame(({ clock }) => {
    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
    const time = scaledTimeRef.current

    if (pillarMaterialRef.current) {
      pillarMaterialRef.current.uniforms.uTime.value = time
      pillarMaterialRef.current.uniforms.uOpacity.value = opacity
    }
  })

  if (pillarData.length === 0) return null

  return (
    <group>
      {pillarData.map((pillar, i) => {
        const MYTHIC_TIER_VALUE = 4
        const LEGENDARY_TIER_VALUE = 3
        const MYTHIC_WIDTH = 0.12
        const LEGENDARY_WIDTH = 0.08
        const tierValue = pillar.tier === 'mythic' ? MYTHIC_TIER_VALUE : LEGENDARY_TIER_VALUE
        const width = pillar.tier === 'mythic' ? MYTHIC_WIDTH : LEGENDARY_WIDTH

        return (
          <mesh
            key={`pillar-${i}`}
            position={[pillar.position.x, pillar.position.y + pillar.height / 2, pillar.position.z]}
          >
            <planeGeometry args={[width, pillar.height, 1, 32]} />
            <shaderMaterial
              ref={i === 0 ? pillarMaterialRef : undefined}
              uniforms={{
                uTime: { value: 0 },
                uOpacity: { value: opacity },
              }}
              vertexShader={`
                uniform float uTime;
                varying vec2 vUv;
                varying float vTier;

                void main() {
                  vUv = uv;
                  vTier = ${tierValue.toFixed(1)};

                  // Billboard effect - always face camera
                  vec4 mvPosition = modelViewMatrix * vec4(0.0, position.y, 0.0, 1.0);
                  mvPosition.xy += position.xy;

                  gl_Position = projectionMatrix * mvPosition;
                }
              `}
              fragmentShader={`
                uniform float uTime;
                uniform float uOpacity;

                varying vec2 vUv;
                varying float vTier;

                void main() {
                  // Fade from bottom (bright) to top (transparent)
                  float heightFade = 1.0 - vUv.y;
                  heightFade = pow(heightFade, 0.5);

                  // Radial fade from center
                  float radialDist = abs(vUv.x - 0.5) * 2.0;
                  float radialFade = 1.0 - pow(radialDist, 2.0);

                  // Energy flow animation
                  float flow = sin(vUv.y * 20.0 - uTime * 4.0) * 0.5 + 0.5;
                  float flowPulse = sin(uTime * 2.5 + vUv.y * 5.0) * 0.3 + 0.7;

                  // Core brightness
                  float core = smoothstep(0.5, 0.0, radialDist);

                  // Base color
                  vec3 color = vec3(${pillar.color[0].toFixed(3)}, ${pillar.color[1].toFixed(3)}, ${pillar.color[2].toFixed(3)});

                  // Mythic rainbow shimmer
                  if (vTier >= 4.0) {
                    float hue = fract(vUv.y * 2.0 + uTime * 0.5);
                    vec3 rainbow = vec3(
                      0.5 + 0.5 * sin(hue * 6.28318),
                      0.5 + 0.5 * sin(hue * 6.28318 + 2.094),
                      0.5 + 0.5 * sin(hue * 6.28318 + 4.188)
                    );
                    float shimmer = 0.8 + 0.2 * sin(uTime * 8.0 + vUv.y * 30.0);
                    color = mix(color, rainbow, 0.3 * shimmer);
                  }

                  // Energy flow brightness
                  color = mix(color, vec3(1.0), flow * 0.2 * core);
                  color = mix(color, vec3(1.0), core * 0.4);

                  // Final alpha
                  float alpha = heightFade * radialFade * flowPulse * uOpacity;
                  alpha *= (0.2 + core * 0.6);

                  gl_FragColor = vec4(color, alpha * 0.5);
                }
              `}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )
      })}
    </group>
  )
}

interface SpaceMarkersProps {
  clusters: SpaceCluster[]
  onSpaceClick?: (cluster: SpaceCluster, position: THREE.Vector3) => void
  opacity?: number
  hideTooltip?: boolean
  agents?: { positionX: number; positionY: number; positionZ: number; state: string }[]
}

export function SpaceMarkers({
  clusters,
  onSpaceClick,
  opacity = 1,
  hideTooltip = false,
  agents = [],
}: SpaceMarkersProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { camera, raycaster, pointer, gl } = useThree()

  // Track drag state to prevent click after dragging
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const DRAG_THRESHOLD = 5 // pixels - minimum movement to be considered a drag

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

  const brainScale = useMemo(() => BRAIN_SCALE, [])

  // Build positions, colors, sizes based on cluster state and tier
  const { positions, colors, sizes, states, tiers, clusterPositions } = useMemo(() => {
    const positions = new Float32Array(clusters.length * 3)
    const colors = new Float32Array(clusters.length * 3)
    const sizes = new Float32Array(clusters.length)
    const states = new Float32Array(clusters.length)  // 0=undiscovered, 1=being_solved, 2=discovered
    const tiers = new Float32Array(clusters.length)   // 0=common, 1=trait, 2=team, 3=legendary, 4=mythic
    const clusterPositions: THREE.Vector3[] = []

    clusters.forEach((cluster, i) => {
      // Position already in brain space from server
      const x = cluster.positionX * brainScale.x
      const y = cluster.positionY * brainScale.y
      const z = cluster.positionZ * brainScale.z

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      clusterPositions.push(new THREE.Vector3(x, y, z))

      // Calculate discovery ratio
      const discoveryRatio = cluster.discoveredCount / Math.max(1, cluster.spaceCount)
      const solvingRatio = cluster.beingSolvedCount / Math.max(1, cluster.spaceCount)

      // Get dominant tier from cluster
      const dominantTier = getDominantTier(cluster.tierCounts)

      // Tier encoding for shader
      const tierMap: Record<SpaceTier, number> = {
        common: 0, trait: 1, team: 2, legendary: 3, mythic: 4
      }
      tiers[i] = tierMap[dominantTier]

      // Size based on space count and tier importance
      const BASE_SIZE = 6.0
      const SIZE_SCALE_FACTOR = 0.4
      const TIER_BOOST_FACTOR = 0.15
      const weightScale = 1.0 + Math.log10(Math.max(1, cluster.spaceCount)) * SIZE_SCALE_FACTOR
      const tierBoost = 1.0 + (TIER_PRIORITY[dominantTier] - 1) * TIER_BOOST_FACTOR  // Higher tiers are slightly larger
      sizes[i] = BASE_SIZE * weightScale * tierBoost

      // State encoding for shader
      const DISCOVERY_THRESHOLD = 0.5
      const SOLVING_THRESHOLD = 0.1
      const STATE_DISCOVERED = 2.0
      const STATE_SOLVING = 1.0
      const STATE_UNDISCOVERED = 0.0

      if (discoveryRatio > DISCOVERY_THRESHOLD) {
        states[i] = STATE_DISCOVERED  // Mostly discovered
      } else if (solvingRatio > SOLVING_THRESHOLD || discoveryRatio > 0) {
        states[i] = STATE_SOLVING  // Being solved / partially discovered
      } else {
        states[i] = STATE_UNDISCOVERED  // Undiscovered
      }

      // Colors based on tier (with state modulation)
      const COLOR_BRIGHTNESS_DISCOVERED = 1.3
      const COLOR_BRIGHTNESS_UNDISCOVERED = 0.4
      const tierColor = TIER_COLORS[dominantTier]

      if (states[i] === STATE_DISCOVERED) {
        // Discovered - brighten tier color
        colors[i * 3] = Math.min(1.0, tierColor[0] * COLOR_BRIGHTNESS_DISCOVERED)
        colors[i * 3 + 1] = Math.min(1.0, tierColor[1] * COLOR_BRIGHTNESS_DISCOVERED)
        colors[i * 3 + 2] = Math.min(1.0, tierColor[2] * COLOR_BRIGHTNESS_DISCOVERED)
      } else if (states[i] === STATE_SOLVING) {
        // Being solved - use tier color at full saturation
        colors[i * 3] = tierColor[0]
        colors[i * 3 + 1] = tierColor[1]
        colors[i * 3 + 2] = tierColor[2]
      } else {
        // Undiscovered - dim tier color
        colors[i * 3] = tierColor[0] * COLOR_BRIGHTNESS_UNDISCOVERED
        colors[i * 3 + 1] = tierColor[1] * COLOR_BRIGHTNESS_UNDISCOVERED
        colors[i * 3 + 2] = tierColor[2] * COLOR_BRIGHTNESS_UNDISCOVERED
      }
    })

    return { positions, colors, sizes, states, tiers, clusterPositions }
  }, [clusters, brainScale])

  // Find closest cluster to ray - shared logic
  const findClosestCluster = useCallback(() => {
    if (clusters.length === 0) return null

    const RAYCAST_THRESHOLD = 0.35 // Increased threshold for easier selection

    raycaster.setFromCamera(pointer, camera)

    let closestIndex: number | null = null
    let closestDist = RAYCAST_THRESHOLD

    clusterPositions.forEach((pos, i) => {
      const dist = raycaster.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    return closestIndex
  }, [raycaster, pointer, camera, clusterPositions, clusters.length])

  // Raycasting for hover detection
  const handlePointerMove = useCallback(() => {
    if (!pointsRef.current) return

    const closestIndex = findClosestCluster()

    if (closestIndex !== hoveredIndex) {
      setHoveredIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'
    }
  }, [findClosestCluster, hoveredIndex])

  const handleClick = useCallback(() => {
    // Don't trigger click if user was dragging to rotate camera
    if (isDragging.current) {
      return
    }

    // Re-check on click in case hover wasn't tracked properly
    const closestIndex = findClosestCluster()

    if (closestIndex !== null && onSpaceClick) {
      const cluster = clusters[closestIndex]
      const position = clusterPositions[closestIndex]
      onSpaceClick(cluster, position)
    }
  }, [findClosestCluster, clusters, clusterPositions, onSpaceClick])

  // Scaled time for trance effect
  const TRANCE_TIME_SCALE = 0.05  // Slow down time during trance
  const NORMAL_TIME_SCALE = 1.0   // Normal time progression
  const userAgents = useAgentStore((state) => state.userAgents)
  const timeScale = userAgents.some(a => a.tranceActive) ? TRANCE_TIME_SCALE : NORMAL_TIME_SCALE
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  useFrame(({ clock }) => {
    // Calculate scaled time for trance slowdown
    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
    const time = scaledTimeRef.current

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time
      materialRef.current.uniforms.uHoveredIndex.value = hoveredIndex ?? -1
      materialRef.current.uniforms.uCameraPosition.value.copy(camera.position)
      materialRef.current.uniforms.uOpacity.value = opacity
    }
    handlePointerMove()
  })

  const hoveredCluster = hoveredIndex !== null ? clusters[hoveredIndex] : null
  const hoveredPosition = hoveredIndex !== null ? clusterPositions[hoveredIndex] : null

  if (clusters.length === 0) return null

  return (
    <group onClick={handleClick}>
      {/* Light pillars for legendary/mythic spaces - visible from across the brain */}
      <LightPillars clusters={clusters} opacity={opacity} />

      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-aColor"
            args={[colors, 3]}
          />
          <bufferAttribute
            attach="attributes-aSize"
            args={[sizes, 1]}
          />
          <bufferAttribute
            attach="attributes-aState"
            args={[states, 1]}
          />
          <bufferAttribute
            attach="attributes-aTier"
            args={[tiers, 1]}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={{
            uTime: { value: 0 },
            uHoveredIndex: { value: -1 },
            uCameraPosition: { value: new THREE.Vector3(0, 0, 3) },
            uOpacity: { value: opacity },
          }}
          vertexShader={`
            attribute vec3 aColor;
            attribute float aSize;
            attribute float aState;
            attribute float aTier;

            uniform float uTime;
            uniform float uHoveredIndex;
            uniform vec3 uCameraPosition;
            uniform float uOpacity;

            varying vec3 vColor;
            varying float vState;
            varying float vTier;
            varying float vHovered;
            varying float vDistScale;

            void main() {
              vColor = aColor;
              vState = aState;
              vTier = aTier;

              float vertexIndex = float(gl_VertexID);
              vHovered = abs(vertexIndex - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              float distToCamera = distance(position, uCameraPosition);

              // Match camera range (1.5 to 6.0) - more aggressive scaling when zoomed in
              float distScale = smoothstep(6.0, 1.5, distToCamera);

              // Discovered and being-solved states get MINIMUM visibility
              float minScale = aState > 0.5 ? 0.5 : 0.15;
              // Higher tiers stay visible from further away
              minScale = max(minScale, aTier * 0.1);
              vDistScale = max(minScale, distScale);

              // Pulsing based on state AND tier
              float pulse = 1.0;
              if (aState == 1.0) {
                // Being solved - fast pulse
                pulse = 1.0 + 0.35 * sin(uTime * 4.0 + float(gl_VertexID) * 0.5);
              } else if (aState == 2.0) {
                // Discovered - gentle pulse
                pulse = 1.0 + 0.15 * sin(uTime * 2.0 + position.x * 5.0);
              }

              // Tier-specific effects
              if (aTier >= 2.0) {
                // Team spaces (tier 2) - sync pulse
                pulse += 0.15 * sin(uTime * 3.0);
              }
              if (aTier >= 3.0) {
                // Legendary spaces (tier 3+) - dramatic pulse
                pulse += 0.25 * sin(uTime * 2.5) * (0.5 + 0.5 * sin(uTime * 0.5));
              }
              if (aTier >= 4.0) {
                // Mythic spaces (tier 4) - golden shimmer
                pulse += 0.3 * (0.5 + 0.5 * sin(uTime * 5.0 + position.y * 10.0));
              }

              // Hover boost
              float hoverScale = mix(1.0, 1.5, vHovered);

              // Minimum size based on tier (legendary/mythic always visible)
              float minSize = aState > 0.5 ? 6.0 : 3.0;
              minSize = max(minSize, aTier * 3.0);  // Higher tiers get larger min size

              gl_PointSize = max(minSize, aSize * vDistScale * pulse * hoverScale);
              gl_Position = projectionMatrix * mvPosition;
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uOpacity;

            varying vec3 vColor;
            varying float vState;
            varying float vTier;
            varying float vHovered;
            varying float vDistScale;

            void main() {
              vec2 center = gl_PointCoord - vec2(0.5);
              float dist = length(center);

              if (dist > 0.5) discard;

              float core = smoothstep(0.25, 0.0, dist);
              float glow = smoothstep(0.5, 0.1, dist);
              float ring = smoothstep(0.5, 0.4, dist) * smoothstep(0.3, 0.38, dist);
              float outerRing = smoothstep(0.5, 0.45, dist) * smoothstep(0.4, 0.42, dist);

              vec3 color = vColor;

              // Undiscovered: dim with subtle pulse
              if (vState < 0.5) {
                float dimPulse = 0.25 + 0.1 * sin(uTime * 0.5);
                color *= dimPulse;
              }
              // Being solved: bright pulse effect with ring
              else if (vState < 1.5) {
                float solvePulse = 0.7 + 0.3 * sin(uTime * 4.0);
                color = mix(color, vec3(1.0), solvePulse * 0.4);
                color += ring * vColor * solvePulse * 0.5;
              }
              // Discovered: bright glow with ring
              else {
                color = mix(color, vec3(1.0, 1.0, 0.9), core * 0.6);
                float rPulse = 0.5 + 0.5 * sin(uTime * 2.5);
                color += ring * vColor * rPulse * 0.4;
              }

              // Tier-specific visual effects
              // Team tier (2): pulsing teal outer ring
              if (vTier >= 1.5 && vTier < 2.5) {
                float teamPulse = 0.5 + 0.5 * sin(uTime * 3.0);
                color += outerRing * vec3(0.18, 0.83, 0.75) * teamPulse * 0.6;
              }
              // Legendary tier (3): golden glow with dual rings
              else if (vTier >= 2.5 && vTier < 3.5) {
                float legendPulse = 0.6 + 0.4 * sin(uTime * 2.5);
                color = mix(color, vec3(1.0, 0.85, 0.3), core * 0.3 * legendPulse);
                color += ring * vec3(1.0, 0.75, 0.14) * legendPulse * 0.5;
                color += outerRing * vec3(1.0, 0.9, 0.5) * legendPulse * 0.4;
              }
              // Mythic tier (4): pink/magenta with shimmer
              else if (vTier >= 3.5) {
                float mythicPulse = 0.5 + 0.5 * sin(uTime * 5.0 + dist * 10.0);
                float shimmer = 0.5 + 0.5 * sin(uTime * 8.0 + center.x * 20.0);
                color = mix(color, vec3(1.0, 0.6, 0.85), core * 0.4 * mythicPulse);
                color += ring * vec3(0.96, 0.45, 0.71) * mythicPulse * 0.6;
                color += outerRing * vec3(1.0, 0.8, 0.95) * shimmer * 0.4;
                float sparkle = pow(shimmer, 8.0) * step(0.85, shimmer);
                color += vec3(1.0) * sparkle * 0.5;
              }

              // Enhanced hover effect with pulsing glow
              float hoverPulse = vHovered * (0.35 + 0.15 * sin(uTime * 6.0));
              color = mix(color, vec3(1.0), hoverPulse);

              // Add animated ring effect on hover
              if (vHovered > 0.5) {
                float hoverRing = smoothstep(0.48, 0.42, dist) * smoothstep(0.35, 0.40, dist);
                float hRingPulse = 0.6 + 0.4 * sin(uTime * 8.0);
                color += hoverRing * vec3(0.3, 0.8, 1.0) * hRingPulse;
              }

              // Scale alpha with distance, lower minimums for discovered states
              float minAlpha = vState > 0.5 ? 0.35 : 0.1;
              minAlpha = max(minAlpha, vTier * 0.12);
              float alpha = glow * 0.7 * max(0.25, vDistScale);
              alpha = max(minAlpha, max(alpha, core * 0.8 * max(0.3, vDistScale)));

              gl_FragColor = vec4(color, alpha * uOpacity);
            }
          `}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Tooltip for hovered space cluster */}
      {hoveredCluster && hoveredPosition && !hideTooltip && (() => {
        const dominantTier = getDominantTier(hoveredCluster.tierCounts)
        // Using Tailwind color classes that map to tier CSS variables
        const tierColors: Record<SpaceTier, { glow: string; border: string; dot: string; badge: string }> = {
          common: { glow: 'bg-[hsl(var(--state-idle))]', border: 'via-[hsl(var(--state-idle))]', dot: 'bg-[hsl(var(--state-idle))] ring-[hsl(var(--state-idle))]/30', badge: 'text-[hsl(var(--state-idle))] bg-[hsl(var(--state-idle))]/10' },
          trait: { glow: 'bg-[hsl(var(--tier-trait))]', border: 'via-[hsl(var(--tier-trait))]', dot: 'bg-[hsl(var(--tier-trait))] ring-[hsl(var(--tier-trait))]/30', badge: 'text-[hsl(var(--tier-trait))] bg-[hsl(var(--tier-trait))]/10' },
          team: { glow: 'bg-[hsl(var(--tier-team))]', border: 'via-[hsl(var(--tier-team))]', dot: 'bg-[hsl(var(--tier-team))] ring-[hsl(var(--tier-team))]/30 animate-pulse', badge: 'text-[hsl(var(--tier-team))] bg-[hsl(var(--tier-team))]/10' },
          legendary: { glow: 'bg-[hsl(var(--tier-legendary))]', border: 'via-[hsl(var(--tier-legendary))]', dot: 'bg-[hsl(var(--tier-legendary))] ring-[hsl(var(--tier-legendary))]/30 animate-pulse', badge: 'text-[hsl(var(--tier-legendary))] bg-[hsl(var(--tier-legendary))]/10' },
          mythic: { glow: 'bg-[hsl(var(--tier-mythic))]', border: 'via-[hsl(var(--tier-mythic))]', dot: 'bg-[hsl(var(--tier-mythic))] ring-[hsl(var(--tier-mythic))]/30 animate-pulse', badge: 'text-[hsl(var(--tier-mythic))] bg-[hsl(var(--tier-mythic))]/10' },
        }
        const tierStyle = tierColors[dominantTier]

        const TOOLTIP_Y_OFFSET = 0.18
        return (
          <Html
            position={[hoveredPosition.x, hoveredPosition.y + TOOLTIP_Y_OFFSET, hoveredPosition.z]}
            center
            style={{ pointerEvents: 'none', zIndex: 10 }}
          >
            <div className="relative">
              {/* Tier-based glow effect */}
              <div className={`absolute -inset-1 rounded-xl blur-md opacity-40 ${tierStyle.glow}`} />

              <div className="relative rounded-xl border border-[var(--card-border)] bg-[var(--background-secondary)]/95 backdrop-blur-lg shadow-2xl whitespace-nowrap min-w-[160px] p-3 px-4">
                {/* Tier-based gradient top border */}
                <div className={`absolute top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent ${tierStyle.border} to-transparent left-4 right-4`} />

                {/* Header with tier badge */}
                <div className="flex items-center justify-between border-b border-[var(--card-border)]/50 gap-2 mb-2 pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`rounded-full ring-2 ring-offset-1 ring-offset-[var(--background-secondary)] ${tierStyle.dot} h-2.5 w-2.5`} />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Space Cluster</span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider rounded px-2 py-0.5 ${tierStyle.badge}`}>
                    {dominantTier}
                  </span>
                </div>

                {/* Active agents nearby indicator */}
                {(() => {
                  // Count agents within a certain distance of this cluster
                  const NEARBY_DISTANCE = 0.3
                  const nearbyAgents = agents.filter(agent => {
                    if (agent.state === 'idle') return false
                    const dx = agent.positionX - hoveredCluster.positionX
                    const dy = agent.positionY - hoveredCluster.positionY
                    const dz = agent.positionZ - hoveredCluster.positionZ
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
                    return dist < NEARBY_DISTANCE
                  })
                  if (nearbyAgents.length > 0) {
                    return (
                      <div className="rounded-lg bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30 flex items-center justify-between mb-2 px-3 py-2.5">
                        <span className="text-[10px] font-semibold text-[var(--brand-teal-1)] uppercase tracking-wide">Agents Here</span>
                        <span className="text-sm font-bold text-[var(--brand-teal-1)]">{nearbyAgents.length}</span>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Stats grid */}
                <div className="grid grid-cols-2 text-[11px]" style={{ gap: 'var(--space-3) var(--space-1)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Spaces</span>
                    <span className="font-medium text-[var(--text-primary)]">{hoveredCluster.spaceCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Discovered</span>
                    <span className="font-medium text-[var(--state-solving)]">{hoveredCluster.discoveredCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Solving</span>
                    <span className="font-medium text-[var(--state-limping)]">{hoveredCluster.beingSolvedCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)]">Avg Loot</span>
                    <span className="font-medium text-[var(--brand-teal-1)]">{Math.round(hoveredCluster.avgLootPool)} AGI</span>
                  </div>
                </div>

                {/* Tier breakdown if available */}
                {hoveredCluster.tierCounts && (
                  <div className="border-t border-[var(--card-border)]/50" style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
                    <div className="flex items-center text-[9px]" style={{ gap: 'var(--space-1)' }}>
                      {hoveredCluster.tierCounts.legendary > 0 && (
                        <span className="font-medium text-[var(--tier-legendary)]">{hoveredCluster.tierCounts.legendary} leg</span>
                      )}
                      {hoveredCluster.tierCounts.team > 0 && (
                        <span className="font-medium text-[var(--tier-team)]">{hoveredCluster.tierCounts.team} team</span>
                      )}
                      {hoveredCluster.tierCounts.trait > 0 && (
                        <span className="font-medium text-[var(--tier-trait)]">{hoveredCluster.tierCounts.trait} trait</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Click hint */}
                <div className="border-t border-[var(--card-border)]/50 text-center" style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Click to deploy agent</span>
                </div>
              </div>
            </div>
          </Html>
        )
      })()}
    </group>
  )
}
