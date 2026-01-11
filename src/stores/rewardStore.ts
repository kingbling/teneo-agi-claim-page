import { create } from 'zustand'
import { formatPoints, type SynapseType } from '@/types/game'
import { useUserStore } from './userStore'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}

// ============================================================================
// MASTERPLAN 2026: REWARD STORE
// Manages rewards, lottery, and leaderboard data
// ============================================================================

// Reward notification types
export type RewardType = 'agi' | 'xp' | 'lottery_ticket' | 'lottery_win' | 'nft' | 'level_up'

export interface RewardNotification {
  id: string
  type: RewardType
  amount: number
  source: string
  timestamp: number
  isVisible: boolean
}

// Lottery participant info
export interface LotteryParticipant {
  userId: string
  userName: string
  shipName: string
  contributionPercent: number
  isWinner?: boolean
  isCurrentUser?: boolean
}

// Lottery result
export interface LotteryResult {
  id: string
  synapseId: string
  synapseType: SynapseType
  winnerId: string
  winnerName: string
  winnerContribution: number
  agiReward: number
  xpReward: number
  participants: LotteryParticipant[]
  timestamp: number
  userWon: boolean
  userConsolationTickets: number
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number
  userId: string
  userName: string
  score: number
  isCurrentUser: boolean
  brainLevel?: number
  totalAgi?: number
  discoveries?: number
}

// Leaderboard types
export type LeaderboardType = 'weekly_agi' | 'total_discoveries' | 'brain_level'

export interface LeaderboardData {
  type: LeaderboardType
  entries: LeaderboardEntry[]
  userRank: number | null
  userScore: number | null
  lastUpdated: number
}

// Store State
export interface RewardState {
  // Recent Rewards (for notifications)
  recentRewards: RewardNotification[]
  maxRewardNotifications: number

  // Lottery Results
  lotteryResults: LotteryResult[]
  currentLotteryAnimation: LotteryResult | null
  isAnimatingLottery: boolean

  // Leaderboard Data
  leaderboardData: Record<LeaderboardType, LeaderboardData | null>
  activeLeaderboardType: LeaderboardType
  isLoadingLeaderboard: boolean

  // UI State
  showNotifications: boolean
}

export interface RewardActions {
  // Reward Notifications
  addReward: (type: RewardType, amount: number, source: string) => void
  dismissReward: (id: string) => void
  clearAllRewards: () => void

  // Lottery
  addLotteryResult: (result: LotteryResult) => void
  startLotteryAnimation: (result: LotteryResult) => void
  endLotteryAnimation: () => void
  useLotteryTickets: (count: number) => Promise<boolean>

  // Leaderboard
  fetchLeaderboard: (type: LeaderboardType) => Promise<void>
  refreshLeaderboard: () => Promise<void>
  setActiveLeaderboardType: (type: LeaderboardType) => void

  // UI
  setShowNotifications: (show: boolean) => void

  // Helpers
  getTotalUnclaimedAgi: () => number
  getRecentLotteryWins: () => LotteryResult[]
}

export type RewardStore = RewardState & RewardActions

const initialState: RewardState = {
  // Rewards
  recentRewards: [],
  maxRewardNotifications: 5,

  // Lottery
  lotteryResults: [],
  currentLotteryAnimation: null,
  isAnimatingLottery: false,

  // Leaderboard
  leaderboardData: {
    weekly_agi: null,
    total_discoveries: null,
    brain_level: null,
  },
  activeLeaderboardType: 'weekly_agi',
  isLoadingLeaderboard: false,

  // UI
  showNotifications: true,
}

