/**
 * Game Configuration - Single Source of Truth
 * Portal Masterplan 2026
 *
 * All game constants, formulas, and balance parameters are defined here.
 * This configuration is exposed via /api/config endpoint and used by both
 * server-side simulation and client-side predictions.
 */

// ============================================================================
// MASTERPLAN 2026: SYNAPSE TYPES (7 Types replacing 5 Space Tiers)
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
  unlockUserLevel: UserLevel  // User level (USDC-based) required to explore
}

export const SYNAPSE_CONFIG: Record<SynapseType, SynapseTypeConfig> = {
  minor: {
    points: 6_000,
    maxPerMin: 100,
    etaMinutes: 60,
    maxExplorers: 1,         // Single player only (V1 Masterplan)
    distribution: 'fair_share',
    agiReward: 10,
    unlockUserLevel: 1,      // All users
  },
  complex: {
    points: 120_000,
    maxPerMin: 200,
    etaMinutes: 720,         // 12 hours
    maxExplorers: 1,         // Single player only (V1 Masterplan)
    distribution: 'fair_share',
    agiReward: 200,
    unlockUserLevel: 1,      // All users
  },
  deep: {
    points: 2_000_000,
    maxPerMin: 300,
    etaMinutes: 2880,        // 48 hours
    maxExplorers: 1,         // Single player only (V1 Masterplan)
    distribution: 'fair_share',
    agiReward: 4_000,
    unlockUserLevel: 1,      // All users
  },
  core: {
    points: 20_000_000,
    maxPerMin: 400,
    etaMinutes: 4320,        // 72 hours
    maxExplorers: 1,         // Single player only (V1 Masterplan)
    distribution: 'fair_share',
    agiReward: 40_000,
    unlockUserLevel: 1,      // All users
  },
  rare: {
    points: 50_000_000,
    maxPerMin: 500,
    etaMinutes: 10080,       // 1 week
    maxExplorers: 1,         // Single player only (V1 Masterplan)
    distribution: 'fair_share',
    agiReward: 100_000,
    unlockUserLevel: 2,      // $1+ USDC (Navigator)
  },
  legendary: {
    points: 100_000_000,
    maxPerMin: 600,
    etaMinutes: 20160,       // 2 weeks
    maxExplorers: 1,         // Single player only (V1 Masterplan)
    distribution: 'fair_share',
    agiReward: 200_000,
    unlockUserLevel: 3,      // $10+ USDC (Voyager)
  },
  unique: {
    points: 500_000_000,
    maxPerMin: 1000,
    etaMinutes: 43200,       // 30 days
    maxExplorers: 1,         // Single player only (V1 Masterplan)
    distribution: 'fair_share',
    agiReward: 1_000_000,
    unlockUserLevel: 4,      // $100+ USDC (Captain)
  },
} as const

export const SYNAPSE_TYPE_ORDER: SynapseType[] = [
  'minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique'
]

// ============================================================================
// MASTERPLAN 2026: USER LEVELS (5 Levels based on USDC spent)
// ============================================================================

export type UserLevel = 1 | 2 | 3 | 4 | 5

export interface UserLevelConfig {
  minUSDC: number           // Minimum cumulative USDC spent
  multiplier: number        // Points per minute multiplier (Masterplan 2026: Level Boost)
  maxShips: number          // Max ships allowed at this level
  label: string             // Display label
}

export const USER_LEVEL_CONFIG: Record<UserLevel, UserLevelConfig> = {
  1: { minUSDC: 0,    multiplier: 1.0, maxShips: 1,  label: 'Explorer' },
  2: { minUSDC: 1,    multiplier: 1.2, maxShips: 2,  label: 'Navigator' },
  3: { minUSDC: 10,   multiplier: 1.5, maxShips: 3,  label: 'Voyager' },
  4: { minUSDC: 100,  multiplier: 1.9, maxShips: 5,  label: 'Captain' },
  5: { minUSDC: 1000, multiplier: 2.4, maxShips: 10, label: 'Admiral' },
} as const

export function calculateUserLevel(totalUSDCSpent: number): UserLevel {
  if (totalUSDCSpent >= 1000) return 5
  if (totalUSDCSpent >= 100) return 4
  if (totalUSDCSpent >= 10) return 3
  if (totalUSDCSpent >= 1) return 2
  return 1
}

// ============================================================================
// V1 MASTERPLAN: ETA CALCULATION (User Level + Items, Single Player)
// ============================================================================

/**
 * Calculate final ETA based on user level and item bonuses.
 * Higher user level = faster completion (FOMO mechanic).
 *
 * Formula: Final ETA = Base ETA / (levelMultiplier * (1 + itemSpeedBoost))
 *
 * @param baseETAMinutes - Base ETA from synapse config
 * @param userLevel - User's level (1-5)
 * @param itemSpeedBoost - Speed boost from items (0.0 - 1.0, e.g., 0.10 = +10%)
 */
