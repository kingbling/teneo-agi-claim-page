// Shop Components - Masterplan 2026
// Item shop system for purchasing game items with $AGENTIC currency

export { ItemShop } from './ItemShop'
export { ShopItemCard } from './ShopItemCard'
export { PurchaseConfirmation, PurchaseSuccessOverlay } from './PurchaseConfirmation'

// Re-export store types and utilities
export type {
  ShopItem,
  UserItem,
  PurchaseResult,
  ItemCategory,
} from '@/stores/shopStore'

export {
  shopStore,
  getItemIcon,
  getItemCategoryLabel,
  formatDuration,
  getRemainingTime,
} from '@/stores/shopStore'
