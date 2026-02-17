// SolidJS Store Exports
// Reactive stores using SolidJS primitives

// Config store - game configuration, settings
export { configStore } from './configStore'
export type { ServerConfig, UserLevelConfig } from './configStore'

// User store - user state, levels, currencies
export { userStore } from './userStore'
export type { UserState } from './userStore'

// Ship store - ships (replacing agents), autopilot, items
export { shipStore } from './shipStore'
export type {
  Ship,
  ShipStatus,
  ShipCluster,
  Synapse,
  SynapseCluster,
  ExplorerInfo,
  SynapseDiscoveryEvent,
  LootEvent,
} from './shipStore'

// Teneo store - Teneo community points integration
export { teneoStore } from './teneoStore'

// Event store - live events with multipliers and bonuses
export { eventStore } from './eventStore'

// UI store - local UI preferences and settings
export { uiStore } from './uiStore'
