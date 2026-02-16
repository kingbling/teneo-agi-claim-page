/**
 * Synapse Utilities - Shared helper functions for synapse operations
 */

import type { SynapseType } from '@/types/game'

/**
 * Get the dominant synapse type from a type count record
 * Returns the synapse type with the highest count, or 'minor' as default
 */
export function getDominantSynapseType(
  typeCounts: Record<SynapseType, number> | undefined
): SynapseType {
  if (!typeCounts || Object.keys(typeCounts).length === 0) {
    return 'minor'
  }

  let maxCount = 0
  let dominantType: SynapseType = 'minor'

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count
      dominantType = type as SynapseType
    }
  }

  return dominantType
}

/**
 * Format synapse type for display
 */
export function formatSynapseType(type: SynapseType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Calculate synapse completion percentage
 */
export function getSynapseProgress(
  pointsAccumulated: number,
  pointsRequired: number
): number {
  if (pointsRequired <= 0) return 0
  return Math.min(100, (pointsAccumulated / pointsRequired) * 100)
}
