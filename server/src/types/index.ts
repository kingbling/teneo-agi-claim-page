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
  baseProbability: number  // 0.001 - 0.05
  state: SpaceState
  solveProgress: number    // 0-100
  lootPool: number         // AGI tokens available
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
  pointsBalance: number
  pointsBurnRate: number    // Base points per second
  traits: AgentTrait[]
  spacesDiscovered: number
  totalLoot: number
  totalPointsBurned: number
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
  avgLootPool: number
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
  brain_level?: number
  brain_xp?: number
  total_brain_xp?: number
  usdc_spent?: number
  agentic_balance?: number
  total_agi_earned?: number
  lottery_tickets?: number
}

// WebSocket message types
export type ClientMessage =
  | { type: 'agent:create'; data: { name: string; traits: AgentTrait[] } }
  | { type: 'agent:deploy'; data: { agentId: string; spaceId: string } }
  | { type: 'agent:direct'; data: { agentId: string; position: [number, number, number] } }
  | { type: 'agent:recall'; data: { agentId: string } }
  | { type: 'agent:refuel'; data: { agentId: string; points: number } }
  | { type: 'subscribe:region'; data: { regionId: string } }

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
  pointsBalance: number
  targetSpaceId: string | null
}

export interface SpaceUpdate {
  id: string
  state: SpaceState
  solveProgress: number
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
  newBrainLevel: number
  brainXpEarned: number
  timestamp: number
}

// Re-export from game config for backward compatibility
export { TIER_LIMITS, getAgentLimit } from '../config/gameConfig.js'
