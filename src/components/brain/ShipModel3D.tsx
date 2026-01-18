/**
 * ShipModel3D - Multi-type Ship Renderer
 *
 * Supports three distinct ship types:
 * - Neuron: Agile interceptor with diamond fuselage, swept delta wings, twin engines
 * - Synapse: Heavy explorer with wide rectangular hull, stubby wings, quad engines
 * - Dendrite: Sleek scout with long needle fuselage, minimal fins, single large engine
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import { constrainToBrainShape } from './core/brainConstants'
import type { Ship, ShipStatus, ShipType } from '@/stores/shipStore'

interface ShipModel3DProps {
  ship: Ship
  isVisible: boolean
}

// State-based accent colors
const STATE_COLORS: Record<ShipStatus, number> = {
  idle: 0xffcc44,
  searching: 0x44aaff,
  exploring: 0x00ffff,
  deploying: 0xff6633,
  returning: 0x66ff66,
}

// Engine glow colors
const ENGINE_COLORS: Record<ShipStatus, number> = {
  idle: 0xffaa22,
  searching: 0x2288ff,
  exploring: 0x00ffff,
  deploying: 0xff4400,
  returning: 0x44ff44,
}

const SHIP_SCALE = 0.1
const ENGINE_TRAIL_PARTICLES = 40 // More particles for twin engines

// Helper to safely get colors for any state
function getStateColor(state: ShipStatus | undefined): number {
  if (state && state in STATE_COLORS) {
    return STATE_COLORS[state]
  }
  return STATE_COLORS.idle
}

function getEngineColor(state: ShipStatus | undefined): number {
  if (state && state in ENGINE_COLORS) {
    return ENGINE_COLORS[state]
  }
  return ENGINE_COLORS.idle
}

/**
 * Creates the main hull - a sleek diamond-cross-section fuselage
 * Tapers from needle nose to wider cockpit area to engine section
 */
