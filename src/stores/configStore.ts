/**
 * Game Configuration Store - SolidJS Version
 *
 * Fetches game configuration from server and provides helper methods
 * for client-side calculations and predictions.
 */

import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import { API_URL } from '@/constants/api'
import { log } from '@/utils/logger'

// ============ TYPES ============

export interface GameConfig {
  costs: {
    AGENT_BASE_COST: number
    TRAIT_COST_PER_LEVEL: number
    REPAIR_COST_MULTIPLIER: number
    STARTING_USER_POINTS: number
    STARTING_AGENT_FUEL: number
    REPAIR_FUEL_AMOUNT: number
  }
  rates: {
    TICK_INTERVAL_MS: number
    BASE_BURN_RATE: number
    BASE_SPEED: number
    BASE_SEARCH_SPEED: number
    DETECTION_RADIUS: number
    WANDER_TURN_RATE: number
  }
  world: {
    BRAIN_BOUNDS_MIN: number
    BRAIN_BOUNDS_MAX: number
    BOUNDARY_MARGIN: number
    BOUNDARY_STEER_STRENGTH: number
  }
  traits: Record<string, TraitEffect>
  tiers: {
    limits: Record<string, number>
    stakingBonuses: Array<{ threshold: number; bonus: number }>
  }
  version: string
}

export interface TraitEffect {
  type: string
  speedBonus?: number
  burnPenalty?: number
  burnReduction?: number
  speedPenalty?: number
  discoveryBonus?: number
  solvePenalty?: number
  lootBonus?: number
  luckyChance?: number
  luckyMultiplier?: number
  collaborativeBonus?: number
}

export interface AgentTrait {
  type: string
  level: number
}

// ============ STORE ============

interface ConfigState {
  gameConfig: GameConfig | null
  isLoaded: boolean
  error: string | null
}

function createConfigStore() {
  const [state, setState] = createStore<ConfigState>({
    gameConfig: null,
    isLoaded: false,
    error: null,
  })

  // Fetch config from server
  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/api/config`)
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`)
      }
      const config: GameConfig = await response.json()
      setState({ gameConfig: config, isLoaded: true, error: null })
    } catch (error) {
      log.config.error('Failed to fetch game config:', error)
      setState({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoaded: false
      })
    }
  }

  // Calculate agent creation cost
  const calculateAgentCost = (traits: AgentTrait[]): number => {
    const config = state.gameConfig
    if (!config) throw new Error('Game config not loaded')

    const traitCost = traits.reduce(
      (sum, t) => sum + t.level * config.costs.TRAIT_COST_PER_LEVEL,
      0
    )
    return config.costs.AGENT_BASE_COST + traitCost
  }

  // Calculate repair cost (50% of creation cost)
  const calculateRepairCost = (creationCost: number): number => {
    const config = state.gameConfig
    if (!config) throw new Error('Game config not loaded')

    return Math.ceil(creationCost * config.costs.REPAIR_COST_MULTIPLIER)
  }

  // Calculate effective burn rate with efficient trait
  const calculateBurnRate = (efficientLevel: number): number => {
    const config = state.gameConfig
    if (!config) throw new Error('Game config not loaded')

    const efficientTrait = config.traits.efficient
    if (!efficientTrait?.burnReduction) return config.rates.BASE_BURN_RATE

    const reduction = efficientLevel * efficientTrait.burnReduction
    const maxReduction = 0.75 // Max 75% reduction
    return config.rates.BASE_BURN_RATE * (1 - Math.min(reduction, maxReduction))
  }

  // Calculate travel time based on distance and swift trait
  const calculateTravelTime = (distance: number, swiftLevel: number): number => {
    const config = state.gameConfig
    if (!config) throw new Error('Game config not loaded')

    const swiftTrait = config.traits.swift
    const speedBonus = swiftTrait?.speedBonus
      ? 1 + swiftLevel * swiftTrait.speedBonus
      : 1

    return (distance / config.rates.BASE_SPEED) * 1000 / speedBonus // Returns milliseconds
  }

  // Calculate fuel cost for travel
  const calculateTravelFuelCost = (
    distance: number,
    swiftLevel: number,
    efficientLevel: number
  ): number => {
    const travelTime = calculateTravelTime(distance, swiftLevel)
    const burnRate = calculateBurnRate(efficientLevel)
    return Math.ceil((travelTime / 1000) * burnRate)
  }

  // Calculate search speed with swift trait
  const calculateSearchSpeed = (swiftLevel: number): number => {
    const config = state.gameConfig
    if (!config) throw new Error('Game config not loaded')

    const swiftTrait = config.traits.swift
    const speedBonus = swiftTrait?.speedBonus
      ? 1 + swiftLevel * swiftTrait.speedBonus
      : 1

    return config.rates.BASE_SEARCH_SPEED * speedBonus
  }

  // Get trait multiplier value
  const getTraitMultiplier = (traitType: string, property: keyof TraitEffect): number => {
    const config = state.gameConfig
    if (!config) throw new Error('Game config not loaded')

    const trait = config.traits[traitType]
    if (!trait) return 0

    const value = trait[property] as number | undefined
    return value ?? 0
  }

  // Get agent limit based on tier and staking
  const getAgentLimit = (tier: string, stakedAmount: number): number => {
    const config = state.gameConfig
    if (!config) throw new Error('Game config not loaded')

    const baseLimit = config.tiers.limits[tier] ?? config.tiers.limits.free
    if (baseLimit === undefined) {
      throw new Error(`Unknown tier: ${tier}`)
    }

    // Check staking bonuses in descending order
    for (let i = config.tiers.stakingBonuses.length - 1; i >= 0; i--) {
      const { threshold, bonus } = config.tiers.stakingBonuses[i]
      if (stakedAmount >= threshold) {
        return bonus === Infinity ? Infinity : baseLimit + bonus
      }
    }

    return baseLimit
  }

  // Check if position is within brain bounds
  const isPositionInBounds = (x: number, y: number, z: number): boolean => {
    const config = state.gameConfig
    if (!config) throw new Error('Game config not loaded')

    const { BRAIN_BOUNDS_MIN, BRAIN_BOUNDS_MAX } = config.world
    return (
      x >= BRAIN_BOUNDS_MIN &&
      x <= BRAIN_BOUNDS_MAX &&
      y >= BRAIN_BOUNDS_MIN &&
      y <= BRAIN_BOUNDS_MAX &&
      z >= BRAIN_BOUNDS_MIN &&
      z <= BRAIN_BOUNDS_MAX
    )
  }

  return {
    // State accessors (reactive getters)
    get gameConfig() { return state.gameConfig },
    get isLoaded() { return state.isLoaded },
    get error() { return state.error },

    // Actions
    fetchConfig,

    // Helper methods
    calculateAgentCost,
    calculateRepairCost,
    calculateBurnRate,
    calculateTravelTime,
    calculateTravelFuelCost,
    calculateSearchSpeed,
    getTraitMultiplier,
    getAgentLimit,
    isPositionInBounds,
  }
}

// Create singleton store outside component tree
export const configStore = createRoot(createConfigStore)

// Legacy export for compatibility
export const useConfigStore = () => configStore
export default configStore
