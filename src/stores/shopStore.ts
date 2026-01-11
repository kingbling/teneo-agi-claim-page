import { create } from 'zustand'
import {
  type ItemType,
  type ItemDefinition,
  ITEM_DEFINITIONS,
} from '@/types/game'
import { useUserStore } from './userStore'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}

// ============================================================================
// MASTERPLAN 2026: SHOP STORE
// Manages item shop state, purchases, and active item effects
// ============================================================================

// User's purchased item with expiration tracking
export interface UserItem {
  id: string
  itemType: ItemType
  purchasedAt: number           // Unix timestamp
  expiresAt: number | null      // Unix timestamp, null = permanent/single-use
  isActive: boolean             // Currently equipped/active
  usesRemaining: number | null  // For single-use items
}

// Shop item with user-specific state
export interface ShopItem extends ItemDefinition {
  isOwned: boolean
  ownedItem?: UserItem
  canPurchase: boolean
  purchaseError?: string
}

// Purchase result from API
export interface PurchaseResult {
  success: boolean
  item?: UserItem
  newBalance?: number
  error?: string
}

// Store State
export interface ShopState {
  // Available shop items
  shopItems: ShopItem[]
  isLoadingShopItems: boolean

  // User's purchased items
  userItems: UserItem[]
  isLoadingUserItems: boolean

  // Purchase state
  purchasingItemId: ItemType | null
  purchaseError: string | null

  // Confirmation dialog
  confirmationDialog: {
    isOpen: boolean
    item: ItemDefinition | null
    isPurchasing: boolean
    error: string | null
  }

  // Active effects (items currently providing bonuses)
  activeEffects: {
    speedBoost: number      // Multiplier (e.g., 1.10 = +10%)
    luckBonus: number       // Additive bonus (e.g., 0.05 = +5%)
    xpAmplifier: number     // Multiplier (e.g., 1.15 = +15%)
    radarActive: boolean    // Shows hidden synapses
    cloakActive: boolean    // Hides from explorer count
  }
}

export interface ShopActions {
  // Shop Items
  fetchShopItems: () => Promise<void>
  getShopItemsByCategory: (category: ItemCategory) => ShopItem[]

  // User Items
  fetchUserItems: () => Promise<void>
  getActiveItems: () => UserItem[]
  getOwnedItemByType: (itemType: ItemType) => UserItem | undefined

  // Purchase Flow
  openPurchaseConfirmation: (itemType: ItemType) => void
  closePurchaseConfirmation: () => void
  confirmPurchase: () => Promise<boolean>
  purchaseItem: (itemType: ItemType) => Promise<PurchaseResult>

  // Item Activation
  activateItem: (itemId: string) => Promise<boolean>
  deactivateItem: (itemId: string) => Promise<boolean>

  // Effect Calculations
  calculateActiveEffects: () => void
  getSpeedMultiplier: () => number
  getLuckBonus: () => number
  getXpMultiplier: () => number
  isRadarActive: () => boolean
  isCloakActive: () => boolean

  // Cleanup
  checkExpiredItems: () => void
}

export type ShopStore = ShopState & ShopActions

// Item categories for filtering
export type ItemCategory = 'speed' | 'luck' | 'xp' | 'radar' | 'cloak' | 'all'

const ITEM_CATEGORIES: Record<ItemType, ItemCategory> = {
  speed_boost: 'speed',
  luck_charm: 'luck',
  xp_amplifier: 'xp',
  radar: 'radar',
  cloak: 'cloak',
}

const initialState: ShopState = {
  shopItems: [],
  isLoadingShopItems: false,

  userItems: [],
  isLoadingUserItems: false,

  purchasingItemId: null,
  purchaseError: null,

  confirmationDialog: {
    isOpen: false,
    item: null,
    isPurchasing: false,
    error: null,
  },

  activeEffects: {
    speedBoost: 1.0,
    luckBonus: 0,
    xpAmplifier: 1.0,
    radarActive: false,
    cloakActive: false,
  },
}

