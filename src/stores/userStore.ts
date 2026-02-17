import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  type UserLevel,
  type SynapseType,
  calculateUserLevel,
  getUserLevelConfig,
  getMaxShipsForUserLevel,
} from '@/types/game'
import { authStore } from './authStore'
import { shipStore } from './shipStore'
import { API_URL } from '@/constants/api'
import { log } from '@/utils/logger'

// ============================================================================
// MASTERPLAN 2026: USER STORE
// Manages user state, levels, currencies, and progression
// ============================================================================

export interface UserState {
  // Identity
  userId: string | null
  userWallet: string | null

  // Legacy points (for migration)
  userPoints: number
  userTier: string

  // Masterplan 2026: User Level (1-5 based on USDC spent)
  // Single level system - Brain Level (XP-based) has been removed
  userLevel: UserLevel
  usdcSpent: number
  pointsPerMinMultiplier: number     // Level Boost: multiplier for points/min spending

  // Masterplan 2026: Token Balances
  agenticBalance: number             // $AGENTIC for shop purchases
  totalAgiEarned: number             // Total $AGI earned
  totalTeneoEarned: number           // Total $TENEO earned

  // Masterplan 2026: Lottery & NFTs
  lotteryTickets: number
  nftCount: number

  // Masterplan 2026: Ship Management
  maxShips: number                   // Max ships allowed (from user level)
  currentShipCount: number           // Current ships owned

  // Masterplan 2026: Unlocked Content
  unlockedSynapseTypes: SynapseType[]

  // Loading State
  isLoading: boolean
  error: string | null
}

const initialState: UserState = {
  // Identity
  userId: null,
  userWallet: null,

  // Legacy
  userPoints: 0,
  userTier: 'free',

  // User Level (Masterplan 2026: Single USDC-based level system)
  userLevel: 1,
  usdcSpent: 0,
  pointsPerMinMultiplier: 1.0,

  // Tokens
  agenticBalance: 0,
  totalAgiEarned: 0,
  totalTeneoEarned: 0,

  // Lottery & NFTs
  lotteryTickets: 0,
  nftCount: 0,

  // Ships
  maxShips: 1,  // L1 starts with 1 ship
  currentShipCount: 0,

  // Unlocks
  unlockedSynapseTypes: [],  // All types unlocked (populated from configStore)

  // UI State
  isLoading: false,
  error: null,
}

