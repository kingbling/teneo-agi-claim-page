import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  type SynapseType,
  SYNAPSE_CONFIG,
  formatPoints,
  formatETA,
  getSynapseTypeLabel,
} from '@/types/game'
import { userStore } from './userStore'
import { shipStore } from './shipStore'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}

// ============================================================================
// MASTERPLAN 2026: EXPLORATION STORE
// Manages synapse exploration UI state, spending controls, and collaboration
// ============================================================================

// Synapse for exploration
export interface ExplorableSynapse {
  id: string
  positionX: number
  positionY: number
  positionZ: number
  region: string
  zone: string
  synapseType: SynapseType
  state: 'undiscovered' | 'being_explored' | 'completed'

  // Points system
  pointsRequired: number
  pointsAccumulated: number
  currentEtaMinutes: number | null

  // Explorers
  explorerCount: number
  maxExplorers: number

  // Rewards
  agiReward: number
  brainXpReward: number

  // Sector
  sectorId: string | null

  // User's contribution (if exploring)
  userContribution?: number
  userShipId?: string
  userPointsPerMin?: number
}

// Explorer info for collaboration display
export interface Collaborator {
  shipId: string
  userId: string
  shipName: string
  userName?: string
  pointsContributed: number
  pointsPerMinute: number
  contributionPercent: number
  joinedAt: number
  isCurrentUser: boolean
}

// Exploration dialog state
export interface ExplorationDialogState {
  isOpen: boolean
  synapse: ExplorableSynapse | null
  selectedShipId: string | null
  spendingRate: number
  isStarting: boolean
  error: string | null
}

// Store State
export interface ExplorationState {
  // Current Exploration (for active synapse panel)
  activeSynapse: ExplorableSynapse | null
  collaborators: Collaborator[]
  isLoadingCollaborators: boolean

  // Exploration Dialog (for starting new exploration)
  explorationDialog: ExplorationDialogState

  // Available Synapses (for synapse browser)
  nearbySynapses: ExplorableSynapse[]
  isLoadingNearbySynapses: boolean

  // Spending Rate History (for quick selection)
  recentSpendingRates: number[]

  // UI State
  showExplorationPanel: boolean
  showSynapseBrowser: boolean
}

const initialDialogState: ExplorationDialogState = {
  isOpen: false,
  synapse: null,
  selectedShipId: null,
  spendingRate: 100,  // Default spending rate
  isStarting: false,
  error: null,
}

const initialState: ExplorationState = {
  activeSynapse: null,
  collaborators: [],
  isLoadingCollaborators: false,

  explorationDialog: initialDialogState,

  nearbySynapses: [],
  isLoadingNearbySynapses: false,

  recentSpendingRates: [50, 100, 200, 300],  // Common spending rates

  showExplorationPanel: true,
  showSynapseBrowser: false,
}

