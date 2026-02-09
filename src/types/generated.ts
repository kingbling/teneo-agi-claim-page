// Auto-generated TypeScript types from Go DTOs
// This file is generated from server-go/internal/dto

// ============================================================================
// TYPES
// ============================================================================

export type SynapseType = 'minor' | 'complex' | 'deep' | 'core' | 'rare' | 'legendary' | 'unique'

// Ship states
export type ShipState = 'idle' | 'deploying' | 'solving' | 'returning'

export type SpaceState = 'undiscovered' | 'being_solved' | 'discovered'

export type SynapseState = 'undiscovered' | 'being_explored' | 'completed'

export type UserLevel = 1 | 2 | 3 | 4 | 5

export type UserTier = 'free' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export type BrainRegion = 'frontal' | 'parietal' | 'temporal' | 'occipital' | 'cerebellum' | 'brainstem'

// ============================================================================
// SHIP
// ============================================================================

export interface ShipDTO {
  id: string
  ownerId: string
  name: string
  state: ShipState
  positionX: number
  positionY: number
  positionZ: number
  startPositionX?: number
  startPositionY?: number
  startPositionZ?: number
  targetPositionX?: number
  targetPositionY?: number
  targetPositionZ?: number
  currentSynapseId?: string
  travelStartTime?: number
  travelDuration?: number
  autopilotEnabled: boolean
  autopilotPreferences?: AutopilotPreferences
  equippedItems: EquippedItem[]
  currentPointsPerMin: number
  spacesDiscovered: number
  totalAgiEarned: number
  createdAt: number
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

export interface EquippedItem {
  itemId: string
  itemType: string
  slotIndex: number
  equippedAt: number
  expiresAt?: number
}

export interface AutopilotPreferences {
  preferredSynapseTypes: SynapseType[]
  maxPointsPerMin: number
  avoidCrowded: boolean
}

// ============================================================================
// SPACE / SYNAPSE
// ============================================================================

export interface Space {
  id: string
  positionX: number
  positionY: number
  positionZ: number
  region: BrainRegion
  zone: string
  synapseCount: number
  state: SpaceState
  discoveredAt?: number
  synapseType: SynapseType
  pointsRequired: number
  pointsAccumulated: number
  currentEtaMinutes?: number
  agiReward: number
  sectorId?: string
}

export interface SpaceCluster {
  id: number
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  spaceCount: number
  synapseCount: number
  discoveredCount: number
  beingSolvedCount: number
  beingExploredCount: number
  avgLootPool: number
  typeCounts: Record<string, number>
  updatedAt: number
}

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
  pointsRequired: number
  pointsAccumulated: number
  currentEtaMinutes: number
  explorerCount: number
  maxExplorers: number
  agiReward: number
  sectorId?: string
  explorers?: ExplorerInfo[]
}

export interface SpaceDiscovery {
  spaceId: string
  positionX: number
  positionY: number
  positionZ: number
  discoveredBy: string[]
  lootDistribution: LootDistributionItem[]
  timestamp: number
}

export interface LootDistributionItem {
  agentId: string
  ownerId: string
  amount: number
}

export interface LootEvent {
  userId: string
  agentId: string
  spaceId: string
  amount: number
  timestamp: number
}

export interface ExplorerInfo {
  shipId: string
  userId: string
  shipName: string
  pointsContributed: number
  pointsPerMinute: number
  joinedAt: number
}

// ============================================================================
// USER
// ============================================================================

export interface User {
  id: string
  wallet: string
  tier: UserTier
  stakedAmount: number
  points: number
  totalLootEarned: number
  createdAt: number
  userLevel?: UserLevel
  usdcSpent?: number
  agenticBalance?: number
  totalAgiEarned?: number
  lotteryTickets?: number
  maxShips?: number
}

// ============================================================================
// CONFIG
// ============================================================================

export interface SynapseConfig {
  points: number
  maxPerMin: number
  etaMinutes: number
  maxExplorers: number
  distribution: string
  agiReward: number
  unlockUserLevel: UserLevel
}

export interface UserLevelConfig {
  minUSDC: number
  multiplier: number
  maxShips: number
  label: string
}

export interface GameConfig {
  synapseConfig: Record<SynapseType, SynapseConfig>
  userLevelConfig: Record<UserLevel, UserLevelConfig>
  worldBounds: WorldBounds
  tickInterval: number
  timeMultiplier: number
}

export interface WorldBounds {
  min: number
  max: number
  boundaryMargin: number
  boundarySteerStrength: number
}

// ============================================================================
// WEBSOCKET MESSAGES
// ============================================================================

export interface ClientMessage {
  type: string
  data: unknown
}

export interface ServerMessage {
  type: string
  data: unknown
}

export interface WorldState {
  synapseClusters: SpaceCluster[]
  shipClusters: ShipCluster[]
  userShips?: ShipDTO[]
  discoveryProgress: DiscoveryProgress
  timestamp?: number
}

export interface DiscoveryProgress {
  total: number
  discovered: number
  beingSolved: number
  beingExplored: number
}

export interface ShipSyncData {
  ships: ShipDTO[]
  timestamp: number
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

// TravelStartedEvent is sent when a ship begins traveling to a synapse
export interface TravelStartedEvent {
  shipId: string
  startPositionX: number
  startPositionY: number
  startPositionZ: number
  targetPositionX: number
  targetPositionY: number
  targetPositionZ: number
  travelStartTime: number
  travelDuration: number
  travelCost: number
  targetSynapseId: string
}