function createUserStore() {
  const [state, setState] = createStore<UserState>({ ...initialState })

  // ============ AUTHENTICATION ============

  const loginUser = async (wallet: string): Promise<boolean> => {
    setState({ isLoading: true, error: null })

    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authStore.getAuthHeader(),
        },
        body: JSON.stringify({ wallet }),
      })

      if (!response.ok) {
        throw new Error('Failed to login')
      }

      const user = await response.json()

      // Calculate derived state (Masterplan 2026: Single USDC-based level system)
      const userLevel = calculateUserLevel(user.usdc_spent || 0)
      const levelConfig = getUserLevelConfig(userLevel)

      setState({
        userId: user.id,
        userWallet: user.wallet,
        userPoints: user.points || 0,
        userTier: user.tier || 'free',

        // User Level (Masterplan 2026)
        userLevel,
        usdcSpent: user.usdc_spent || 0,
        pointsPerMinMultiplier: levelConfig.multiplier,

        // Tokens
        agenticBalance: user.agentic_balance || 0,
        totalAgiEarned: user.total_agi_earned || 0,
        totalTeneoEarned: user.total_teneo_earned || 0,

        // Lottery & NFTs
        lotteryTickets: user.lottery_tickets || 0,
        nftCount: user.nft_count || 0,

        // Ships (from User Level only)
        maxShips: getMaxShipsForUserLevel(userLevel),
        currentShipCount: 0, // Will be set by shipStore

        // Unlocks (from User Level)
        unlockedSynapseTypes: [],  // All types unlocked

        isLoading: false,
      })

      return true
    } catch (error) {
      log.user.error('Login failed:', error)
      setState({ isLoading: false, error: 'Failed to login' })
      return false
    }
  }

  const logout = () => {
    // CRITICAL: Clear ship selection and user ships before resetting user state
    // This prevents data leakage between users (e.g., User A's ship details visible to User B)
    shipStore.selectShip(null)
    shipStore.clearUserShips()

    authStore.clearAuth()
    setState({ ...initialState })
  }

  // ============ USDC SPENDING ============

  const recordUSDCSpent = async (amount: number): Promise<boolean> => {
    if (!state.userId) return false

    try {
      const response = await fetch(`${API_URL}/api/users/${state.userId}/usdc-spent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authStore.getAuthHeader(),
        },
        body: JSON.stringify({ amount }),
      })

      if (!response.ok) {
        throw new Error('Failed to record USDC spent')
      }

      const newTotal = state.usdcSpent + amount
      const newLevel = calculateUserLevel(newTotal)
      const levelConfig = getUserLevelConfig(newLevel)

      setState({
        usdcSpent: newTotal,
        userLevel: newLevel,
        pointsPerMinMultiplier: levelConfig.multiplier,
        maxShips: getMaxShipsForUserLevel(newLevel),
        unlockedSynapseTypes: [],  // All types unlocked
      })

      return true
    } catch (error) {
      log.user.error('Failed to record USDC spent:', error)
      return false
    }
  }

  // ============ TOKEN MANAGEMENT ============

  const addAgi = (amount: number) => {
    setState('totalAgiEarned', (total) => total + amount)
  }

  const addTeneo = (amount: number) => {
    setState('totalTeneoEarned', (total) => total + amount)
  }

  // ============ LOTTERY ============

  const addLotteryTickets = (count: number) => {
    setState('lotteryTickets', (tickets) => tickets + count)
  }

  const spendLotteryTicket = (): boolean => {
    if (state.lotteryTickets < 1) return false
    setState('lotteryTickets', state.lotteryTickets - 1)
    return true
  }

  // ============ NFTs ============

  const addNFT = () => {
    setState('nftCount', (count) => count + 1)
  }

  // ============ POINTS ============

  const setUserPoints = (points: number) => {
    setState('userPoints', points)
  }

  // ============ SHIPS ============

  const setCurrentShipCount = (count: number) => {
    setState('currentShipCount', count)
  }

  const canCreateShip = (): boolean => {
    return state.currentShipCount < state.maxShips
  }

  // ============ UTILITY ============

  const refreshUserState = async (): Promise<void> => {
    if (!state.userId || !state.userWallet) return
    await loginUser(state.userWallet)
  }

  const getUserLevelLabel = (): string => {
    const config = getUserLevelConfig(state.userLevel)
    return `L${state.userLevel} ${config.label}`
  }

  return {
    // ============ REACTIVE GETTERS ============
    // Identity
    get userId() { return state.userId },
    get userWallet() { return state.userWallet },

    // Legacy
    get userPoints() { return state.userPoints },
    get userTier() { return state.userTier },

    // User Level (Masterplan 2026: Single USDC-based level system)
    get userLevel() { return state.userLevel },
    get usdcSpent() { return state.usdcSpent },
    get pointsPerMinMultiplier() { return state.pointsPerMinMultiplier },

    // Tokens
    get agenticBalance() { return state.agenticBalance },
    get totalAgiEarned() { return state.totalAgiEarned },
    get totalTeneoEarned() { return state.totalTeneoEarned },

    // Lottery & NFTs
    get lotteryTickets() { return state.lotteryTickets },
    get nftCount() { return state.nftCount },

    // Ships
    get maxShips() { return state.maxShips },
    get currentShipCount() { return state.currentShipCount },

    // Unlocks
    get unlockedSynapseTypes() { return state.unlockedSynapseTypes },

    // Loading State
    get isLoading() { return state.isLoading },
    get error() { return state.error },

    // ============ COMPUTED SELECTORS ============
    get isLoggedIn() { return state.userId !== null },

    // ============ ACTIONS ============
    // Authentication
    loginUser,
    logout,

    // USDC Spending
    recordUSDCSpent,

    // Token Management
    addAgi,
    addTeneo,

    // Lottery
    addLotteryTickets,
    spendLotteryTicket,

    // NFTs
    addNFT,

    // Points
    setUserPoints,

    // Ships
    setCurrentShipCount,
    canCreateShip,

    // Utility
    refreshUserState,
    getUserLevelLabel,
  }
}

export const userStore = createRoot(createUserStore)