function createExplorationStore() {
  const [state, setState] = createStore<ExplorationState>({ ...initialState })

  // ============ ACTIVE EXPLORATION ============

  const setActiveSynapse = (synapse: ExplorableSynapse | null) => {
    setState({ activeSynapse: synapse })
    if (synapse) {
      refreshCollaborators()
    } else {
      setState({ collaborators: [] })
    }
  }

  const refreshActiveSynapse = async () => {
    if (!state.activeSynapse) return

    try {
      const response = await fetch(`${API_URL}/api/synapses/${state.activeSynapse.id}`)
      if (!response.ok) return

      const synapse = await response.json()
      setState({ activeSynapse: synapse })
    } catch (error) {
      console.error('Failed to refresh active synapse:', error)
    }
  }

  const refreshCollaborators = async () => {
    if (!state.activeSynapse) return

    setState({ isLoadingCollaborators: true })
    try {
      const response = await fetch(`${API_URL}/api/synapses/${state.activeSynapse.id}/explorers`)
      if (!response.ok) {
        setState({ isLoadingCollaborators: false })
        return
      }

      const explorers = await response.json()
      const userId = userStore.userId

      // Calculate contribution percentages
      const totalPoints = explorers.reduce((sum: number, e: Collaborator) => sum + e.pointsContributed, 0)

      const collaborators: Collaborator[] = explorers.map((e: Collaborator) => ({
        ...e,
        contributionPercent: totalPoints > 0 ? (e.pointsContributed / totalPoints) * 100 : 0,
        isCurrentUser: e.userId === userId,
      }))

      setState({ collaborators, isLoadingCollaborators: false })
    } catch (error) {
      console.error('Failed to fetch collaborators:', error)
      setState({ isLoadingCollaborators: false })
    }
  }

  // ============ EXPLORATION DIALOG ============

  const openExplorationDialog = (synapse: ExplorableSynapse) => {
    const idleShips = shipStore.userShips.filter(s => s.state === 'idle')
    const config = SYNAPSE_CONFIG[synapse.synapseType]

    setState({
      explorationDialog: {
        isOpen: true,
        synapse,
        selectedShipId: idleShips.length > 0 ? idleShips[0].id : null,
        spendingRate: Math.min(100, config.maxPerMin),  // Start at 100 or max for this type
        isStarting: false,
        error: null,
      },
    })
  }

  const closeExplorationDialog = () => {
    setState({ explorationDialog: initialDialogState })
  }

  const setDialogShip = (shipId: string | null) => {
    setState('explorationDialog', { ...state.explorationDialog, selectedShipId: shipId })
  }

  const setDialogSpendingRate = (rate: number) => {
    if (!state.explorationDialog.synapse) return

    const config = SYNAPSE_CONFIG[state.explorationDialog.synapse.synapseType]
    const clampedRate = Math.max(10, Math.min(rate, config.maxPerMin))

    setState('explorationDialog', { ...state.explorationDialog, spendingRate: clampedRate })
  }

  const confirmStartExploration = async (): Promise<boolean> => {
    if (!state.explorationDialog.synapse || !state.explorationDialog.selectedShipId) {
      setState('explorationDialog', { ...state.explorationDialog, error: 'Please select a ship' })
      return false
    }

    setState('explorationDialog', { ...state.explorationDialog, isStarting: true, error: null })

    const success = await shipStore.startExploration(
      state.explorationDialog.selectedShipId,
      state.explorationDialog.synapse.id,
      state.explorationDialog.spendingRate
    )

    if (success) {
      // Add to recent spending rates
      addRecentSpendingRate(state.explorationDialog.spendingRate)

      // Set this as the active synapse
      setState({ activeSynapse: state.explorationDialog.synapse })

      // Close dialog
      closeExplorationDialog()

      // Refresh collaborators
      refreshCollaborators()

      return true
    } else {
      setState('explorationDialog', {
        ...state.explorationDialog,
        isStarting: false,
        error: 'Failed to start exploration',
      })
      return false
    }
  }

  // ============ NEARBY SYNAPSES ============

  const fetchNearbySynapses = async (x: number, y: number, z: number, radius: number = 50) => {
    setState({ isLoadingNearbySynapses: true })
    try {
      const response = await fetch(
        `${API_URL}/api/synapses/nearby?x=${x}&y=${y}&z=${z}&radius=${radius}`
      )
      if (!response.ok) {
        setState({ isLoadingNearbySynapses: false })
        return
      }

      const synapses = await response.json()
      setState({ nearbySynapses: synapses, isLoadingNearbySynapses: false })
    } catch (error) {
      console.error('Failed to fetch nearby synapses:', error)
      setState({ isLoadingNearbySynapses: false })
    }
  }

  const filterSynapsesByType = (types: SynapseType[]): ExplorableSynapse[] => {
    if (types.length === 0) return state.nearbySynapses
    return state.nearbySynapses.filter(s => types.includes(s.synapseType))
  }

  // ============ SPENDING RATE ============

  const updateSpendingRate = async (newRate: number): Promise<boolean> => {
    if (!state.activeSynapse) return false

    // Find user's ship exploring this synapse
    const userShips = shipStore.userShips
    const exploringShip = userShips.find(
      s => s.state === 'exploring' && s.currentSynapseId === state.activeSynapse?.id
    )

    if (!exploringShip) return false

    const config = SYNAPSE_CONFIG[state.activeSynapse.synapseType]
    const clampedRate = Math.max(10, Math.min(newRate, config.maxPerMin))

    const success = await shipStore.updateSpendingRate(exploringShip.id, clampedRate)

    if (success) {
      addRecentSpendingRate(clampedRate)
      refreshActiveSynapse()
    }

    return success
  }

  const addRecentSpendingRate = (rate: number) => {
    const rates = state.recentSpendingRates.filter(r => r !== rate)
    setState({
      recentSpendingRates: [rate, ...rates].slice(0, 6),  // Keep last 6 rates
    })
  }

  // ============ LEAVE EXPLORATION ============

  const leaveCurrentExploration = async (): Promise<boolean> => {
    if (!state.activeSynapse) return false

    // Find user's ship exploring this synapse
    const userShips = shipStore.userShips
    const exploringShip = userShips.find(
      s => s.state === 'exploring' && s.currentSynapseId === state.activeSynapse?.id
    )

    if (!exploringShip) return false

    const success = await shipStore.leaveExploration(exploringShip.id)

    if (success) {
      setState({ activeSynapse: null, collaborators: [] })
    }

    return success
  }

  // ============ UI ============

  const setShowExplorationPanel = (show: boolean) => setState({ showExplorationPanel: show })
  const setShowSynapseBrowser = (show: boolean) => setState({ showSynapseBrowser: show })

  // ============ HELPERS ============

  const getEstimatedReward = () => {
    if (!state.activeSynapse) return { agi: 0, brainXp: 0, isLottery: false }

    const config = SYNAPSE_CONFIG[state.activeSynapse.synapseType]
    const isLottery = config.distribution === 'lottery'

    // Find user's contribution
    const userId = userStore.userId
    const myContrib = state.collaborators.find(c => c.userId === userId)

    if (isLottery) {
      // Lottery: Full reward if win, consolation ticket if lose
      return {
        agi: config.agiReward,
        brainXp: config.brainXpReward,
        isLottery: true,
      }
    } else {
      // Fair share: proportional to contribution
      const contributionPercent = myContrib ? myContrib.contributionPercent / 100 : 0
      return {
        agi: Math.floor(config.agiReward * contributionPercent),
        brainXp: Math.floor(config.brainXpReward * contributionPercent),
        isLottery: false,
      }
    }
  }

  const getMyContributionPercent = (): number => {
    const userId = userStore.userId
    const myContrib = state.collaborators.find(c => c.userId === userId)
    return myContrib ? myContrib.contributionPercent : 0
  }

  const getSynapseProgress = (): number => {
    if (!state.activeSynapse || state.activeSynapse.pointsRequired === 0) return 0
    return Math.min(100, (state.activeSynapse.pointsAccumulated / state.activeSynapse.pointsRequired) * 100)
  }

  const canExplore = (synapse: ExplorableSynapse): { canExplore: boolean; reason: string | null } => {
    // Check brain level requirement
    const brainLevel = userStore.brainLevel
    const unlockedSynapseTypes = userStore.unlockedSynapseTypes
    const config = SYNAPSE_CONFIG[synapse.synapseType]

    if (!unlockedSynapseTypes.includes(synapse.synapseType)) {
      return {
        canExplore: false,
        reason: `Requires Brain Level ${config.unlockBrainLevel} (you are level ${brainLevel})`,
      }
    }

    // Check if synapse is full
    if (synapse.maxExplorers !== -1 && synapse.explorerCount >= synapse.maxExplorers) {
      return {
        canExplore: false,
        reason: `Synapse is full (${synapse.explorerCount}/${synapse.maxExplorers} explorers)`,
      }
    }

    // Check if synapse is already completed
    if (synapse.state === 'completed') {
      return {
        canExplore: false,
        reason: 'Synapse has already been completed',
      }
    }

    // Check if user has idle ships
    const idleShips = shipStore.userShips.filter(s => s.state === 'idle')
    if (idleShips.length === 0) {
      return {
        canExplore: false,
        reason: 'No idle ships available',
      }
    }

    return { canExplore: true, reason: null }
  }

  return {
    // ============ REACTIVE GETTERS ============
    // Current Exploration
    get activeSynapse() { return state.activeSynapse },
    get collaborators() { return state.collaborators },
    get isLoadingCollaborators() { return state.isLoadingCollaborators },

    // Exploration Dialog
    get explorationDialog() { return state.explorationDialog },

    // Available Synapses
    get nearbySynapses() { return state.nearbySynapses },
    get isLoadingNearbySynapses() { return state.isLoadingNearbySynapses },

    // Spending Rate History
    get recentSpendingRates() { return state.recentSpendingRates },

    // UI State
    get showExplorationPanel() { return state.showExplorationPanel },
    get showSynapseBrowser() { return state.showSynapseBrowser },

    // ============ COMPUTED SELECTORS ============
    get isExploring() { return state.activeSynapse !== null },

    // ============ ACTIONS ============
    // Active Exploration
    setActiveSynapse,
    refreshActiveSynapse,
    refreshCollaborators,

    // Exploration Dialog
    openExplorationDialog,
    closeExplorationDialog,
    setDialogShip,
    setDialogSpendingRate,
    confirmStartExploration,

    // Nearby Synapses
    fetchNearbySynapses,
    filterSynapsesByType,

    // Spending Rate
    updateSpendingRate,
    addRecentSpendingRate,

    // Leave Exploration
    leaveCurrentExploration,

    // UI
    setShowExplorationPanel,
    setShowSynapseBrowser,

    // Helpers
    getEstimatedReward,
    getMyContributionPercent,
    getSynapseProgress,
    canExplore,
  }
}

