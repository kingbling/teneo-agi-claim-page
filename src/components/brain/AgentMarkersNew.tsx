import { onMount, onCleanup, createEffect, createMemo, createSignal, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import { BRAIN_SCALE, TRANCE_CONFIG } from './core/brainConstants'

// Ship states (replacing agent states)
export type ShipState = 'idle' | 'exploring' | 'deploying' | 'returning'

// Ship interface for Masterplan 2026
export interface Ship {
  id: string
  ownerId: string
  name: string
  state: ShipState

  // Current position
  positionX: number
  positionY: number
  positionZ: number

  // Target synapse position (when exploring)
  targetX: number | null
  targetY: number | null
  targetZ: number | null

  // Current synapse being explored
  currentSynapseId: string | null
  exploreStartTime: number | null

  // Autopilot - ships don't have fuel, they have autopilot
  autopilotEnabled: boolean
  autopilotTargetType: 'minor' | 'complex' | 'deep' | 'core' | 'rare' | 'legendary' | 'unique' | null

  // Stats
  synapsesExplored: number
  totalAgiEarned: number
  totalXpEarned: number

  // Timestamps
  createdAt: number
  deployedAt: number | null
}

// Ship cluster for LOD visualization
export interface ShipCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  shipCount: number
  dominantState: ShipState
  avgProgress: number
  updatedAt: number
}

interface ShipMarkersProps {
  userShips: Ship[]
  shipClusters?: ShipCluster[]
  onShipClick?: (ship: Ship) => void
}

// Hash string for consistent color generation
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// HSL to RGB conversion
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360
  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return [r, g, b]
}

// Generate unique color for ship based on ID and state
function getShipColor(shipId: string, state: ShipState): [number, number, number] {
  const hue = hashString(shipId) % 360

  // Ship state color modifiers
  const stateModifiers: Record<ShipState, { s: number; l: number }> = {
    idle: { s: 0.4, l: 0.45 },
    exploring: { s: 0.95, l: 0.60 },    // Bright when actively exploring
    deploying: { s: 0.85, l: 0.55 },    // Traveling to synapse
    returning: { s: 0.65, l: 0.50 },    // Heading back
  }

  const mod = stateModifiers[state] || { s: 0.5, l: 0.5 }
  return hslToRgb(hue, mod.s, mod.l)
}

