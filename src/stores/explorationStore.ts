import { create } from 'zustand'
import {
  type SynapseType,
  SYNAPSE_CONFIG,
  formatPoints,
  formatETA,
  getSynapseTypeLabel,
} from '@/types/game'
import { useUserStore } from './userStore'
import { useShipStore } from './shipStore'

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

export interface ExplorationActions {
  // Active Exploration
  setActiveSynapse: (synapse: ExplorableSynapse | null) => void
  refreshActiveSynapse: () => Promise<void>
  refreshCollaborators: () => Promise<void>

  // Exploration Dialog
  openExplorationDialog: (synapse: ExplorableSynapse) => void
  closeExplorationDialog: () => void
  setDialogShip: (shipId: string | null) => void
  setDialogSpendingRate: (rate: number) => void
  confirmStartExploration: () => Promise<boolean>

  // Nearby Synapses
  fetchNearbySynapses: (x: number, y: number, z: number, radius?: number) => Promise<void>
  filterSynapsesByType: (types: SynapseType[]) => ExplorableSynapse[]

  // Spending Rate
  updateSpendingRate: (newRate: number) => Promise<boolean>
  addRecentSpendingRate: (rate: number) => void

  // Leave Exploration
  leaveCurrentExploration: () => Promise<boolean>

  // UI
  setShowExplorationPanel: (show: boolean) => void
  setShowSynapseBrowser: (show: boolean) => void

  // Helpers
  getEstimatedReward: () => { agi: number; brainXp: number; isLottery: boolean }
  getMyContributionPercent: () => number
  getSynapseProgress: () => number
  canExplore: (synapse: ExplorableSynapse) => { canExplore: boolean; reason: string | null }
}

export type ExplorationStore = ExplorationState & ExplorationActions

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

