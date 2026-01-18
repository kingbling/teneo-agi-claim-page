/**
 * Shared Types for TENEO
 *
 * These types are used by both frontend (src/) and backend (server/src/)
 * to ensure type consistency across the WebSocket boundary.
 */

// ============================================================================
// SYNPASE TYPES
// ============================================================================

export type SynapseType = 'minor' | 'complex' | 'deep' | 'core' | 'rare' | 'legendary' | 'unique'
export type SynapseState = 'undiscovered' | 'being_solved' | 'discovered'

export interface Synapse {
  id: string
  positionX: number
  positionY: number
  positionZ: number
  region: string
  zone: string
  synapseType: SynapseType
  state: SynapseState
  synapseCount: number
  discoveredAt: number | null

  // Masterplan 2026: Points-based exploration
  pointsRequired: number
  pointsAccumulated: number
  currentEtaMinutes: number | null

  // Explorer info
  explorerCount: number
  maxExplorers: number

  // Rewards
  agiReward: number

  // Sector
  sectorId: string | null
}

// ============================================================================
// SHIP TYPES
// ============================================================================

export type ShipState = 'idle' | 'searching' | 'deploying' | 'exploring' | 'returning'

export interface EquippedItem {
  itemId: string
  itemType: string
  slotIndex: number
  equippedAt: number
  expiresAt: number | null
}

export interface AutopilotPreferences {
  preferredSynapseTypes: SynapseType[]
  maxPointsPerMin: number
  avoidCrowded: boolean
}

export interface Ship {
  id: string
  ownerId: string
  name: string
  state: ShipState

  // Position (for visualization)
  positionX: number
  positionY: number
  positionZ: number

  // Start position for travel animation
  startPositionX?: number
  startPositionY?: number
  startPositionZ?: number

  // Target position (for travel path visualization) - destination when deploying
  targetPositionX?: number
  targetPositionY?: number
  targetPositionZ?: number

  // Current synapse being explored
  currentSynapseId: string | null

  // Travel timing
  travelStartTime: number | null
  travelDuration: number | null

  // Masterplan 2026: Autopilot
  autopilotEnabled: boolean
  autopilotPreferences?: AutopilotPreferences

  // Masterplan 2026: Items
  equippedItems: EquippedItem[]

  // Current points per minute spending rate
  currentPointsPerMin: number

  // Stats
  spacesDiscovered: number
  totalAgiEarned: number
  createdAt: number

  // Client-side timestamp reconciliation (not sent by server)
  _lastLocalUpdate?: number
}

// ============================================================================
// CLUSTER TYPES (LOD)
// ============================================================================

export interface SynapseCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  synapseCount: number
  discoveredCount: number
  beingExploredCount: number
  avgLootPool: number
  typeCounts: Partial<Record<SynapseType, number>>
  updatedAt: number
}

export interface ShipCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  shipCount: number
  dominantState: ShipState
  avgProgress: number
  updatedAt: number
}

// ============================================================================
// USER TYPES
// ============================================================================

export type UserTier = 'free' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
export type UserLevel = 1 | 2 | 3 | 4 | 5

export interface User {
  id: string
  wallet: string
  tier: UserTier
  stakedAmount: number
  points: number
  totalLootEarned: number
  createdAt: number

  // Masterplan 2026 fields
  userLevel?: UserLevel
  usdcSpent?: number
  agenticBalance?: number
  totalAgiEarned?: number
  lotteryTickets?: number
  maxShips?: number
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

export interface ClientMessage {
  type: 'ping' | 'auth:identify' | 'auth:logout'
  data: unknown
}

export interface AuthIdentifyData {
  token: string
}

export type ServerMessage =
  | { type: 'state:sync'; data: WorldState }
  | { type: 'ships:sync'; data: ShipSyncData }
  | { type: 'ships:update'; data: ShipUpdateData }
  | { type: 'agents:update'; data: unknown[] }  // Legacy
  | { type: 'synapse:completed'; data: SynapseCompletionData }
  | { type: 'exploration:progress'; data: ExplorationProgressData }
  | { type: 'space:discovered'; data: Synapse }
  | { type: 'loot:distributed'; data: LootDistribution }
  | { type: 'user:levelup'; data: UserLevelUpData }
  | { type: 'auth:success'; data: { userId: string } }
  | { type: 'auth:error'; data: { message: string } }
  | { type: 'error'; data: { message: string } }
  | { type: 'log:entry'; data: LogEntry }

export interface WorldState {
  synapseClusters: SynapseCluster[]
  agentClusters: ShipCluster[]
  userShips: Ship[]
  discoveryProgress: DiscoveryProgress
}

export interface ShipSyncData {
  ships: Ship[]
  timestamp: number
}

export interface ShipUpdateData {
  ships: Partial<Ship>[]
  timestamp: number
}

export interface DiscoveryProgress {
  total: number
  discovered: number
  beingSolved: number
}

export interface SynapseCompletionData {
  synapseId: string
  synapseType: SynapseType
  discoveredAt: number
  totalExplorers: number
  agiReward: number
  isLottery: boolean
  winnerId?: string
  winnerShipId?: string
}

export interface ExplorationProgressData {
  synapseId: string
  synapseType: SynapseType
  pointsAccumulated: number
  pointsRequired: number
  etaMinutes: number
  explorerCount: number
  timestamp: number
}

export interface UserLevelUpData {
  userId: string
  newLevel: UserLevel
  timestamp: number
}

export interface LootDistribution {
  synapseId: string
  synapseType: SynapseType
  rewards: LootReward[]
  timestamp: number
}

export interface LootReward {
  userId: string
  shipId: string
  agiAmount: number
  isLotteryWinner: boolean
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp?: number
  context?: Record<string, unknown>
}

// ============================================================================
// BRAIN REGION TYPES
// ============================================================================

export type BrainRegion = 'frontal' | 'parietal' | 'temporal' | 'occipital' | 'cerebellum' | 'brainstem'

// ============================================================================
// RE-EXPORT EVERYTHING FOR CONVENIENCE
// ============================================================================

export type {
  SynapseType,
  SynapseState,
  Synapse,
  ShipState,
  Ship,
  EquippedItem,
  AutopilotPreferences,
  SynapseCluster,
  ShipCluster,
  User,
  UserTier,
  UserLevel,
  WorldState,
  ShipSyncData,
  ShipUpdateData,
  DiscoveryProgress,
  SynapseCompletionData,
  ExplorationProgressData,
  UserLevelUpData,
  BrainRegion,
}
