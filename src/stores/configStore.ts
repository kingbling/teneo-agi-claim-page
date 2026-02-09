/**
 * Game Configuration Store - SolidJS Version
 *
 * Fetches game configuration from server.
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

  return {
    // State accessors (reactive getters)
    get gameConfig() { return state.gameConfig },
    get isLoaded() { return state.isLoaded },
    get error() { return state.error },

    // Actions
    fetchConfig,
  }
}

// Create singleton store outside component tree
export const configStore = createRoot(createConfigStore)

export default configStore
