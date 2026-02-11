import type { SynapseType } from '@/types/game'

// ============================================================================
// SHIP STORE — TYPES, INTERFACES, AND MAPPING FUNCTIONS
// ============================================================================

// API Configuration - empty string means same-origin (App Platform deployment)
export const API_URL = import.meta.env.VITE_API_URL ?? ''

// State mapping: server uses 'being_solved'/'discovered', client uses 'being_explored'/'completed'
export function mapServerSynapseState(serverState: string): 'undiscovered' | 'being_explored' | 'completed' {
  switch (serverState) {
    case 'being_solved': return 'being_explored'
    case 'discovered': return 'completed'
    default: return serverState as 'undiscovered'
  }
}

// Map server ship states to client ship states
// Input: AgentState or ShipDTO state — both now use 'traveling' (unified)
export function mapServerShipState(serverState: string): ShipStatus {
  switch (serverState) {
    case 'traveling': return 'traveling'
    case 'solving': return 'solving'
    case 'returning': return 'returning'
    case 'searching': return 'idle'  // Deprecated - treat as idle
    case 'idle':
    default:
      return 'idle'
  }
}

// Ship Status (simplified from Agent) - 'searching' removed as obsolete
// Note: 'solving' was renamed from 'exploring' to better reflect ship is working on a synapse
export type ShipStatus = 'idle' | 'solving' | 'traveling' | 'returning'

// Ship Type (visual style)
export type ShipType = 'neuron' | 'synapse' | 'dendrite' | 'axon' | 'cortex'

// Equipped Item on a Ship
export interface EquippedItem {
  itemId: string
  itemType: string
  slotIndex: number
  equippedAt: number
  expiresAt: number | null  // null = permanent
}

// Ship Entity (replaces Agent)
export interface Ship {
  id: string
  ownerId: string
  name: string
  state: ShipStatus
  shipType: ShipType

  // Position (for visualization)
  positionX: number
  positionY: number
  positionZ: number

  // Start position for travel animation
  startPositionX?: number
  startPositionY?: number
  startPositionZ?: number

  // Target position (for travel path visualization) - destination when traveling
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

  // Rotation (for travel animation)
  rotationY?: number  // Yaw rotation in radians - direction ship is facing

  // Stats
  spacesDiscovered: number
  totalAgiEarned: number
  createdAt: number

  // Timestamp reconciliation - for optimistic updates
  _lastLocalUpdate?: number  // Client-side timestamp when ship was last modified locally
}

// Autopilot Preferences
export interface AutopilotPreferences {
  preferredSynapseTypes: SynapseType[]  // Priority order
  maxPointsPerMin: number                // Cap on spending rate
  avoidCrowded: boolean                  // Prefer synapses with fewer explorers
}

// Synapse (for exploration)
export interface Synapse {
  id: string
  positionX: number
  positionY: number
  positionZ: number
  region: string
  zone: string
  synapseType: SynapseType
  state: 'undiscovered' | 'being_explored' | 'completed'

  // Points system
  pointsRequired: number
  pointsAccumulated: number
  currentEtaMinutes: number | null

  // Explorers
  explorerCount: number
  maxExplorers: number

  // Rewards
  agiReward: number

  // Sector
  sectorId: string | null
}

// Space/Synapse Cluster for LOD
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
  typeCounts: Record<SynapseType, number>
  updatedAt: number
}

// Ship Cluster for LOD
export interface ShipCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  shipCount: number
  dominantState: ShipStatus
  avgProgress: number
  updatedAt: number
}

// Map server SpaceCluster properties to client SynapseCluster properties
// Server uses: spaceCount, beingSolvedCount
// Client uses: synapseCount, beingExploredCount
interface ServerCluster {
  id: string
  lodLevel: number
  positionX: number
  positionY: number
  positionZ: number
  spaceCount?: number
  synapseCount?: number
  discoveredCount?: number
  beingSolvedCount?: number
  beingExploredCount?: number
  avgLootPool?: number
  typeCounts?: Record<SynapseType, number>
  updatedAt?: number
}

export function mapServerClusterToClient(cluster: ServerCluster): SynapseCluster {
  const synapseCount = cluster.spaceCount ?? cluster.synapseCount ?? 0

  // Use server typeCounts, default to all minor if not provided
  const typeCounts = cluster.typeCounts || { minor: synapseCount }

  return {
    id: cluster.id,
    lodLevel: cluster.lodLevel,
    positionX: cluster.positionX,
    positionY: cluster.positionY,
    positionZ: cluster.positionZ,
    synapseCount,
    discoveredCount: cluster.discoveredCount ?? 0,
    beingExploredCount: cluster.beingSolvedCount ?? cluster.beingExploredCount ?? 0,
    avgLootPool: cluster.avgLootPool ?? 0,
    typeCounts,
    updatedAt: cluster.updatedAt ?? Date.now(),
  }
}

// World State
export interface WorldState {
  synapseClusters: SynapseCluster[]
  agentClusters: ShipCluster[]  // Renamed from shipClusters to match server
  discoveryProgress: {
    total: number
    discovered: number
    beingExplored: number
  }
}

// Explorer Info (other users exploring same synapse)
export interface ExplorerInfo {
  shipId: string
  userId: string
  shipName: string
  pointsContributed: number
  pointsPerMinute: number
  joinedAt: number
}

// Discovery Event
export interface SynapseDiscoveryEvent {
  synapseId: string
  synapseType: SynapseType
  discoveredAt: number
  totalExplorers: number
  agiReward: number
  isLottery: boolean
  winnerId?: string
  winnerShipId?: string
  // Position for visual effects (discovery burst)
  positionX: number
  positionY: number
  positionZ: number
}

