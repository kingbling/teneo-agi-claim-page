// Agent Discovery System Types

// Brain Regions
export type BrainRegion =
  | 'frontal'
  | 'parietal'
  | 'temporal'
  | 'occipital'
  | 'cerebellum'
  | 'brainstem'

// Agent States (updated for permanent deployment model)
export type AgentState =
  | 'idle'
  | 'solving'
  | 'deploying'      // leaving center, heading toward target
  | 'wandering'      // biased random walk in target region
  | 'limping_home'   // low fuel, slowly returning to center
  | 'exhausted'      // arrived home with no fuel, needs repair

// Space States
export type SpaceState = 'undiscovered' | 'being_solved' | 'discovered'

// Space Tiers (determines difficulty and rewards)
export type SpaceTier = 'common' | 'trait' | 'team' | 'legendary' | 'mythic'

// Trait Types (each has a bonus AND a penalty for meaningful tradeoffs)
export type TraitType = 'explorer' | 'solver' | 'swift' | 'efficient' | 'pioneer' | 'networker' | 'beacon' | 'lucky' | 'collaborative' | 'trance' | 'staker'

// Agent Trait (with tradeoffs)
export interface AgentTrait {
  type: TraitType
  level: 1 | 2 | 3 | 4 | 5
}

// Trait definition with bonus and penalty
export interface TraitDefinition {
  type: TraitType
  name: string
  description: string
  bonusType: string
  bonusPerLevel: number      // positive effect multiplier per level
  penaltyType: string
  penaltyPerLevel: number    // negative effect multiplier per level
}

// Trait definitions with meaningful tradeoffs
export const TRAIT_DEFINITIONS: Record<TraitType, TraitDefinition> = {
  explorer: {
    type: 'explorer',
    name: 'Explorer',
    description: 'Better at finding spaces, slower at solving them',
    bonusType: 'discoveryRange',
    bonusPerLevel: 0.40,      // +40% discovery range per level
    penaltyType: 'solveSpeed',
    penaltyPerLevel: -0.30,   // -30% solve speed per level
  },
  solver: {
    type: 'solver',
    name: 'Solver',
    description: 'Fast at solving spaces, but misses discoveries',
    bonusType: 'solveSpeed',
    bonusPerLevel: 0.50,      // +50% solve speed per level
    penaltyType: 'discoveryRange',
    penaltyPerLevel: -0.40,   // -40% discovery range per level
  },
  swift: {
    type: 'swift',
    name: 'Swift',
    description: 'Travels fast but burns more fuel',
    bonusType: 'travelSpeed',
    bonusPerLevel: 0.60,      // +60% travel speed per level
    penaltyType: 'burnRate',
    penaltyPerLevel: 0.40,    // +40% fuel burn per level (penalty is INCREASED burn)
  },
  efficient: {
    type: 'efficient',
    name: 'Efficient',
    description: 'Burns less fuel but travels slowly',
    bonusType: 'burnRate',
    bonusPerLevel: -0.50,     // -50% fuel burn per level (bonus is DECREASED burn)
    penaltyType: 'travelSpeed',
    penaltyPerLevel: -0.30,   // -30% travel speed per level
  },
  pioneer: {
    type: 'pioneer',
    name: 'Pioneer',
    description: 'Fast in undiscovered areas, slow on established paths',
    bonusType: 'offNetworkSpeed',
    bonusPerLevel: 0.80,      // +80% speed in undiscovered areas per level
    penaltyType: 'onNetworkSpeed',
    penaltyPerLevel: -0.20,   // -20% speed on network per level
  },
  networker: {
    type: 'networker',
    name: 'Networker',
    description: 'Blazing fast on established paths, struggles off-network',
    bonusType: 'onNetworkSpeed',
    bonusPerLevel: 1.00,      // +100% speed on network per level
    penaltyType: 'offNetworkSpeed',
    penaltyPerLevel: -0.50,   // -50% speed off-network per level
  },
  beacon: {
    type: 'beacon',
    name: 'Beacon',
    description: 'Attracts nearby agents, but earns less loot personally',
    bonusType: 'attractionRadius',
    bonusPerLevel: 0.50,      // +50% attraction radius per level
    penaltyType: 'personalLoot',
    penaltyPerLevel: -0.20,   // -20% personal loot per level
  },
  lucky: {
    type: 'lucky',
    name: 'Lucky',
    description: 'Higher chance for bonus loot, but less reliable discovery',
    bonusType: 'bonusLootChance',
    bonusPerLevel: 0.10,      // +10% bonus loot chance per level
    penaltyType: 'discoveryRange',
    penaltyPerLevel: -0.15,   // -15% discovery range per level
  },
  collaborative: {
    type: 'collaborative',
    name: 'Collaborative',
    description: 'Great in teams, struggles solo',
    bonusType: 'teamSolveSpeed',
    bonusPerLevel: 0.25,      // +25% team solve speed per level
    penaltyType: 'soloSolveSpeed',
    penaltyPerLevel: -0.30,   // -30% solo solve speed per level
  },
  trance: {
    type: 'trance',
    name: 'Trance',
    description: 'Enters deep focus after solving, auto-continues but slowed',
    bonusType: 'tranceDuration',
    bonusPerLevel: 3.0,       // +3 seconds trance duration per level
    penaltyType: 'tranceSlowdown',
    penaltyPerLevel: 0.05,    // 5% additional slowdown per level (20x base)
  },
  staker: {
    type: 'staker',
    name: 'Staker',
    description: 'Earns extra loot share based on stake',
    bonusType: 'lootShare',
    bonusPerLevel: 0.10,      // +10% loot share per level
    penaltyType: 'travelSpeed',
    penaltyPerLevel: -0.10,   // -10% travel speed per level
  },
}