export const explorationStore = createRoot(createExplorationStore)

// ============ SELECTOR FUNCTIONS (for compatibility) ============

export const selectActiveSynapse = () => explorationStore.activeSynapse
export const selectCollaborators = () => explorationStore.collaborators
export const selectExplorationDialog = () => explorationStore.explorationDialog
export const selectNearbySynapses = () => explorationStore.nearbySynapses
export const selectIsExploring = () => explorationStore.isExploring

// ============ HELPER FUNCTIONS ============

export function getSynapseDescription(synapse: ExplorableSynapse): string {
  const typeLabel = getSynapseTypeLabel(synapse.synapseType)
  const progress = (synapse.pointsAccumulated / synapse.pointsRequired) * 100
  const eta = synapse.currentEtaMinutes ? formatETA(synapse.currentEtaMinutes) : 'Unknown'

  return `${typeLabel} Synapse - ${progress.toFixed(1)}% complete - ETA: ${eta}`
}

export function getSynapseRewardText(synapse: ExplorableSynapse): string {
  const config = SYNAPSE_CONFIG[synapse.synapseType]
  const agiFormatted = formatPoints(config.agiReward)
  const xpFormatted = formatPoints(config.brainXpReward)
  const isLottery = config.distribution === 'lottery'

  if (isLottery) {
    return `Lottery: ${agiFormatted} AGI + ${xpFormatted} XP`
  } else {
    return `Fair Share: Up to ${agiFormatted} AGI + ${xpFormatted} XP`
  }
}

export function getSpendingRateOptions(synapseType: SynapseType): number[] {
  const config = SYNAPSE_CONFIG[synapseType]
  const max = config.maxPerMin
  const options: number[] = []

  // Generate sensible options based on max
  if (max >= 50) options.push(50)
  if (max >= 100) options.push(100)
  if (max >= 200) options.push(200)
  if (max >= 300) options.push(300)
  if (max >= 500) options.push(500)
  if (max >= 1000) options.push(1000)

  // Always include max if not already
  if (!options.includes(max)) options.push(max)

  return options.sort((a, b) => a - b)
}