export const useShopStore = create<ShopStore>((set, get) => ({
  ...initialState,

  // ============ SHOP ITEMS ============

  fetchShopItems: async () => {
    set({ isLoadingShopItems: true })

    try {
      // Fetch user's owned items first
      await get().fetchUserItems()

      const { userItems } = get()
      const agenticBalance = useUserStore.getState().agenticBalance

      // Build shop items from definitions with user state
      const shopItems: ShopItem[] = Object.values(ITEM_DEFINITIONS).map((def) => {
        const ownedItem = userItems.find(
          (ui) => ui.itemType === def.id && (ui.expiresAt === null || ui.expiresAt > Date.now())
        )
        const canAfford = agenticBalance >= def.cost

        return {
          ...def,
          isOwned: !!ownedItem,
          ownedItem,
          canPurchase: canAfford && !ownedItem,
          purchaseError: !canAfford
            ? `Need ${def.cost - agenticBalance} more $AGENTIC`
            : ownedItem
            ? 'Already owned'
            : undefined,
        }
      })

      set({ shopItems, isLoadingShopItems: false })
    } catch (error) {
      console.error('Failed to fetch shop items:', error)
      set({ isLoadingShopItems: false })
    }
  },

  getShopItemsByCategory: (category: ItemCategory): ShopItem[] => {
    const { shopItems } = get()
    if (category === 'all') return shopItems
    return shopItems.filter((item) => ITEM_CATEGORIES[item.id] === category)
  },

  // ============ USER ITEMS ============

  fetchUserItems: async () => {
    const userId = useUserStore.getState().userId
    if (!userId) return

    set({ isLoadingUserItems: true })

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/items`)
      if (!response.ok) {
        throw new Error('Failed to fetch user items')
      }

      const items: UserItem[] = await response.json()

      // Filter out expired items
      const validItems = items.filter(
        (item) => item.expiresAt === null || item.expiresAt > Date.now()
      )

      set({ userItems: validItems, isLoadingUserItems: false })

      // Recalculate active effects
      get().calculateActiveEffects()
    } catch (error) {
      console.error('Failed to fetch user items:', error)
      set({ isLoadingUserItems: false })
    }
  },

  getActiveItems: (): UserItem[] => {
    const { userItems } = get()
    const now = Date.now()
    return userItems.filter(
      (item) => item.isActive && (item.expiresAt === null || item.expiresAt > now)
    )
  },

  getOwnedItemByType: (itemType: ItemType): UserItem | undefined => {
    const { userItems } = get()
    const now = Date.now()
    return userItems.find(
      (item) =>
        item.itemType === itemType &&
        (item.expiresAt === null || item.expiresAt > now)
    )
  },

  // ============ PURCHASE FLOW ============

  openPurchaseConfirmation: (itemType: ItemType) => {
    const item = ITEM_DEFINITIONS[itemType]
    if (!item) return

    set({
      confirmationDialog: {
        isOpen: true,
        item,
        isPurchasing: false,
        error: null,
      },
    })
  },

  closePurchaseConfirmation: () => {
    set({
      confirmationDialog: {
        isOpen: false,
        item: null,
        isPurchasing: false,
        error: null,
      },
    })
  },

  confirmPurchase: async (): Promise<boolean> => {
    const { confirmationDialog } = get()
    if (!confirmationDialog.item) return false

    set({
      confirmationDialog: {
        ...confirmationDialog,
        isPurchasing: true,
        error: null,
      },
    })

    const result = await get().purchaseItem(confirmationDialog.item.id)

    if (result.success) {
      get().closePurchaseConfirmation()
      // Refresh shop items to update state
      await get().fetchShopItems()
      return true
    } else {
      set({
        confirmationDialog: {
          ...get().confirmationDialog,
          isPurchasing: false,
          error: result.error || 'Purchase failed',
        },
      })
      return false
    }
  },

  purchaseItem: async (itemType: ItemType): Promise<PurchaseResult> => {
    const userId = useUserStore.getState().userId
    if (!userId) {
      return { success: false, error: 'Not logged in' }
    }

    const item = ITEM_DEFINITIONS[itemType]
    if (!item) {
      return { success: false, error: 'Invalid item' }
    }

    const agenticBalance = useUserStore.getState().agenticBalance
    if (agenticBalance < item.cost) {
      return { success: false, error: 'Insufficient $AGENTIC balance' }
    }

    set({ purchasingItemId: itemType, purchaseError: null })

    try {
      const response = await fetch(`${API_URL}/api/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          itemType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Purchase failed')
      }

      const result = await response.json()

      // Update user's agentic balance
      useUserStore.getState().spendAgentic(item.cost)

      // Add item to user's inventory
      const newItem: UserItem = {
        id: result.itemId || `${itemType}-${Date.now()}`,
        itemType,
        purchasedAt: Date.now(),
        expiresAt: item.duration ? Date.now() + item.duration * 60 * 1000 : null,
        isActive: true,
        usesRemaining: item.duration === null ? 1 : null,
      }

      set((state) => ({
        userItems: [...state.userItems, newItem],
        purchasingItemId: null,
      }))

      // Recalculate effects
      get().calculateActiveEffects()

      return {
        success: true,
        item: newItem,
        newBalance: agenticBalance - item.cost,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed'
      set({ purchasingItemId: null, purchaseError: errorMessage })
      return { success: false, error: errorMessage }
    }
  },

  // ============ ITEM ACTIVATION ============

  activateItem: async (itemId: string): Promise<boolean> => {
    const { userItems } = get()
    const item = userItems.find((i) => i.id === itemId)
    if (!item) return false

    try {
      const response = await fetch(`${API_URL}/api/items/${itemId}/activate`, {
        method: 'POST',
      })

      if (!response.ok) {
        return false
      }

      set((state) => ({
        userItems: state.userItems.map((i) =>
          i.id === itemId ? { ...i, isActive: true } : i
        ),
      }))

      get().calculateActiveEffects()
      return true
    } catch (error) {
      console.error('Failed to activate item:', error)
      return false
    }
  },

  deactivateItem: async (itemId: string): Promise<boolean> => {
    const { userItems } = get()
    const item = userItems.find((i) => i.id === itemId)
    if (!item) return false

    try {
      const response = await fetch(`${API_URL}/api/items/${itemId}/deactivate`, {
        method: 'POST',
      })

      if (!response.ok) {
        return false
      }

      set((state) => ({
        userItems: state.userItems.map((i) =>
          i.id === itemId ? { ...i, isActive: false } : i
        ),
      }))

      get().calculateActiveEffects()
      return true
    } catch (error) {
      console.error('Failed to deactivate item:', error)
      return false
    }
  },

  // ============ EFFECT CALCULATIONS ============

  calculateActiveEffects: () => {
    const activeItems = get().getActiveItems()

    const effects = {
      speedBoost: 1.0,
      luckBonus: 0,
      xpAmplifier: 1.0,
      radarActive: false,
      cloakActive: false,
    }

    activeItems.forEach((item) => {
      const def = ITEM_DEFINITIONS[item.itemType]
      if (!def) return

      switch (item.itemType) {
        case 'speed_boost':
          effects.speedBoost += def.effectValue
          break
        case 'luck_charm':
          effects.luckBonus += def.effectValue
          break
        case 'xp_amplifier':
          effects.xpAmplifier += def.effectValue
          break
        case 'radar':
          effects.radarActive = true
          break
        case 'cloak':
          effects.cloakActive = true
          break
      }
    })

    set({ activeEffects: effects })
  },

  getSpeedMultiplier: (): number => {
    return get().activeEffects.speedBoost
  },

  getLuckBonus: (): number => {
    return get().activeEffects.luckBonus
  },

  getXpMultiplier: (): number => {
    return get().activeEffects.xpAmplifier
  },

  isRadarActive: (): boolean => {
    return get().activeEffects.radarActive
  },

  isCloakActive: (): boolean => {
    return get().activeEffects.cloakActive
  },

  // ============ CLEANUP ============

  checkExpiredItems: () => {
    const now = Date.now()
    const { userItems } = get()

    const validItems = userItems.filter(
      (item) => item.expiresAt === null || item.expiresAt > now
    )

    if (validItems.length !== userItems.length) {
      set({ userItems: validItems })
      get().calculateActiveEffects()
    }
  },
}))