function createHullGeometry(S: number): THREE.BufferGeometry {
  // Hull profile points (Z axis is length, 0 = center)
  // Cross section is diamond shape (4 vertices per station)

  const stations = [
    // Z position, width (X), height (Y) - half dimensions
    { z: -S * 0.85, w: 0, h: 0 },           // Nose tip
    { z: -S * 0.65, w: S * 0.025, h: S * 0.02 },  // Nose taper
    { z: -S * 0.4, w: S * 0.06, h: S * 0.04 },   // Forward fuselage
    { z: -S * 0.15, w: S * 0.09, h: S * 0.055 }, // Cockpit area (widest)
    { z: S * 0.1, w: S * 0.085, h: S * 0.05 },   // Mid fuselage
    { z: S * 0.35, w: S * 0.07, h: S * 0.04 },   // Rear taper
    { z: S * 0.5, w: S * 0.04, h: S * 0.03 },    // Engine mount
  ]

  const vertices: number[] = []
  const indices: number[] = []

  // Generate diamond cross-section at each station
  // 4 points per station: top, right, bottom, left
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i]
    if (s.w === 0) {
      // Nose tip - single point repeated 4x for indexing
      vertices.push(0, 0, s.z)
      vertices.push(0, 0, s.z)
      vertices.push(0, 0, s.z)
      vertices.push(0, 0, s.z)
    } else {
      vertices.push(0, s.h, s.z)      // Top
      vertices.push(s.w, 0, s.z)      // Right
      vertices.push(0, -s.h, s.z)     // Bottom
      vertices.push(-s.w, 0, s.z)     // Left
    }
  }

  // Connect stations with triangles
  for (let i = 0; i < stations.length - 1; i++) {
    const base = i * 4
    const next = (i + 1) * 4

    // 4 quad faces between stations (each split into 2 triangles)
    for (let j = 0; j < 4; j++) {
      const j2 = (j + 1) % 4
      // Triangle 1
      indices.push(base + j, next + j, next + j2)
      // Triangle 2
      indices.push(base + j, next + j2, base + j2)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

/**
 * Creates aggressive swept delta wing with thickness
 */
function createWingGeometry(S: number, isLeft: boolean): THREE.BufferGeometry {
  const xSign = isLeft ? 1 : -1

  // Wing profile - aggressive swept delta
  const rootLead = -S * 0.05   // Leading edge at root
  const rootTrail = S * 0.35   // Trailing edge at root
  const tipLead = S * 0.25     // Leading edge at tip (swept back)
  const tipTrail = S * 0.4     // Trailing edge at tip
  const span = S * 0.5         // Wing span
  const rootThick = S * 0.018  // Thickness at root
  const tipThick = S * 0.006   // Thickness at tip (tapered)

  // Vertices: root section (4 points) + tip section (4 points)
  const vertices = new Float32Array([
    // Root - leading edge top/bottom
    xSign * S * 0.08, rootThick / 2, rootLead,
    xSign * S * 0.08, -rootThick / 2, rootLead,
    // Root - trailing edge top/bottom
    xSign * S * 0.08, rootThick / 2, rootTrail,
    xSign * S * 0.08, -rootThick / 2, rootTrail,

    // Tip - leading edge top/bottom
    xSign * span, tipThick / 2, tipLead,
    xSign * span, -tipThick / 2, tipLead,
    // Tip - trailing edge top/bottom
    xSign * span, tipThick / 2, tipTrail,
    xSign * span, -tipThick / 2, tipTrail,
  ])

  // Indices for wing surfaces
  const idx = isLeft ? new Uint16Array([
    // Top surface
    0, 4, 2,  2, 4, 6,
    // Bottom surface
    1, 3, 5,  3, 7, 5,
    // Leading edge
    0, 1, 4,  1, 5, 4,
    // Trailing edge
    2, 6, 3,  3, 6, 7,
    // Tip cap
    4, 5, 6,  5, 7, 6,
    // Root cap
    0, 2, 1,  1, 2, 3,
  ]) : new Uint16Array([
    // Top surface (reversed winding)
    0, 2, 4,  2, 6, 4,
    // Bottom surface
    1, 5, 3,  3, 5, 7,
    // Leading edge
    0, 4, 1,  1, 4, 5,
    // Trailing edge
    2, 3, 6,  3, 7, 6,
    // Tip cap
    4, 6, 5,  5, 6, 7,
    // Root cap
    0, 1, 2,  1, 3, 2,
  ])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(new THREE.BufferAttribute(idx, 1))
  geometry.computeVertexNormals()

  return geometry
}

/**
 * Creates canted vertical stabilizer (like F-22 style)
 */
function createStabilizerGeometry(S: number, isLeft: boolean): THREE.BufferGeometry {
  const xSign = isLeft ? 1 : -1
  const cant = 0.25 // Outward cant angle

  const baseX = xSign * S * 0.06
  const height = S * 0.12
  const thickness = S * 0.008

  // Canted fin - leans outward
  const topX = baseX + xSign * height * Math.sin(cant)
  const topY = height * Math.cos(cant)

  const vertices = new Float32Array([
    // Base quad (on fuselage)
    baseX - thickness, S * 0.03, S * 0.2,    // 0: base front left
    baseX + thickness, S * 0.03, S * 0.2,    // 1: base front right
    baseX - thickness, S * 0.03, S * 0.45,   // 2: base rear left
    baseX + thickness, S * 0.03, S * 0.45,   // 3: base rear right

    // Top edge (swept back, canted outward)
    topX, S * 0.03 + topY, S * 0.32,         // 4: top front
    topX, S * 0.03 + topY, S * 0.48,         // 5: top rear
  ])

  const idx = new Uint16Array([
    // Outer face
    0, 4, 2,  2, 4, 5,
    // Inner face
    1, 3, 4,  3, 5, 4,
    // Front edge
    0, 1, 4,
    // Rear edge
    2, 5, 3,
    // Top edge
    4, 5, 4, // degenerate, skip
    // Base
    0, 2, 1,  1, 2, 3,
  ])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(new THREE.BufferAttribute(idx, 1))
  geometry.computeVertexNormals()

  return geometry
}

/**
 * Creates sleek teardrop cockpit canopy
 */
function createCockpitGeometry(S: number): THREE.BufferGeometry {
  // Elongated bubble canopy
  const length = S * 0.22
  const width = S * 0.055
  const height = S * 0.045

  const segments = 8
  const vertices: number[] = []
  const indices: number[] = []

  // Front point
  vertices.push(0, S * 0.055, -S * 0.35)

  // Generate elongated dome sections
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const z = -S * 0.35 + t * length
    const profileScale = Math.sin(t * Math.PI) // Bulge in middle
    const w = width * profileScale
    const h = height * profileScale

    // 4 points per section (simplified)
    vertices.push(0, S * 0.055 + h, z)           // Top
    vertices.push(w, S * 0.055 + h * 0.5, z)     // Right
    vertices.push(0, S * 0.055, z)               // Bottom (on hull)
    vertices.push(-w, S * 0.055 + h * 0.5, z)    // Left
  }

  // Connect front point to first section
  for (let j = 0; j < 4; j++) {
    const j2 = (j + 1) % 4
    indices.push(0, 1 + j, 1 + j2)
  }

  // Connect sections
  for (let i = 0; i < segments - 1; i++) {
    const base = 1 + i * 4
    const next = base + 4
    for (let j = 0; j < 4; j++) {
      const j2 = (j + 1) % 4
      indices.push(base + j, next + j, next + j2)
      indices.push(base + j, next + j2, base + j2)
    }
  }

  // Close rear
  const lastBase = 1 + (segments - 1) * 4
  for (let j = 0; j < 4; j++) {
    const j2 = (j + 1) % 4
    indices.push(lastBase + j, lastBase + j2, lastBase) // Converge to center-ish
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

/**
 * Creates Neuron ship geometry (agile interceptor) - the original design
 */
function createNeuronGeometry(): THREE.Group {
  const shipGroup = new THREE.Group()
  const S = SHIP_SCALE

  // === MAIN HULL ===
  const hullGeom = createHullGeometry(S)
  const hull = new THREE.Mesh(hullGeom)
  hull.name = 'hull'
  shipGroup.add(hull)

  // === WINGS ===
  const leftWingGeom = createWingGeometry(S, true)
  const leftWing = new THREE.Mesh(leftWingGeom)
  leftWing.name = 'wing'
  shipGroup.add(leftWing)

  const rightWingGeom = createWingGeometry(S, false)
  const rightWing = new THREE.Mesh(rightWingGeom)
  rightWing.name = 'wing'
  shipGroup.add(rightWing)

  // === CANTED STABILIZERS ===
  const leftStab = new THREE.Mesh(createStabilizerGeometry(S, true))
  leftStab.name = 'wing'
  shipGroup.add(leftStab)

  const rightStab = new THREE.Mesh(createStabilizerGeometry(S, false))
  rightStab.name = 'wing'
  shipGroup.add(rightStab)

  // === COCKPIT CANOPY ===
  const cockpitGeom = createCockpitGeometry(S)
  const cockpit = new THREE.Mesh(cockpitGeom)
  cockpit.name = 'cockpit'
  shipGroup.add(cockpit)

  // === TWIN ENGINES ===
  const engineRadius = S * 0.028
  const engineLength = S * 0.18
  const engineSpacing = S * 0.055

  const engineGeom = new THREE.CylinderGeometry(
    engineRadius * 0.7,  // Front (smaller)
    engineRadius,        // Rear
    engineLength,
    8
  )

  // Left engine
  const leftEngine = new THREE.Mesh(engineGeom)
  leftEngine.rotation.x = Math.PI / 2
  leftEngine.position.set(engineSpacing, -S * 0.01, S * 0.42)
  leftEngine.name = 'engine'
  shipGroup.add(leftEngine)

  // Right engine
  const rightEngine = new THREE.Mesh(engineGeom.clone())
  rightEngine.rotation.x = Math.PI / 2
  rightEngine.position.set(-engineSpacing, -S * 0.01, S * 0.42)
  rightEngine.name = 'engine'
  shipGroup.add(rightEngine)

  // === ENGINE GLOWS ===
  const glowGeom = new THREE.CircleGeometry(engineRadius * 1.2, 16)

  const leftGlow = new THREE.Mesh(glowGeom)
  leftGlow.rotation.x = Math.PI / 2
  leftGlow.position.set(engineSpacing, -S * 0.01, S * 0.52)
  leftGlow.name = 'engineGlow'
  shipGroup.add(leftGlow)

  const rightGlow = new THREE.Mesh(glowGeom.clone())
  rightGlow.rotation.x = Math.PI / 2
  rightGlow.position.set(-engineSpacing, -S * 0.01, S * 0.52)
  rightGlow.name = 'engineGlow'
  shipGroup.add(rightGlow)

  // Engine cores (bright center)
  const coreGeom = new THREE.CircleGeometry(engineRadius * 0.5, 12)

  const leftCore = new THREE.Mesh(coreGeom)
  leftCore.rotation.x = Math.PI / 2
  leftCore.position.set(engineSpacing, -S * 0.01, S * 0.521)
  leftCore.name = 'engineCore'
  shipGroup.add(leftCore)

  const rightCore = new THREE.Mesh(coreGeom.clone())
  rightCore.rotation.x = Math.PI / 2
  rightCore.position.set(-engineSpacing, -S * 0.01, S * 0.521)
  rightCore.name = 'engineCore'
  shipGroup.add(rightCore)

  // === ACCENT LIGHTS === (small glowing strips)
  const accentGeom = new THREE.BoxGeometry(S * 0.005, S * 0.003, S * 0.08)

  // Wing accent lights
  const leftAccent = new THREE.Mesh(accentGeom)
  leftAccent.position.set(S * 0.25, S * 0.01, S * 0.2)
  leftAccent.name = 'accent'
  shipGroup.add(leftAccent)

  const rightAccent = new THREE.Mesh(accentGeom.clone())
  rightAccent.position.set(-S * 0.25, S * 0.01, S * 0.2)
  rightAccent.name = 'accent'
  shipGroup.add(rightAccent)

  // === POINT LIGHT === (subtle fill light)
  const shipLight = new THREE.PointLight(0xffffff, 0.5, S * 2)
  shipLight.position.set(0, S * 0.1, -S * 0.2)
  shipGroup.add(shipLight)

  return shipGroup
}

/**
 * Creates Synapse ship geometry (heavy explorer)
 * Wide rectangular hull, stubby wings with sensor pods, quad engines
 */
function createSynapseGeometry(): THREE.Group {
  const shipGroup = new THREE.Group()
  const S = SHIP_SCALE

  // === WIDE RECTANGULAR HULL ===
  // Synapse is 1.2x length, 2x width of Neuron
  const hullWidth = S * 0.18
  const hullHeight = S * 0.06
  const hullLength = S * 1.0

  const hullGeom = new THREE.BoxGeometry(hullWidth, hullHeight, hullLength)
  // Bevel the edges slightly by applying a matrix
  const hull = new THREE.Mesh(hullGeom)
  hull.name = 'hull'
  hull.position.z = S * 0.1
  shipGroup.add(hull)

  // === STUBBY WINGS WITH SENSOR PODS ===
  const wingGeom = new THREE.BoxGeometry(S * 0.3, S * 0.015, S * 0.2)

  const leftWing = new THREE.Mesh(wingGeom)
  leftWing.position.set(S * 0.22, 0, S * 0.15)
  leftWing.name = 'wing'
  shipGroup.add(leftWing)

  const rightWing = new THREE.Mesh(wingGeom.clone())
  rightWing.position.set(-S * 0.22, 0, S * 0.15)
  rightWing.name = 'wing'
  shipGroup.add(rightWing)

  // Sensor pods at wing tips
  const podGeom = new THREE.SphereGeometry(S * 0.025, 8, 8)

  const leftPod = new THREE.Mesh(podGeom)
  leftPod.position.set(S * 0.4, 0, S * 0.15)
  leftPod.name = 'accent'
  shipGroup.add(leftPod)

  const rightPod = new THREE.Mesh(podGeom.clone())
  rightPod.position.set(-S * 0.4, 0, S * 0.15)
  rightPod.name = 'accent'
  shipGroup.add(rightPod)

  // === QUAD ENGINES (2x2 grid) ===
  const engineRadius = S * 0.022
  const engineLength = S * 0.15
  const engineGeom = new THREE.CylinderGeometry(
    engineRadius * 0.8,
    engineRadius,
    engineLength,
    6
  )

  const enginePositions = [
    [S * 0.05, -S * 0.015, S * 0.55],
    [-S * 0.05, -S * 0.015, S * 0.55],
    [S * 0.05, S * 0.015, S * 0.55],
    [-S * 0.05, S * 0.015, S * 0.55],
  ]

  enginePositions.forEach(([x, y, z]) => {
    const engine = new THREE.Mesh(engineGeom.clone())
    engine.rotation.x = Math.PI / 2
    engine.position.set(x, y, z)
    engine.name = 'engine'
    shipGroup.add(engine)
  })

  // === ENGINE GLOWS ===
  const glowGeom = new THREE.CircleGeometry(engineRadius * 1.1, 12)

  enginePositions.forEach(([x, y, z]) => {
    const glow = new THREE.Mesh(glowGeom.clone())
    glow.rotation.x = Math.PI / 2
    glow.position.set(x, y, z + S * 0.08)
    glow.name = 'engineGlow'
    shipGroup.add(glow)

    const coreGeom = new THREE.CircleGeometry(engineRadius * 0.4, 8)
    const core = new THREE.Mesh(coreGeom)
    core.rotation.x = Math.PI / 2
    core.position.set(x, y, z + S * 0.081)
    core.name = 'engineCore'
    shipGroup.add(core)
  })

  // === WIDE INDUSTRIAL CANOPY ===
  const canopyWidth = S * 0.12
  const canopyHeight = S * 0.035
  const canopyLength = S * 0.15

  const canopyGeom = new THREE.BoxGeometry(canopyWidth, canopyHeight, canopyLength)
  const cockpit = new THREE.Mesh(canopyGeom)
  cockpit.position.set(0, hullHeight / 2 + canopyHeight / 2, -S * 0.25)
  cockpit.name = 'cockpit'
  shipGroup.add(cockpit)

  // === DORSAL SENSOR DISHES ===
  const dishGeom = new THREE.CylinderGeometry(S * 0.02, S * 0.015, S * 0.008, 8)

  const dishPositions = [
    [0, hullHeight / 2 + S * 0.01, S * 0.0],
    [0, hullHeight / 2 + S * 0.01, S * 0.15],
    [0, hullHeight / 2 + S * 0.01, S * 0.3],
  ]

  dishPositions.forEach(([x, y, z]) => {
    const dish = new THREE.Mesh(dishGeom.clone())
    dish.position.set(x, y, z)
    dish.name = 'accent'
    shipGroup.add(dish)
  })

  // === POINT LIGHT ===
  const shipLight = new THREE.PointLight(0xffffff, 0.5, S * 2)
  shipLight.position.set(0, S * 0.1, -S * 0.1)
  shipGroup.add(shipLight)

  return shipGroup
}

/**
 * Creates Dendrite ship geometry (sleek scout)
 * Long needle fuselage, minimal fins, single large engine, whisker spines
 */
function createDendriteGeometry(): THREE.Group {
  const shipGroup = new THREE.Group()
  const S = SHIP_SCALE

  // === LONG NEEDLE HULL ===
  // Dendrite is 1.5x length, 0.5x width of Neuron
  const hullLength = S * 1.3
  const hullRadius = S * 0.03

  // Tapered cylinder for needle shape
  const hullGeom = new THREE.CylinderGeometry(
    hullRadius * 0.3,  // Nose (thin)
    hullRadius,        // Rear (wider)
    hullLength,
    12
  )
  const hull = new THREE.Mesh(hullGeom)
  hull.rotation.x = Math.PI / 2
  hull.position.z = S * 0.15
  hull.name = 'hull'
  shipGroup.add(hull)

  // === X-PATTERN DELTA FINS (4 small fins) ===
  const finGeom = new THREE.BufferGeometry()
  const finVerts = new Float32Array([
    // Triangle fin
    0, 0, S * 0.35,           // Root front
    0, 0, S * 0.55,           // Root rear
    S * 0.08, S * 0.08, S * 0.5,  // Tip
  ])
  finGeom.setAttribute('position', new THREE.BufferAttribute(finVerts, 3))
  finGeom.computeVertexNormals()

  // 4 fins in X-pattern (rotated 45 degrees)
  const finAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]
  finAngles.forEach(angle => {
    const fin = new THREE.Mesh(finGeom.clone())
    fin.rotation.z = angle
    fin.name = 'wing'
    shipGroup.add(fin)
  })

  // === SINGLE LARGE ENGINE ===
  const engineRadius = S * 0.04
  const engineLength = S * 0.2

  const engineGeom = new THREE.CylinderGeometry(
    engineRadius * 0.6,
    engineRadius,
    engineLength,
    12
  )
  const engine = new THREE.Mesh(engineGeom)
  engine.rotation.x = Math.PI / 2
  engine.position.set(0, 0, S * 0.65)
  engine.name = 'engine'
  shipGroup.add(engine)

  // Extended nozzle with glow rings
  const nozzleGeom = new THREE.TorusGeometry(engineRadius * 0.8, S * 0.005, 8, 16)
  const ringPositions = [S * 0.72, S * 0.76, S * 0.80]
  ringPositions.forEach(z => {
    const ring = new THREE.Mesh(nozzleGeom.clone())
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 0, z)
    ring.name = 'engineGlow'
    shipGroup.add(ring)
  })

  // Main engine glow
  const glowGeom = new THREE.CircleGeometry(engineRadius * 1.3, 16)
  const glow = new THREE.Mesh(glowGeom)
  glow.rotation.x = Math.PI / 2
  glow.position.set(0, 0, S * 0.76)
  glow.name = 'engineGlow'
  shipGroup.add(glow)

  const coreGeom = new THREE.CircleGeometry(engineRadius * 0.6, 12)
  const core = new THREE.Mesh(coreGeom)
  core.rotation.x = Math.PI / 2
  core.position.set(0, 0, S * 0.761)
  core.name = 'engineCore'
  shipGroup.add(core)

  // === BUBBLE COCKPIT ===
  const cockpitGeom = new THREE.SphereGeometry(S * 0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  const cockpit = new THREE.Mesh(cockpitGeom)
  cockpit.rotation.x = -Math.PI / 2
  cockpit.position.set(0, hullRadius * 0.8, -S * 0.35)
  cockpit.name = 'cockpit'
  shipGroup.add(cockpit)

  // === WHISKER SPINES (dendrite branches) ===
  const spineGeom = new THREE.CylinderGeometry(S * 0.002, S * 0.001, S * 0.15, 4)

  // 6 whiskers at various angles from the nose
  const spineData = [
    { angle: 0, tilt: 0.3, z: -S * 0.4 },
    { angle: Math.PI / 3, tilt: 0.25, z: -S * 0.35 },
    { angle: 2 * Math.PI / 3, tilt: 0.25, z: -S * 0.35 },
    { angle: Math.PI, tilt: 0.3, z: -S * 0.4 },
    { angle: 4 * Math.PI / 3, tilt: 0.25, z: -S * 0.35 },
    { angle: 5 * Math.PI / 3, tilt: 0.25, z: -S * 0.35 },
  ]

  spineData.forEach(({ angle, tilt, z }) => {
    const spine = new THREE.Mesh(spineGeom.clone())
    spine.rotation.x = tilt
    spine.rotation.z = angle
    spine.position.set(
      Math.cos(angle) * S * 0.02,
      Math.sin(angle) * S * 0.02,
      z
    )
    spine.name = 'accent'
    shipGroup.add(spine)
  })

  // === POINT LIGHT ===
  const shipLight = new THREE.PointLight(0xffffff, 0.5, S * 2)
  shipLight.position.set(0, S * 0.1, -S * 0.2)
  shipGroup.add(shipLight)

  return shipGroup
}

/**
 * Creates ship geometry based on ship type
 */
function createShipGeometry(shipType: ShipType): THREE.Group {
  switch (shipType) {
    case 'synapse':
      return createSynapseGeometry()
    case 'dendrite':
      return createDendriteGeometry()
    case 'neuron':
    default:
      return createNeuronGeometry()
  }
}

/**
 * Creates materials - red metallic hull with accent lighting
 */
function createShipMaterials(state: ShipStatus | undefined) {
  // Defensive: ensure we have valid colors even if state is undefined or unknown
  const safeState = state && state in STATE_COLORS ? state : 'idle'
  const accentColor = STATE_COLORS[safeState]
  const engineColor = ENGINE_COLORS[safeState]

  return {
    // Hull - bright cherry red (BasicMaterial for guaranteed visibility)
    hull: new THREE.MeshBasicMaterial({
      color: 0xdd4444,
      side: THREE.DoubleSide,
    }),
    // Wings - slightly darker red
    wing: new THREE.MeshBasicMaterial({
      color: 0xbb3333,
      side: THREE.DoubleSide,
    }),
    // Engine housing - dark grey
    engine: new THREE.MeshBasicMaterial({
      color: 0x444455,
    }),
    // Engine glow - subtle thruster glow
    engineGlow: new THREE.MeshBasicMaterial({
      color: engineColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    }),
    // Engine core - small bright center
    engineCore: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
    }),
    // Cockpit - bright tinted glass canopy
    cockpit: new THREE.MeshStandardMaterial({
      color: 0x66aacc,
      emissive: 0x224455,
      emissiveIntensity: 0.15,
      metalness: 0.1,
      roughness: 0.05,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }),
    // Accent lights - full brightness for small detail strips
    accent: new THREE.MeshBasicMaterial({
      color: accentColor,
    }),
  }
}