export const useExplorationStore = create<ExplorationStore>((set, get) => ({
  ...initialState,

  // ============ ACTIVE EXPLORATION ============

  setActiveSynapse: (synapse: ExplorableSynapse | null) => {
    set({ activeSynapse: synapse })
    if (synapse) {
      get().refreshCollaborators()
    } else {
      set({ collaborators: [] })
    }
  },

  refreshActiveSynapse: async () => {
    const { activeSynapse } = get()
    if (!activeSynapse) return

    try {
      const response = await fetch(`${API_URL}/api/synapses/${activeSynapse.id}`)
      if (!response.ok) return

      const synapse = await response.json()
      set({ activeSynapse: synapse })
    } catch (error) {
      console.error('Failed to refresh active synapse:', error)
    }
  },

  refreshCollaborators: async () => {
    const { activeSynapse } = get()
    if (!activeSynapse) return

    set({ isLoadingCollaborators: true })
    try {
      const response = await fetch(`${API_URL}/api/synapses/${activeSynapse.id}/explorers`)
      if (!response.ok) {
        set({ isLoadingCollaborators: false })
        return
      }

      const explorers = await response.json()
      const userId = useUserStore.getState().userId

      // Calculate contribution percentages
      const totalPoints = explorers.reduce((sum: number, e: Collaborator) => sum + e.pointsContributed, 0)

      const collaborators: Collaborator[] = explorers.map((e: Collaborator) => ({
        ...e,
        contributionPercent: totalPoints > 0 ? (e.pointsContributed / totalPoints) * 100 : 0,
        isCurrentUser: e.userId === userId,
      }))

      set({ collaborators, isLoadingCollaborators: false })
    } catch (error) {
      console.error('Failed to fetch collaborators:', error)
      set({ isLoadingCollaborators: false })
    }
  },

  // ============ EXPLORATION DIALOG ============

  openExplorationDialog: (synapse: ExplorableSynapse) => {
    const idleShips = useShipStore.getState().userShips.filter(s => s.state === 'idle')
    const config = SYNAPSE_CONFIG[synapse.synapseType]

    set({
      explorationDialog: {
        isOpen: true,
        synapse,
        selectedShipId: idleShips.length > 0 ? idleShips[0].id : null,
        spendingRate: Math.min(100, config.maxPerMin),  // Start at 100 or max for this type
        isStarting: false,
        error: null,
      },
    })
  },

  closeExplorationDialog: () => {
    set({ explorationDialog: initialDialogState })
  },

  setDialogShip: (shipId: string | null) => {
    set((state) => ({
      explorationDialog: { ...state.explorationDialog, selectedShipId: shipId },
    }))
  },

  setDialogSpendingRate: (rate: number) => {
    const { explorationDialog } = get()
    if (!explorationDialog.synapse) return

    const config = SYNAPSE_CONFIG[explorationDialog.synapse.synapseType]
    const clampedRate = Math.max(10, Math.min(rate, config.maxPerMin))

    set((state) => ({
      explorationDialog: { ...state.explorationDialog, spendingRate: clampedRate },
    }))
  },

  confirmStartExploration: async (): Promise<boolean> => {
    const { explorationDialog } = get()
    if (!explorationDialog.synapse || !explorationDialog.selectedShipId) {
      set((state) => ({
        explorationDialog: { ...state.explorationDialog, error: 'Please select a ship' },
      }))
      return false
    }

    set((state) => ({
      explorationDialog: { ...state.explorationDialog, isStarting: true, error: null },
    }))

    const success = await useShipStore.getState().startExploration(
      explorationDialog.selectedShipId,
      explorationDialog.synapse.id,
      explorationDialog.spendingRate
    )

    if (success) {
      // Add to recent spending rates
      get().addRecentSpendingRate(explorationDialog.spendingRate)

      // Set this as the active synapse
      set({ activeSynapse: explorationDialog.synapse })

      // Close dialog
      get().closeExplorationDialog()

      // Refresh collaborators
      get().refreshCollaborators()

      return true
    } else {
      set((state) => ({
        explorationDialog: {
          ...state.explorationDialog,
          isStarting: false,
          error: 'Failed to start exploration',
        },
      }))
      return false
    }
  },

  // ============ NEARBY SYNAPSES ============

  fetchNearbySynapses: async (x: number, y: number, z: number, radius: number = 50) => {
    set({ isLoadingNearbySynapses: true })
    try {
      const response = await fetch(
        `${API_URL}/api/synapses/nearby?x=${x}&y=${y}&z=${z}&radius=${radius}`
      )
      if (!response.ok) {
        set({ isLoadingNearbySynapses: false })
        return
      }

      const synapses = await response.json()
      set({ nearbySynapses: synapses, isLoadingNearbySynapses: false })
    } catch (error) {
      console.error('Failed to fetch nearby synapses:', error)
      set({ isLoadingNearbySynapses: false })
    }
  },

  filterSynapsesByType: (types: SynapseType[]): ExplorableSynapse[] => {
    const { nearbySynapses } = get()
    if (types.length === 0) return nearbySynapses
    return nearbySynapses.filter(s => types.includes(s.synapseType))
  },

  // ============ SPENDING RATE ============

  updateSpendingRate: async (newRate: number): Promise<boolean> => {
    const { activeSynapse } = get()
    if (!activeSynapse) return false

    // Find user's ship exploring this synapse
    const userShips = useShipStore.getState().userShips
    const exploringShip = userShips.find(
      s => s.state === 'exploring' && s.currentSynapseId === activeSynapse.id
    )

    if (!exploringShip) return false

    const config = SYNAPSE_CONFIG[activeSynapse.synapseType]
    const clampedRate = Math.max(10, Math.min(newRate, config.maxPerMin))

    const success = await useShipStore.getState().updateSpendingRate(exploringShip.id, clampedRate)

    if (success) {
      get().addRecentSpendingRate(clampedRate)
      get().refreshActiveSynapse()
    }

    return success
  },

  addRecentSpendingRate: (rate: number) => {
    set((state) => {
      const rates = state.recentSpendingRates.filter(r => r !== rate)
      return {
        recentSpendingRates: [rate, ...rates].slice(0, 6),  // Keep last 6 rates
      }
    })
  },

  // ============ LEAVE EXPLORATION ============

  leaveCurrentExploration: async (): Promise<boolean> => {
    const { activeSynapse } = get()
    if (!activeSynapse) return false

    // Find user's ship exploring this synapse
    const userShips = useShipStore.getState().userShips
    const exploringShip = userShips.find(
      s => s.state === 'exploring' && s.currentSynapseId === activeSynapse.id
    )

    if (!exploringShip) return false

    const success = await useShipStore.getState().leaveExploration(exploringShip.id)

    if (success) {
      set({ activeSynapse: null, collaborators: [] })
    }

    return success
  },

  // ============ UI ============

  setShowExplorationPanel: (show: boolean) => set({ showExplorationPanel: show }),
  setShowSynapseBrowser: (show: boolean) => set({ showSynapseBrowser: show }),

  // ============ HELPERS ============

  getEstimatedReward: () => {
    const { activeSynapse, collaborators } = get()
    if (!activeSynapse) return { agi: 0, brainXp: 0, isLottery: false }

    const config = SYNAPSE_CONFIG[activeSynapse.synapseType]
    const isLottery = config.distribution === 'lottery'

    // Find user's contribution
    const userId = useUserStore.getState().userId
    const myContrib = collaborators.find(c => c.userId === userId)

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
  },

  getMyContributionPercent: (): number => {
    const { collaborators } = get()
    const userId = useUserStore.getState().userId
    const myContrib = collaborators.find(c => c.userId === userId)
    return myContrib ? myContrib.contributionPercent : 0
  },

  getSynapseProgress: (): number => {
    const { activeSynapse } = get()
    if (!activeSynapse || activeSynapse.pointsRequired === 0) return 0
    return Math.min(100, (activeSynapse.pointsAccumulated / activeSynapse.pointsRequired) * 100)
  },

  canExplore: (synapse: ExplorableSynapse): { canExplore: boolean; reason: string | null } => {
    // Check brain level requirement
    const { brainLevel, unlockedSynapseTypes } = useUserStore.getState()
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
    const idleShips = useShipStore.getState().userShips.filter(s => s.state === 'idle')
    if (idleShips.length === 0) {
      return {
        canExplore: false,
        reason: 'No idle ships available',
      }
    }

    return { canExplore: true, reason: null }
  },
}))

// ============ SELECTORS ============

export const selectActiveSynapse = (state: ExplorationStore) => state.activeSynapse
export const selectCollaborators = (state: ExplorationStore) => state.collaborators
export const selectExplorationDialog = (state: ExplorationStore) => state.explorationDialog
export const selectNearbySynapses = (state: ExplorationStore) => state.nearbySynapses
export const selectIsExploring = (state: ExplorationStore) => state.activeSynapse !== null

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
    return `🎰 Lottery: ${agiFormatted} AGI + ${xpFormatted} XP`
  } else {
    return `💰 Fair Share: Up to ${agiFormatted} AGI + ${xpFormatted} XP`
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
