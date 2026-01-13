// SolidJS Store Exports
// Reactive stores using SolidJS primitives

// Config store - game configuration, settings
export { configStore } from './configStore'
export type { GameConfig, ConfigState } from './configStore'

// User store - user state, levels, currencies, brain progression
export { userStore } from './userStore'
export type {
  UserState,
  LevelProgress,
  BrainProgression,
} from './userStore'

// Brain region store - UI state for brain visualization
export { brainRegionStore } from './brainRegionStore'
export type { BrainRegionState } from './brainRegionStore'

// Ship store - ships (replacing agents), autopilot, items
export { shipStore } from './shipStore'
export type {
  Ship,
  ShipStatus,
  ShipCluster,
  Synapse,
  SynapseCluster,
  EquippedItem,
  AutopilotPreferences,
  ExplorerInfo,
  SynapseDiscoveryEvent,
  LootEvent,
  ShipState,
} from './shipStore'

// Event store - live events with multipliers and bonuses
export { eventStore } from './eventStore'
export type {
  LiveEvent,
  EventType,
  EventStatus,
  EventMultiplier,
  EventMilestone,
  EventState,
} from './eventStore'

// Shop store - item shop, purchases, active effects
export { shopStore } from './shopStore'
export type {
  ShopItem,
  UserItem,
  PurchaseResult,
  ItemCategory,
  ShopState,
} from './shopStore'

// UI store - local UI preferences and settings
export { uiStore } from './uiStore'
