// Masterplan 2026: Store Exports
// New modular store architecture replacing monolithic agentStore

// User store - user state, levels, currencies, brain progression
export {
  useUserStore,
  selectIsLoggedIn,
  selectUserLevel,
  selectBrainLevel,
  selectAgenticBalance,
  selectTotalAgiEarned,
  selectLotteryTickets,
  selectMaxShips,
  selectUnlockedSynapseTypes,
  selectXpProgress,
  type UserState,
  type UserActions,
  type UserStore,
} from './userStore'

// Ship store - ships (replacing agents), autopilot, items
export {
  useShipStore,
  selectUserShips,
  selectSelectedShip,
  selectExploringShips,
  selectIdleShips,
  selectCurrentExploration,
  selectDiscoveryProgress,
  selectRecentLoot,
  type Ship,
  type ShipStatus,
  type ShipCluster,
  type Synapse,
  type SynapseCluster,
  type EquippedItem,
  type AutopilotPreferences,
  type ExplorerInfo,
  type SynapseDiscoveryEvent,
  type LootEvent,
} from './shipStore'

// Exploration store - synapse exploration UI, spending controls, collaboration
export {
  useExplorationStore,
  selectActiveSynapse,
  selectCollaborators,
  selectExplorationDialog,
  selectNearbySynapses,
  selectIsExploring,
  getSynapseDescription,
  getSynapseRewardText,
  getSpendingRateOptions,
  type ExplorableSynapse,
  type Collaborator,
  type ExplorationDialogState,
} from './explorationStore'

// Sector store - sectors/seasons with progress tracking
export {
  useSectorStore,
  selectSectors,
  selectActiveSector,
  selectSectorProgress,
  selectIsLoadingSectors,
  selectUnlockedSectors,
  selectLockedSectors,
  getSectorStatusLabel,
  getSectorStatusColor,
  formatSectorReward,
  type Sector,
  type SectorStatus,
  type SectorReward,
  type SectorProgress,
  type SectorState,
  type SectorActions,
  type SectorStore,
} from './sectorStore'

// Event store - live events with multipliers and bonuses
export {
  useEventStore,
  selectActiveEvents,
  selectUpcomingEvents,
  selectPastEvents,
  selectIsLoadingEvents,
  selectDismissedEventIds,
  selectExpandedEventId,
  selectHasActiveEvents,
  getEventTypeLabel,
  getEventTypeIcon,
  formatTimeRemaining,
  formatMultiplier,
  type LiveEvent,
  type EventType,
  type EventStatus,
  type EventMultiplier,
  type EventMilestone,
  type EventState,
  type EventActions,
  type EventStore,
} from './eventStore'

// Shop store - item shop, purchases, active effects
export {
  useShopStore,
  selectShopItems,
  selectUserItems,
  selectActiveEffects,
  selectConfirmationDialog,
  selectIsLoadingShop,
  selectPurchasingItemId,
  getItemIcon,
  getItemCategoryLabel,
  formatDuration,
  getRemainingTime,
  type ShopItem,
  type UserItem,
  type PurchaseResult,
  type ItemCategory,
  type ShopState,
  type ShopActions,
  type ShopStore,
} from './shopStore'

// Reward store - rewards, lottery, leaderboard
export {
  useRewardStore,
  selectRecentRewards,
  selectIsAnimatingLottery,
  selectCurrentLotteryAnimation,
  selectActiveLeaderboard,
  selectLeaderboardType,
  selectIsLoadingLeaderboard,
  getRewardTypeLabel,
  getRewardTypeIcon,
  getLeaderboardTypeLabel,
  formatLeaderboardScore,
  type RewardType,
  type RewardNotification,
  type LotteryParticipant,
  type LotteryResult,
  type LeaderboardEntry,
  type LeaderboardType,
  type LeaderboardData,
  type RewardState,
  type RewardActions,
  type RewardStore,
} from './rewardStore'

// Legacy store - still used by existing components during migration
// Will be deprecated once all components migrate to new stores
export { useAgentStore } from './agentStore'
export { useConfigStore } from './configStore'
export { useBrainRegionStore } from './brainRegionStore'
