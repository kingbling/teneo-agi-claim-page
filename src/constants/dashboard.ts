/**
 * Dashboard-related constants
 */

// Re-export BRAIN_SCALE from brainConstants for convenience
export { BRAIN_SCALE } from '@/components/brain/core/brainConstants'

// Loot thresholds for visual effects (based on AGI reward amounts)
export const LOOT_THRESHOLDS = {
  MIN_NOTIFY: 100,      // Minimum loot to trigger discovery burst
  DEEP: 4_000,          // Deep synapse threshold
  LEGENDARY: 200_000,   // Legendary synapse threshold
  UNIQUE: 1_000_000,    // Unique synapse threshold
}
