import { create } from 'zustand'
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

export interface UserActions {
  // Authentication
  loginUser: (wallet: string) => Promise<boolean>
  logout: () => void
  initFromStorage: () => Promise<boolean>

  // USDC Spending (upgrades user level)
  recordUSDCSpent: (amount: number) => Promise<boolean>

  // Brain XP (from synapse completions)
  addBrainXP: (xp: number) => void

  // Token Management
  addAgentic: (amount: number) => void
  spendAgentic: (amount: number) => boolean
  addAgi: (amount: number) => void
  addTeneo: (amount: number) => void

  // Lottery
  addLotteryTickets: (count: number) => void
  spendLotteryTicket: () => boolean

  // NFTs
  addNFT: () => void

  // Ships
  setCurrentShipCount: (count: number) => void
  canCreateShip: () => boolean

  // Utility
  refreshUserState: () => Promise<void>
  getUserLevelLabel: () => string
  getBrainLevelLabel: () => string
}

export type UserStore = UserState & UserActions

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

export const useUserStore = create<UserStore>((set, get) => ({
  ...initialState,

  // ============ AUTHENTICATION ============

  loginUser: async (wallet: string) => {
    set({ isLoading: true, error: null })

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

      set({
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
      set({ isLoading: false, error: 'Failed to login' })
      return false
    }
  },

  logout: () => {
    clearWalletFromStorage()
    set(initialState)
  },

  // Auto-login from stored wallet
  initFromStorage: async () => {
    const storedWallet = loadWalletFromStorage()
    if (storedWallet) {
      return get().loginUser(storedWallet)
    }
    return false
  },

  // ============ USDC SPENDING ============

  recordUSDCSpent: async (amount: number) => {
    const { userId, usdcSpent } = get()
    if (!userId) return false

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/usdc-spent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })

      if (!response.ok) {
        throw new Error('Failed to record USDC spent')
      }

      const newTotal = usdcSpent + amount
      const newLevel = calculateUserLevel(newTotal)
      const levelConfig = getUserLevelConfig(newLevel)

      set({
        usdcSpent: newTotal,
        userLevel: newLevel,
        rewardMultiplier: levelConfig.multiplier,
        maxShips: Math.max(levelConfig.maxShips, getMaxShipsForBrainLevel(get().brainLevel)),
      })

      return true
    } catch (error) {
      console.error('Failed to record USDC spent:', error)
      return false
    }
  },

  // ============ BRAIN XP ============

  addBrainXP: (xp: number) => {
    const { brainLevel, totalBrainXP, userLevel } = get()

    const newTotalXP = totalBrainXP + xp
    const newBrainLevel = getLevelFromTotalXP(newTotalXP)
    const xpToNextLevel = getXPForLevel(newBrainLevel)
    const xpAtCurrentLevel = getTotalXPForLevel(newBrainLevel)
    const xpProgress = xpToNextLevel > 0
      ? Math.min(100, ((newTotalXP - xpAtCurrentLevel) / xpToNextLevel) * 100)
      : 100

    const levelConfig = getUserLevelConfig(userLevel)

    set({
      brainXP: newTotalXP - xpAtCurrentLevel,
      totalBrainXP: newTotalXP,
      brainLevel: newBrainLevel,
      xpToNextLevel,
      xpProgress,
      unlockedSynapseTypes: getUnlockedSynapseTypes(newBrainLevel),
      maxShips: Math.max(levelConfig.maxShips, getMaxShipsForBrainLevel(newBrainLevel)),
    })

    // Check for level up
    if (newBrainLevel > brainLevel) {
      console.log(`Brain Level Up! ${brainLevel} -> ${newBrainLevel}`)
      // Could emit event here for UI notification
    }
  },

  // ============ TOKEN MANAGEMENT ============

  addAgentic: (amount: number) => {
    set((state) => ({
      agenticBalance: state.agenticBalance + amount,
    }))
  },

  spendAgentic: (amount: number) => {
    const { agenticBalance } = get()
    if (agenticBalance < amount) return false

    set({ agenticBalance: agenticBalance - amount })
    return true
  },

  addAgi: (amount: number) => {
    set((state) => ({
      totalAgiEarned: state.totalAgiEarned + amount,
    }))
  },

  addTeneo: (amount: number) => {
    set((state) => ({
      totalTeneoEarned: state.totalTeneoEarned + amount,
    }))
  },

  // ============ LOTTERY ============

  addLotteryTickets: (count: number) => {
    set((state) => ({
      lotteryTickets: state.lotteryTickets + count,
    }))
  },

  spendLotteryTicket: () => {
    const { lotteryTickets } = get()
    if (lotteryTickets < 1) return false

    set({ lotteryTickets: lotteryTickets - 1 })
    return true
  },

  // ============ NFTs ============

  addNFT: () => {
    set((state) => ({
      nftCount: state.nftCount + 1,
    }))
  },

  // ============ SHIPS ============

  setCurrentShipCount: (count: number) => {
    set({ currentShipCount: count })
  },

  canCreateShip: () => {
    const { currentShipCount, maxShips } = get()
    return currentShipCount < maxShips
  },

  // ============ UTILITY ============

  refreshUserState: async () => {
    const { userId, userWallet } = get()
    if (!userId || !userWallet) return

    await get().loginUser(userWallet)
  },

  getUserLevelLabel: () => {
    const { userLevel } = get()
    const config = getUserLevelConfig(userLevel)
    return `L${userLevel} ${config.label}`
  },

  getBrainLevelLabel: () => {
    const { brainLevel } = get()
    if (brainLevel >= BRAIN_LEVEL_CONFIG.maxLevel) {
      return `Brain Level MAX (${BRAIN_LEVEL_CONFIG.maxLevel})`
    }
    return `Brain Level ${brainLevel}`
  },
}))

// ============ SELECTORS ============

export const selectIsLoggedIn = (state: UserStore) => state.userId !== null
export const selectUserLevel = (state: UserStore) => state.userLevel
export const selectBrainLevel = (state: UserStore) => state.brainLevel
export const selectAgenticBalance = (state: UserStore) => state.agenticBalance
export const selectTotalAgiEarned = (state: UserStore) => state.totalAgiEarned
export const selectLotteryTickets = (state: UserStore) => state.lotteryTickets
export const selectMaxShips = (state: UserStore) => state.maxShips
export const selectUnlockedSynapseTypes = (state: UserStore) => state.unlockedSynapseTypes
export const selectXpProgress = (state: UserStore) => state.xpProgress
