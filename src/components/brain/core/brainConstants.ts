/**
 * Brain Visualization Constants
 *
 * Centralized constants for all brain visualization components.
 * Eliminates magic numbers scattered across components.
 */

// Brain shape scaling factors
export const BRAIN_SCALE = {
  x: 1.3,  // Wider
  y: 1.0,  // Normal height
  z: 1.1,  // Slightly deeper
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

// Trance mode
export const TRANCE_CONFIG = {
  timeScale: 0.05,  // 20x slowdown (1/20 = 0.05)
  normalScale: 1.0,
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

// Particle counts per LOD level (FEWER when zoomed in to prevent overexposure)
export const LOD_PARTICLE_COUNTS = {
  lod0: 25000,   // Close view - sparse to prevent washout
  lod1: 50000,   // Medium view - balanced
  lod2: 80000,   // Far view - full detail visible from distance
} as const
