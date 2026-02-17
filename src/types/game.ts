// Portal Masterplan 2026 - Game Types
// Single USDC-based Level System (5 Levels)

// ============================================================================
// SYNAPSE TYPES — Now dynamic from database via configStore.synapseTypes
// ============================================================================

// SynapseType is now a string (DB-driven, no longer a fixed union)
export type SynapseType = string

export type UserLevel = 1 | 2 | 3 | 4 | 5

// ============================================================================
// COLORS AND VISUAL CONSTANTS
// Re-export from centralized colors module
// ============================================================================

export { SYNAPSE_COLORS, rgbToRgb, getSynapseRgbColor } from '@/constants/colors'
export type { RGBColor, SynapseColorConfig } from '@/constants/colors'

export const USER_LEVEL_COLORS: Record<UserLevel, string> = {
  1: '#6B7280',  // Gray
  2: '#3B82F6',  // Blue
  3: '#10B981',  // Green
  4: '#F59E0B',  // Amber
  5: '#8B5CF6',  // Purple
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getSynapseTypeLabel(type: SynapseType | undefined): string {
  const t = type || 'minor'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function formatPoints(points: number | undefined | null): string {
  if (points == null) return '0'
  if (points >= 1_000_000_000) return `${(points / 1_000_000_000).toFixed(1)}B`
  if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(1)}M`
  if (points >= 1_000) return `${(points / 1_000).toFixed(1)}K`
  return points.toString()
}

export function formatETA(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  return `${days}d ${hours}h`
}
