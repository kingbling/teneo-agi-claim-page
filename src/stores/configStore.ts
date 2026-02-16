/**
 * Game Configuration Store - SolidJS Version
 *
 * Fetches game configuration from server.
 */

import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import { API_URL } from '@/constants/api'
import { log } from '@/utils/logger'
import { initSynapseColors } from '@/constants/colors'
import type { SynapseTypeDTO } from '@/types/api.generated'

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
  synapseTypes: SynapseTypeDTO[]
  isLoaded: boolean
  error: string | null
}

function createConfigStore() {
  const [state, setState] = createStore<ConfigState>({
    gameConfig: null,
    synapseTypes: [],
    isLoaded: false,
    error: null,
  })

  // Fetch config from server
  const fetchConfig = async () => {
    try {
      // Fetch game config and synapse types in parallel
      const [configRes, typesRes] = await Promise.all([
        fetch(`${API_URL}/api/config`),
        fetch(`${API_URL}/api/synapse-types`),
      ])

      if (!configRes.ok) {
        throw new Error(`Failed to fetch config: ${configRes.statusText}`)
      }
      const config: GameConfig = await configRes.json()

      let synapseTypes: SynapseTypeDTO[] = []
      if (typesRes.ok) {
        const typesData = await typesRes.json()
        synapseTypes = typesData.synapseTypes || []
      } else {
        log.config.warn('Failed to fetch synapse types, using empty list')
      }

      // Initialize color system from DB types
      if (synapseTypes.length > 0) {
        initSynapseColors(synapseTypes)
      }

      setState({ gameConfig: config, synapseTypes, isLoaded: true, error: null })
    } catch (error) {
      log.config.error('Failed to fetch game config:', error)
      setState({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoaded: false
      })
    }
  }

  // Get synapse type config by name
  const getSynapseType = (name: string): SynapseTypeDTO | undefined => {
    return state.synapseTypes.find(t => t.name === name)
  }

  // Get synapse type by index (for binary decode)
  const getSynapseTypeByIndex = (index: number): SynapseTypeDTO | undefined => {
    return state.synapseTypes[index]
  }

  return {
    // State accessors (reactive getters)
    get gameConfig() { return state.gameConfig },
    get synapseTypes() { return state.synapseTypes },
    get isLoaded() { return state.isLoaded },
    get error() { return state.error },

    // Actions
    fetchConfig,
    getSynapseType,
    getSynapseTypeByIndex,
  }
}

// Create singleton store outside component tree
export const configStore = createRoot(createConfigStore)

export default configStore
