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

// Ship zoom configuration - for close-up ship inspection
export const SHIP_ZOOM_CONFIG = {
  closeZoomDistance: 0.5,        // Camera offset when zooming to ship
  modelVisibleThreshold: 1.0,    // Show 3D model when camera < this distance
  transitionZone: 0.3,           // Opacity blend range
  zoomOffset: [0.7, 0.25, 0.5] as const,  // Camera offset from ship position [x, y, z] - zoomed out more
  animationDuration: 800,        // Zoom animation ms
  minDistanceOverride: 0.3,      // Temporary minDistance during ship zoom
} as const

// Ship follow configuration - for smooth camera tracking during ship movement
export const SHIP_FOLLOW_CONFIG = {
  followLerpSpeed: 1.2,          // How fast camera follows ship (lower = smoother, ship appears to move ahead)
  followOffset: [0.7, 0.25, 0.5] as const,  // Camera offset while following [x, y, z]
  initialZoomDuration: 800,      // Initial zoom animation duration ms
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

// ============================================================================
// SHIP MARKER SHADER CONSTANTS
// Extracted from AgentMarkers.tsx for maintainability
// ============================================================================

// Ship marker rendering
export const SHIP_MARKER_CONFIG = {
  pointSize: 25.0,             // Base point size (increased for visibility)
  distanceScale: 60.0,         // Distance-based scaling divisor
  minPointSize: 15.0,          // Minimum clamped point size (increased)
  maxPointSize: 40.0,          // Maximum clamped point size (increased)
} as const

// Ship state pulse animations (frequency in Hz, amplitude as multiplier)
// Ship state pulse animations - matches ShipStatus type: 'idle' | 'solving' | 'deploying' | 'returning'
export const SHIP_STATE_PULSE = {
  idle: { frequency: 1.0, amplitude: 0.1 },       // Subtle breathing
  solving: { frequency: 1.5, amplitude: 0.1 },    // Working at synapse (orbiting)
  deploying: { frequency: 5.0, amplitude: 0.25 }, // Rapid pulse (moving)
  returning: { frequency: 2.0, amplitude: 0.15 }, // Gentle pulse (moving)
} as const

// Ship marker shape (diamond)
export const SHIP_SHAPE_CONFIG = {
  coreInner: 0.2,              // Core smoothstep start
  coreOuter: 0.28,             // Core smoothstep end
  glowInner: 0.25,             // Glow smoothstep start
  glowOuter: 0.5,              // Glow smoothstep end
  coreBrightness: 1.3,         // Core color multiplier
  glowBrightness: 0.7,         // Glow color multiplier
} as const

// Ship engine glow
export const SHIP_ENGINE_CONFIG = {
  radius: 0.12,                // Engine glow radius
  idleIntensity: 0.25,         // Idle engine brightness
  activeIntensity: 0.6,        // Active engine brightness
  idleFlickerFreq: 1.5,        // Idle flicker frequency
  activeFlickerFreq: 10.0,     // Active flicker frequency
  idleFlickerAmp: 0.2,         // Idle flicker amplitude
  activeFlickerAmp: 0.3,       // Active flicker amplitude
  idleColor: [0.4, 0.7, 1.0],  // Soft cyan for idle
  activeColor: [1.0, 0.5, 0.1], // Orange for active
} as const

// World ship (ambient / other-user) marker rendering
export const WORLD_SHIP_CONFIG = {
  pointSize: 20.0,               // Base point size
  distanceScale: 65.0,           // Distance-based scaling divisor
  minPointSize: 12.0,            // Minimum clamped point size
  maxPointSize: 35.0,            // Maximum clamped point size
  color: [0.9, 0.85, 0.7] as const, // Warm white-gold (contrasts with blue synapse cloud)
  fadeOutDuration: 1.0,          // Seconds to fade out when going idle
} as const

// Ship state colors (RGB values for shader) - keyed by ShipStatus
export const SHIP_STATE_COLORS: Record<'idle' | 'solving' | 'deploying' | 'returning', readonly [number, number, number]> = {
  idle: [1.0, 0.9, 0.2],       // Bright yellow/gold for visibility
  solving: [0.0, 0.87, 0.87],  // Bright cyan (ship at synapse)
  deploying: [0.87, 0.67, 0.0],  // Bright orange (traveling)
  returning: [0.53, 0.87, 0.53], // Bright green
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
