import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import { userStore } from './userStore'

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

function createSectorStore() {
  const [state, setState] = createStore<SectorState>(initialState)

  // ============ FETCH ============

  const fetchSectors = async () => {
    setState({ isLoading: true, error: null })

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

      setState({
        sectors,
        activeSector,
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to fetch sectors:', error)
      setState({
        sectors: [],
        activeSector: null,
        isLoading: false,
        error: 'Failed to load sectors',
      })
    }
  }

  const fetchSectorProgress = async (sectorId: string) => {
    setState({ isLoadingProgress: true })

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

      setState('sectorProgress', sectorId, progress)
      setState({ isLoadingProgress: false })
    } catch (error) {
      console.error('Failed to fetch sector progress:', error)
      // Fall back to local sector data
      const sector = state.sectors.find(s => s.id === sectorId)
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
        setState('sectorProgress', sectorId, progress)
      }
      setState({ isLoadingProgress: false })
    }
  }

  // ============ NAVIGATION ============

  const setActiveSector = (sectorId: string | null) => {
    if (sectorId === null) {
      setState({ activeSector: null })
      return
    }

    const sector = state.sectors.find(s => s.id === sectorId)
    if (sector) {
      setState({ activeSector: sector })
      // Fetch progress when sector is selected
      fetchSectorProgress(sectorId)
    }
  }

  // ============ HELPERS ============

  const getSectorById = (sectorId: string) => {
    return state.sectors.find(s => s.id === sectorId)
  }

  const getUnlockedSectors = () => {
    return state.sectors.filter(s => s.status === 'active' || s.status === 'completed')
  }

  const getLockedSectors = () => {
    return state.sectors.filter(s => s.status === 'locked' || s.status === 'upcoming')
  }

  const getSectorProgressPercent = (sectorId: string) => {
    const progress = state.sectorProgress[sectorId]
    if (progress) {
      return progress.progressPercent
    }
    const sector = state.sectors.find(s => s.id === sectorId)
    return sector?.progressPercent || 0
  }

  const canUnlockSector = (sectorId: string) => {
    const sector = state.sectors.find(s => s.id === sectorId)
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
      const currentBrainLevel = userStore.brainLevel
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
      const previousSector = state.sectors.find(s => s.id === previousSectorId)
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
  }

  return {
    // State getters
    get sectors() { return state.sectors },
    get activeSector() { return state.activeSector },
    get sectorProgress() { return state.sectorProgress },
    get isLoading() { return state.isLoading },
    get isLoadingProgress() { return state.isLoadingProgress },
    get error() { return state.error },

    // Computed getters
    get unlockedSectors() { return getUnlockedSectors() },
    get lockedSectors() { return getLockedSectors() },

    // Actions
    fetchSectors,
    fetchSectorProgress,
    setActiveSector,

    // Helpers
    getSectorById,
    getUnlockedSectors,
    getLockedSectors,
    getSectorProgressPercent,
    canUnlockSector,
  }
}

export const sectorStore = createRoot(createSectorStore)

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
