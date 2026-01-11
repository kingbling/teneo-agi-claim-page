import { create } from 'zustand'
import { useUserStore } from './userStore'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}

// ============================================================================
// MASTERPLAN 2026: SECTOR STORE
// Manages sectors (seasons) - themed content releases with progress tracking
// ============================================================================

export type SectorStatus = 'locked' | 'active' | 'completed' | 'upcoming'

export interface SectorReward {
  type: 'agi' | 'teneo' | 'nft' | 'lottery_tickets' | 'agentic'
  amount: number
  label: string
}

export interface Sector {
  id: string
  name: string
  description: string
  theme: string
  status: SectorStatus

  // Timing
  startDate: Date | null
  endDate: Date | null

  // Progress
  totalSynapses: number
  discoveredSynapses: number
  progressPercent: number

  // Rewards
  rewardPool: SectorReward[]
  completionBonus: SectorReward | null

  // Unlock Requirements
  unlockRequirement: {
    type: 'brain_level' | 'previous_sector' | 'none'
    value: number | string | null
  }

  // Visual
  iconUrl: string | null
  bannerUrl: string | null
  color: string
}

export interface SectorProgress {
  sectorId: string
  userId: string
  synapsesDiscovered: number
  synapsesTotal: number
  progressPercent: number
  rewardsEarned: SectorReward[]
  completedAt: Date | null
}

export interface SectorState {
  // Sectors
  sectors: Sector[]
  activeSector: Sector | null
  sectorProgress: Record<string, SectorProgress>

  // Loading
  isLoading: boolean
  isLoadingProgress: boolean
  error: string | null
}

export interface SectorActions {
  // Fetch
  fetchSectors: () => Promise<void>
  fetchSectorProgress: (sectorId: string) => Promise<void>

  // Navigation
  setActiveSector: (sectorId: string | null) => void

  // Helpers
  getSectorById: (sectorId: string) => Sector | undefined
  getUnlockedSectors: () => Sector[]
  getLockedSectors: () => Sector[]
  getSectorProgressPercent: (sectorId: string) => number
  canUnlockSector: (sectorId: string) => { canUnlock: boolean; reason: string | null }
}

export type SectorStore = SectorState & SectorActions

const initialState: SectorState = {
  sectors: [],
  activeSector: null,
  sectorProgress: {},
  isLoading: false,
  isLoadingProgress: false,
  error: null,
}

// Helper functions for API mapping
function mapApiStateToStatus(state: string): SectorStatus {
  switch (state) {
    case 'active': return 'active'
    case 'completed': return 'completed'
    case 'upcoming': return 'upcoming'
    default: return 'locked'
  }
}

function getSectorColor(region: string): string {
  const colors: Record<string, string> = {
    frontal: '#3B82F6',
    temporal: '#8B5CF6',
    parietal: '#10B981',
    occipital: '#F59E0B',
    default: '#6B7280',
  }
  return colors[region] || colors.default
}