// ============ SELECTORS ============

export const selectShopItems = (state: ShopStore) => state.shopItems
export const selectUserItems = (state: ShopStore) => state.userItems
export const selectActiveEffects = (state: ShopStore) => state.activeEffects
export const selectConfirmationDialog = (state: ShopStore) => state.confirmationDialog
export const selectIsLoadingShop = (state: ShopStore) => state.isLoadingShopItems
export const selectPurchasingItemId = (state: ShopStore) => state.purchasingItemId

// ============ HELPER FUNCTIONS ============

export function getItemIcon(itemType: ItemType): string {
  switch (itemType) {
    case 'speed_boost':
      return 'Zap'
    case 'luck_charm':
      return 'Clover'
    case 'xp_amplifier':
      return 'TrendingUp'
    case 'radar':
      return 'Radar'
    case 'cloak':
      return 'Eye'
    default:
      return 'Package'
  }
}

export function getItemCategoryLabel(category: ItemCategory): string {
  switch (category) {
    case 'speed':
      return 'Speed'
    case 'luck':
      return 'Luck'
    case 'xp':
      return 'XP'
    case 'radar':
      return 'Radar'
    case 'cloak':
      return 'Cloak'
    case 'all':
      return 'All Items'
  }
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Single use'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function getRemainingTime(expiresAt: number | null): string {
  if (expiresAt === null) return 'Permanent'
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return 'Expired'
  const minutes = Math.ceil(remaining / 60000)
  return formatDuration(minutes)
}