export function calculateFinalETA(
  baseETAMinutes: number,
  userLevel: UserLevel,
  itemSpeedBoost: number = 0
): number {
  const levelMultiplier = USER_LEVEL_CONFIG[userLevel].multiplier
  const totalBoost = levelMultiplier * (1 + itemSpeedBoost)
  return Math.ceil(baseETAMinutes / totalBoost)
}

// ============================================================================
// MASTERPLAN 2026: ITEM SHOP
// ============================================================================

export type ItemType = 'speed_boost' | 'luck_charm' | 'xp_amplifier' | 'radar' | 'cloak'

export interface ItemDefinition {
  id: ItemType
  name: string
  description: string
  cost: number              // Cost in $AGENTIC
  effectValue: number       // Numeric effect value
  durationMinutes: number | null   // Duration, null = permanent/single-use
}

export const ITEM_DEFINITIONS: Record<ItemType, ItemDefinition> = {
  speed_boost: {
    id: 'speed_boost',
    name: 'Speed Boost',
    description: 'Increases points contribution rate',
    cost: 100,
    effectValue: 0.10,      // +10%
    durationMinutes: 60,
  },
  luck_charm: {
    id: 'luck_charm',
    name: 'Luck Charm',
    description: 'Increases lottery winning odds',
    cost: 250,
    effectValue: 0.05,      // +5%
    durationMinutes: null,  // Single use
  },
  xp_amplifier: {
    id: 'xp_amplifier',
    name: 'XP Amplifier',
    description: 'Increases XP rewards earned',
    cost: 200,
    effectValue: 0.15,      // +15%
    durationMinutes: 60,
  },
  radar: {
    id: 'radar',
    name: 'Radar',
    description: 'Reveals hidden high-value synapses',
    cost: 500,
    effectValue: 1,
    durationMinutes: 30,
  },
  cloak: {
    id: 'cloak',
    name: 'Cloak',
    description: 'Hide your ship from explorer count',
    cost: 1000,
    effectValue: 1,
    durationMinutes: 60,
  },
} as const

// ============ SIMULATION RATES ============

export const RATES = {
  TICK_INTERVAL_MS: 1000,             // Milliseconds per simulation tick
  TIME_MULTIPLIER: 288,               // Speed up simulation (288 = 24h in 5min real time)
  BASE_BURN_RATE: 1.0,                // Points per second (base fuel consumption)
  BASE_SPEED: 0.1,                    // Units per second (traveling speed)
  BASE_SEARCH_SPEED: 0.03,            // Units per second (searching/exploring speed)
  DETECTION_RADIUS: 0.08,             // Radius to auto-detect undiscovered spaces
  WANDER_TURN_RATE: 0.3,              // Direction change rate for organic movement (radians)
} as const

// ============ WORLD BOUNDS ============

export const WORLD = {
  BRAIN_BOUNDS_MIN: -1.3,             // Minimum coordinate (X, Y, Z)
  BRAIN_BOUNDS_MAX: 1.3,              // Maximum coordinate (X, Y, Z)
  BOUNDARY_MARGIN: 0.2,               // Start steering when this close to edge
  BOUNDARY_STEER_STRENGTH: 0.5,       // Steering force away from boundaries
} as const

// ============ TRAIT DEFINITIONS ============

export interface TraitEffect {
  type: string
  speedBonus?: number        // Multiplier for travel/search speed
  burnPenalty?: number       // Increase to fuel consumption
  burnReduction?: number     // Decrease to fuel consumption
  speedPenalty?: number      // Decrease to travel/search speed
  discoveryBonus?: number    // Bonus to space discovery probability
  solvePenalty?: number      // Penalty to solve speed
  lootBonus?: number         // Bonus to loot rewards
  luckyChance?: number       // Chance per level for lucky bonus
  luckyMultiplier?: number   // Multiplier when lucky triggers
  collaborativeBonus?: number // Bonus per additional solver
}

export const TRAIT_EFFECTS: Record<string, TraitEffect> = {
  explorer: {
    type: 'explorer',
    discoveryBonus: 0.25,              // +25% solve probability per level
    solvePenalty: 0.30,                // -30% solve speed (not implemented yet)
  },
  efficient: {
    type: 'efficient',
    burnReduction: 0.15,               // -15% fuel burn per level (max 75%)
    speedPenalty: 0.30,                // -30% travel speed (not implemented yet)
  },
  staker: {
    type: 'staker',
    lootBonus: 0.10,                   // +10% loot rewards per level
  },
  swift: {
    type: 'swift',
    speedBonus: 0.20,                  // +20% travel/search speed per level
    burnPenalty: 0.40,                 // +40% burn rate (not implemented yet)
  },
  lucky: {
    type: 'lucky',
    luckyChance: 0.05,                 // 5% chance per level
    luckyMultiplier: 1.5,              // 1.5x loot when triggers
  },
  collaborative: {
    type: 'collaborative',
    collaborativeBonus: 0.10,          // +10% solve bonus per other solver, per level
  },
} as const

