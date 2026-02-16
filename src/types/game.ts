// Portal Masterplan 2026 - Game Types
// Single USDC-based Level System (5 Levels)

// ============================================================================
// SYNAPSE TYPES — Now dynamic from database via configStore.synapseTypes
// ============================================================================

// SynapseType is now a string (DB-driven, no longer a fixed union)
export type SynapseType = string

export type SynapseDistribution = 'fair_share' | 'lottery'

export type UserLevel = 1 | 2 | 3 | 4 | 5

// ============================================================================
// USER LEVELS (5 Levels Based on USDC Spent - Masterplan 2026)
// ============================================================================

export interface UserLevelConfig {
  minUSDC: number           // Minimum cumulative USDC spent
  multiplier: number        // Points per minute multiplier (Level Boost)
  maxShips: number          // Max ships allowed
  label: string             // Display label
}

export const USER_LEVEL_CONFIG: Record<UserLevel, UserLevelConfig> = {
  1: { minUSDC: 0,    multiplier: 1.0, maxShips: 1,  label: 'Explorer' },
  2: { minUSDC: 1,    multiplier: 1.2, maxShips: 2,  label: 'Navigator' },
  3: { minUSDC: 10,   multiplier: 1.5, maxShips: 3,  label: 'Voyager' },
  4: { minUSDC: 100,  multiplier: 1.9, maxShips: 5,  label: 'Captain' },
  5: { minUSDC: 1000, multiplier: 2.4, maxShips: 10, label: 'Admiral' },
}

export function calculateUserLevel(totalUSDCSpent: number): UserLevel {
  if (totalUSDCSpent >= 1000) return 5
  if (totalUSDCSpent >= 100) return 4
  if (totalUSDCSpent >= 10) return 3
  if (totalUSDCSpent >= 1) return 2
  return 1
}

export function getUserLevelConfig(level: UserLevel): UserLevelConfig {
  return USER_LEVEL_CONFIG[level]
}

export function getMaxShipsForUserLevel(userLevel: UserLevel): number {
  return USER_LEVEL_CONFIG[userLevel].maxShips
}

// ============================================================================
// COLORS AND VISUAL CONSTANTS
// Re-export from centralized colors module
// ============================================================================

export { SYNAPSE_COLORS, rgbToRgb, rgbToRgba, getSynapseRgbColor } from '@/constants/colors'
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

export function getUserLevelLabel(level: UserLevel): string {
  return `L${level} ${USER_LEVEL_CONFIG[level].label}`
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
