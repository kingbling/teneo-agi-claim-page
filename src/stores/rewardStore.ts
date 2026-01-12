import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import { formatPoints, type SynapseType } from '@/types/game'
import { userStore } from './userStore'

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

function createRewardStore() {
  const [state, setState] = createStore<RewardState>({ ...initialState })

  // ============ REWARD NOTIFICATIONS ============

  const addReward = (type: RewardType, amount: number, source: string) => {
    const id = `reward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newReward: RewardNotification = {
      id,
      type,
      amount,
      source,
      timestamp: Date.now(),
      isVisible: true,
    }

    const updatedRewards = [newReward, ...state.recentRewards].slice(0, state.maxRewardNotifications)
    setState({ recentRewards: updatedRewards })

    // Also update the user store if it's AGI, XP, or lottery tickets
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
      dismissReward(id)
    }, 5000)
  }

  const dismissReward = (id: string) => {
    setState({
      recentRewards: state.recentRewards.map((r) =>
        r.id === id ? { ...r, isVisible: false } : r
      ),
    })

    // Remove from list after animation
    setTimeout(() => {
      setState({
        recentRewards: state.recentRewards.filter((r) => r.id !== id),
      })
    }, 300)
  }

  const clearAllRewards = () => {
    setState({ recentRewards: [] })
  }

  // ============ LOTTERY ============

  const addLotteryResult = (result: LotteryResult) => {
    setState({
      lotteryResults: [result, ...state.lotteryResults].slice(0, 20),
    })
  }

  const startLotteryAnimation = (result: LotteryResult) => {
    setState({
      currentLotteryAnimation: result,
      isAnimatingLottery: true,
    })
  }

  const endLotteryAnimation = () => {
    const currentLotteryAnimation = state.currentLotteryAnimation

    if (currentLotteryAnimation) {
      // Add rewards after animation
      if (currentLotteryAnimation.userWon) {
        addReward('lottery_win', currentLotteryAnimation.agiReward, `Lottery Win - ${currentLotteryAnimation.synapseType} Synapse`)
        addReward('xp', currentLotteryAnimation.xpReward, `Lottery Win - ${currentLotteryAnimation.synapseType} Synapse`)
      } else if (currentLotteryAnimation.userConsolationTickets > 0) {
        addReward('lottery_ticket', currentLotteryAnimation.userConsolationTickets, 'Lottery Consolation')
      }

      // Add to history
      addLotteryResult(currentLotteryAnimation)
    }

    setState({
      currentLotteryAnimation: null,
      isAnimatingLottery: false,
    })
  }

  const useLotteryTickets = async (count: number): Promise<boolean> => {
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
  }

  // ============ LEADERBOARD ============

  const fetchLeaderboard = async (type: LeaderboardType) => {
    setState({ isLoadingLeaderboard: true })

    try {
      const userId = userStore.userId
      const response = await fetch(`${API_URL}/api/leaderboard/${type}?userId=${userId}`)

      if (!response.ok) {
        setState({ isLoadingLeaderboard: false })
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

      setState('leaderboardData', type, leaderboardData)
      setState({ isLoadingLeaderboard: false })
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
      setState({ isLoadingLeaderboard: false })
    }
  }

  const refreshLeaderboard = async () => {
    await fetchLeaderboard(state.activeLeaderboardType)
  }

  const setActiveLeaderboardType = (type: LeaderboardType) => {
    setState({ activeLeaderboardType: type })

    // Fetch if not cached or stale (older than 5 minutes)
    const cached = state.leaderboardData[type]
    if (!cached || Date.now() - cached.lastUpdated > 5 * 60 * 1000) {
      fetchLeaderboard(type)
    }
  }

  // ============ UI ============

  const setShowNotifications = (show: boolean) => {
    setState({ showNotifications: show })
  }

  // ============ HELPERS ============

  const getTotalUnclaimedAgi = (): number => {
    return state.recentRewards
      .filter((r) => (r.type === 'agi' || r.type === 'lottery_win') && r.isVisible)
      .reduce((sum, r) => sum + r.amount, 0)
  }

  const getRecentLotteryWins = (): LotteryResult[] => {
    return state.lotteryResults.filter((r) => r.userWon).slice(0, 5)
  }

  return {
    // ============ REACTIVE GETTERS ============
    // Recent Rewards
    get recentRewards() { return state.recentRewards },
    get maxRewardNotifications() { return state.maxRewardNotifications },

    // Lottery Results
    get lotteryResults() { return state.lotteryResults },
    get currentLotteryAnimation() { return state.currentLotteryAnimation },
    get isAnimatingLottery() { return state.isAnimatingLottery },

    // Leaderboard Data
    get leaderboardData() { return state.leaderboardData },
    get activeLeaderboardType() { return state.activeLeaderboardType },
    get isLoadingLeaderboard() { return state.isLoadingLeaderboard },

    // UI State
    get showNotifications() { return state.showNotifications },

    // ============ COMPUTED SELECTORS ============
    get visibleRewards() { return state.recentRewards.filter((r) => r.isVisible) },
    get activeLeaderboard() { return state.leaderboardData[state.activeLeaderboardType] },

    // ============ ACTIONS ============
    // Reward Notifications
    addReward,
    dismissReward,
    clearAllRewards,

    // Lottery
    addLotteryResult,
    startLotteryAnimation,
    endLotteryAnimation,
    useLotteryTickets,

    // Leaderboard
    fetchLeaderboard,
    refreshLeaderboard,
    setActiveLeaderboardType,

    // UI
    setShowNotifications,

    // Helpers
    getTotalUnclaimedAgi,
    getRecentLotteryWins,
  }
}

export const rewardStore = createRoot(createRewardStore)

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