export const useRewardStore = create<RewardStore>((set, get) => ({
  ...initialState,

  // ============ REWARD NOTIFICATIONS ============

  addReward: (type: RewardType, amount: number, source: string) => {
    const id = `reward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newReward: RewardNotification = {
      id,
      type,
      amount,
      source,
      timestamp: Date.now(),
      isVisible: true,
    }

    set((state) => {
      const updatedRewards = [newReward, ...state.recentRewards].slice(0, state.maxRewardNotifications)
      return { recentRewards: updatedRewards }
    })

    // Also update the user store if it's AGI, XP, or lottery tickets
    const userStore = useUserStore.getState()
    switch (type) {
      case 'agi':
      case 'lottery_win':
        userStore.addAgi(amount)
        break
      case 'xp':
        userStore.addBrainXP(amount)
        break
      case 'lottery_ticket':
        userStore.addLotteryTickets(amount)
        break
      case 'nft':
        userStore.addNFT()
        break
    }

    // Auto-dismiss after delay
    setTimeout(() => {
      get().dismissReward(id)
    }, 5000)
  },

  dismissReward: (id: string) => {
    set((state) => ({
      recentRewards: state.recentRewards.map((r) =>
        r.id === id ? { ...r, isVisible: false } : r
      ),
    }))

    // Remove from list after animation
    setTimeout(() => {
      set((state) => ({
        recentRewards: state.recentRewards.filter((r) => r.id !== id),
      }))
    }, 300)
  },

  clearAllRewards: () => {
    set({ recentRewards: [] })
  },

  // ============ LOTTERY ============

  addLotteryResult: (result: LotteryResult) => {
    set((state) => ({
      lotteryResults: [result, ...state.lotteryResults].slice(0, 20),
    }))
  },

  startLotteryAnimation: (result: LotteryResult) => {
    set({
      currentLotteryAnimation: result,
      isAnimatingLottery: true,
    })
  },

  endLotteryAnimation: () => {
    const { currentLotteryAnimation } = get()

    if (currentLotteryAnimation) {
      // Add rewards after animation
      if (currentLotteryAnimation.userWon) {
        get().addReward('lottery_win', currentLotteryAnimation.agiReward, `Lottery Win - ${currentLotteryAnimation.synapseType} Synapse`)
        get().addReward('xp', currentLotteryAnimation.xpReward, `Lottery Win - ${currentLotteryAnimation.synapseType} Synapse`)
      } else if (currentLotteryAnimation.userConsolationTickets > 0) {
        get().addReward('lottery_ticket', currentLotteryAnimation.userConsolationTickets, 'Lottery Consolation')
      }

      // Add to history
      get().addLotteryResult(currentLotteryAnimation)
    }

    set({
      currentLotteryAnimation: null,
      isAnimatingLottery: false,
    })
  },

  useLotteryTickets: async (count: number): Promise<boolean> => {
    const userStore = useUserStore.getState()

    if (userStore.lotteryTickets < count) {
      return false
    }

    try {
      const response = await fetch(`${API_URL}/api/lottery/use-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userStore.userId,
          count,
        }),
      })

      if (!response.ok) {
        return false
      }

      // Deduct tickets locally
      for (let i = 0; i < count; i++) {
        userStore.spendLotteryTicket()
      }

      return true
    } catch (error) {
      console.error('Failed to use lottery tickets:', error)
      return false
    }
  },

  // ============ LEADERBOARD ============

  fetchLeaderboard: async (type: LeaderboardType) => {
    set({ isLoadingLeaderboard: true })

    try {
      const userId = useUserStore.getState().userId
      const response = await fetch(`${API_URL}/api/leaderboard/${type}?userId=${userId}`)

      if (!response.ok) {
        set({ isLoadingLeaderboard: false })
        return
      }

      const data = await response.json()

      const leaderboardData: LeaderboardData = {
        type,
        entries: data.entries.map((entry: LeaderboardEntry, index: number) => ({
          ...entry,
          rank: index + 1,
          isCurrentUser: entry.userId === userId,
        })),
        userRank: data.userRank,
        userScore: data.userScore,
        lastUpdated: Date.now(),
      }

      set((state) => ({
        leaderboardData: {
          ...state.leaderboardData,
          [type]: leaderboardData,
        },
        isLoadingLeaderboard: false,
      }))
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
      set({ isLoadingLeaderboard: false })
    }
  },

  refreshLeaderboard: async () => {
    const { activeLeaderboardType } = get()
    await get().fetchLeaderboard(activeLeaderboardType)
  },

  setActiveLeaderboardType: (type: LeaderboardType) => {
    set({ activeLeaderboardType: type })

    // Fetch if not cached or stale (older than 5 minutes)
    const cached = get().leaderboardData[type]
    if (!cached || Date.now() - cached.lastUpdated > 5 * 60 * 1000) {
      get().fetchLeaderboard(type)
    }
  },

  // ============ UI ============

  setShowNotifications: (show: boolean) => {
    set({ showNotifications: show })
  },

  // ============ HELPERS ============

  getTotalUnclaimedAgi: (): number => {
    const { recentRewards } = get()
    return recentRewards
      .filter((r) => (r.type === 'agi' || r.type === 'lottery_win') && r.isVisible)
      .reduce((sum, r) => sum + r.amount, 0)
  },

  getRecentLotteryWins: (): LotteryResult[] => {
    const { lotteryResults } = get()
    return lotteryResults.filter((r) => r.userWon).slice(0, 5)
  },
}))

// ============ SELECTORS ============

export const selectRecentRewards = (state: RewardStore) => state.recentRewards.filter((r) => r.isVisible)
export const selectIsAnimatingLottery = (state: RewardStore) => state.isAnimatingLottery
export const selectCurrentLotteryAnimation = (state: RewardStore) => state.currentLotteryAnimation
export const selectActiveLeaderboard = (state: RewardStore) => state.leaderboardData[state.activeLeaderboardType]
export const selectLeaderboardType = (state: RewardStore) => state.activeLeaderboardType
export const selectIsLoadingLeaderboard = (state: RewardStore) => state.isLoadingLeaderboard

// ============ HELPER FUNCTIONS ============

export function getRewardTypeLabel(type: RewardType): string {
  switch (type) {
    case 'agi':
      return 'AGI Earned'
    case 'xp':
      return 'Brain XP'
    case 'lottery_ticket':
      return 'Lottery Ticket'
    case 'lottery_win':
      return 'Lottery Win!'
    case 'nft':
      return 'NFT Minted'
    case 'level_up':
      return 'Level Up!'
    default:
      return 'Reward'
  }
}

export function getRewardTypeIcon(type: RewardType): string {
  switch (type) {
    case 'agi':
      return 'coins'
    case 'xp':
      return 'zap'
    case 'lottery_ticket':
      return 'ticket'
    case 'lottery_win':
      return 'trophy'
    case 'nft':
      return 'image'
    case 'level_up':
      return 'arrow-up'
    default:
      return 'gift'
  }
}

export function getLeaderboardTypeLabel(type: LeaderboardType): string {
  switch (type) {
    case 'weekly_agi':
      return 'Weekly AGI'
    case 'total_discoveries':
      return 'Total Discoveries'
    case 'brain_level':
      return 'Brain Level'
    default:
      return 'Leaderboard'
  }
}

export function formatLeaderboardScore(type: LeaderboardType, score: number): string {
  switch (type) {
    case 'weekly_agi':
    case 'total_discoveries':
      return formatPoints(score)
    case 'brain_level':
      return `Lv. ${score}`
    default:
      return score.toString()
  }
}