/**
 * Creates twin engine trail particle system
 */
function createEngineTrail(engineColor: number): {
  points: THREE.Points
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
} {
  const S = SHIP_SCALE
  const count = ENGINE_TRAIL_PARTICLES
  const engineSpacing = S * 0.055

  const positions = new Float32Array(count * 3)
  const particleData = new Float32Array(count * 4)

  for (let i = 0; i < count; i++) {
    // Alternate between left and right engine
    const isLeft = i % 2 === 0
    const engineX = isLeft ? engineSpacing : -engineSpacing

    positions[i * 3] = engineX
    positions[i * 3 + 1] = -S * 0.01
    positions[i * 3 + 2] = S * 0.52

    particleData[i * 4] = Math.random()
    particleData[i * 4 + 1] = 0.5 + Math.random() * 0.8
    particleData[i * 4 + 2] = 2 + Math.random() * 3
    particleData[i * 4 + 3] = Math.random() * Math.PI * 2
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aParticleData', new THREE.BufferAttribute(particleData, 4))

  const color = new THREE.Color(engineColor)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
    },
    vertexShader: `
      attribute vec4 aParticleData;
      uniform float uTime;

      varying float vAlpha;
      varying float vLife;

      void main() {
        float lifeOffset = aParticleData.x;
        float speed = aParticleData.y;
        float size = aParticleData.z;
        float angle = aParticleData.w;

        float life = mod(uTime * speed * 1.2 + lifeOffset, 1.0);
        vLife = life;

        // Trail flows backward from engine
        float trailLength = 0.2;
        vec3 pos = position;
        pos.z += life * trailLength;

        // Slight spread
        float spread = life * 0.015;
        pos.x += cos(angle) * spread;
        pos.y += sin(angle) * spread;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

        float lifeFade = 1.0 - life;
        gl_PointSize = size * lifeFade * (80.0 / -mvPosition.z);

        vAlpha = lifeFade * lifeFade * 0.35;

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      varying float vLife;

      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);

        float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;

        // Hot white core fading to color
        vec3 color = mix(vec3(1.0), uColor, vLife * 0.6 + 0.2);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 200

  return { points, geometry, material }
}

export const ShipModel3D: Component<ShipModel3DProps> = (props) => {
  const { scene } = useThree()
  let shipGroup: THREE.Group | null = null
  let materials: ReturnType<typeof createShipMaterials> | null = null
  let engineTrail: ReturnType<typeof createEngineTrail> | null = null

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    // Use ship type with fallback to 'neuron' for backwards compatibility
    const shipType = props.ship.shipType || 'neuron'
    shipGroup = createShipGeometry(shipType)
    materials = createShipMaterials(props.ship.state)

    engineTrail = createEngineTrail(getEngineColor(props.ship.state))
    shipGroup.add(engineTrail.points)

    shipGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && materials) {
        const materialKey = child.name as keyof typeof materials
        if (materials[materialKey]) {
          child.material = materials[materialKey]
        }
      }
    })

    const pos = getShipWorldPosition(props.ship)
    shipGroup.position.copy(pos)
    shipGroup.visible = props.isVisible

    sceneObj.add(shipGroup)
  })

  onCleanup(() => {
    const sceneObj = scene()
    if (sceneObj && shipGroup) {
      sceneObj.remove(shipGroup)
      shipGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
        if (child instanceof THREE.Points) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
    }
    if (engineTrail) {
      engineTrail.geometry.dispose()
      engineTrail.material.dispose()
    }
  })

  // Track target position for smooth interpolation
  const targetPosition = new THREE.Vector3()
  let positionInitialized = false

  // Track target rotation for smooth interpolation
  let targetRotationY = 0
  let currentRotationY = 0
  let rotationInitialized = false

  createEffect(() => {
    if (!shipGroup) return

    // CRITICAL FIX: For exploring ships, always use targetPosition as the source of truth
    // This prevents ships from disappearing when they arrive at synapses
    let pos = props.ship
    if (props.ship.state === 'exploring' && props.ship.targetPositionX !== undefined) {
      pos = {
        ...props.ship,
        positionX: props.ship.targetPositionX,
        positionY: props.ship.targetPositionY,
        positionZ: props.ship.targetPositionZ,
      }
    }

    const worldPos = getShipWorldPosition(pos)
    targetPosition.copy(worldPos)

    // Initialize position immediately on first set
    if (!positionInitialized) {
      shipGroup.position.copy(worldPos)
      positionInitialized = true
    }
    // Otherwise, position will be lerped in useFrame
  })

  // Update target rotation when ship rotationY changes
  createEffect(() => {
    if (props.ship.rotationY !== undefined) {
      targetRotationY = props.ship.rotationY
      // Initialize rotation immediately on first set
      if (!rotationInitialized && shipGroup) {
        currentRotationY = targetRotationY
        rotationInitialized = true
        console.log('[ShipModel3D] Initial rotation set for ship', props.ship.id.slice(0, 8),
          'rotationY:', (targetRotationY * 180 / Math.PI).toFixed(1) + '°')
      }
    }
  })

  // For deploying ships, use client-side interpolation to ensure smooth movement
  // This handles the case where server travel:position updates are delayed
  createEffect(() => {
    if (props.ship.state === 'deploying' && props.ship.targetPositionX !== undefined &&
        props.ship.startPositionX !== undefined && props.ship.travelStartTime && props.ship.travelDuration) {
      // Calculate current progress based on elapsed time (client-side)
      const elapsed = Date.now() - props.ship.travelStartTime
      const progress = Math.min(Math.max(elapsed / props.ship.travelDuration, 0), 1)

      // Client-side interpolation: x = start + (target - start) * progress
      // This ensures smooth animation even with delayed WebSocket updates
      const interpX = props.ship.startPositionX + (props.ship.targetPositionX - props.ship.startPositionX) * progress
      const interpY = props.ship.startPositionY + (props.ship.targetPositionY - props.ship.startPositionY) * progress
      const interpZ = props.ship.startPositionZ + (props.ship.targetPositionZ - props.ship.startPositionZ) * progress

      // Always use client-side interpolation for deploying ships
      // This ensures the "x += formula" smooth animation during travel
      const pos = getShipWorldPosition({
        ...props.ship,
        positionX: interpX,
        positionY: interpY,
        positionZ: interpZ
      })
      targetPosition.copy(pos)
    }
  })

  createEffect(() => {
    if (!shipGroup) return
    shipGroup.visible = props.isVisible
  })

  createEffect(() => {
    if (!shipGroup) return

    const newMaterials = createShipMaterials(props.ship.state)
    materials = newMaterials

    shipGroup.traverse((child) => {
      if (child instanceof THREE.PointLight) {
        child.color.setHex(getStateColor(props.ship.state))
      }
      if (child instanceof THREE.Mesh) {
        const materialKey = child.name as keyof typeof newMaterials
        if (newMaterials[materialKey]) {
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
          child.material = newMaterials[materialKey]
        }
      }
    })

    if (engineTrail) {
      const newColor = new THREE.Color(getEngineColor(props.ship.state))
      engineTrail.material.uniforms.uColor.value = newColor
    }
  })

  useFrame(({ clock }) => {
    if (!shipGroup || !props.isVisible) return

    const time = performance.now() * 0.001
    const deltaTime = Math.min(clock.getDelta(), 0.1)  // Cap delta to avoid jumps

    // Smooth position interpolation (lerp towards target)
    const lerpFactor = 1.0 - Math.exp(-4.0 * deltaTime)  // Same speed as AgentMarkers
    shipGroup.position.lerp(targetPosition, lerpFactor)

    // Smooth rotation interpolation toward target
    if (props.ship.state === 'deploying') {
      // Calculate shortest rotation path (handle angle wrapping)
      let rotDelta = targetRotationY - currentRotationY
      // Normalize to [-PI, PI] range
      while (rotDelta > Math.PI) rotDelta -= Math.PI * 2
      while (rotDelta < -Math.PI) rotDelta += Math.PI * 2
      // Slerp toward target
      currentRotationY += rotDelta * lerpFactor * 2  // Slightly faster rotation
      shipGroup.rotation.y = currentRotationY
    } else {
      // Gradually return to neutral rotation when not traveling
      currentRotationY *= (1.0 - lerpFactor * 0.5)
      shipGroup.rotation.y = currentRotationY
    }

    // Very subtle hover motion - reduced 75% to minimize camera jitter during follow
    // Applied as secondary rotation on top of travel direction
    shipGroup.rotation.x = Math.sin(time * 0.8) * 0.015
    shipGroup.rotation.z = Math.sin(time * 0.6) * 0.01
    shipGroup.position.y += Math.sin(time * 1.2) * 0.0005

    // Engine pulse based on state
    let pulseSpeed = 2.0
    let pulseMin = 0.6
    let pulseMax = 1.0

    switch (props.ship.state) {
      case 'idle':
        pulseSpeed = 1.5
        pulseMin = 0.5
        pulseMax = 0.8
        break
      case 'exploring':
        pulseSpeed = 3.5
        pulseMin = 0.7
        pulseMax = 1.0
        break
      case 'deploying':
        pulseSpeed = 6.0
        pulseMin = 0.8
        pulseMax = 1.0
        break
      case 'returning':
        pulseSpeed = 2.5
        pulseMin = 0.6
        pulseMax = 0.9
        break
    }

    const pulse = pulseMin + (Math.sin(time * pulseSpeed) * 0.5 + 0.5) * (pulseMax - pulseMin)

    // Update all engine glows (subtle pulse)
    shipGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.name === 'engineGlow' && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.opacity = pulse * 0.4
          child.scale.setScalar(0.95 + pulse * 0.08)
        }
        if (child.name === 'engineCore' && child.material instanceof THREE.MeshBasicMaterial) {
          const corePulse = 0.5 + Math.sin(time * pulseSpeed * 2) * 0.15
          child.material.opacity = corePulse
        }
      }
    })

    if (engineTrail) {
      engineTrail.material.uniforms.uTime.value = time
    }
  })

  return null
}

function getShipWorldPosition(ship: Ship): THREE.Vector3 {
  // Use same coordinate transformation as synapses for visual consistency
  const [x, y, z] = constrainToBrainShape(
    ship.positionX,
    ship.positionY,
    ship.positionZ
  )
  return new THREE.Vector3(x, y, z)
}

export default ShipModel3D
