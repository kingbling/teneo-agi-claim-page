import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  type ItemType,
  type ItemDefinition,
  ITEM_DEFINITIONS,
} from '@/types/game'
import { userStore } from './userStore'
import { API_URL } from '@/constants/api'
import { log } from '@/utils/logger'

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

function createShopStore() {
  const [state, setState] = createStore<ShopState>({ ...initialState })

  // ============ HELPER: GET ACTIVE ITEMS ============

  const getActiveItems = (): UserItem[] => {
    const now = Date.now()
    return state.userItems.filter(
      (item) => item.isActive && (item.expiresAt === null || item.expiresAt > now)
    )
  }

  // ============ EFFECT CALCULATIONS ============

  const calculateActiveEffects = () => {
    const activeItems = getActiveItems()

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

    setState({ activeEffects: effects })
  }

  // ============ USER ITEMS ============

  const fetchUserItems = async () => {
    const userId = userStore.userId
    if (!userId) return

    setState({ isLoadingUserItems: true })

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/items`)

      // Handle 404 gracefully - endpoint may not be implemented yet
      if (response.status === 404) {
        setState({ userItems: [], isLoadingUserItems: false })
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch user items')
      }

      const data = await response.json()

      // Handle both array response and object with items property
      const items: UserItem[] = Array.isArray(data) ? data : (data?.items ?? [])

      // Filter out expired items
      const validItems = items.filter(
        (item) => item.expiresAt === null || item.expiresAt > Date.now()
      )

      setState({ userItems: validItems, isLoadingUserItems: false })

      // Recalculate active effects
      calculateActiveEffects()
    } catch {
      // Silently handle network errors for this optional endpoint
      setState({ userItems: [], isLoadingUserItems: false })
    }
  }

  // ============ SHOP ITEMS ============

  const fetchShopItems = async () => {
    setState({ isLoadingShopItems: true })

    try {
      // Fetch user's owned items first
      await fetchUserItems()

      const agenticBalance = userStore.agenticBalance

      // Build shop items from definitions with user state
      const shopItems: ShopItem[] = Object.values(ITEM_DEFINITIONS).map((def) => {
        const ownedItem = state.userItems.find(
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

      setState({ shopItems, isLoadingShopItems: false })
    } catch (error) {
      log.shop.error('Failed to fetch shop items:', error)
      setState({ isLoadingShopItems: false })
    }
  }

  const getShopItemsByCategory = (category: ItemCategory): ShopItem[] => {
    if (category === 'all') return state.shopItems
    return state.shopItems.filter((item) => ITEM_CATEGORIES[item.id] === category)
  }

  const getOwnedItemByType = (itemType: ItemType): UserItem | undefined => {
    const now = Date.now()
    return state.userItems.find(
      (item) =>
        item.itemType === itemType &&
        (item.expiresAt === null || item.expiresAt > now)
    )
  }

  // ============ PURCHASE FLOW ============

  const openPurchaseConfirmation = (itemType: ItemType) => {
    const item = ITEM_DEFINITIONS[itemType]
    if (!item) return

    setState({
      confirmationDialog: {
        isOpen: true,
        item,
        isPurchasing: false,
        error: null,
      },
    })
  }

  const closePurchaseConfirmation = () => {
    setState({
      confirmationDialog: {
        isOpen: false,
        item: null,
        isPurchasing: false,
        error: null,
      },
    })
  }

  const purchaseItem = async (itemType: ItemType): Promise<PurchaseResult> => {
    const userId = userStore.userId
    if (!userId) {
      return { success: false, error: 'Not logged in' }
    }

    const item = ITEM_DEFINITIONS[itemType]
    if (!item) {
      return { success: false, error: 'Invalid item' }
    }

    const agenticBalance = userStore.agenticBalance
    if (agenticBalance < item.cost) {
      return { success: false, error: 'Insufficient $AGENTIC balance' }
    }

    setState({ purchasingItemId: itemType, purchaseError: null })

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
      userStore.spendAgentic(item.cost)

      // Add item to user's inventory
      const newItem: UserItem = {
        id: result.itemId || `${itemType}-${Date.now()}`,
        itemType,
        purchasedAt: Date.now(),
        expiresAt: item.duration ? Date.now() + item.duration * 60 * 1000 : null,
        isActive: true,
        usesRemaining: item.duration === null ? 1 : null,
      }

      setState({
        userItems: [...state.userItems, newItem],
        purchasingItemId: null,
      })

      // Recalculate effects
      calculateActiveEffects()

      return {
        success: true,
        item: newItem,
        newBalance: agenticBalance - item.cost,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed'
      setState({ purchasingItemId: null, purchaseError: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

  const confirmPurchase = async (): Promise<boolean> => {
    if (!state.confirmationDialog.item) return false

    setState({
      confirmationDialog: {
        ...state.confirmationDialog,
        isPurchasing: true,
        error: null,
      },
    })

    const result = await purchaseItem(state.confirmationDialog.item.id)

    if (result.success) {
      closePurchaseConfirmation()
      // Refresh shop items to update state
      await fetchShopItems()
      return true
    } else {
      setState({
        confirmationDialog: {
          ...state.confirmationDialog,
          isPurchasing: false,
          error: result.error || 'Purchase failed',
        },
      })
      return false
    }
  }

  // ============ ITEM ACTIVATION ============

  const activateItem = async (itemId: string): Promise<boolean> => {
    const item = state.userItems.find((i) => i.id === itemId)
    if (!item) return false

    try {
      const response = await fetch(`${API_URL}/api/items/${itemId}/activate`, {
        method: 'POST',
      })

      if (!response.ok) {
        return false
      }

      setState({
        userItems: state.userItems.map((i) =>
          i.id === itemId ? { ...i, isActive: true } : i
        ),
      })

      calculateActiveEffects()
      return true
    } catch (error) {
      log.shop.error('Failed to activate item:', error)
      return false
    }
  }

  const deactivateItem = async (itemId: string): Promise<boolean> => {
    const item = state.userItems.find((i) => i.id === itemId)
    if (!item) return false

    try {
      const response = await fetch(`${API_URL}/api/items/${itemId}/deactivate`, {
        method: 'POST',
      })

      if (!response.ok) {
        return false
      }

      setState({
        userItems: state.userItems.map((i) =>
          i.id === itemId ? { ...i, isActive: false } : i
        ),
      })

      calculateActiveEffects()
      return true
    } catch (error) {
      log.shop.error('Failed to deactivate item:', error)
      return false
    }
  }

  // ============ CLEANUP ============

  const checkExpiredItems = () => {
    const now = Date.now()

    const validItems = state.userItems.filter(
      (item) => item.expiresAt === null || item.expiresAt > now
    )

    if (validItems.length !== state.userItems.length) {
      setState({ userItems: validItems })
      calculateActiveEffects()
    }
  }

  return {
    // ============ REACTIVE GETTERS ============
    // Shop Items
    get shopItems() { return state.shopItems },
    get isLoadingShopItems() { return state.isLoadingShopItems },

    // User Items
    get userItems() { return state.userItems },
    get isLoadingUserItems() { return state.isLoadingUserItems },

    // Purchase State
    get purchasingItemId() { return state.purchasingItemId },
    get purchaseError() { return state.purchaseError },

    // Confirmation Dialog
    get confirmationDialog() { return state.confirmationDialog },

    // Active Effects
    get activeEffects() { return state.activeEffects },

    // ============ COMPUTED GETTERS ============
    get speedMultiplier() { return state.activeEffects.speedBoost },
    get luckBonus() { return state.activeEffects.luckBonus },
    get xpMultiplier() { return state.activeEffects.xpAmplifier },
    get isRadarActive() { return state.activeEffects.radarActive },
    get isCloakActive() { return state.activeEffects.cloakActive },

    // ============ ACTIONS ============
    // Shop Items
    fetchShopItems,
    getShopItemsByCategory,

    // User Items
    fetchUserItems,
    getActiveItems,
    getOwnedItemByType,

    // Purchase Flow
    openPurchaseConfirmation,
    closePurchaseConfirmation,
    confirmPurchase,
    purchaseItem,

    // Item Activation
    activateItem,
    deactivateItem,

    // Effect Calculations
    calculateActiveEffects,

    // Cleanup
    checkExpiredItems,
  }
}

export const shopStore = createRoot(createShopStore)

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
