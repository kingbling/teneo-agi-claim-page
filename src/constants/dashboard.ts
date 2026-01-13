/**
 * Dashboard-related constants
 *
 * Centralized magic numbers and configuration values
 * to make the codebase more maintainable.
 */

// Brain visualization scale factors
export const BRAIN_SCALE = {
  x: 1.3,
  y: 1.0,
  z: 1.1,
} as const

// Masterplan 2026: Synapse type colors
export const SYNAPSE_TYPE_COLORS = {
  minor: '#60A5FA',     // Blue
  complex: '#A78BFA',   // Purple
  deep: '#2DD4BF',      // Teal
  core: '#FBBF24',      // Yellow/Gold
  rare: '#F87171',      // Red
  legendary: '#F472B6', // Pink
  unique: '#FCD34D',    // Amber/Gold
} as const

// Masterplan 2026: User level colors
export const USER_LEVEL_COLORS = {
  1: '#6B7280', // Gray - Novice
  2: '#3B82F6', // Blue - Apprentice
  3: '#10B981', // Green - Explorer
  4: '#F59E0B', // Amber - Veteran
  5: '#8B5CF6', // Purple - Elite
} as const

// Toast notification durations (ms)
export const TOAST_DURATIONS = {
  SHORT: 1500,
  DEFAULT: 2000,
  MEDIUM: 3000,
  LONG: 5000,
} as const

// Masterplan 2026: Synapse discovery loot thresholds (based on $AGI rewards)
export const LOOT_THRESHOLDS = {
  MIN_NOTIFY: 10,       // Minor synapses: 10 $AGI
  CONFETTI: 1000,       // Deep synapses: 4000 $AGI - confetti for big wins
  DEEP: 4000,           // Deep synapse reward
  CORE: 40000,          // Core synapse reward
  RARE: 100000,         // Rare synapse reward
  LEGENDARY: 200000,    // Legendary synapse reward
  UNIQUE: 1000000,      // Unique synapse reward
} as const

// Brain region classification thresholds
export const REGION_THRESHOLDS = {
  BOUNDARY: 0.3,  // Position boundary for region classification
} as const

// Camera and LOD settings
export const CAMERA_SETTINGS = {
  DEFAULT_DISTANCE: 5,
  MIN_DISTANCE: 1.5,
  MAX_DISTANCE: 5,
  LOD_UPDATE_INTERVAL: 500,  // ms
  LOD_THRESHOLDS: {
    MEDIUM: 2.5,   // Switch to LOD 1
    FAR: 4,        // Switch to LOD 2
  },
} as const
