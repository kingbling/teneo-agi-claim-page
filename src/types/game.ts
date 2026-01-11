// Portal Masterplan 2026 - Game Types

// ============================================================================
// SYNAPSE TYPES (Replacing 5 Space Tiers with 7 Synapse Types)
// ============================================================================

export type SynapseType = 'minor' | 'complex' | 'deep' | 'core' | 'rare' | 'legendary' | 'unique'

export type SynapseDistribution = 'fair_share' | 'lottery'

export interface SynapseTypeConfig {
  points: number              // Total points required to complete
  maxPerMin: number           // Maximum points/min a user can spend
  etaMinutes: number          // Base ETA at max spending rate
  maxExplorers: number        // Max concurrent explorers (-1 = unlimited)
  distribution: SynapseDistribution
  agiReward: number           // $AGI reward for completion
  brainXpReward: number       // Brain XP earned
  unlockBrainLevel: number    // Brain level required to explore
}

export const SYNAPSE_CONFIG: Record<SynapseType, SynapseTypeConfig> = {
  minor: {
    points: 6_000,
    maxPerMin: 100,
    etaMinutes: 60,
    maxExplorers: 1,
    distribution: 'fair_share',
    agiReward: 10,
    brainXpReward: 100,
    unlockBrainLevel: 1,
  },
  complex: {
    points: 120_000,
    maxPerMin: 200,
    etaMinutes: 720,         // 12 hours
    maxExplorers: 2,
    distribution: 'fair_share',
    agiReward: 200,
    brainXpReward: 500,
    unlockBrainLevel: 5,
  },
  deep: {
    points: 2_000_000,
    maxPerMin: 300,
    etaMinutes: 2880,        // 48 hours
    maxExplorers: 4,
    distribution: 'lottery',
    agiReward: 4_000,
    brainXpReward: 2_000,
    unlockBrainLevel: 20,
  },
  core: {
    points: 20_000_000,
    maxPerMin: 400,
    etaMinutes: 4320,        // 72 hours
    maxExplorers: 10,
    distribution: 'lottery',
    agiReward: 40_000,
    brainXpReward: 10_000,
    unlockBrainLevel: 50,
  },
  rare: {
    points: 50_000_000,
    maxPerMin: 500,
    etaMinutes: 10080,       // 1 week
    maxExplorers: -1,        // unlimited
    distribution: 'lottery',
    agiReward: 100_000,
    brainXpReward: 25_000,
    unlockBrainLevel: 100,
  },
  legendary: {
    points: 100_000_000,
    maxPerMin: 600,
    etaMinutes: 20160,       // 2 weeks
    maxExplorers: -1,
    distribution: 'lottery',
    agiReward: 200_000,
    brainXpReward: 50_000,
    unlockBrainLevel: 175,
  },
  unique: {
    points: 500_000_000,
    maxPerMin: 1000,
    etaMinutes: 43200,       // 30 days
    maxExplorers: -1,
    distribution: 'lottery',
    agiReward: 1_000_000,
    brainXpReward: 100_000,
    unlockBrainLevel: 248,
  },
}

// Synapse type order for sorting (least rare to most rare)
export const SYNAPSE_TYPE_ORDER: SynapseType[] = [
  'minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique'
]

// ============================================================================
// USER LEVELS (5 Levels Based on USDC Spent)
// ============================================================================

export type UserLevel = 1 | 2 | 3 | 4 | 5

export interface UserLevelConfig {
  minUSDC: number           // Minimum cumulative USDC spent
  multiplier: number        // Reward multiplier
  etaBoost: number          // ETA reduction percentage
  maxShips: number          // Max ships allowed
  label: string             // Display label
}

