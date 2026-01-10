/**
 * Game Configuration - Single Source of Truth
 *
 * All game constants, formulas, and balance parameters are defined here.
 * This configuration is exposed via /api/config endpoint and used by both
 * server-side simulation and client-side predictions.
 */

// ============ AGENT COSTS ============

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
    costs: COSTS,
    rates: RATES,
    world: WORLD,
    traits: TRAIT_EFFECTS,
    tiers: {
      limits: TIER_LIMITS,
      stakingBonuses: STAKING_BONUSES,
    },
    version: '1.0.0',
  }
}
