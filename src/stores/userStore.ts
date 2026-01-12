import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  type UserLevel,
  type SynapseType,
  calculateUserLevel,
  getUserLevelConfig,
  getXPForLevel,
  getTotalXPForLevel,
  getLevelFromTotalXP,
  getMaxShipsForBrainLevel,
  getUnlockedSynapseTypes,
  BRAIN_LEVEL_CONFIG,
} from '@/types/game'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}

// localStorage keys
const STORAGE_KEY_WALLET = 'teneo_wallet'

// Persistence helpers
function saveWalletToStorage(wallet: string) {
  try {
    localStorage.setItem(STORAGE_KEY_WALLET, wallet)
  } catch {
    // localStorage might be disabled
  }
}

function loadWalletFromStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_WALLET)
  } catch {
    return null
  }
}

function clearWalletFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY_WALLET)
  } catch {
    // localStorage might be disabled
  }
}

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
  userLevel: UserLevel
  usdcSpent: number
  rewardMultiplier: number

  // Masterplan 2026: Brain Level (1-248 with XP progression)
  brainLevel: number
  brainXP: number                    // XP towards next level
  totalBrainXP: number               // Lifetime XP
  xpToNextLevel: number              // XP needed for next level
  xpProgress: number                 // Progress percentage (0-100)

  // Masterplan 2026: Token Balances
  agenticBalance: number             // $AGENTIC for shop purchases
  totalAgiEarned: number             // Total $AGI earned
  totalTeneoEarned: number           // Total $TENEO earned

  // Masterplan 2026: Lottery & NFTs
  lotteryTickets: number
  nftCount: number

  // Masterplan 2026: Ship Management
  maxShips: number                   // Max ships allowed (from user level + brain level)
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

  // User Level
  userLevel: 1,
  usdcSpent: 0,
  rewardMultiplier: 1.0,

  // Brain Level
  brainLevel: 1,
  brainXP: 0,
  totalBrainXP: 0,
  xpToNextLevel: getXPForLevel(1),
  xpProgress: 0,

  // Tokens
  agenticBalance: 0,
  totalAgiEarned: 0,
  totalTeneoEarned: 0,

  // Lottery & NFTs
  lotteryTickets: 0,
  nftCount: 0,

  // Ships
  maxShips: 3,  // Default to 3 (brain level 25)
  currentShipCount: 0,

  // Unlocks
  unlockedSynapseTypes: ['minor'],

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      })

      if (!response.ok) {
        throw new Error('Failed to login')
      }

      const user = await response.json()

      // Calculate derived state
      const userLevel = calculateUserLevel(user.usdc_spent || 0)
      const levelConfig = getUserLevelConfig(userLevel)
      const brainLevel = user.brain_level || 1
      const totalBrainXP = user.total_brain_xp || 0
      const xpToNextLevel = getXPForLevel(brainLevel)
      const xpAtCurrentLevel = getTotalXPForLevel(brainLevel)
      const xpProgress = xpToNextLevel > 0
        ? Math.min(100, ((totalBrainXP - xpAtCurrentLevel) / xpToNextLevel) * 100)
        : 100

      // Save wallet to localStorage for persistence
      saveWalletToStorage(wallet)

      setState({
        userId: user.id,
        userWallet: user.wallet,
        userPoints: user.points || 0,
        userTier: user.tier || 'free',

        // User Level
        userLevel,
        usdcSpent: user.usdc_spent || 0,
        rewardMultiplier: levelConfig.multiplier,

        // Brain Level
        brainLevel,
        brainXP: user.brain_xp || 0,
        totalBrainXP,
        xpToNextLevel,
        xpProgress,

        // Tokens
        agenticBalance: user.agentic_balance || 0,
        totalAgiEarned: user.total_agi_earned || 0,
        totalTeneoEarned: user.total_teneo_earned || 0,

        // Lottery & NFTs
        lotteryTickets: user.lottery_tickets || 0,
        nftCount: user.nft_count || 0,

        // Ships
        maxShips: Math.max(levelConfig.maxShips, getMaxShipsForBrainLevel(brainLevel)),
        currentShipCount: 0, // Will be set by shipStore

        // Unlocks
        unlockedSynapseTypes: getUnlockedSynapseTypes(brainLevel),

        isLoading: false,
      })

      return true
    } catch (error) {
      console.error('Login failed:', error)
      setState({ isLoading: false, error: 'Failed to login' })
      return false
    }
  }

  const logout = () => {
    clearWalletFromStorage()
    setState({ ...initialState })
  }

  // Auto-login from stored wallet
  const initFromStorage = async (): Promise<boolean> => {
    const storedWallet = loadWalletFromStorage()
    if (storedWallet) {
      return loginUser(storedWallet)
    }
    return false
  }

  // ============ USDC SPENDING ============

  const recordUSDCSpent = async (amount: number): Promise<boolean> => {
    if (!state.userId) return false

    try {
      const response = await fetch(`${API_URL}/api/users/${state.userId}/usdc-spent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        rewardMultiplier: levelConfig.multiplier,
        maxShips: Math.max(levelConfig.maxShips, getMaxShipsForBrainLevel(state.brainLevel)),
      })

      return true
    } catch (error) {
      console.error('Failed to record USDC spent:', error)
      return false
    }
  }

  // ============ BRAIN XP ============

  const addBrainXP = (xp: number) => {
    const newTotalXP = state.totalBrainXP + xp
    const newBrainLevel = getLevelFromTotalXP(newTotalXP)
    const xpToNextLevel = getXPForLevel(newBrainLevel)
    const xpAtCurrentLevel = getTotalXPForLevel(newBrainLevel)
    const xpProgress = xpToNextLevel > 0
      ? Math.min(100, ((newTotalXP - xpAtCurrentLevel) / xpToNextLevel) * 100)
      : 100

    const levelConfig = getUserLevelConfig(state.userLevel)
    const previousBrainLevel = state.brainLevel

    setState({
      brainXP: newTotalXP - xpAtCurrentLevel,
      totalBrainXP: newTotalXP,
      brainLevel: newBrainLevel,
      xpToNextLevel,
      xpProgress,
      unlockedSynapseTypes: getUnlockedSynapseTypes(newBrainLevel),
      maxShips: Math.max(levelConfig.maxShips, getMaxShipsForBrainLevel(newBrainLevel)),
    })

    // Check for level up
    if (newBrainLevel > previousBrainLevel) {
      console.log(`Brain Level Up! ${previousBrainLevel} -> ${newBrainLevel}`)
      // Could emit event here for UI notification
    }
  }

  // ============ TOKEN MANAGEMENT ============

  const addAgentic = (amount: number) => {
    setState('agenticBalance', (balance) => balance + amount)
  }

  const spendAgentic = (amount: number): boolean => {
    if (state.agenticBalance < amount) return false
    setState('agenticBalance', state.agenticBalance - amount)
    return true
  }

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

  const getBrainLevelLabel = (): string => {
    if (state.brainLevel >= BRAIN_LEVEL_CONFIG.maxLevel) {
      return `Brain Level MAX (${BRAIN_LEVEL_CONFIG.maxLevel})`
    }
    return `Brain Level ${state.brainLevel}`
  }

  return {
    // ============ REACTIVE GETTERS ============
    // Identity
    get userId() { return state.userId },
    get userWallet() { return state.userWallet },

    // Legacy
    get userPoints() { return state.userPoints },
    get userTier() { return state.userTier },

    // User Level
    get userLevel() { return state.userLevel },
    get usdcSpent() { return state.usdcSpent },
    get rewardMultiplier() { return state.rewardMultiplier },

    // Brain Level
    get brainLevel() { return state.brainLevel },
    get brainXP() { return state.brainXP },
    get totalBrainXP() { return state.totalBrainXP },
    get xpToNextLevel() { return state.xpToNextLevel },
    get xpProgress() { return state.xpProgress },

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
    initFromStorage,

    // USDC Spending
    recordUSDCSpent,

    // Brain XP
    addBrainXP,

    // Token Management
    addAgentic,
    spendAgentic,
    addAgi,
    addTeneo,

    // Lottery
    addLotteryTickets,
    spendLotteryTicket,

    // NFTs
    addNFT,

    // Ships
    setCurrentShipCount,
    canCreateShip,

    // Utility
    refreshUserState,
    getUserLevelLabel,
    getBrainLevelLabel,
  }
}

export const userStore = createRoot(createUserStore)