// ============ TIER SYSTEM ============

export const TIER_LIMITS: Record<string, number> = {
  free: 10,      // Development: increased from 1
  bronze: 3,
  silver: 5,
  gold: 10,
  platinum: 25,
  diamond: 100,
} as const

export const STAKING_BONUSES = [
  { threshold: 1000, bonus: 250 },
  { threshold: 10000, bonus: 1000 },
  { threshold: 100000, bonus: Infinity },
] as const

/**
 * Calculate agent limit based on tier and staking amount
 */
export function getAgentLimit(tier: string, stakedAmount: number): number {
  const baseLimit = TIER_LIMITS[tier]
  if (baseLimit === undefined) {
    throw new Error(`Unknown tier: ${tier}`)
  }

  // Check staking bonuses in descending order
  for (let i = STAKING_BONUSES.length - 1; i >= 0; i--) {
    const { threshold, bonus } = STAKING_BONUSES[i]
    if (stakedAmount >= threshold) {
      return bonus === Infinity ? Infinity : baseLimit + bonus
    }
  }

  return baseLimit
}

// ============ CALCULATION HELPERS ============

/**
 * Calculate effective burn rate with efficient trait
 */
export function calculateBurnRate(efficientLevel: number): number {
  const reduction = efficientLevel * TRAIT_EFFECTS.efficient.burnReduction!
  const maxReduction = 0.75 // Max 75% reduction
  return RATES.BASE_BURN_RATE * (1 - Math.min(reduction, maxReduction))
}

/**
 * Calculate travel time based on distance and swift trait
 */
export function calculateTravelTime(distance: number, swiftLevel: number): number {
  const speedBoost = 1 + (swiftLevel * TRAIT_EFFECTS.swift.speedBonus!)
  return (distance / RATES.BASE_SPEED) * 1000 / speedBoost  // Returns milliseconds
}

/**
 * Calculate solve probability with explorer and collaborative traits
 */
export function calculateSolveProbability(
  baseProbability: number,
  explorerLevel: number,
  collaborativeLevel: number,
  solverCount: number
): number {
  const explorerBonus = 1 + (explorerLevel * TRAIT_EFFECTS.explorer.discoveryBonus!)
  const collaborativeBonus = 1 + ((solverCount - 1) * TRAIT_EFFECTS.collaborative.collaborativeBonus! * (collaborativeLevel + 1))

  return baseProbability * explorerBonus * collaborativeBonus * solverCount
}

/**
 * Calculate loot share with staker and lucky traits
 */
export function calculateLootShare(
  totalLoot: number,
  stakerLevel: number,
  luckyLevel: number,
  solverCount: number
): number {
  const baseShare = totalLoot / solverCount
  const stakerBonus = 1 + (stakerLevel * TRAIT_EFFECTS.staker.lootBonus!)

  // Lucky trait: chance per level for bonus multiplier
  const luckyChance = TRAIT_EFFECTS.lucky.luckyChance! * luckyLevel
  const luckyBonus = Math.random() < luckyChance ? TRAIT_EFFECTS.lucky.luckyMultiplier! : 1.0

  return Math.floor(baseShare * stakerBonus * luckyBonus)
}

// ============ CONFIG EXPORT ============

/**
 * Complete game configuration for API endpoint
 * This is what gets sent to the client via /api/config
 */
export interface GameConfig {
  // Masterplan 2026
  synapseTypes: typeof SYNAPSE_CONFIG
  userLevels: typeof USER_LEVEL_CONFIG
  items: typeof ITEM_DEFINITIONS

  rates: typeof RATES
  world: typeof WORLD
  traits: typeof TRAIT_EFFECTS
  tiers: {
    limits: typeof TIER_LIMITS
    stakingBonuses: typeof STAKING_BONUSES
  }
  version: string
}

export function getGameConfig(): GameConfig {
  return {
    // Masterplan 2026
    synapseTypes: SYNAPSE_CONFIG,
    userLevels: USER_LEVEL_CONFIG,
    items: ITEM_DEFINITIONS,

    rates: RATES,
    world: WORLD,
    traits: TRAIT_EFFECTS,
    tiers: {
      limits: TIER_LIMITS,
      stakingBonuses: STAKING_BONUSES,
    },
    version: '3.0.0',  // Masterplan 2026 - Single USDC-based level system
  }
}
