import { onMount, onCleanup, createEffect, createMemo, createSignal, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { SynapseType, UserLevel } from '@/types/game'
import { SYNAPSE_TYPE_COLORS, SYNAPSE_CONFIG } from '@/types/game'
import { BRAIN_SCALE, TRANCE_CONFIG, constrainToBrainShape } from './core/brainConstants'
import type { SynapseCluster } from '@/stores/shipStore'

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

function getDominantSynapseType(typeCounts?: Record<SynapseType, number>): SynapseType {
  if (!typeCounts) return 'minor'

  let dominantType: SynapseType = 'minor'
  let highestCount = 0

  // Return the type with the highest COUNT (most common in cluster)
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > highestCount) {
      dominantType = type as SynapseType
      highestCount = count
    } else if (count === highestCount && count > 0) {
      // Tie-breaker: prefer rarer types when counts are equal
      if (SYNAPSE_TYPE_PRIORITY[type as SynapseType] > SYNAPSE_TYPE_PRIORITY[dominantType]) {
        dominantType = type as SynapseType
      }
    }
  }

  return dominantType
}

// Vertex shader for synapse markers with state-based animation
// Enhanced with dramatic type-based visual hierarchy and progress rings
export const SYNAPSE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;
  attribute float aSynapseType;
  attribute float aProgress;  // 0.0-1.0 for exploration progress
  attribute float aHovered;   // 1.0 if hovered, 0.0 otherwise

  uniform float uTime;

  varying vec3 vColor;
  varying float vState;
  varying float vSynapseType;
  varying float vProgress;
  varying float vHovered;

  void main() {
    vColor = aColor;
    vState = aState;
    vSynapseType = aSynapseType;
    vProgress = aProgress;
    vHovered = aHovered;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float pulse = 1.0;
    float sizeMultiplier = 1.0;

    // State-based animation: 0=undiscovered, 1=exploring, 2=discovered
    if (aState < 0.5) {
      // Undiscovered: subtle breathing
      pulse = 1.0 + sin(uTime * 1.5 + position.x * 4.0) * 0.05;
      sizeMultiplier = 0.9;
    } else if (aState < 1.5) {
      // Being explored: gentle pulsing
      pulse = 1.0 + sin(uTime * 3.0 + position.y * 4.0) * 0.1;
      sizeMultiplier = 1.1;
    } else {
      // Discovered: stable
      pulse = 1.0 + sin(uTime * 0.8) * 0.03;
      sizeMultiplier = 1.0;
    }

    // Type-based animations - subtle effects for rarer types
    // Core synapses (type 3) have subtle pulse
    if (aSynapseType > 2.5 && aSynapseType < 3.5) {
      pulse *= 1.0 + sin(uTime * 2.0 + position.z * 4.0) * 0.05;
    }

    // Rare synapses (type 4) have gentle shimmer
    if (aSynapseType > 3.5 && aSynapseType < 4.5) {
      pulse *= 1.0 + sin(uTime * 2.5 + position.z * 5.0) * 0.06;
    }

    // Legendary synapses (type 5) have soft shimmer
    if (aSynapseType > 4.5 && aSynapseType < 5.5) {
      pulse *= 1.0 + sin(uTime * 3.0) * 0.08;
    }

    // Unique synapses (type 6) have noticeable pulse
    if (aSynapseType > 5.5) {
      pulse *= 1.0 + sin(uTime * 3.0) * 0.1;
    }

    // HOVER EFFECT: Scale up when hovered
    if (aHovered > 0.5) {
      sizeMultiplier *= 1.8;  // Make hovered synapse larger
      pulse *= 1.0 + sin(uTime * 6.0) * 0.15;  // Faster pulse when hovered
    }

    // Distance-based scaling for consistent appearance
    float distScale = 80.0 / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aSize * pulse * sizeMultiplier * distScale, 2.0, 32.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for synapse markers with distinct state visuals
// Enhanced with dramatic type-based visual hierarchy and progress rings
export const SYNAPSE_FRAGMENT_SHADER = `
  uniform float uTime;

  varying vec3 vColor;
  varying float vState;
  varying float vSynapseType;
  varying float vProgress;
  varying float vHovered;

  // Helper: Calculate angle from center (0-1 normalized)
  float getAngle(vec2 coord) {
    float angle = atan(coord.y, coord.x);
    return (angle + 3.14159) / (2.0 * 3.14159);  // Normalize to 0-1
  }

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular falloff
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

    vec3 finalColor = vColor;

    // State-based visual treatment
    if (vState < 0.5) {
      // Undiscovered: muted, mysterious, inviting exploration
      finalColor *= 0.6;
      finalColor = mix(finalColor, vec3(0.3, 0.4, 0.55), 0.3);
      alpha *= 0.7;
      // Soft glow core
      float dimCore = smoothstep(0.15, 0.0, dist) * 0.3;
      finalColor += dimCore * vec3(0.5, 0.55, 0.7);
    } else if (vState < 1.5) {
      // Being explored: vibrant with PROGRESS RING
      finalColor = mix(finalColor, vec3(1.0, 0.85, 0.3), 0.4);
      alpha *= 1.2;

      // Hot core (smaller to make room for progress ring)
      float warmCore = smoothstep(0.12, 0.0, dist) * 0.6;
      finalColor += warmCore * vec3(1.0, 0.75, 0.35);

      // PROGRESS RING - animated sweeping arc
      float ringInner = 0.32;
      float ringOuter = 0.42;
      float ringMask = smoothstep(ringInner - 0.02, ringInner, dist) * smoothstep(ringOuter + 0.02, ringOuter, dist);

      // Calculate angle for progress visualization
      float angle = getAngle(center);

      // Animated rotation offset (clockwise sweep)
      float rotationSpeed = 0.5;
      float rotation = fract(uTime * rotationSpeed);

      // Adjust angle with rotation
      float adjustedAngle = fract(angle + rotation);

      // Progress arc: filled from 0 to vProgress (simulated as 0.3-0.8 cycling animation if no real data)
      float simulatedProgress = 0.5 + 0.4 * sin(uTime * 0.3);  // Cycles between 0.1 and 0.9
      float effectiveProgress = max(vProgress, simulatedProgress);

      // Progress fill with smooth edge
      float progressFill = smoothstep(effectiveProgress + 0.02, effectiveProgress - 0.02, adjustedAngle);

      // Colored progress ring: bright cyan filled, dim gray unfilled
      vec3 progressColor = mix(vec3(0.2, 0.25, 0.3), vec3(0.3, 0.95, 1.0), progressFill);
      progressColor *= ringMask * 1.2;

      // Leading edge glow (bright spark at progress front)
      float leadingEdge = smoothstep(0.05, 0.0, abs(adjustedAngle - effectiveProgress)) * ringMask;
      progressColor += leadingEdge * vec3(1.0, 1.0, 1.0) * 1.5;

      finalColor += progressColor;
      alpha = max(alpha, ringMask * 0.95);

      // Outer glow halo
      float halo = smoothstep(0.48, 0.38, dist) * 0.4;
      alpha += halo * 0.4;

    } else {
      // Discovered: triumphant, bright, accomplished
      finalColor *= 1.3;
      alpha *= 1.1;
      // Bright white core
      float whiteCore = smoothstep(0.12, 0.0, dist) * 0.6;
      finalColor = mix(finalColor, vec3(1.0), whiteCore);
      // Success ring (greenish tint)
      float successRing = smoothstep(0.32, 0.38, dist) * smoothstep(0.48, 0.4, dist);
      finalColor += successRing * vec3(0.4, 0.9, 0.5) * 0.5;
    }

    // Type-based enhancements - restored for visual hierarchy

    // Core synapses (type 3): warm golden undertone
    if (vSynapseType > 2.5 && vSynapseType < 3.5) {
      float goldTint = smoothstep(0.3, 0.0, dist) * 0.25;
      finalColor += goldTint * vec3(1.0, 0.85, 0.3);
    }

    // Rare synapses (type 4): sparkle effect + outer glow
    if (vSynapseType > 3.5 && vSynapseType < 4.5) {
      alpha *= 1.15;
      float sparkle = smoothstep(0.08, 0.0, dist) * 0.4;
      finalColor += sparkle * vec3(1.0, 0.9, 0.85);
      // Red-ish outer ring
      float rareRing = smoothstep(0.38, 0.42, dist) * smoothstep(0.5, 0.44, dist);
      finalColor += rareRing * vec3(1.0, 0.5, 0.6) * 0.5;
    }

    // Legendary synapses (type 5): brilliant with magenta halo
    if (vSynapseType > 4.5 && vSynapseType < 5.5) {
      alpha *= 1.2;
      float brilliance = smoothstep(0.06, 0.0, dist) * 0.5;
      finalColor += brilliance * vec3(1.0, 1.0, 0.95);
      // Magenta outer halo
      float legendaryHalo = smoothstep(0.35, 0.45, dist) * smoothstep(0.55, 0.48, dist);
      finalColor += legendaryHalo * vec3(1.0, 0.5, 1.0) * 0.6;
    }

    // Unique synapses (type 6): dramatic beacon with double ring
    if (vSynapseType > 5.5) {
      alpha *= 1.3;
      // Brilliant white core
      float beacon = smoothstep(0.04, 0.0, dist) * 0.6;
      finalColor += beacon * vec3(1.0, 1.0, 0.9);
      // Inner golden ring
      float innerRing = smoothstep(0.2, 0.25, dist) * smoothstep(0.35, 0.28, dist);
      finalColor += innerRing * vec3(1.0, 0.9, 0.4) * 0.6;
      // Outer yellow halo
      float outerHalo = smoothstep(0.4, 0.5, dist) * smoothstep(0.6, 0.52, dist);
      finalColor += outerHalo * vec3(1.0, 1.0, 0.5) * 0.5;
    }

    // HOVER HIGHLIGHT: Bright cyan glow ring when hovered
    if (vHovered > 0.5) {
      // Brighten the whole synapse
      finalColor *= 1.4;

      // Add bright cyan outer ring
      float hoverRing = smoothstep(0.35, 0.42, dist) * smoothstep(0.5, 0.44, dist);
      finalColor += hoverRing * vec3(0.3, 1.0, 1.0) * 1.5;

      // Add inner white glow
      float hoverCore = smoothstep(0.15, 0.0, dist) * 0.5;
      finalColor += hoverCore * vec3(1.0, 1.0, 1.0);

      // Boost alpha for visibility
      alpha = max(alpha, 0.95);
    }

    // Allow rarer types to exceed 1.0 for bloom effect
    finalColor = min(finalColor, vec3(1.5));
    gl_FragColor = vec4(finalColor, alpha);
  }
`

interface SynapseMarkersProps {
  clusters: SynapseCluster[]
  userLevel?: UserLevel  // For showing locked synapse types (Masterplan 2026: USDC-based level)
  onSynapseClick?: (cluster: SynapseCluster, position: THREE.Vector3) => void
}

export const SynapseMarkers: Component<SynapseMarkersProps> = (props) => {
  const { scene, gl, camera } = useThree()

  // Three.js objects (imperative refs)
  let pointsObject: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null

  // Raycaster for click/hover detection
  let raycaster: THREE.Raycaster | null = null
  let pointer = new THREE.Vector2()

  // Track cluster positions for raycasting
  let clusterPositions: THREE.Vector3[] = []

  // Hover attribute buffer (updated each frame)
  let hoveredAttrBuffer: Float32Array | null = null
  let hoveredAttr: THREE.BufferAttribute | null = null

  // Track drag state
  let pointerDownPos: { x: number; y: number } | null = null
  let isDragging = false
  const DRAG_THRESHOLD = 5

  // Time tracking for scaled time (trance mode)
  let scaledTime = 0
  let lastRealTime = 0

  // Hover state signal for tooltip
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null)
  const [tooltipPosition, setTooltipPosition] = createSignal<{ x: number; y: number } | null>(null)

  // Build geometry data from clusters
  const geometryData = createMemo(() => {
    const clusters = props.clusters
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
    const clusterPositionsArray: THREE.Vector3[] = []

    clusters.forEach((cluster, i) => {
      // Apply brain shape constraint to keep synapses INSIDE the brain volume
      const [x, y, z] = constrainToBrainShape(
        cluster.positionX,
        cluster.positionY,
        cluster.positionZ
      )

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      clusterPositionsArray.push(new THREE.Vector3(x, y, z))

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

    return { positions, colors, sizes, states, synapseTypes, progress, clusterPositions: clusterPositionsArray }
  })

  // Find closest cluster to pointer for hover/click
  const findClosestCluster = (): number | null => {
    const sceneObj = scene()
    const cam = camera()
    if (!raycaster || !cam || props.clusters.length === 0) return null

    const threshold = 0.35
    raycaster.setFromCamera(pointer, cam)

    let closestIndex: number | null = null
    let closestDist = threshold

    clusterPositions.forEach((pos, i) => {
      const dist = raycaster!.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    return closestIndex
  }

  // Handle click on synapse cluster - only trigger if actually hovering one
  const handleClick = () => {
    if (isDragging) return

    // Use the tracked hover state instead of finding closest at click time
    // This prevents accidental clicks when looking around
    const currentHovered = hoveredIndex()
    if (currentHovered !== null && props.onSynapseClick) {
      const cluster = props.clusters[currentHovered]
      const pos = clusterPositions[currentHovered]
      props.onSynapseClick(cluster, pos)
    }
  }

  onMount(() => {
    const sceneObj = scene()
    const renderer = gl()
    const cam = camera()

    if (!sceneObj || !renderer) {
      console.warn('SynapseMarkersNew: Scene or renderer not available')
      return
    }

    // Initialize raycaster
    raycaster = new THREE.Raycaster()

    // Create geometry
    geometry = new THREE.BufferGeometry()

    // Create shader material - using normal blending to prevent bloom blowout
    material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
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

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging) {
        handleClick()
      }
      pointerDownPos = null
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)

    onCleanup(() => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)

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

  // Update geometry when clusters change
  createEffect(() => {
    const data = geometryData()
    if (!data || !geometry) return

    // Update cluster positions for raycasting
    clusterPositions = data.clusterPositions

    // Initialize hovered attribute buffer (all zeros = not hovered)
    hoveredAttrBuffer = new Float32Array(props.clusters.length)
    hoveredAttr = new THREE.BufferAttribute(hoveredAttrBuffer, 1)
    hoveredAttr.setUsage(THREE.DynamicDrawUsage)  // Will be updated frequently

    // Update geometry attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
    geometry.setAttribute('aState', new THREE.BufferAttribute(data.states, 1))
    geometry.setAttribute('aSynapseType', new THREE.BufferAttribute(data.synapseTypes, 1))
    geometry.setAttribute('aProgress', new THREE.BufferAttribute(data.progress, 1))
    geometry.setAttribute('aHovered', hoveredAttr)
    geometry.computeBoundingSphere()
  })

  // Animation frame for hover detection and time updates
  useFrame(({ elapsed, clock, camera: cam }) => {
    // Update scaled time (trance mode deprecated - always normal scale)
    const timeScale = TRANCE_CONFIG.normalScale

    const realTime = clock.getElapsedTime()
    const delta = realTime - lastRealTime
    lastRealTime = realTime
    scaledTime += delta * timeScale

    // Update shader time uniform for animations
    if (material) {
      material.uniforms.uTime.value = scaledTime
    }

    // Hover detection
    const closestIndex = findClosestCluster()
    const currentHovered = hoveredIndex()

    if (closestIndex !== currentHovered) {
      setHoveredIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'

      // Update hovered attribute for shader highlight
      if (hoveredAttrBuffer && hoveredAttr) {
        // Clear previous hover
        if (currentHovered !== null && currentHovered < hoveredAttrBuffer.length) {
          hoveredAttrBuffer[currentHovered] = 0.0
        }
        // Set new hover
        if (closestIndex !== null && closestIndex < hoveredAttrBuffer.length) {
          hoveredAttrBuffer[closestIndex] = 1.0
        }
        hoveredAttr.needsUpdate = true
      }

      // Update tooltip position if hovering
      if (closestIndex !== null && clusterPositions[closestIndex]) {
        const pos = clusterPositions[closestIndex].clone()
        pos.project(cam)

        const renderer = gl()
        if (renderer) {
          const rect = renderer.domElement.getBoundingClientRect()
          const x = (pos.x * 0.5 + 0.5) * rect.width + rect.left
          const y = (-pos.y * 0.5 + 0.5) * rect.height + rect.top
          setTooltipPosition({ x, y })
        }
      } else {
        setTooltipPosition(null)
      }
    } else if (closestIndex !== null && clusterPositions[closestIndex]) {
      // Update tooltip position while hovering (in case of camera movement)
      const pos = clusterPositions[closestIndex].clone()
      pos.project(cam)

      const renderer = gl()
      if (renderer) {
        const rect = renderer.domElement.getBoundingClientRect()
        const x = (pos.x * 0.5 + 0.5) * rect.width + rect.left
        const y = (-pos.y * 0.5 + 0.5) * rect.height + rect.top
        setTooltipPosition({ x, y })
      }
    }
  })

  // Get hovered cluster for tooltip
  const hoveredCluster = createMemo(() => {
    const idx = hoveredIndex()
    return idx !== null ? props.clusters[idx] : null
  })

  const hoveredDominantType = createMemo(() => {
    const cluster = hoveredCluster()
    return cluster ? getDominantSynapseType(cluster.typeCounts) : null
  })

  const hoveredIsLocked = createMemo(() => {
    const dominantType = hoveredDominantType()
    const userLevel = props.userLevel ?? 1 as UserLevel
    return dominantType ? userLevel < SYNAPSE_CONFIG[dominantType].unlockUserLevel : false
  })

  // Return tooltip JSX (rendered as SolidJS component)
  // Note: This tooltip is a DOM overlay, not part of the Three.js scene
  return (
    <>
      {hoveredCluster() && tooltipPosition() && (
        <div
          class="fixed pointer-events-none z-50"
          style={{
            left: `${tooltipPosition()!.x}px`,
            top: `${tooltipPosition()!.y}px`,
            transform: 'translate(-50%, -100%) translateY(-8px)',
          }}
        >
          <div class="bg-[var(--card-bg)]/95 backdrop-blur-sm border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs whitespace-nowrap">
            <div class="font-medium text-[var(--text-primary)]">
              {hoveredCluster()!.synapseCount} synapses
            </div>
            {hoveredDominantType() && (
              <div class="text-[var(--text-secondary)] capitalize">
                {hoveredDominantType()} type
                {hoveredIsLocked() && (
                  <span class="text-red-400 ml-1">(Locked - Lvl {SYNAPSE_CONFIG[hoveredDominantType()!].unlockUserLevel})</span>
                )}
              </div>
            )}
            <div class="text-[var(--text-secondary)]">
              {hoveredCluster()!.discoveredCount} discovered
            </div>
            {hoveredCluster()!.beingExploredCount > 0 && (
              <div class="text-yellow-400">
                {hoveredCluster()!.beingExploredCount} exploring
              </div>
            )}
            {hoveredCluster()!.explorerCount !== undefined && hoveredCluster()!.explorerCount! > 0 && (
              <div class="text-cyan-400">
                {hoveredCluster()!.explorerCount} explorers
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// Re-export for backward compatibility
export { SynapseMarkers as SpaceMarkers }