// Vertex shader for ship markers - enhanced with direction
const SHIP_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;
  attribute float aAutopilot;
  attribute float aDirection;  // Rotation angle toward target (radians)

  uniform float uTime;

  varying vec3 vColor;
  varying float vState;
  varying float vAutopilot;
  varying float vDirection;

  void main() {
    vColor = aColor;
    vState = aState;
    vAutopilot = aAutopilot;
    vDirection = aDirection;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Pulse effect for active ships
    float pulse = 1.0;
    if (aState > 0.5 && aState < 2.5) {
      // Exploring/deploying - stronger pulse with urgency
      pulse = 1.0 + sin(uTime * 4.0 + position.x * 10.0) * 0.25;
    } else if (aState > 2.5) {
      // Returning - gentle pulse
      pulse = 1.0 + sin(uTime * 2.0) * 0.1;
    }

    // Extra throb for autopilot ships
    if (aAutopilot > 0.5) {
      pulse *= 1.0 + sin(uTime * 6.0) * 0.15;
    }

    gl_PointSize = aSize * pulse;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for ship markers - arrow/ship shape
const SHIP_FRAGMENT_SHADER = `
  uniform float uTime;

  varying vec3 vColor;
  varying float vState;
  varying float vAutopilot;
  varying float vDirection;

  // Signed distance function for arrow/ship shape
  float sdTriangle(vec2 p, float size) {
    // Equilateral triangle pointing up
    float k = sqrt(3.0);
    p.x = abs(p.x) - size;
    p.y = p.y + size / k;
    if (p.x + k * p.y > 0.0) {
      p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    }
    p.x -= clamp(p.x, -2.0 * size, 0.0);
    return -length(p) * sign(p.y);
  }

  // Rotate 2D point
  vec2 rotate2D(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Rotate based on direction (make ship point toward target)
    vec2 rotatedPos = rotate2D(center, vDirection);

    // Ship shape: arrow/triangle pointing in direction
    float shipSize = 0.2;
    float shipDist = sdTriangle(rotatedPos * 2.0, shipSize);

    // Base ship shape
    float shipMask = 1.0 - smoothstep(-0.02, 0.02, shipDist);

    // Outer glow around ship
    float glowMask = 1.0 - smoothstep(0.0, 0.25, shipDist);

    vec3 finalColor = vColor;
    float alpha = 0.0;

    // State-based rendering
    if (vState < 0.5) {
      // Idle: dim, simple shape
      alpha = shipMask * 0.6 + glowMask * 0.2;
      finalColor *= 0.7;
    } else if (vState < 1.5) {
      // Exploring: bright, pulsing glow, engine trail
      alpha = shipMask * 1.0 + glowMask * 0.5;
      finalColor *= 1.3;

      // Engine exhaust trail (behind ship)
      vec2 exhaustPos = rotatedPos + vec2(0.0, 0.15);  // Behind the ship
      float exhaustDist = length(exhaustPos);
      float exhaustMask = smoothstep(0.25, 0.05, exhaustDist) * smoothstep(-0.1, 0.1, exhaustPos.y);

      // Animated exhaust flicker
      exhaustMask *= 0.5 + 0.5 * sin(uTime * 12.0 + exhaustPos.x * 20.0);

      // Orange/cyan exhaust color
      vec3 exhaustColor = mix(vec3(1.0, 0.6, 0.2), vec3(0.3, 0.9, 1.0), sin(uTime * 8.0) * 0.5 + 0.5);
      finalColor = mix(finalColor, exhaustColor, exhaustMask * 0.8);
      alpha += exhaustMask * 0.7;

    } else if (vState < 2.5) {
      // Deploying: traveling animation, motion blur effect
      alpha = shipMask * 0.9 + glowMask * 0.4;
      finalColor *= 1.1;

      // Speed lines behind ship
      vec2 trailPos = rotatedPos + vec2(0.0, 0.1);
      float trailMask = smoothstep(0.3, 0.0, trailPos.y) * smoothstep(0.1, 0.02, abs(trailPos.x));
      trailMask *= 0.3 + 0.7 * sin(uTime * 15.0 + trailPos.y * 30.0);
      alpha += trailMask * 0.4;

    } else {
      // Returning: gentler, satisfied glow
      alpha = shipMask * 0.85 + glowMask * 0.35;
      finalColor *= 1.0;

      // Soft success aura
      float auraMask = smoothstep(0.35, 0.15, dist) * 0.3;
      finalColor = mix(finalColor, vec3(0.4, 1.0, 0.6), auraMask);
      alpha += auraMask * 0.3;
    }

    // Autopilot indicator: rotating ring
    if (vAutopilot > 0.5) {
      float ringRadius = 0.38;
      float ringWidth = 0.04;
      float ringDist = abs(dist - ringRadius);
      float ringMask = smoothstep(ringWidth, ringWidth * 0.3, ringDist);

      // Animated dashed ring
      float angle = atan(center.y, center.x);
      float dashPattern = step(0.5, fract((angle + uTime * 2.0) * 3.0 / 6.28318));

      ringMask *= dashPattern;

      // Green autopilot ring
      finalColor = mix(finalColor, vec3(0.3, 1.0, 0.5), ringMask * 0.8);
      alpha = max(alpha, ringMask * 0.9);
    }

    // Bright center core
    float coreMask = smoothstep(0.12, 0.0, dist);
    finalColor = mix(finalColor, vec3(1.0, 1.0, 0.9), coreMask * 0.5);
    alpha = max(alpha, coreMask * 0.6);

    // Clamp color
    finalColor = min(finalColor, vec3(1.5));

    gl_FragColor = vec4(finalColor, alpha * 0.95);
  }
`

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ShipMarkersNew: Component<ShipMarkersProps> = (props) => {
  const { scene, gl, camera } = useThree()

  // Three.js objects (imperative refs)
  let pointsObject: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null

  // Raycaster for click/hover detection
  let raycaster: THREE.Raycaster | null = null
  let pointer = new THREE.Vector2()

  // Track ship positions for raycasting
  let shipPositions: THREE.Vector3[] = []

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

  // Filter to only active ships (not idle)
  const activeShips = createMemo(() => {
    return props.userShips.filter(s => s.state !== 'idle')
  })

  // Build geometry data for active ships
  const geometryData = createMemo(() => {
    const ships = activeShips()
    if (ships.length === 0) return null

    const count = ships.length
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const states = new Float32Array(count)
    const autopilots = new Float32Array(count)
    const directions = new Float32Array(count)  // Direction toward target (radians)
    const shipPositionsArray: THREE.Vector3[] = []

    ships.forEach((ship, i) => {
      const x = ship.positionX * BRAIN_SCALE.x
      const y = ship.positionY * BRAIN_SCALE.y
      const z = ship.positionZ * BRAIN_SCALE.z

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      shipPositionsArray.push(new THREE.Vector3(x, y, z))

      // Get color based on ship ID and state
      const color = getShipColor(ship.id, ship.state)
      colors[i * 3] = color[0]
      colors[i * 3 + 1] = color[1]
      colors[i * 3 + 2] = color[2]

      // Size based on state - larger for better visibility
      const baseSize = 16.0
      sizes[i] = ship.state === 'exploring' ? baseSize * 1.4 : baseSize

      // State encoding: 0=idle, 1=exploring, 2=deploying, 3=returning
      const stateMap: Record<ShipState, number> = {
        idle: 0, exploring: 1, deploying: 2, returning: 3
      }
      states[i] = stateMap[ship.state] || 0

      // Autopilot flag
      autopilots[i] = ship.autopilotEnabled ? 1.0 : 0.0

      // Calculate direction toward target (in screen space approximation)
      // Default pointing "forward" (up in UV space = -PI/2)
      let direction = -Math.PI / 2
      if (ship.targetX !== null && ship.targetY !== null && ship.targetZ !== null) {
        const targetX = ship.targetX * BRAIN_SCALE.x
        const targetY = ship.targetY * BRAIN_SCALE.y
        // Use XY plane for direction (simplified 2D direction)
        const dx = targetX - x
        const dy = targetY - y
        direction = Math.atan2(dy, dx) - Math.PI / 2  // Adjust so ship points toward target
      }
      directions[i] = direction
    })

    return { positions, colors, sizes, states, autopilots, directions, shipPositions: shipPositionsArray }
  })

  // Find closest ship to pointer for hover/click
  const findClosestShip = (): number | null => {
    const cam = camera()
    const ships = activeShips()
    if (!raycaster || !cam || ships.length === 0) return null

    const threshold = 0.15
    raycaster.setFromCamera(pointer, cam)

    let closestIndex: number | null = null
    let closestDist = threshold

    shipPositions.forEach((pos, i) => {
      const dist = raycaster!.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    return closestIndex
  }

  // Handle click on ship
  const handleClick = () => {
    if (isDragging) return

    const closestIndex = findClosestShip()
    if (closestIndex !== null && props.onShipClick) {
      const ships = activeShips()
      props.onShipClick(ships[closestIndex])
    }
  }

  onMount(() => {
    const sceneObj = scene()
    const renderer = gl()
    const cam = camera()

    if (!sceneObj || !renderer) {
      console.warn('ShipMarkersNew: Scene or renderer not available')
      return
    }

    // Initialize raycaster
    raycaster = new THREE.Raycaster()

    // Create geometry
    geometry = new THREE.BufferGeometry()

    // Create shader material
    material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: SHIP_VERTEX_SHADER,
      fragmentShader: SHIP_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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

  // Update geometry when ships change
  createEffect(() => {
    const data = geometryData()
    if (!data || !geometry) return

    // Update ship positions for raycasting
    shipPositions = data.shipPositions

    // Update geometry attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
    geometry.setAttribute('aState', new THREE.BufferAttribute(data.states, 1))
    geometry.setAttribute('aAutopilot', new THREE.BufferAttribute(data.autopilots, 1))
    geometry.setAttribute('aDirection', new THREE.BufferAttribute(data.directions, 1))
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

    // Update shader uniforms
    if (material) {
      material.uniforms.uTime.value = scaledTime
    }

    // Hover detection
    const closestIndex = findClosestShip()
    const currentHovered = hoveredIndex()

    if (closestIndex !== currentHovered) {
      setHoveredIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'

      // Update tooltip position if hovering
      if (closestIndex !== null && shipPositions[closestIndex]) {
        const pos = shipPositions[closestIndex].clone()
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
    } else if (closestIndex !== null && shipPositions[closestIndex]) {
      // Update tooltip position while hovering (in case of camera movement)
      const pos = shipPositions[closestIndex].clone()
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

  // Get hovered ship for tooltip
  const hoveredShip = createMemo(() => {
    const idx = hoveredIndex()
    const ships = activeShips()
    return idx !== null ? ships[idx] : null
  })

  // Return tooltip JSX (rendered as SolidJS component)
  // Note: This tooltip is a DOM overlay, not part of the Three.js scene
  return (
    <>
      {hoveredShip() && tooltipPosition() && (
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
              {hoveredShip()!.name}
            </div>
            <div class="text-[var(--text-secondary)] capitalize">
              {hoveredShip()!.state}
            </div>
            {hoveredShip()!.autopilotEnabled && (
              <div class="text-green-400 flex items-center gap-1">
                <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Autopilot: {hoveredShip()!.autopilotTargetType || 'Any'}
              </div>
            )}
            <div class="text-cyan-400">
              {hoveredShip()!.synapsesExplored} explored
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Re-export for backward compatibility
export { ShipMarkersNew as AgentMarkersNew }
