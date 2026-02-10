/**
 * Brain Visualization Constants
 *
 * Centralized constants for all brain visualization components.
 * Eliminates magic numbers scattered across components.
 */

// Brain shape scaling factors
export const BRAIN_SCALE = {
  x: 1.35 * 1.2,  // Must match SynapseParticlesMinimal scaling
  y: 1.0 * 1.2,
  z: 1.15 * 1.2,
} as const

// Particle counts
export const PARTICLE_COUNTS = {
  synapseParticles: 80000,    // Background brain particles
  burnParticles: 5,           // Per active agent
  electronParticles: 60,      // Per discovery burst
  discoveryBurstParticles: 24,// Per discovery
} as const

// Animation speeds
export const ANIMATION_SPEEDS = {
  brainGlowPulse: 0.1,        // Radians per second
  burnParticleLife: 2,        // Seconds
  electronFlowDuration: 2,    // Seconds
  discoveryBurstDuration: 2,  // Seconds
  agentPulse: 2,              // Pulse frequency multiplier
} as const

// Colors by tier/state
export const TIER_COLORS = {
  common: { r: 0.4, g: 0.5, b: 0.6 },
  trait: { r: 0.3, g: 0.7, b: 0.9 },
  team: { r: 0.9, g: 0.6, b: 0.2 },
  legendary: { r: 1.0, g: 0.84, b: 0.0 },
  mythic: { r: 0.9, g: 0.3, b: 0.9 },
} as const

export const STATE_COLORS = {
  idle: { r: 0.5, g: 0.5, b: 0.5 },
  wandering: { r: 0.3, g: 0.8, b: 0.4 },
  deploying: { r: 0.2, g: 0.6, b: 1.0 },
  solving: { r: 1.0, g: 0.8, b: 0.2 },
  limping_home: { r: 0.8, g: 0.3, b: 0.3 },
  exhausted: { r: 0.4, g: 0.2, b: 0.2 },
} as const

export const DISCOVERY_COLORS = [
  { r: 1.0, g: 0.84, b: 0.0 },  // Gold
  { r: 1.0, g: 0.9, b: 0.4 },   // Light gold
  { r: 0.9, g: 0.7, b: 0.2 },   // Amber
] as const

// Space state colors
export const SPACE_STATE_COLORS = {
  undiscovered: { r: 0.3, g: 0.4, b: 0.5 },
  being_solved: { r: 0.8, g: 0.6, b: 0.2 },
  discovered: { r: 0.2, g: 0.8, b: 0.4 },
} as const

// Network visualization
export const NETWORK_CONFIG = {
  maxConnectionDistance: 2.0,
  particlesPerConnection: 12,
  baseSpeed: 0.5,
  maxSpeedMultiplier: 5.0,
} as const

// Camera defaults - closer default for better detail, limited max to prevent over-exposure
export const CAMERA_CONFIG = {
  defaultPosition: [0, 0, 3] as const,
  // Brain visual center (Y offset accounts for brain bounds -0.6 to 0.8)
  brainCenter: [0, 0.1, 0] as const,
  fov: 50,
  minDistance: 1.5,
  maxDistance: 5,
} as const

// LOD thresholds (camera distance)
export const LOD_THRESHOLDS = {
  lod0: 2.5,  // Close view
  lod1: 4.0,  // Medium view
  lod2: Infinity, // Far view
} as const

// Particle counts per LOD level - reduced for cleaner visuals and better performance
export const LOD_PARTICLE_COUNTS = {
  lod0: 1000,    // Close view - very sparse for ship focus (reduced from 1500 for performance)
  lod1: 2500,    // Medium view (reduced from 3000)
  lod2: 4000,    // Far view (reduced from 5000)
} as const


/**
 * Constrain positions to be INSIDE the brain volume
 * Uses brain shape deformations to ensure particles follow the brain's grooves and bulges
 * This function is shared between SpaceMarkers, ElectronFlow, and other components
 * to ensure consistent coordinate transformations.
 */
export function constrainToBrainShape(rawX: number, rawY: number, rawZ: number): [number, number, number] {
  // Start with normalized position
  let x = rawX
  let y = rawY
  let z = rawZ

  // Calculate distance from origin
  let r = Math.sqrt(x * x + y * y + z * z)

  // If outside unit sphere, normalize to surface first
  if (r > 1.0) {
    x /= r
    y /= r
    z /= r
    r = 1.0
  }

  // Get direction for shape calculation (unit sphere position)
  const dirX = r > 0.001 ? x / r : 0
  const dirY = r > 0.001 ? y / r : 0
  const dirZ = r > 0.001 ? z / r : 0

  // Apply brain shape deformations (matching SynapseParticlesMinimal)
  // Central groove (longitudinal fissure)
  const grooveDepth = Math.exp(-Math.abs(dirX) * 6) * 0.15
  const grooveFactor = 1.0 - grooveDepth * Math.max(0, dirY)

  // Regional bulges that define the brain's distinctive shape
  const frontalBulge = Math.max(0, dirZ * 0.5 + 0.5) * Math.max(0, dirY * 0.5 + 0.3) * 0.2
  const temporalBulge = Math.max(0, Math.abs(dirX) - 0.3) * Math.max(0, -dirY * 0.5 + 0.3) * Math.max(0, dirZ * 0.5 + 0.5) * 0.25
  const occipitalBulge = Math.max(0, -dirZ * 0.5 + 0.3) * Math.max(0, dirY * 0.3 + 0.3) * 0.15
  const cerebellumBulge = Math.max(0, -dirZ * 0.5 + 0.2) * Math.max(0, -dirY * 0.5 + 0.2) * (1 - Math.abs(dirX) * 0.8) * 0.2
  const bottomFlatten = Math.max(0, -dirY - 0.5) * 0.15

  // Combined shape modifier
  const shapeMod = grooveFactor + frontalBulge + temporalBulge + occipitalBulge + cerebellumBulge - bottomFlatten

  // Apply shape and keep INSIDE the volume (multiply by r to maintain depth distribution)
  const finalR = r * shapeMod

  // Apply final scaling with BRAIN_SCALE
  return [
    dirX * finalR * BRAIN_SCALE.x,
    dirY * finalR * BRAIN_SCALE.y,
    dirZ * finalR * BRAIN_SCALE.z
  ]
}
