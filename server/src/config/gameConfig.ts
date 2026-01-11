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
  multiplier: number        // Reward multiplier
  etaBoost: number          // ETA reduction percentage
  maxShips: number          // Max ships allowed at this level
  label: string             // Display label
}

export const USER_LEVEL_CONFIG: Record<UserLevel, UserLevelConfig> = {
  1: { minUSDC: 0,    multiplier: 1.0, etaBoost: 0.00, maxShips: 1,  label: 'Explorer' },
  2: { minUSDC: 1,    multiplier: 1.2, etaBoost: 0.05, maxShips: 2,  label: 'Navigator' },
  3: { minUSDC: 10,   multiplier: 1.5, etaBoost: 0.12, maxShips: 3,  label: 'Voyager' },
  4: { minUSDC: 100,  multiplier: 1.9, etaBoost: 0.20, maxShips: 5,  label: 'Captain' },
  5: { minUSDC: 1000, multiplier: 2.4, etaBoost: 0.30, maxShips: 10, label: 'Admiral' },
} as const

export function calculateUserLevel(totalUSDCSpent: number): UserLevel {
  if (totalUSDCSpent >= 1000) return 5
  if (totalUSDCSpent >= 100) return 4
  if (totalUSDCSpent >= 10) return 3
  if (totalUSDCSpent >= 1) return 2
  return 1
}

// ============================================================================
// MASTERPLAN 2026: BRAIN LEVELS (248 Levels with exponential XP)
// ============================================================================

export const BRAIN_LEVEL_CONFIG = {
  baseXP: 1_000_000,        // XP required for level 1 -> 2
  growthRate: 0.02,         // +2% XP per level
  maxLevel: 248,
} as const

export const SHIP_UNLOCK_MILESTONES: Record<number, number> = {
  1: 1,     // Level 1: 1 ship
  10: 2,    // Level 10: 2 ships
  25: 3,    // Level 25: 3 ships
  50: 4,    // Level 50: 4 ships
  100: 5,   // Level 100: 5 ships
  150: 7,   // Level 150: 7 ships
  200: 10,  // Level 200: 10 ships
}

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
// MASTERPLAN 2026: ETA CALCULATION (Collaboration with Diminishing Returns)
// ============================================================================

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
  const multiplier = Math.max(0.50, (1 - explorerBoost) * (1 - avgLevelBoost))
  return Math.ceil(baseETAMinutes * multiplier)
}

// ============================================================================
// MASTERPLAN 2026: REWARD DISTRIBUTION
// ============================================================================

export interface LotteryResult {
  winnerId: string
  winnerShipId: string
  reward: number
  totalParticipants: number
  totalPoints: number
}

export function runLotteryDistribution(
  explorers: Array<{ userId: string; shipId: string; pointsContributed: number }>,
  totalReward: number
): LotteryResult {
  const totalPoints = explorers.reduce((sum, e) => sum + e.pointsContributed, 0)
  const random = Math.random() * totalPoints

  let cumulative = 0
  for (const explorer of explorers) {
    cumulative += explorer.pointsContributed
    if (random <= cumulative) {
      return {
        winnerId: explorer.userId,
        winnerShipId: explorer.shipId,
        reward: totalReward,
        totalParticipants: explorers.length,
        totalPoints,
      }
    }
  }

  // Fallback to last explorer (shouldn't happen)
  const last = explorers[explorers.length - 1]
  return {
    winnerId: last.userId,
    winnerShipId: last.shipId,
    reward: totalReward,
    totalParticipants: explorers.length,
    totalPoints,
  }
}

