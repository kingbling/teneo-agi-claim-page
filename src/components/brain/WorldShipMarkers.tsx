import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree } from '@/three/hooks'
import { constrainToBrainShape } from './core/brainConstants'
import { shipStore, type WorldShip } from '@/stores/shipStore'

/**
 * WorldShipMarkers renders ambient + other-user ships as subtle semi-transparent points.
 * Visually distinct from the user's own ships: smaller, muted blue, lower opacity.
 * Non-interactive (no click handling, raycaster, tooltips).
 */

const WORLD_SHIP_COLOR = new Float32Array([0.4, 0.6, 0.9]) // Muted blue
const POINT_SIZE = 16
const MAX_WORLD_SHIPS = 50

// Inline vertex shader
const VERTEX_SHADER = `
  uniform float uTime;
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Gentle pulse
    float pulse = 1.0 + sin(uTime * 2.0 + position.x * 10.0) * 0.1;

    gl_PointSize = ${POINT_SIZE.toFixed(1)} * pulse * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Inline fragment shader
const FRAGMENT_SHADER = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    // Circular point with soft edges
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft glow falloff
    float alpha = smoothstep(0.5, 0.15, dist) * vAlpha;

    gl_FragColor = vec4(uColor, alpha);
  }
`

export const WorldShipMarkers: Component = () => {
  const threeContext = useThree()
  const { scene } = threeContext

  let pointsObject: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null
  let animFrameId: number | null = null

  // Smooth position interpolation
  const renderedPositions = new Map<string, THREE.Vector3>()
  const LERP_FACTOR = 0.12

  onMount(() => {
    // Create geometry with pre-allocated buffers
    geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(MAX_WORLD_SHIPS * 3)
    const alphas = new Float32Array(MAX_WORLD_SHIPS)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))

    // Create material
    material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(WORLD_SHIP_COLOR[0], WORLD_SHIP_COLOR[1], WORLD_SHIP_COLOR[2]) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    pointsObject = new THREE.Points(geometry, material)
    pointsObject.frustumCulled = false
    scene.add(pointsObject)

    // Animation loop
    const animate = () => {
      animFrameId = requestAnimationFrame(animate)
      if (!material || !geometry) return

      material.uniforms.uTime.value = performance.now() / 1000

      // Get world ships from store
      const worldShips: WorldShip[] = shipStore.worldShips || []
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
      const alphaAttr = geometry.getAttribute('aAlpha') as THREE.BufferAttribute

      const count = Math.min(worldShips.length, MAX_WORLD_SHIPS)

      for (let i = 0; i < count; i++) {
        const ship = worldShips[i]

        // Constrain to brain shape
        const [cx, cy, cz] = constrainToBrainShape(ship.x, ship.y, ship.z)

        // Smooth interpolation
        let rendered = renderedPositions.get(ship.id)
        if (!rendered) {
          rendered = new THREE.Vector3(cx, cy, cz)
          renderedPositions.set(ship.id, rendered)
        } else {
          rendered.x += (cx - rendered.x) * LERP_FACTOR
          rendered.y += (cy - rendered.y) * LERP_FACTOR
          rendered.z += (cz - rendered.z) * LERP_FACTOR
        }

        posAttr.setXYZ(i, rendered.x, rendered.y, rendered.z)
        alphaAttr.setX(i, ship.s === 0 ? 0.4 : 0.15) // traveling = brighter, idle = dim
      }

      // Zero out remaining slots
      for (let i = count; i < MAX_WORLD_SHIPS; i++) {
        posAttr.setXYZ(i, 0, 0, 0)
        alphaAttr.setX(i, 0)
      }

      posAttr.needsUpdate = true
      alphaAttr.needsUpdate = true
      geometry.setDrawRange(0, count)
    }

    animate()
  })

  // Clean up stale rendered positions when ships change
  createEffect(() => {
    const worldShips: WorldShip[] = shipStore.worldShips || []
    const currentIds = new Set(worldShips.map(s => s.id))
    for (const id of renderedPositions.keys()) {
      if (!currentIds.has(id)) {
        renderedPositions.delete(id)
      }
    }
  })

  onCleanup(() => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
    }
    if (pointsObject && scene) {
      scene.remove(pointsObject)
    }
    geometry?.dispose()
    material?.dispose()
    renderedPositions.clear()
  })

  return null
}
