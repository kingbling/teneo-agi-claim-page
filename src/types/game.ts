// Portal Masterplan 2026 - Game Types
// Single USDC-based Level System (5 Levels)

// Import SYNAPSE_TYPE_ORDER for use in functions below
import { SYNAPSE_TYPE_ORDER } from '@/constants/colors'

// ============================================================================
// SYNAPSE TYPES (7 Types)
// ============================================================================

export type SynapseType = 'minor' | 'complex' | 'deep' | 'core' | 'rare' | 'legendary' | 'unique'

export type SynapseDistribution = 'fair_share' | 'lottery'

export type UserLevel = 1 | 2 | 3 | 4 | 5

export interface SynapseTypeConfig {
  points: number              // Total points required to complete
  maxPerMin: number           // Maximum points/min a user can spend
  etaMinutes: number          // Base ETA at max spending rate
  maxExplorers: number        // Max concurrent explorers (-1 = unlimited)
  distribution: SynapseDistribution
  agiReward: number           // $AGI reward for completion
  unlockUserLevel: UserLevel  // User level (USDC-based) required to explore
}

export const SYNAPSE_CONFIG: Record<SynapseType, SynapseTypeConfig> = {
  minor: {
    points: 6_000,
    maxPerMin: 100,
    etaMinutes: 60,
    maxExplorers: 1,         // V1 Masterplan: Single player only
    distribution: 'fair_share',
    agiReward: 10,
    unlockUserLevel: 1,      // All users
  },
  complex: {
    points: 120_000,
    maxPerMin: 200,
    etaMinutes: 720,         // 12 hours
    maxExplorers: 1,         // V1 Masterplan: Single player only
    distribution: 'fair_share',
    agiReward: 200,
    unlockUserLevel: 1,      // All users
  },
  deep: {
    points: 2_000_000,
    maxPerMin: 300,
    etaMinutes: 2880,        // 48 hours
    maxExplorers: 1,         // V1 Masterplan: Single player only
    distribution: 'fair_share',
    agiReward: 4_000,
    unlockUserLevel: 1,      // All users
  },
  core: {
    points: 20_000_000,
    maxPerMin: 400,
    etaMinutes: 4320,        // 72 hours
    maxExplorers: 1,         // V1 Masterplan: Single player only
    distribution: 'fair_share',
    agiReward: 40_000,
    unlockUserLevel: 1,      // All users
  },
  rare: {
    points: 50_000_000,
    maxPerMin: 500,
    etaMinutes: 10080,       // 1 week
    maxExplorers: 1,         // V1 Masterplan: Single player only
    distribution: 'fair_share',
    agiReward: 100_000,
    unlockUserLevel: 2,      // $1+ USDC (Navigator)
  },
  legendary: {
    points: 100_000_000,
    maxPerMin: 600,
    etaMinutes: 20160,       // 2 weeks
    maxExplorers: 1,         // V1 Masterplan: Single player only
    distribution: 'fair_share',
    agiReward: 200_000,
    unlockUserLevel: 3,      // $10+ USDC (Voyager)
  },
  unique: {
    points: 500_000_000,
    maxPerMin: 1000,
    etaMinutes: 43200,       // 30 days
    maxExplorers: 1,         // V1 Masterplan: Single player only
    distribution: 'fair_share',
    agiReward: 1_000_000,
    unlockUserLevel: 4,      // $100+ USDC (Captain)
  },
}

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

export function getUnlockedSynapseTypes(userLevel: UserLevel): SynapseType[] {
  return SYNAPSE_TYPE_ORDER.filter(type => userLevel >= SYNAPSE_CONFIG[type].unlockUserLevel)
}

// ============================================================================
// ITEM SYSTEM
// ============================================================================

export type ItemType = 'speed_boost' | 'luck_charm' | 'xp_amplifier' | 'radar' | 'cloak'

export interface ItemDefinition {
  id: ItemType
  name: string
  description: string
  cost: number              // Cost in $AGENTIC
  effect: string            // Human-readable effect
  effectValue: number       // Numeric effect value
  duration: number | null   // Duration in minutes, null = permanent
}

export const ITEM_DEFINITIONS: Record<ItemType, ItemDefinition> = {
  speed_boost: {
    id: 'speed_boost',
    name: 'Speed Boost',
    description: 'Increases points contribution rate',
    cost: 100,
    effect: '+10% points/min',
    effectValue: 0.10,
    duration: 60,           // 1 hour
  },
  luck_charm: {
    id: 'luck_charm',
    name: 'Luck Charm',
    description: 'Increases lottery winning odds',
    cost: 250,
    effect: '+5% lottery odds',
    effectValue: 0.05,
    duration: null,         // Permanent (single use)
  },
  xp_amplifier: {
    id: 'xp_amplifier',
    name: 'XP Amplifier',
    description: 'Increases XP rewards earned',
    cost: 200,
    effect: '+15% XP rewards',
    effectValue: 0.15,
    duration: 60,           // 1 hour
  },
  radar: {
    id: 'radar',
    name: 'Radar',
    description: 'Reveals hidden high-value synapses',
    cost: 500,
    effect: 'Shows hidden synapses',
    effectValue: 1,
    duration: 30,           // 30 minutes
  },
  cloak: {
    id: 'cloak',
    name: 'Cloak',
    description: 'Hide your ship from explorer count',
    cost: 1000,
    effect: 'Hide from explorer count',
    effectValue: 1,
    duration: 60,           // 1 hour
  },
}

// ============================================================================
// COLORS AND VISUAL CONSTANTS
// Re-export from centralized colors module
// ============================================================================

export { SYNAPSE_COLORS, rgbToRgb, rgbToRgba, getSynapseRgbColor, SYNAPSE_TYPE_ORDER } from '@/constants/colors'
export type { RGBColor, SynapseColorConfig } from '@/constants/colors'

// Legacy export for backwards compatibility - maps to SYNAPSE_COLORS.rgb
import { SYNAPSE_COLORS } from '@/constants/colors'
export const SYNAPSE_TYPE_COLORS = Object.fromEntries(
  Object.entries(SYNAPSE_COLORS).map(([k, v]) => [k, v.rgb])
) as Record<SynapseType, { r: number; g: number; b: number }>

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
