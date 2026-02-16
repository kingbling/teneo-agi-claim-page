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
import type { SynapseTypeDTO, ShipTypeDTO } from '@/types/api.generated'

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
  shipTypes: ShipTypeDTO[]
  enabledRegions: string[]
  isLoaded: boolean
  error: string | null
}

function createConfigStore() {
  const [state, setState] = createStore<ConfigState>({
    gameConfig: null,
    synapseTypes: [],
    shipTypes: [],
    enabledRegions: [],
    isLoaded: false,
    error: null,
  })

  // Fetch config from server
  const fetchConfig = async () => {
    try {
      // Fetch game config, synapse types, ship types, and enabled regions in parallel
      const [configRes, typesRes, shipTypesRes, brainPartsRes] = await Promise.all([
        fetch(`${API_URL}/api/config`),
        fetch(`${API_URL}/api/synapse-types`),
        fetch(`${API_URL}/api/ship-types`),
        fetch(`${API_URL}/api/brain-parts`),
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

      let shipTypes: ShipTypeDTO[] = []
      if (shipTypesRes.ok) {
        const shipTypesData = await shipTypesRes.json()
        shipTypes = shipTypesData.shipTypes || []
      } else {
        log.config.warn('Failed to fetch ship types, using empty list')
      }

      let enabledRegions: string[] = []
      if (brainPartsRes.ok) {
        const brainPartsData = await brainPartsRes.json()
        enabledRegions = brainPartsData.enabledRegions || []
      } else {
        log.config.warn('Failed to fetch brain parts, using empty list')
      }

      // Initialize color system from DB types
      if (synapseTypes.length > 0) {
        initSynapseColors(synapseTypes)
      }

      setState({ gameConfig: config, synapseTypes, shipTypes, enabledRegions, isLoaded: true, error: null })
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

  // Get ship type config by name
  const getShipType = (name: string): ShipTypeDTO | undefined => {
    return state.shipTypes.find(t => t.name === name)
  }

  return {
    // State accessors (reactive getters)
    get gameConfig() { return state.gameConfig },
    get synapseTypes() { return state.synapseTypes },
    get shipTypes() { return state.shipTypes },
    get enabledRegions() { return state.enabledRegions },
    get isLoaded() { return state.isLoaded },
    get error() { return state.error },

    // Actions
    fetchConfig,
    getSynapseType,
    getSynapseTypeByIndex,
    getShipType,
  }
}

// Create singleton store outside component tree
export const configStore = createRoot(createConfigStore)

export default configStore