// Central deployment position (brain center / corpus callosum)
export const DEPLOYMENT_ORIGIN = { x: 0, y: 0, z: 0 }

// Discovery Agent
export interface Agent {
  id: string
  ownerId: string
  name: string
  state: AgentState

  // Current position
  positionX: number
  positionY: number
  positionZ: number

  // Home position (always deployment origin)
  homeX: number
  homeY: number
  homeZ: number

  // Target region for biased random walk (set on deploy)
  targetX: number | null
  targetY: number | null
  targetZ: number | null

  // Start position for traveling animation
  startPositionX?: number
  startPositionY?: number
  startPositionZ?: number

  // Wander direction for random walk component
  wanderDirX: number
  wanderDirY: number
  wanderDirZ: number
  wanderPhase: number

  // Current space being solved (if any)
  currentSpaceId: string | null
  solveStartTime: number | null

  // Fuel system
  pointsBalance: number
  pointsBurnRate: number  // base rate, modified by traits

  // Repair cost (50% of creation cost when exhausted)
  creationCost: number
  needsRepair: boolean

  // Traits with tradeoffs
  traits: AgentTrait[]

  // Stats
  spacesDiscovered: number
  totalLoot: number
  totalPointsBurned: number
  distanceTraveled: number

  // Timestamps
  createdAt: number
  deployedAt: number | null

  // Trance state (server-authoritative)
  tranceActive: boolean
  tranceEndTime: number | null
  tranceLevel: number
}

// Discoverable Space (with tier system for multiplayer)
export interface Space {
  id: string
  positionX: number
  positionY: number
  positionZ: number
  region: BrainRegion
  zone: string
  synapseCount: number

  // Tier system (determines difficulty and requirements)
  tier: SpaceTier
  requiredTrait: TraitType | null       // trait required for efficient solving (trait spaces)
  requiredAgentCount: number            // minimum agents needed (team/legendary/mythic)
  maxAgentCount: number                 // capacity limit

  // Solve mechanics
  baseProbability: number               // chance to discover when passing nearby
  baseSolveTime: number                 // seconds to solve (modified by traits)
  state: SpaceState
  solveProgress: number