export const useSectorStore = create<SectorStore>((set, get) => ({
  ...initialState,

  // ============ FETCH ============

  fetchSectors: async () => {
    set({ isLoading: true, error: null })

    try {
      const response = await fetch(`${API_URL}/api/sectors`)
      if (!response.ok) throw new Error('Failed to fetch sectors')
      const data = await response.json()

      // Map API response to frontend Sector type
      const sectors: Sector[] = (data.sectors || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        theme: s.region || 'default',
        status: mapApiStateToStatus(s.state),
        startDate: s.startTime ? new Date(s.startTime) : null,
        endDate: s.endTime ? new Date(s.endTime) : null,
        totalSynapses: s.totalSynapses || 0,
        discoveredSynapses: s.completedSynapses || 0,
        progressPercent: s.totalSynapses > 0
          ? Math.round((s.completedSynapses / s.totalSynapses) * 100)
          : 0,
        rewardPool: [
          { type: 'agi' as const, amount: s.totalAgiRewards || 0, label: `${(s.totalAgiRewards || 0).toLocaleString()} $AGI Pool` },
        ],
        completionBonus: null,
        unlockRequirement: { type: 'none' as const, value: null },
        iconUrl: null,
        bannerUrl: null,
        color: getSectorColor(s.region || 'default'),
      }))

      // Set active sector to first active or first sector
      const activeSector = sectors.find(s => s.status === 'active') || sectors[0] || null

      set({
        sectors,
        activeSector,
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to fetch sectors:', error)
      set({
        sectors: [],
        activeSector: null,
        isLoading: false,
        error: 'Failed to load sectors',
      })
    }
  },

  fetchSectorProgress: async (sectorId: string) => {
    set({ isLoadingProgress: true })

    try {
      const response = await fetch(`${API_URL}/api/sectors/${sectorId}/progress`)
      if (!response.ok) throw new Error('Failed to fetch sector progress')
      const data = await response.json()

      const apiProgress = data.progress
      const progress: SectorProgress = {
        sectorId,
        userId: 'current-user',
        synapsesDiscovered: apiProgress?.synapsesCompleted || 0,
        synapsesTotal: (apiProgress?.synapsesCompleted || 0) + (apiProgress?.synapsesRemaining || 0),
        progressPercent: apiProgress?.completionPercentage || 0,
        rewardsEarned: [],
        completedAt: null,
      }

      set((state) => ({
        sectorProgress: {
          ...state.sectorProgress,
          [sectorId]: progress,
        },
        isLoadingProgress: false,
      }))
    } catch (error) {
      console.error('Failed to fetch sector progress:', error)
      // Fall back to local sector data
      const sector = get().sectors.find(s => s.id === sectorId)
      if (sector) {
        const progress: SectorProgress = {
          sectorId,
          userId: 'current-user',
          synapsesDiscovered: sector.discoveredSynapses,
          synapsesTotal: sector.totalSynapses,
          progressPercent: sector.progressPercent,
          rewardsEarned: [],
          completedAt: null,
        }
        set((state) => ({
          sectorProgress: {
            ...state.sectorProgress,
            [sectorId]: progress,
          },
          isLoadingProgress: false,
        }))
      } else {
        set({ isLoadingProgress: false })
      }
    }
  },

  // ============ NAVIGATION ============

  setActiveSector: (sectorId: string | null) => {
    if (sectorId === null) {
      set({ activeSector: null })
      return
    }

    const sector = get().sectors.find(s => s.id === sectorId)
    if (sector) {
      set({ activeSector: sector })
      // Fetch progress when sector is selected
      get().fetchSectorProgress(sectorId)
    }
  },

  // ============ HELPERS ============

  getSectorById: (sectorId: string) => {
    return get().sectors.find(s => s.id === sectorId)
  },

  getUnlockedSectors: () => {
    return get().sectors.filter(s => s.status === 'active' || s.status === 'completed')
  },

  getLockedSectors: () => {
    return get().sectors.filter(s => s.status === 'locked' || s.status === 'upcoming')
  },

  getSectorProgressPercent: (sectorId: string) => {
    const progress = get().sectorProgress[sectorId]
    if (progress) {
      return progress.progressPercent
    }
    const sector = get().sectors.find(s => s.id === sectorId)
    return sector?.progressPercent || 0
  },

  canUnlockSector: (sectorId: string) => {
    const sector = get().sectors.find(s => s.id === sectorId)
    if (!sector) {
      return { canUnlock: false, reason: 'Sector not found' }
    }

    if (sector.status === 'active' || sector.status === 'completed') {
      return { canUnlock: true, reason: null }
    }

    const { unlockRequirement } = sector

    if (unlockRequirement.type === 'none') {
      return { canUnlock: true, reason: null }
    }

    if (unlockRequirement.type === 'brain_level') {
      const requiredLevel = unlockRequirement.value as number
      const currentBrainLevel = useUserStore.getState().brainLevel
      if (currentBrainLevel >= requiredLevel) {
        return { canUnlock: true, reason: null }
      }
      return {
        canUnlock: false,
        reason: `Requires Brain Level ${requiredLevel} (you have ${currentBrainLevel})`,
      }
    }

    if (unlockRequirement.type === 'previous_sector') {
      const previousSectorId = unlockRequirement.value as string
      const previousSector = get().sectors.find(s => s.id === previousSectorId)
      if (!previousSector) {
        return { canUnlock: false, reason: 'Previous sector not found' }
      }
      if (previousSector.status !== 'completed') {
        return {
          canUnlock: false,
          reason: `Complete "${previousSector.name}" first`,
        }
      }
      return { canUnlock: true, reason: null }
    }

    return { canUnlock: false, reason: 'Unknown unlock requirement' }
  },
}))

// ============ SELECTORS ============

export const selectSectors = (state: SectorStore) => state.sectors
export const selectActiveSector = (state: SectorStore) => state.activeSector
export const selectSectorProgress = (state: SectorStore) => state.sectorProgress
export const selectIsLoadingSectors = (state: SectorStore) => state.isLoading
export const selectUnlockedSectors = (state: SectorStore) => state.getUnlockedSectors()
export const selectLockedSectors = (state: SectorStore) => state.getLockedSectors()

// ============ HELPER FUNCTIONS ============

export function getSectorStatusLabel(status: SectorStatus): string {
  const labels: Record<SectorStatus, string> = {
    locked: 'Locked',
    active: 'Active',
    completed: 'Completed',
    upcoming: 'Coming Soon',
  }
  return labels[status]
}

export function getSectorStatusColor(status: SectorStatus): string {
  const colors: Record<SectorStatus, string> = {
    locked: '#6B7280',
    active: '#10B981',
    completed: '#3B82F6',
    upcoming: '#F59E0B',
  }
  return colors[status]
}

export function formatSectorReward(reward: SectorReward): string {
  const typeLabels: Record<string, string> = {
    agi: '$AGI',
    teneo: '$TENEO',
    nft: 'NFT',
    lottery_tickets: 'Lottery Tickets',
    agentic: '$AGENTIC',
  }
  return `${reward.amount.toLocaleString()} ${typeLabels[reward.type] || reward.type}`
}