export function runFairShareDistribution(
  explorers: Array<{ userId: string; shipId: string; pointsContributed: number }>,
  totalReward: number
): Array<{ userId: string; shipId: string; reward: number }> {
  const totalPoints = explorers.reduce((sum, e) => sum + e.pointsContributed, 0)

  return explorers.map(explorer => ({
    userId: explorer.userId,
    shipId: explorer.shipId,
    reward: Math.floor((explorer.pointsContributed / totalPoints) * totalReward),
  }))
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
    description: 'Increases brain XP earned',
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

// ============================================================================
// LEGACY: AGENT COSTS (Kept for migration compatibility)
// ============================================================================

export const COSTS = {
  AGENT_BASE_COST: 100,               // Base cost to create an agent
  TRAIT_COST_PER_LEVEL: 50,           // Additional cost per trait level
  REPAIR_COST_MULTIPLIER: 0.5,        // Repair costs 50% of creation cost
  STARTING_USER_POINTS: 1000,         // Points given to new users
  STARTING_AGENT_FUEL: 500,           // Initial fuel for new agents
  REPAIR_FUEL_AMOUNT: 100,            // Fuel given after repair
} as const

// ============ SIMULATION RATES ============

export const RATES = {
  TICK_INTERVAL_MS: 1000,             // Milliseconds per simulation tick
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
  tranceDurationBase?: number    // Base trance duration (seconds)
  tranceDurationPerLevel?: number // Additional duration per level
  tranceSlowdownPerLevel?: number // Time scale slowdown per level
  tranceTimeScale?: number       // Base time scale during trance
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
  // Trance trait (client-side only, will be migrated to server)
  trance: {
    type: 'trance',
    tranceDurationBase: 5,             // Base 5 seconds
    tranceDurationPerLevel: 3,         // +3 seconds per level
    tranceSlowdownPerLevel: 0.05,      // +5% slowdown per level
    tranceTimeScale: 0.05,             // 20x slowdown (0.05 = 1/20)
  },
  // Extended traits (for future use)
  solver: {
    type: 'solver',
    // To be implemented
  },
  pioneer: {
    type: 'pioneer',
    // To be implemented
  },
  networker: {
    type: 'networker',
    // To be implemented
  },
  beacon: {
    type: 'beacon',
    // To be implemented
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
 * Calculate agent creation cost based on traits
 */
export function calculateAgentCost(traits: Array<{ type: string; level: number }>): number {
  const traitCost = traits.reduce((sum, t) => sum + t.level * COSTS.TRAIT_COST_PER_LEVEL, 0)
  return COSTS.AGENT_BASE_COST + traitCost
}

/**
 * Calculate repair cost (50% of creation cost)
 */
export function calculateRepairCost(creationCost: number): number {
  return Math.ceil(creationCost * COSTS.REPAIR_COST_MULTIPLIER)
}

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
 * Calculate search speed with swift trait
 */
export function calculateSearchSpeed(swiftLevel: number): number {
  const speedBonus = 1 + (swiftLevel * TRAIT_EFFECTS.swift.speedBonus!)
  return RATES.BASE_SEARCH_SPEED * speedBonus
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

/**
 * Calculate trance duration based on trait level
 */
export function calculateTranceDuration(tranceLevel: number): number {
  const { tranceDurationBase, tranceDurationPerLevel } = TRAIT_EFFECTS.trance
  return (tranceDurationBase! + tranceLevel * tranceDurationPerLevel!) * 1000  // Returns milliseconds
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
  brainLevel: typeof BRAIN_LEVEL_CONFIG
  shipUnlocks: typeof SHIP_UNLOCK_MILESTONES
  synapseUnlocks: typeof SYNAPSE_UNLOCK_LEVELS
  items: typeof ITEM_DEFINITIONS

  // Legacy (for migration)
  costs: typeof COSTS
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
    brainLevel: BRAIN_LEVEL_CONFIG,
    shipUnlocks: SHIP_UNLOCK_MILESTONES,
    synapseUnlocks: SYNAPSE_UNLOCK_LEVELS,
    items: ITEM_DEFINITIONS,

    // Legacy (for migration)
    costs: COSTS,
    rates: RATES,
    world: WORLD,
    traits: TRAIT_EFFECTS,
    tiers: {
      limits: TIER_LIMITS,
      stakingBonuses: STAKING_BONUSES,
    },
    version: '2.0.0',  // Masterplan 2026
  }
}