  // Time-limited (legendary/mythic)
  timeLimit: number | null              // ms from discovery to solve deadline
  solveDeadline: number | null          // timestamp when space becomes unsolvable

  // Rewards
  lootPool: number
  firstDiscovererBonus: number          // +25% for first discoverer

  // Discovery tracking
  discoveredAt: number | null
  discoveredBy: string | null           // first discoverer agent ID
  currentSolvers: string[]              // agent IDs currently solving
}

// Space tier configuration
export const SPACE_TIER_CONFIG: Record<SpaceTier, {
  probability: number           // % of spaces that are this tier
  lootRange: [number, number]   // min-max loot
  solveTimeRange: [number, number]  // min-max seconds to solve
  requiredAgents: number
  maxAgents: number
  timeLimit: number | null      // ms, null = no limit
}> = {
  common: {
    probability: 0.60,
    lootRange: [10, 50],
    solveTimeRange: [5, 15],
    requiredAgents: 1,
    maxAgents: 1,
    timeLimit: null,
  },
  trait: {
    probability: 0.25,
    lootRange: [100, 300],
    solveTimeRange: [20, 40],
    requiredAgents: 1,
    maxAgents: 3,
    timeLimit: null,
  },
  team: {
    probability: 0.10,
    lootRange: [500, 1000],
    solveTimeRange: [60, 60],   // 60s with 3 agents, -10s per extra
    requiredAgents: 3,
    maxAgents: 8,
    timeLimit: null,
  },
  legendary: {
    probability: 0.04,
    lootRange: [2000, 5000],
    solveTimeRange: [90, 120],
    requiredAgents: 5,
    maxAgents: 15,
    timeLimit: 5 * 60 * 1000,   // 5 minutes
  },
  mythic: {
    probability: 0.01,
    lootRange: [10000, 25000],
    solveTimeRange: [120, 180],
    requiredAgents: 10,
    maxAgents: 30,
    timeLimit: 10 * 60 * 1000,  // 10 minutes
  },
}

// Agent Cluster (for LOD visualization)
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

// Space Cluster (for LOD visualization)
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

  // Tier breakdown for multiplayer coordination
  tierCounts: Record<SpaceTier, number>

  updatedAt: number
}

// Network Connection (Death Stranding-style shared infrastructure)
export interface NetworkConnection {
  id: string
  fromSpaceId: string
  toSpaceId: string
  fromX: number
  fromY: number
  fromZ: number
  toX: number
  toY: number
  toZ: number

  // Usage tracking (more use = faster travel)
  useCount: number              // total times traversed
  lastUsedAt: number            // timestamp
  speedMultiplier: number       // 1.0 base, up to 5.0 for heavy traffic

  createdAt: number
}

// Network speed constants
export const NETWORK_SPEEDS = {
  OFF_NETWORK: 1.0,             // base travel speed
  ON_NETWORK_BASE: 3.0,         // 3x speed on any strand
  ON_NETWORK_MAX: 5.0,          // max 5x speed on heavily used strands
  USE_COUNT_FOR_MAX: 1000,      // uses needed to reach max speed
  CONNECTION_RANGE: 2.0,        // max distance between spaces to form connection
  SNAP_DISTANCE: 0.5,           // distance to "snap" onto network
}

// Calculate speed multiplier based on usage
export function getNetworkSpeedMultiplier(useCount: number): number {
  const progress = Math.min(useCount / NETWORK_SPEEDS.USE_COUNT_FOR_MAX, 1.0)
  return NETWORK_SPEEDS.ON_NETWORK_BASE +
    (NETWORK_SPEEDS.ON_NETWORK_MAX - NETWORK_SPEEDS.ON_NETWORK_BASE) * progress
}

// Discovery Progress Stats
export interface DiscoveryProgress {
  total: number
  discovered: number
  beingSolved: number
}

