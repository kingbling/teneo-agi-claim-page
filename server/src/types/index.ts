// Brain regions
export type BrainRegion = 'frontal' | 'parietal' | 'temporal' | 'occipital' | 'cerebellum' | 'brainstem'

// Agent states
export type AgentState = 'idle' | 'searching' | 'traveling' | 'solving' | 'returning'

// Space states
export type SpaceState = 'undiscovered' | 'being_solved' | 'discovered'

// Agent trait types
export type TraitType = 'explorer' | 'efficient' | 'staker' | 'swift' | 'lucky' | 'collaborative' | 'trance'

// Agent trait
export interface AgentTrait {
  type: TraitType
  level: number  // 1-5
}

// Space - discoverable unit in the brain
export interface Space {
  id: string
  positionX: number
  positionY: number
  positionZ: number
  region: BrainRegion
  zone: string
  synapseCount: number
  state: SpaceState
  discoveredAt: number | null
}

// Agent - user's discovery entity
export interface Agent {
  id: string
  ownerId: string           // User wallet
  name: string
  state: AgentState
  positionX: number
  positionY: number
  positionZ: number
  // Home position (deployment origin, always center)
  homeX: number
  homeY: number
  homeZ: number
  // Target region for biased random walk
  targetX: number | null
  targetY: number | null
  targetZ: number | null
  startPositionX: number | null  // Starting position for travel interpolation
  startPositionY: number | null
  startPositionZ: number | null
  // Wander direction for searching state (normalized direction vector)
  wanderDirX: number
  wanderDirY: number
  wanderDirZ: number
  wanderPhase: number        // Phase offset for organic movement
  targetSpaceId: string | null
  // For solving state
  currentSpaceId: string | null
  solveStartTime: number | null
  travelStartTime: number | null
  travelDuration: number | null  // ms to reach destination
  traits: AgentTrait[]
  spacesDiscovered: number
  distanceTraveled: number
  createdAt: number
  deployedAt: number | null
  // Repair mechanics (permanent deployment model)
  creationCost: number       // Points spent to create (50% to repair)
  needsRepair: boolean       // True when agent ran out of fuel
  // Trance state (server-authoritative)
  tranceActive: boolean      // True when agent is in trance mode
  tranceEndTime: number | null // Timestamp when trance will end
  tranceLevel: number        // Level of trance trait (0 if no trance trait)
}

// Agent cluster for visualization (pre-computed)
export interface AgentCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  agentCount: number
  dominantState: AgentState
  avgProgress: number
  updatedAt: number
}

// Space cluster for visualization (pre-computed)
export interface SpaceCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  spaceCount: number
  discoveredCount: number
  beingSolvedCount: number
  updatedAt: number
}

// User
export interface User {
  id: string
  wallet: string
  tier: 'free' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  stakedAmount: number
  points: number
  totalLootEarned: number
  createdAt: number
  // Masterplan 2026 fields
  usdc_spent?: number
  agentic_balance?: number
  total_agi_earned?: number
  lottery_tickets?: number
}

// WebSocket message types
export type ClientMessage =
  | { type: 'ping'; data: Record<string, never> }
  | { type: 'auth:identify'; data: { token: string } }
  | { type: 'auth:logout'; data: Record<string, never> }

// Log entry for admin streaming
export interface LogEntryData {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: any
}

export type ServerMessage =
  | { type: 'state:sync'; data: WorldState }
  | { type: 'agents:update'; data: AgentUpdate[] }
  | { type: 'spaces:update'; data: SpaceUpdate[] }
  | { type: 'space:discovered'; data: SpaceDiscovery }
  | { type: 'loot:distributed'; data: LootEvent }
  | { type: 'error'; data: { message: string } }
  // Masterplan 2026 message types
  | { type: 'synapse:completed'; data: SynapseCompletionData }
  | { type: 'exploration:progress'; data: ExplorationProgressData }
  | { type: 'user:levelup'; data: UserLevelUpData }
  // Admin log streaming
  | { type: 'log:entry'; data: LogEntryData }
  // Ship sync (user-specific)
  | { type: 'ships:sync'; data: ShipSyncData }
  | { type: 'auth:success'; data: { userId: string } }
  | { type: 'auth:error'; data: { message: string } }

export interface WorldState {
  synapseClusters: SpaceCluster[]
  shipClusters: AgentCluster[]
  userShips: Agent[]
  discoveryProgress: {
    total: number
    discovered: number
    beingSolved: number
  }
}

export interface AgentUpdate {
  id: string
  positionX: number
  positionY: number
  positionZ: number
  state: AgentState
  targetSpaceId: string | null
}

export interface SpaceUpdate {
  id: string
  state: SpaceState
  solverCount: number
}

export interface SpaceDiscovery {
  spaceId: string
  positionX: number
  positionY: number
  positionZ: number
  discoveredBy: string[]  // Agent IDs
  lootDistribution: { agentId: string; ownerId: string; amount: number }[]
  timestamp: number
}

export interface LootEvent {
  userId: string
  agentId: string
  spaceId: string
  amount: number
  timestamp: number
}

// ============================================================================
// MASTERPLAN 2026: WebSocket Message Data Types
// ============================================================================

export type SynapseType = 'minor' | 'complex' | 'deep' | 'core' | 'rare' | 'legendary' | 'unique'
export type UserLevel = 1 | 2 | 3 | 4 | 5

export interface SynapseCompletionData {
  synapseId: string
  synapseType: SynapseType
  totalReward: number
  distribution: 'fair_share' | 'lottery'
  explorers: Array<{ userId: string; shipId: string; reward: number; isWinner?: boolean }>
  timestamp: number
}

export interface ExplorationProgressData {
  synapseId: string
  synapseType: SynapseType
  pointsAccumulated: number
  pointsRequired: number
  currentETAMinutes: number
  explorerCount: number
  timestamp: number
}

export interface UserLevelUpData {
  userId: string
  newLevel: UserLevel
  timestamp: number
}

// ============================================================================
// SHIP SYNC: Client-friendly ship data sent via WebSocket
// ============================================================================

// Client-facing ship state (different from internal AgentState)
export type ShipState = 'idle' | 'searching' | 'deploying' | 'exploring' | 'returning'

// Ship DTO for WebSocket sync (client-friendly state names)
export interface ShipDTO {
  id: string
  ownerId: string
  name: string
  state: ShipState
  // Current position
  positionX: number
  positionY: number
  positionZ: number
  // Start position for travel animation
  startPositionX: number | null
  startPositionY: number | null
  startPositionZ: number | null
  // Target position for travel animation
  targetPositionX: number | null
  targetPositionY: number | null
  targetPositionZ: number | null
  // Current synapse being explored
  currentSynapseId: string | null
  // Travel timing for interpolation
  travelStartTime: number | null
  travelDuration: number | null
  // Autopilot
  autopilotEnabled: boolean
  // Stats
  currentPointsPerMin: number
  spacesDiscovered: number
  totalAgiEarned: number
  createdAt: number
}

export interface ShipSyncData {
  ships: ShipDTO[]
  timestamp: number
}

// Re-export from game config for backward compatibility
export { TIER_LIMITS, getAgentLimit } from '../config/gameConfig.js'
