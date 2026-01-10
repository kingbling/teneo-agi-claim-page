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

// Agent fuel thresholds (points)
export const FUEL_THRESHOLDS = {
  LOW: 500,        // Agents below this need refueling
  CRITICAL: 100,   // Agents in critical fuel state
} as const

// Fuel bar percentage thresholds
export const FUEL_PERCENT_THRESHOLDS = {
  CRITICAL: 20,    // Below this is critical (red)
  LOW: 50,         // Below this is low (orange/warning)
} as const

// Toast notification durations (ms)
export const TOAST_DURATIONS = {
  SHORT: 1500,
  DEFAULT: 2000,
  MEDIUM: 3000,
  LONG: 5000,
} as const

// Discovery loot thresholds
export const LOOT_THRESHOLDS = {
  MIN_NOTIFY: 50,      // Minimum loot to show notification
  CONFETTI: 100,       // Loot amount to trigger confetti
  TEAM: 100,           // Team tier threshold
  LEGENDARY: 200,      // Legendary tier threshold
  MYTHIC: 500,         // Mythic tier threshold
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