// User (for frontend)
export interface User {
  id: string
  wallet: string
  tier: UserTier
  stakedAmount: number
  points: number
  totalLootEarned: number
  createdAt: number
}

// World State (from server)
export interface WorldState {
  spaceClusters: SpaceCluster[]
  agentClusters: AgentCluster[]
  userAgents: Agent[]
  discoveryProgress: DiscoveryProgress
  networkConnections: NetworkConnection[]  // Death Stranding-style strands
}

// Server Messages
export type ServerMessage =
  | { type: 'state:sync'; data: WorldState }
  | { type: 'space:discovered'; data: SpaceDiscoveryEvent }
  | { type: 'loot:distributed'; data: LootEvent }
  | { type: 'agents:update'; data: Agent[] }
  | { type: 'error'; data: { message: string } }

// Client Messages (no recall - permanent deployment)
export type ClientMessage =
  | { type: 'agent:refuel'; data: { agentId: string; points: number } }
  | { type: 'agent:repair'; data: { agentId: string } }  // repair exhausted agent

// Events
export interface SpaceDiscoveryEvent {
  spaceId: string
  positionX: number
  positionY: number
  positionZ: number
  discoveredBy: string[]
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

// User Tiers for Agent Limits
export type UserTier = 'free' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export const TIER_LIMITS: Record<UserTier, number> = {
  free: 1,
  bronze: 3,
  silver: 5,
  gold: 10,
  platinum: 25,
  diamond: 100,
}

export function getAgentLimit(tier: UserTier, stakedAmount: number = 0): number {
  const baseLimit = TIER_LIMITS[tier] || 1
  // Staking bonuses
  if (stakedAmount >= 100000) return Infinity
  if (stakedAmount >= 10000) return 1000
  if (stakedAmount >= 1000) return 250
  return baseLimit
}

// Helper to get trait effect description for UI
export function getTraitEffectDescription(type: TraitType): string {
  const def = TRAIT_DEFINITIONS[type]
  if (!def) return ''
  const bonusSign = def.bonusPerLevel >= 0 ? '+' : ''
  const penaltySign = def.penaltyPerLevel >= 0 ? '+' : ''
  return `${bonusSign}${Math.round(def.bonusPerLevel * 100)}% ${def.bonusType} / ${penaltySign}${Math.round(def.penaltyPerLevel * 100)}% ${def.penaltyType}`
}

// Trait Effects - simple description for UI
export const TRAIT_EFFECTS: Record<TraitType, { description: string; effectPerLevel: string }> = {
  explorer: { description: 'Boost discovery probability', effectPerLevel: '+40% per level' },
  solver: { description: 'Faster solve speed', effectPerLevel: '+50% per level' },
  swift: { description: 'Faster travel speed', effectPerLevel: '+60% per level' },
  efficient: { description: 'Reduce point burn rate', effectPerLevel: '-50% per level' },
  pioneer: { description: 'Fast in undiscovered areas', effectPerLevel: '+80% per level' },
  networker: { description: 'Fast on established paths', effectPerLevel: '+100% per level' },
  beacon: { description: 'Attracts nearby agents', effectPerLevel: '+50% radius per level' },
  lucky: { description: 'Chance for bonus loot', effectPerLevel: '+10% chance per level' },
  collaborative: { description: 'Team solve speed bonus', effectPerLevel: '+25% per solver per level' },
  trance: { description: 'Auto-continue + slowdown after solve', effectPerLevel: '+3s duration per level' },
  staker: { description: 'Extra loot share based on stake', effectPerLevel: '+10% per level' },
}

// === Visualization Types ===

/**
 * ViewMode - Standardized view mode across the application
 * - '3d': Full 3D perspective view with OrbitControls
 * - 'topdown': 2D top-down orthographic view
 */
export type ViewMode = '3d' | 'topdown'

/**
 * View mode labels for UI display
 */
export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  '3d': '3D View',
  'topdown': 'Top-Down'
}