// Loot Event
export interface LootEvent {
  synapseId: string
  synapseType: SynapseType
  userId: string
  shipId: string
  agiAmount: number
  isLotteryWin: boolean
  lotteryTicketsAwarded: number
  timestamp: number
}

// Synapse Delta (compact state change notification)
export interface SynapseDelta {
  i: number  // Array index
  s: number  // New state (0/1/2)
}

// Travel Started Event (sent when ship begins traveling)
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

// Travel Position Update (streamed during travel)
export interface TravelPositionUpdate {
  shipId: string
  positionX: number
  positionY: number
  positionZ: number
  rotationY: number  // Yaw - direction ship is facing
  progress: number   // 0.0 to 1.0
}

// Travel Position Batch (batched updates for efficiency)
export interface TravelPositionBatch {
  ships: TravelPositionUpdate[]
  timestamp: number
}

// World Ship (ambient + other users, broadcast via world:ships)
export interface WorldShip {
  id: string
  tp?: string  // shipType: 'neuron' | 'synapse' | 'dendrite' | 'axon' | 'cortex'
  x: number
  y: number
  z: number
  r: number   // rotationY
  s: number   // 0=traveling, 1=idle
  // Trajectory for client-side interpolation (only when traveling)
  sx?: number  // startX
  sy?: number  // startY
  sz?: number  // startZ
  tx?: number  // targetX
  ty?: number  // targetY
  tz?: number  // targetZ
  ts?: number  // travelStart (unix ms)
  td?: number  // travelDuration (ms)
}

// Server Messages
export type ServerMessage =
  | { type: 'state:sync'; data: WorldState & { timestamp?: number } }
  | { type: 'synapse:completed'; data: SynapseDiscoveryEvent }
  | { type: 'loot:distributed'; data: LootEvent }
  | { type: 'ships:update'; data: { ships: Ship[]; timestamp?: number } }
  | { type: 'ships:sync'; data: { ships: Ship[]; timestamp: number } }  // Full ship state from server
  | { type: 'travel:started'; data: TravelStartedEvent }  // Ship started traveling
  | { type: 'travel:position'; data: TravelPositionBatch }  // Position updates during travel
  | { type: 'world:ships'; data: { ships: WorldShip[]; t: number } }  // Ambient + other-user ships
  | { type: 'auth:success'; data: { userId: string } }
  | { type: 'auth:error'; data: { message: string } }
  | { type: 'agents:update'; data: unknown[] }  // Legacy - server agent updates
  | { type: 'exploration:progress'; data: { synapseId: string; pointsAccumulated: number; eta?: number; currentETAMinutes?: number; etaMinutes?: number } }
  | { type: 'cluster:update'; data: { clusters: SynapseCluster[]; timestamp: number } }  // Immediate cluster state change
  | { type: 'synapses:delta'; data: { c: SynapseDelta[]; t: number } }  // Compact delta updates
  | { type: 'error'; data: { message: string } }

// Raw Synapse Data (500k individual points from binary endpoint)
export interface RawSynapseData {
  count: number
  positions: Float32Array  // count * 3 (x, y, z interleaved)
  states: Uint8Array       // count (0=undiscovered, 1=being_solved, 2=discovered)
  types: Uint8Array        // count (0-6 mapping to synapse types)
  version: number          // For invalidation/updates
}

// Store State
export interface ShipStoreState {
  // Connection State
  isConnected: boolean
  ws: WebSocket | null

  // Individual Synapse Data (500k points)
  rawSynapseData: RawSynapseData | null
  rawSynapseDataVersion: number  // Incremented on updates for reactivity

  // Synapse State (LOD clusters)
  synapseClusters: SynapseCluster[]
  synapseClustersLod0: SynapseCluster[]
  synapseClustersLod1: SynapseCluster[]
  synapseClustersLod2: SynapseCluster[]

  // Ship State (clusters + user's ships)
  shipClusters: ShipCluster[]
  userShips: Ship[]
  worldShips: WorldShip[]  // Ambient + other-user ships
  selectedShipId: string | null

  // Current Exploration (for selected ship)
  currentExplorationSynapse: Synapse | null
  currentExplorers: ExplorerInfo[]

  // Exploration Target (synapse selected for a searching ship to explore)
  explorationTarget: Synapse | null

  // Recent Events
  recentDiscoveries: SynapseDiscoveryEvent[]
  recentLoot: LootEvent[]

  // Loading States
  isLoadingWorld: boolean
  isLoadingShips: boolean
}

export const initialState: ShipStoreState = {
  // Connection
  isConnected: false,
  ws: null,

  // Individual Synapses (500k points)
  rawSynapseData: null,
  rawSynapseDataVersion: 0,

  // Synapses (LOD clusters)
  synapseClusters: [],
  synapseClustersLod0: [],
  synapseClustersLod1: [],
  synapseClustersLod2: [],

  // Ships
  shipClusters: [],
  userShips: [],
  worldShips: [],
  selectedShipId: null,

  // Current Exploration
  currentExplorationSynapse: null,
  currentExplorers: [],

  // Exploration Target (for searching ships)
  explorationTarget: null,

  // Events
  recentDiscoveries: [],
  recentLoot: [],

  // Loading
  isLoadingWorld: true,
  isLoadingShips: true,
}

// Helper to safely get userShips array (guards against proxy/HMR issues)
export const safeUserShips = (s: ShipStoreState): Ship[] =>
  Array.isArray(s.userShips) ? s.userShips : []

// Helper to update a single ship in the userShips array
export const updateShipInList = (s: ShipStoreState, updatedShip: Ship): void => {
  s.userShips = s.userShips.map(ss => ss.id === updatedShip.id ? updatedShip : ss)
}