export const USER_LEVEL_CONFIG: Record<UserLevel, UserLevelConfig> = {
  1: { minUSDC: 0,    multiplier: 1.0, etaBoost: 0.00, maxShips: 1,  label: 'Explorer' },
  2: { minUSDC: 1,    multiplier: 1.2, etaBoost: 0.05, maxShips: 2,  label: 'Navigator' },
  3: { minUSDC: 10,   multiplier: 1.5, etaBoost: 0.12, maxShips: 3,  label: 'Voyager' },
  4: { minUSDC: 100,  multiplier: 1.9, etaBoost: 0.20, maxShips: 5,  label: 'Captain' },
  5: { minUSDC: 1000, multiplier: 2.4, etaBoost: 0.30, maxShips: 10, label: 'Admiral' },
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

// ============================================================================
// BRAIN LEVELS (248 Levels with Exponential XP Curve)
// ============================================================================

export interface BrainLevelConfig {
  baseXP: number            // XP required for level 1 -> 2
  growthRate: number        // % increase per level (e.g., 0.02 = 2%)
  maxLevel: number          // Maximum brain level
}

export const BRAIN_LEVEL_CONFIG: BrainLevelConfig = {
  baseXP: 1_000_000,        // 1M XP for level 1 -> 2
  growthRate: 0.02,         // +2% XP per level
  maxLevel: 248,
}

// Brain level milestones for ship unlocks
export const SHIP_UNLOCK_MILESTONES: Record<number, number> = {
  1: 1,     // Level 1: 1 ship
  10: 2,    // Level 10: 2 ships
  25: 3,    // Level 25: 3 ships
  50: 4,    // Level 50: 4 ships
  100: 5,   // Level 100: 5 ships
  150: 7,   // Level 150: 7 ships
  200: 10,  // Level 200: 10 ships
}

// Synapse type unlock levels
export const SYNAPSE_UNLOCK_LEVELS: Record<SynapseType, number> = {
  minor: 1,
  complex: 5,
  deep: 20,
  core: 50,
  rare: 100,
  legendary: 175,
  unique: 248,
}

export function getXPForLevel(level: number): number {
  if (level < 1) return 0
  if (level >= BRAIN_LEVEL_CONFIG.maxLevel) return Infinity
  return Math.floor(
    BRAIN_LEVEL_CONFIG.baseXP * Math.pow(1 + BRAIN_LEVEL_CONFIG.growthRate, level - 1)
  )
}

export function getTotalXPForLevel(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) {
    total += getXPForLevel(i)
  }
  return total
}

export function getLevelFromTotalXP(totalXP: number): number {
  let level = 1
  let xpNeeded = 0
  while (level < BRAIN_LEVEL_CONFIG.maxLevel) {
    xpNeeded += getXPForLevel(level)
    if (totalXP < xpNeeded) return level
    level++
  }
  return BRAIN_LEVEL_CONFIG.maxLevel
}

export function getMaxShipsForBrainLevel(brainLevel: number): number {
  let maxShips = 1
  const levels = Object.keys(SHIP_UNLOCK_MILESTONES).map(Number).sort((a, b) => a - b)
  for (const level of levels) {
    if (brainLevel >= level) {
      maxShips = SHIP_UNLOCK_MILESTONES[level]
    }
  }
  return maxShips
}

export function getUnlockedSynapseTypes(brainLevel: number): SynapseType[] {
  return SYNAPSE_TYPE_ORDER.filter(type => brainLevel >= SYNAPSE_UNLOCK_LEVELS[type])
}

// ============================================================================
// ETA CALCULATION (Collaboration with Diminishing Returns)
// ============================================================================

// Explorer boost per additional explorer (diminishing returns)
const EXPLORER_BOOSTS = [0, 0.07, 0.05, 0.04, 0.03, 0.02, 0.01]

export function calculateFinalETA(
  baseETAMinutes: number,
  explorerCount: number,
  userLevels: UserLevel[]
): number {
  // Explorer boost with diminishing returns (max ~22% total)
  let explorerBoost = 0
  for (let i = 1; i < explorerCount && i < EXPLORER_BOOSTS.length; i++) {
    explorerBoost += EXPLORER_BOOSTS[i]
  }
  // Additional explorers beyond 6 add 1% each
  if (explorerCount > 6) {
    explorerBoost += 0.01 * (explorerCount - 6)
  }

  // Level boost (average of all explorers)
  const avgLevelBoost = userLevels.reduce((sum, lvl) => {
    return sum + USER_LEVEL_CONFIG[lvl].etaBoost
  }, 0) / Math.max(userLevels.length, 1)

  // Formula: Final ETA = Base ETA x max(0.50, (1-ExplorerBoost) x (1-LevelBoost))
  // Minimum 50% of base ETA (max 50% reduction)
  const multiplier = Math.max(0.50, (1 - explorerBoost) * (1 - avgLevelBoost))
  return Math.ceil(baseETAMinutes * multiplier)
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
    description: 'Increases brain XP earned',
    cost: 200,
    effect: '+15% brain XP',
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
// ============================================================================

export interface RGBColor {
  r: number
  g: number
  b: number
}

export const SYNAPSE_TYPE_COLORS: Record<SynapseType, RGBColor> = {
  minor:     { r: 0.4, g: 0.6, b: 0.8 },  // Blue
  complex:   { r: 0.6, g: 0.4, b: 0.9 },  // Purple
  deep:      { r: 0.3, g: 0.8, b: 0.5 },  // Teal
  core:      { r: 1.0, g: 0.8, b: 0.0 },  // Gold
  rare:      { r: 0.9, g: 0.3, b: 0.3 },  // Red-pink
  legendary: { r: 0.9, g: 0.5, b: 1.0 },  // Bright magenta
  unique:    { r: 1.0, g: 0.9, b: 0.2 },  // Brilliant yellow
}

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

export function getSynapseTypeLabel(type: SynapseType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function getUserLevelLabel(level: UserLevel): string {
  return `L${level} ${USER_LEVEL_CONFIG[level].label}`
}

export function formatPoints(points: number): string {
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
