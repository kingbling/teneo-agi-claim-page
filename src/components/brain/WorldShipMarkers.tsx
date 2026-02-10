import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree } from '@/three/hooks'
import { constrainToBrainShape, WORLD_SHIP_CONFIG } from './core/brainConstants'
import { WORLD_SHIP_VERTEX_SHADER, WORLD_SHIP_FRAGMENT_SHADER } from './shaders/worldShipShaders'
import { shipStore, type WorldShip } from '@/stores/shipStore'

/**
 * WorldShipMarkers renders ambient + other-user ships as warm white-gold diamond markers.
 * Visually distinct from user's own ships and from the blue synapse cloud.
 * Non-interactive (no click handling, raycaster, tooltips).
 *
 * Features:
 * - Distance-based point size clamping (visible at all zoom levels)
 * - Velocity tracking for directional streak effect
 * - Fade-out over ~1s when ships go idle (instead of instant vanish)
 * - NormalBlending for visibility against bright areas
 */

const MAX_WORLD_SHIPS = 100

export const WorldShipMarkers: Component = () => {
  const { scene } = useThree()

  let pointsObject: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null
  let animFrameId: number | null = null

  // Smooth position interpolation
  const renderedPositions = new Map<string, THREE.Vector3>()
  // Previous positions for velocity computation
  const prevPositions = new Map<string, THREE.Vector3>()
  // Fade-out tracking: maps ship ID → { alpha, fading }
  const fadeState = new Map<string, { alpha: number; fading: boolean; x: number; y: number; z: number }>()

  const LERP_FACTOR = 0.12
  const FADE_OUT_SPEED = 1.0 / WORLD_SHIP_CONFIG.fadeOutDuration // alpha per second

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    // Create geometry with pre-allocated buffers
    geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(MAX_WORLD_SHIPS * 3)
    const alphas = new Float32Array(MAX_WORLD_SHIPS)
    const velocities = new Float32Array(MAX_WORLD_SHIPS * 3)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3))

    material = new THREE.ShaderMaterial({
      vertexShader: WORLD_SHIP_VERTEX_SHADER,
      fragmentShader: WORLD_SHIP_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(
          WORLD_SHIP_CONFIG.color[0],
          WORLD_SHIP_CONFIG.color[1],
          WORLD_SHIP_CONFIG.color[2],
        ) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    pointsObject = new THREE.Points(geometry, material)
    pointsObject.frustumCulled = false
    sceneObj.add(pointsObject)

    let lastTime = performance.now()

    const animate = () => {
      animFrameId = requestAnimationFrame(animate)
      if (!material || !geometry) return

      const now = performance.now()
      const dt = (now - lastTime) / 1000 // seconds
      lastTime = now

      material.uniforms.uTime.value = now / 1000

      const worldShips: WorldShip[] = shipStore.worldShips || []
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
      const alphaAttr = geometry.getAttribute('aAlpha') as THREE.BufferAttribute
      const velAttr = geometry.getAttribute('aVelocity') as THREE.BufferAttribute

      // Build set of current ship IDs
      const currentIds = new Set(worldShips.map(s => s.id))

      // Mark ships that disappeared as fading
      for (const [id, state] of fadeState) {
        if (!currentIds.has(id) && !state.fading) {
          state.fading = true
        }
      }

      // Process active ships
      let writeIdx = 0

      for (let i = 0; i < worldShips.length && writeIdx < MAX_WORLD_SHIPS; i++) {
        const ship = worldShips[i]
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

        // Compute velocity from previous position
        const prev = prevPositions.get(ship.id)
        let vx = 0, vy = 0, vz = 0
        if (prev) {
          vx = rendered.x - prev.x
          vy = rendered.y - prev.y
          vz = rendered.z - prev.z
        }
        prevPositions.set(ship.id, new THREE.Vector3(rendered.x, rendered.y, rendered.z))

        // Target alpha: traveling = 0.7, idle = 0.4
        const targetAlpha = ship.s === 0 ? 0.7 : 0.4

        // Update fade state
        let fs = fadeState.get(ship.id)
        if (!fs) {
          fs = { alpha: targetAlpha, fading: false, x: rendered.x, y: rendered.y, z: rendered.z }
          fadeState.set(ship.id, fs)
        } else {
          fs.fading = false
          // Smoothly approach target alpha
          fs.alpha += (targetAlpha - fs.alpha) * 0.1
          fs.x = rendered.x
          fs.y = rendered.y
          fs.z = rendered.z
        }

        posAttr.setXYZ(writeIdx, rendered.x, rendered.y, rendered.z)
        alphaAttr.setX(writeIdx, fs.alpha)
        velAttr.setXYZ(writeIdx, vx, vy, vz)
        writeIdx++
      }

      // Process fading-out ships (recently disappeared)
      const toRemove: string[] = []
      for (const [id, state] of fadeState) {
        if (!state.fading) continue
        if (writeIdx >= MAX_WORLD_SHIPS) break

        state.alpha -= FADE_OUT_SPEED * dt
        if (state.alpha <= 0) {
          toRemove.push(id)
          continue
        }

        posAttr.setXYZ(writeIdx, state.x, state.y, state.z)
        alphaAttr.setX(writeIdx, state.alpha)
        velAttr.setXYZ(writeIdx, 0, 0, 0)
        writeIdx++
      }

      // Clean up fully faded ships
      for (const id of toRemove) {
        fadeState.delete(id)
        renderedPositions.delete(id)
        prevPositions.delete(id)
      }

      // Zero out remaining slots
      for (let i = writeIdx; i < MAX_WORLD_SHIPS; i++) {
        posAttr.setXYZ(i, 0, 0, 0)
        alphaAttr.setX(i, 0)
        velAttr.setXYZ(i, 0, 0, 0)
      }

      posAttr.needsUpdate = true
      alphaAttr.needsUpdate = true
      velAttr.needsUpdate = true
      geometry.setDrawRange(0, writeIdx)
    }

    animate()
  })

  // Clean up stale rendered positions when ships change
  createEffect(() => {
    const worldShips: WorldShip[] = shipStore.worldShips || []
    const currentIds = new Set(worldShips.map(s => s.id))
    // Only clean up positions for ships that have fully faded
    for (const id of renderedPositions.keys()) {
      if (!currentIds.has(id) && !fadeState.has(id)) {
        renderedPositions.delete(id)
        prevPositions.delete(id)
      }
    }
  })

  onCleanup(() => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
    }
    const sceneObj = scene()
    if (pointsObject && sceneObj) {
      sceneObj.remove(pointsObject)
    }
    geometry?.dispose()
    material?.dispose()
    renderedPositions.clear()
    prevPositions.clear()
    fadeState.clear()
  })

  return null
}
