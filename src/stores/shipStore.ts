import { createRoot } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import type { SynapseType } from '@/types/game'
import { authStore } from './authStore'
import { userStore } from './userStore'
import { toast } from '@/components/ui/Toast'

// API Configuration - empty string means same-origin (App Platform deployment)
const API_URL = import.meta.env.VITE_API_URL ?? ''
// WebSocket URL - ensure /ws path is appended
const WS_BASE = import.meta.env.VITE_WS_URL ?? ''
const WS_URL = WS_BASE ? `${WS_BASE.replace(/\/$/, '')}/ws` : '/ws'

// ============================================================================
// MASTERPLAN 2026: SHIP STORE
// Replaces agentStore - no fuel/traits, adds autopilot + items
// ============================================================================

// State mapping: server uses 'being_solved'/'discovered', client uses 'being_explored'/'completed'
function mapServerSynapseState(serverState: string): 'undiscovered' | 'being_explored' | 'completed' {
  switch (serverState) {
    case 'being_solved': return 'being_explored'
    case 'discovered': return 'completed'
    default: return serverState as 'undiscovered'
  }
}

// Map server ship states to client ship states
// Server sends: idle, traveling, solving, returning
// Client expects: idle, deploying, exploring, returning
function mapServerShipState(serverState: string): ShipStatus {
  switch (serverState) {
    case 'traveling': return 'deploying'
    case 'solving': return 'exploring'
    case 'returning': return 'returning'
    case 'searching': return 'idle'  // Deprecated - treat as idle
    case 'idle':
    default:
      return 'idle'
  }
}

// Ship Status (simplified from Agent) - 'searching' removed as obsolete
export type ShipStatus = 'idle' | 'exploring' | 'deploying' | 'returning'

// Ship Type (visual style)
export type ShipType = 'neuron' | 'synapse' | 'dendrite'

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

// Generate mock typeCounts for visual variety when server returns empty data
// Uses cluster ID hash to deterministically assign type variety
function generateMockTypeCounts(clusterId: string, totalCount: number): Record<SynapseType, number> {
  const result: Record<SynapseType, number> = {
    minor: 0,
    complex: 0,
    deep: 0,
    core: 0,
    rare: 0,
    legendary: 0,
    unique: 0,
  }

  if (totalCount === 0) return result

  // Simple hash from cluster ID for deterministic but varied distribution
  let hash = 0
  for (let i = 0; i < clusterId.length; i++) {
    hash = ((hash << 5) - hash + clusterId.charCodeAt(i)) | 0
  }
  const seed = Math.abs(hash)

  // Weighted distribution - rarer types less common
  const weights = [0.35, 0.25, 0.18, 0.12, 0.06, 0.03, 0.01]
  const types: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']

  // Use seed to pick a "dominant" type for variety
  const dominantIndex = seed % 5  // First 5 types can be dominant
  const shiftedWeights = [...weights]

  // Boost the dominant type
  shiftedWeights[dominantIndex] += 0.2
  const total = shiftedWeights.reduce((a, b) => a + b, 0)
  const normalizedWeights = shiftedWeights.map(w => w / total)

  let remaining = totalCount
  for (let i = 0; i < types.length - 1; i++) {
    const count = Math.floor(totalCount * normalizedWeights[i])
    result[types[i]] = count
    remaining -= count
  }
  result.unique = Math.max(0, remaining)

  return result
}

// Map server SpaceCluster properties to client SynapseCluster properties
// Server uses: spaceCount, beingSolvedCount
// Client uses: synapseCount, beingExploredCount
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapServerClusterToClient(cluster: any): SynapseCluster {
  const synapseCount = cluster.spaceCount ?? cluster.synapseCount ?? 0

  // Use server typeCounts if populated, otherwise generate mock data for visual variety
  const serverTypeCounts = cluster.typeCounts
  const hasValidTypeCounts = serverTypeCounts && Object.keys(serverTypeCounts).length > 0 &&
    Object.values(serverTypeCounts).some((v: any) => v > 0)

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
    typeCounts: hasValidTypeCounts ? serverTypeCounts : generateMockTypeCounts(cluster.id, synapseCount),
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

// Server Messages
export type ServerMessage =
  | { type: 'state:sync'; data: WorldState & { timestamp?: number } }
  | { type: 'synapse:completed'; data: SynapseDiscoveryEvent }
  | { type: 'loot:distributed'; data: LootEvent }
  | { type: 'ships:update'; data: { ships: Ship[]; timestamp?: number } }
  | { type: 'ships:sync'; data: { ships: Ship[]; timestamp: number } }  // Full ship state from server
  | { type: 'travel:started'; data: TravelStartedEvent }  // Ship started traveling
  | { type: 'travel:position'; data: TravelPositionBatch }  // Position updates during travel
  | { type: 'auth:success'; data: { userId: string } }
  | { type: 'auth:error'; data: { message: string } }
  | { type: 'agents:update'; data: any[] }  // Legacy - server agent updates
  | { type: 'exploration:progress'; data: { synapseId: string; pointsAccumulated: number; eta?: number; currentETAMinutes?: number } }  // eta for legacy, currentETAMinutes for server naming
  | { type: 'lottery:winner'; data: { synapseId: string; winnerId: string; winnerShipId: string; reward: number } }
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

  // Ship State (LOD clusters + user's ships)
  shipClusters: ShipCluster[]
  shipClustersLod0: ShipCluster[]
  shipClustersLod1: ShipCluster[]
  shipClustersLod2: ShipCluster[]
  userShips: Ship[]
  selectedShipId: string | null

  // Current Exploration (for selected ship)
  currentExplorationSynapse: Synapse | null
  currentExplorers: ExplorerInfo[]

  // Exploration Target (synapse selected for a searching ship to explore)
  explorationTarget: Synapse | null

  // Discovery Progress
  discoveryProgress: {
    total: number
    discovered: number
    beingExplored: number
  }

  // Recent Events
  recentDiscoveries: SynapseDiscoveryEvent[]
  recentLoot: LootEvent[]

  // UI State
  viewMode: '3d' | '2d-top'
  showShipPaths: boolean
  showDiscoveredOnly: boolean
  currentLodLevel: number

  // Loading States
  isLoadingWorld: boolean
  isLoadingShips: boolean
  deployingShipIds: Set<string>
}

const initialState: ShipStoreState = {
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
  shipClustersLod0: [],
  shipClustersLod1: [],
  shipClustersLod2: [],
  userShips: [],
  selectedShipId: null,

  // Current Exploration
  currentExplorationSynapse: null,
  currentExplorers: [],

  // Exploration Target (for searching ships)
  explorationTarget: null,

  // Progress
  discoveryProgress: { total: 0, discovered: 0, beingExplored: 0 },

  // Events
  recentDiscoveries: [],
  recentLoot: [],

  // UI
  viewMode: '3d',
  showShipPaths: true,
  showDiscoveredOnly: false,
  currentLodLevel: 0,

  // Loading
  isLoadingWorld: true,
  isLoadingShips: true,
  deployingShipIds: new Set(),
}

function createShipStore() {
  const [state, setState] = createStore<ShipStoreState>({ ...initialState })

  // Helper to safely get userShips array (guards against proxy/HMR issues)
  const safeUserShips = (s: ShipStoreState): Ship[] =>
    Array.isArray(s.userShips) ? s.userShips : []

  // Helper to update a single ship in the userShips array
  const updateShipInList = (s: ShipStoreState, updatedShip: Ship): void => {
    s.userShips = s.userShips.map(ss => ss.id === updatedShip.id ? updatedShip : ss)
  }

  // ============ SERVER MESSAGE HANDLER ============

  function handleServerMessage(message: ServerMessage) {
    switch (message.type) {
      case 'state:sync': {
        const world = message.data
        console.log('[WebSocket state:sync] Received world:', world)
        console.log('[WebSocket state:sync] Cluster count:', world.synapseClusters?.length)

        // Map server clusters to client format and separate by LOD level
        const rawClusters = world.synapseClusters || []
        const mappedClusters = rawClusters.map(mapServerClusterToClient)

        const synapseClustersLod0 = mappedClusters.filter(c => c.lodLevel === 0)
        const synapseClustersLod1 = mappedClusters.filter(c => c.lodLevel === 1)
        const synapseClustersLod2 = mappedClusters.filter(c => c.lodLevel === 2)

        // Server sends agentClusters (was shipClusters)
        const agentClusters = world.agentClusters || []
        const shipClustersLod0 = agentClusters.filter(c => c.lodLevel === 0)
        const shipClustersLod1 = agentClusters.filter(c => c.lodLevel === 1)
        const shipClustersLod2 = agentClusters.filter(c => c.lodLevel === 2)

        setState({
          synapseClusters: mappedClusters,
          synapseClustersLod0,
          synapseClustersLod1,
          synapseClustersLod2,
          shipClusters: agentClusters,
          shipClustersLod0,
          shipClustersLod1,
          shipClustersLod2,
          discoveryProgress: world.discoveryProgress,
        })
        break
      }

      case 'ships:sync': {
        // Full ship state from server - replaces local state with timestamp reconciliation
        const { ships, timestamp } = message.data
        console.log('[WebSocket ships:sync] Received ships:', ships?.length, ships)
        if (!Array.isArray(ships)) break

        setState(produce((s) => {
          s.userShips = ships.map(serverShip => {
            const localShip = s.userShips.find(ls => ls.id === serverShip.id)
            // Keep local state if it was modified more recently than the server's timestamp
            // This prevents flickering when user action is followed by stale WebSocket sync
            if (localShip?._lastLocalUpdate && localShip._lastLocalUpdate > timestamp) {
              return localShip
            }
            // Map server state to client state (server: traveling/solving → client: deploying/exploring)
            return {
              ...serverShip,
              state: mapServerShipState(serverShip.state),
            }
          })
          s.isLoadingShips = false
        }))

        // Update ship count in userStore
        userStore.setCurrentShipCount(ships.length)
        break
      }

      case 'travel:started': {
        // Handle travel:started event - update ship with travel interpolation data
        const event = message.data
        console.log('[WebSocket travel:started] Ship traveling:', event.shipId)
        const now = Date.now()
        setState(produce((s) => {
          // Use map pattern to ensure proper reactivity (like agents:update handler)
          s.userShips = safeUserShips(s).map(ship => {
            if (ship.id !== event.shipId) return ship
            console.log('[WebSocket travel:started] Updating ship state to deploying:', ship.id)
            return {
              ...ship,
              state: 'deploying' as const,
              startPositionX: event.startPositionX,
              startPositionY: event.startPositionY,
              startPositionZ: event.startPositionZ,
              targetPositionX: event.targetPositionX,
              targetPositionY: event.targetPositionY,
              targetPositionZ: event.targetPositionZ,
              travelStartTime: event.travelStartTime,
              travelDuration: event.travelDuration,
              currentSynapseId: event.targetSynapseId,
              // Set local timestamp to prevent ships:sync from overwriting
              _lastLocalUpdate: now,
            }
          })
        }))
        break
      }

      case 'travel:position': {
        // Handle travel:position event - streamed position/rotation updates during travel
        const batch = message.data as TravelPositionBatch
        if (!batch.ships?.length) break

        setState(produce((s) => {
          for (const update of batch.ships) {
            const index = safeUserShips(s).findIndex(ship => ship.id === update.shipId)
            if (index >= 0) {
              // Update position and rotation from server stream
              s.userShips[index] = {
                ...s.userShips[index],
                positionX: update.positionX,
                positionY: update.positionY,
                positionZ: update.positionZ,
                rotationY: update.rotationY,
              }
            }
          }
        }))
        break
      }

      case 'auth:success': {
        console.log('WebSocket authenticated as user:', message.data.userId)
        break
      }

      case 'auth:error': {
        console.error('WebSocket auth failed:', message.data.message)
        toast.error('Session expired. Please reconnect your wallet.')
        // Clear ship state on auth failure to prevent stale data
        setState({
          userShips: [],
          selectedShipId: null,
          isLoadingShips: false,
        })
        break
      }

      case 'synapse:completed': {
        const event = message.data
        setState(produce((s) => {
          s.recentDiscoveries = [event, ...s.recentDiscoveries].slice(0, 50)
        }))
        break
      }

      case 'loot:distributed': {
        const event = message.data
        setState(produce((s) => {
          s.recentLoot = [event, ...s.recentLoot].slice(0, 50)
        }))

        // Update user's AGI (Masterplan 2026: Brain XP removed)
        const userId = userStore.userId
        if (event.userId === userId) {
          userStore.addAgi(event.agiAmount)
          if (event.lotteryTicketsAwarded > 0) {
            userStore.addLotteryTickets(event.lotteryTicketsAwarded)
          }
        }
        break
      }

      case 'ships:update': {
        // Partial ship updates with timestamp reconciliation
        const { ships: updatedShips, timestamp } = message.data
        if (!Array.isArray(updatedShips)) break

        setState(produce((s) => {
          s.userShips = safeUserShips(s).map((ship) => {
            const updated = updatedShips.find(u => u.id === ship.id)
            if (!updated) return ship

            // If we have a local update more recent than this server update, keep local state
            if (ship._lastLocalUpdate && timestamp && ship._lastLocalUpdate > timestamp) {
              return ship
            }

            // Merge the update, map server state to client state, preserve local timestamp
            return {
              ...updated,
              state: mapServerShipState(updated.state),
              _lastLocalUpdate: ship._lastLocalUpdate,
            }
          })
        }))
        break
      }

      case 'agents:update': {
        // Agent updates from simulation engine - includes state changes on arrival
        const agents = message.data
        console.log('[WebSocket agents:update] Received:', agents)
        if (!Array.isArray(agents)) break

        // Only process if we have ships
        if (safeUserShips(state).length === 0) {
          console.log('[WebSocket agents:update] No user ships, skipping')
          break
        }

        setState(produce((s) => {
          s.userShips = safeUserShips(s).map((ship) => {
            const agent = agents.find(a => a.id === ship.id)
            if (!agent) return ship

            const newState = agent.state ? mapServerShipState(agent.state) : ship.state
            console.log(`[WebSocket agents:update] Ship ${ship.id.slice(0,8)} state: ${ship.state} → ${newState} (server: ${agent.state})`)

            // Update position and state (state is sent when ship arrives at destination)
            return {
              ...ship,
              positionX: agent.positionX ?? ship.positionX,
              positionY: agent.positionY ?? ship.positionY,
              positionZ: agent.positionZ ?? ship.positionZ,
              // Update state if provided (arrival transitions: traveling->solving, etc.)
              state: newState,
              // Update synapse ID if provided
              currentSynapseId: agent.targetSpaceId !== undefined ? agent.targetSpaceId : ship.currentSynapseId,
              // Clear travel data on arrival (when state changes from traveling)
              ...(agent.state === 'solving' ? {
                travelStartTime: null,
                travelDuration: null,
                startPositionX: undefined,
                startPositionY: undefined,
                startPositionZ: undefined,
              } : {}),
            }
          })
        }))
        break
      }

      case 'exploration:progress': {
        const { synapseId, pointsAccumulated, eta, currentETAMinutes } = message.data
        // Support both eta (legacy/client) and currentETAMinutes (server naming)
        const etaMinutes = eta ?? currentETAMinutes
        if (state.currentExplorationSynapse?.id === synapseId && etaMinutes !== undefined) {
          setState('currentExplorationSynapse', {
            ...state.currentExplorationSynapse,
            pointsAccumulated,
            currentEtaMinutes: etaMinutes,
          })
        }
        break
      }

      case 'lottery:winner': {
        // Could trigger a notification UI here
        break
      }

      case 'synapses:delta': {
        // Compact delta updates for individual synapse state changes
        const { c: changes } = message.data
        if (!state.rawSynapseData || !changes?.length) break

        // Update states in place
        for (const { i, s } of changes) {
          if (i < state.rawSynapseData.states.length) {
            state.rawSynapseData.states[i] = s
          }
        }

        // Increment version to trigger reactivity
        setState('rawSynapseDataVersion', v => v + 1)
        break
      }

      case 'error': {
        console.error('Server error:', message.data.message)
        break
      }
    }
  }

  // ============ CONNECTION ============

  // Exponential backoff for WebSocket reconnection
  const INITIAL_RECONNECT_DELAY = 3000 // 3 seconds
  const MAX_RECONNECT_DELAY = 30000 // 30 seconds
  let reconnectDelay = INITIAL_RECONNECT_DELAY

  const connect = () => {
    if (state.ws) return

    console.log('[WebSocket] Connecting to:', WS_URL)
    const socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      console.log('[WebSocket] Connected successfully')
      setState({ isConnected: true, ws: socket })
      // Reset backoff on successful connection
      reconnectDelay = INITIAL_RECONNECT_DELAY

      // Send auth token if available
      const token = authStore.token
      if (token) {
        console.log('[WebSocket] Sending auth:identify')
        socket.send(JSON.stringify({
          type: 'auth:identify',
          data: { token },
        }))
      }
    }

    socket.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)
        handleServerMessage(message)
      } catch (error) {
        console.error('Failed to parse server message:', error)
      }
    }

    socket.onclose = (event) => {
      console.log('[WebSocket] Disconnected, code:', event.code, 'reason:', event.reason)
      setState({ isConnected: false, ws: null })

      // Auto-reconnect with exponential backoff
      console.log(`[WebSocket] Reconnecting in ${reconnectDelay}ms...`)
      setTimeout(() => {
        if (!state.ws) {
          connect()
        }
      }, reconnectDelay)

      // Increase delay for next attempt (exponential backoff)
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
    }

    socket.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error)
    }

    setState({ ws: socket })
  }

  const disconnect = () => {
    if (state.ws) {
      state.ws.close()
      setState({ ws: null, isConnected: false })
    }
  }

  // ============ SHIP ACTIONS ============

  const createShip = async (name: string): Promise<Ship | null> => {
    const userId = userStore.userId
    if (!userId) {
      throw new Error('Please login first')
    }

    try {
      const response = await fetch(`${API_URL}/api/ships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Propagate error to caller
        const error = new Error(errorData.error || 'Failed to create ship')
        ;(error as any).serverError = errorData
        throw error
      }

      const result = await response.json()
      const ship = result.ship

      setState(produce((s) => {
        const currentShips = Array.isArray(s.userShips) ? s.userShips : []
        s.userShips = [...currentShips, ship]
      }))

      // Update ship count in userStore
      const shipCount = Array.isArray(state.userShips) ? state.userShips.length : 0
      userStore.setCurrentShipCount(shipCount)

      return ship
    } catch (err) {
      // Re-throw to let caller handle the error
      throw err
    }
  }

  const selectShip = (shipId: string | null) => {
    setState({ selectedShipId: shipId })

    // If selecting a ship that's exploring, fetch synapse details
    if (shipId) {
      const ship = state.userShips.find(s => s.id === shipId)
      if (ship?.currentSynapseId) {
        fetchSynapseDetails(ship.currentSynapseId)
        fetchSynapseExplorers(ship.currentSynapseId)
      }
    }
  }

  // Set exploration target (synapse selected for a searching ship)
  const setExplorationTarget = async (synapseId: string | null) => {
    if (synapseId) {
      const synapse = await fetchSynapseDetails(synapseId)
      setState({ explorationTarget: synapse })
    } else {
      setState({ explorationTarget: null })
    }
  }

  // Set exploration target by position (for cluster clicks)
  const setExplorationTargetByPosition = async (x: number, y: number, z: number) => {
    const synapse = await fetchSynapseByPosition(x, y, z)
    setState({ explorationTarget: synapse })
  }

  // ============ EXPLORATION ACTIONS ============

  const startExploration = async (shipId: string, synapseId: string, pointsPerMin: number): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship) {
      console.error('Ship not found:', shipId)
      return false
    }
    if (ship.state !== 'idle') {
      console.error('Ship must be idle to start exploration:', ship.state)
      return false
    }

    const userId = userStore.userId
    if (!userId) return false

    // Optimistic update with timestamp for reconciliation
    const now = Date.now()
    const optimisticShip = { ...ship, state: 'exploring' as const, currentSynapseId: synapseId, _lastLocalUpdate: now }
    setState(produce((s) => {
      updateShipInList(s, optimisticShip)
    }))

    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}/explore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId, userId, pointsPerMin }),
      })

      if (response.ok) {
        const { ship: updatedShip, synapse } = await response.json()
        setState(produce((s) => {
          // Map server state to client state
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
            _lastLocalUpdate: now,
          })
          s.currentExplorationSynapse = synapse
          s.explorationTarget = null  // Clear target after starting exploration
        }))
        return true
      }

      // Rollback on error
      const error = await response.json()
      console.error('Start exploration failed:', error.error || error)
      toast.error(error.error || 'Failed to start exploration')
      setState(produce((s) => {
        updateShipInList(s, ship)  // Revert to original state
      }))
      return false
    } catch (error) {
      console.error('Failed to start exploration:', error)
      toast.error('Failed to start exploration')
      // Rollback on error
      setState(produce((s) => {
        updateShipInList(s, ship)  // Revert to original state
      }))
      return false
    }
  }

  const leaveExploration = async (shipId: string): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship || ship.state !== 'exploring' || !ship.currentSynapseId) {
      // This can happen due to race condition with WebSocket updates - not an error
      console.debug('Ship is not exploring (state may have changed):', shipId, ship?.state)
      return false
    }

    try {
      const response = await fetch(`${API_URL}/api/synapses/${ship.currentSynapseId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
          s.currentExplorationSynapse = null
          s.currentExplorers = []
        }))
        return true
      }

      const error = await response.json()
      console.error('Leave exploration failed:', error.error || error)
      return false
    } catch (error) {
      console.error('Failed to leave exploration:', error)
      return false
    }
  }

  const updateSpendingRate = async (shipId: string, pointsPerMin: number): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship || ship.state !== 'exploring' || !ship.currentSynapseId) {
      console.error('Ship is not exploring:', shipId)
      return false
    }

    try {
      const response = await fetch(`${API_URL}/api/synapses/${ship.currentSynapseId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId, pointsPerMin }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to update spending rate:', error)
      return false
    }
  }

  // ============ AUTOPILOT ============

  const toggleAutopilot = async (shipId: string, enabled: boolean): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to toggle autopilot:', error)
      return false
    }
  }

  const setAutopilotPreferences = async (shipId: string, prefs: AutopilotPreferences): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/autopilot/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to set autopilot preferences:', error)
      return false
    }
  }

  // ============ ITEMS ============

  const equipItem = async (shipId: string, itemId: string, slotIndex: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, slotIndex }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to equip item:', error)
      return false
    }
  }

  const unequipItem = async (shipId: string, slotIndex: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/unequip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to unequip item:', error)
      return false
    }
  }

  // ============ DEPLOY/RECALL ============

  const deployShip = async (shipId: string, targetX: number, targetY: number, targetZ: number): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship) {
      console.error('Ship not found:', shipId)
      return false
    }
    if (ship.state !== 'idle') {
      console.error('Ship must be idle to deploy:', ship.state)
      return false
    }

    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: targetX, positionY: targetY, positionZ: targetZ }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
        }))
        return true
      }

      const error = await response.json()
      console.error('Deploy failed:', error.error || error)
      return false
    } catch (error) {
      console.error('Failed to deploy ship:', error)
      return false
    }
  }

  const deployToSynapse = async (shipId: string, synapseId: string): Promise<boolean> => {
    const synapse = await fetchSynapseDetails(synapseId)
    if (!synapse) {
      console.error('Synapse not found:', synapseId)
      return false
    }

    return deployShip(shipId, synapse.positionX, synapse.positionY, synapse.positionZ)
  }

  // Travel to synapse - ship moves to synapse position and auto-starts exploring on arrival
  const travelToSynapse = async (shipId: string, synapseId: string, pointsPerMin?: number): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship) {
      console.error('Ship not found:', shipId)
      return false
    }
    if (ship.state !== 'idle') {
      console.error('Ship must be idle to travel:', ship.state)
      return false
    }

    // Optimistic update with timestamp - set to deploying state
    const now = Date.now()
    const optimisticShip = { ...ship, state: 'deploying' as const, _lastLocalUpdate: now }
    setState(produce((s) => {
      updateShipInList(s, optimisticShip)
      s.explorationTarget = null  // Clear target after travel starts
    }))

    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/travel-to-synapse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synapseId, pointsPerMin: pointsPerMin || ship.currentPointsPerMin || 100 }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          // Map server state to client state and preserve travel animation data
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
            _lastLocalUpdate: now,
          })
        }))
        return true
      }

      // Rollback on error
      const error = await response.json()
      console.error('Travel to synapse failed:', error.error || error)
      toast.error(error.error || 'Failed to travel to synapse')
      setState(produce((s) => {
        updateShipInList(s, ship)  // Revert to original state
      }))
      return false
    } catch (error) {
      console.error('Failed to travel to synapse:', error)
      toast.error('Failed to travel to synapse')
      // Rollback on error
      setState(produce((s) => {
        updateShipInList(s, ship)  // Revert to original state
      }))
      return false
    }
  }

  const recallShip = async (shipId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
          s.currentExplorationSynapse = null
          s.currentExplorers = []
        }))
      }
    } catch (error) {
      // Fallback: update locally
      setState(produce((s) => {
        s.userShips = safeUserShips(s).map(ss =>
          ss.id === shipId ? { ...ss, state: 'idle' as const, currentSynapseId: null } : ss
        )
      }))
    }
  }

  // ============ API ACTIONS ============

  const fetchUserShips = async () => {
    const userId = userStore.userId
    if (!userId) return

    setState({ isLoadingShips: true })
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/ships`)
      if (!response.ok) throw new Error('Failed to fetch ships')

      const data = await response.json()
      // Ensure ships is always an array (API might return { ships: [...] } or [...])
      const rawShips = Array.isArray(data) ? data : (Array.isArray(data?.ships) ? data.ships : [])
      // Map server states to client states
      const ships = rawShips.map((ship: any) => ({
        ...ship,
        state: mapServerShipState(ship.state),
      }))
      setState({ userShips: ships, isLoadingShips: false })

      // Update ship count in userStore
      userStore.setCurrentShipCount(ships.length)
    } catch (error) {
      console.error('Failed to fetch user ships:', error)
      setState({ isLoadingShips: false })
    }
  }

  const fetchWorldState = async () => {
    setState({ isLoadingWorld: true })
    try {
      const response = await fetch(`${API_URL}/api/world`)
      if (!response.ok) throw new Error('Failed to fetch world state')

      const world = await response.json()
      console.log('[fetchWorldState] Received world data:', world)
      console.log('[fetchWorldState] Cluster count:', world.synapseClusters?.length)

      // Map server clusters to client format and separate by LOD level
      // Server sends 'synapseClusters' with SpaceCluster properties (spaceCount, beingSolvedCount)
      // Client expects SynapseCluster properties (synapseCount, beingExploredCount)
      const rawClusters = world.synapseClusters || []
      const mappedClusters = rawClusters.map(mapServerClusterToClient)

      const synapseClustersLod0 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 0)
      const synapseClustersLod1 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 1)
      const synapseClustersLod2 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 2)

      console.log('[fetchWorldState] LOD0 clusters:', synapseClustersLod0.length)

      // Server sends agentClusters (was shipClusters)
      const agentClusters = world.agentClusters || []
      const shipClustersLod0 = agentClusters.filter((c: ShipCluster) => c.lodLevel === 0)
      const shipClustersLod1 = agentClusters.filter((c: ShipCluster) => c.lodLevel === 1)
      const shipClustersLod2 = agentClusters.filter((c: ShipCluster) => c.lodLevel === 2)

      setState({
        synapseClusters: mappedClusters,
        synapseClustersLod0,
        synapseClustersLod1,
        synapseClustersLod2,
        shipClusters: agentClusters,
        shipClustersLod0,
        shipClustersLod1,
        shipClustersLod2,
        discoveryProgress: world.discoveryProgress || { total: 0, discovered: 0, beingExplored: 0 },
        isLoadingWorld: false,
      })
    } catch (error) {
      console.error('Failed to fetch world state:', error)
      setState({ isLoadingWorld: false })
    }
  }

  /**
   * Fetch all 500k synapses in compact binary format
   * Binary format (16 bytes per synapse):
   * - float32 positionX (4 bytes)
   * - float32 positionY (4 bytes)
   * - float32 positionZ (4 bytes)
   * - uint8   state (1 byte)
   * - uint8   synapseType (1 byte)
   * - uint16  reserved (2 bytes)
   */
  const fetchBulkSynapses = async (): Promise<boolean> => {
    try {
      console.log('[ShipStore] Fetching bulk synapses...')
      const response = await fetch(`${API_URL}/api/synapses/bulk`)
      if (!response.ok) throw new Error('Failed to fetch bulk synapses')

      const buffer = await response.arrayBuffer()
      const view = new DataView(buffer)

      // Read header: version (1 byte) + count (4 bytes)
      const version = view.getUint8(0)
      const count = view.getUint32(1, true) // little-endian

      console.log(`[ShipStore] Loaded ${count} raw synapses (v${version})`)

      // Allocate typed arrays
      const positions = new Float32Array(count * 3)
      const states = new Uint8Array(count)
      const types = new Uint8Array(count)

      const HEADER = 5
      const RECORD = 16

      // Parse binary data
      for (let i = 0; i < count; i++) {
        const off = HEADER + i * RECORD
        positions[i * 3] = view.getFloat32(off, true)
        positions[i * 3 + 1] = view.getFloat32(off + 4, true)
        positions[i * 3 + 2] = view.getFloat32(off + 8, true)
        states[i] = view.getUint8(off + 12)
        types[i] = view.getUint8(off + 13)
      }

      setState({
        rawSynapseData: { count, positions, states, types, version },
        rawSynapseDataVersion: v => v + 1,
      })

      return true
    } catch (error) {
      console.error('Failed to fetch bulk synapses:', error)
      return false
    }
  }

  const fetchSynapseDetails = async (synapseId: string): Promise<Synapse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}`)
      if (!response.ok) return null

      const synapse = await response.json()
      // Map server state to client state
      if (synapse.state) {
        synapse.state = mapServerSynapseState(synapse.state)
      }
      setState({ currentExplorationSynapse: synapse })
      return synapse
    } catch (error) {
      console.error('Failed to fetch synapse details:', error)
      return null
    }
  }

  const fetchSynapseByPosition = async (x: number, y: number, z: number): Promise<Synapse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/near?x=${x}&y=${y}&z=${z}`)
      if (!response.ok) return null

      const data = await response.json()
      const synapse = data.synapse
      // Map server state to client state
      if (synapse?.state) {
        synapse.state = mapServerSynapseState(synapse.state)
      }
      setState({ currentExplorationSynapse: synapse })
      return synapse
    } catch (error) {
      console.error('Failed to fetch synapse by position:', error)
      return null
    }
  }

  const fetchSynapseExplorers = async (synapseId: string): Promise<ExplorerInfo[]> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}`)
      if (!response.ok) return []

      const data = await response.json()
      const explorers = data.synapse?.explorers || []
      setState({ currentExplorers: explorers })
      return explorers
    } catch (error) {
      console.error('Failed to fetch synapse explorers:', error)
      return []
    }
  }

  // ============ UI ACTIONS ============

  const setViewMode = (mode: '3d' | '2d-top') => setState({ viewMode: mode })
  const setShowShipPaths = (show: boolean) => setState({ showShipPaths: show })
  const setShowDiscoveredOnly = (show: boolean) => setState({ showDiscoveredOnly: show })
  const setLodLevel = (level: number) => setState({ currentLodLevel: Math.max(0, Math.min(2, level)) })

  // ============ STATE RESET ============

  /**
   * Clear all user-specific ship state (call on logout)
   * Prevents data leakage between users and cleans up stale state
   */
  const clearUserShips = () => {
    setState({
      userShips: [],
      selectedShipId: null,
      currentExplorationSynapse: null,
      currentExplorers: [],
      explorationTarget: null,
      isLoadingShips: false,
      deployingShipIds: new Set(),
    })
  }

  // ============ UTILITY ============

  const getSynapseClustersForLod = () => {
    switch (state.currentLodLevel) {
      case 0: return state.synapseClustersLod0
      case 1: return state.synapseClustersLod1
      case 2: return state.synapseClustersLod2
      default: return state.synapseClustersLod0
    }
  }

  const getShipClustersForLod = () => {
    switch (state.currentLodLevel) {
      case 0: return state.shipClustersLod0
      case 1: return state.shipClustersLod1
      case 2: return state.shipClustersLod2
      default: return state.shipClustersLod0
    }
  }

  const canCreateShip = () => {
    const ships = state.userShips
    if (!Array.isArray(ships)) return true
    return ships.length < userStore.maxShips
  }

  return {
    // ============ REACTIVE GETTERS ============
    // Connection State
    get isConnected() { return state.isConnected },
    get ws() { return state.ws },

    // Individual Synapse Data (500k points)
    get rawSynapseData() { return state.rawSynapseData },
    get rawSynapseDataVersion() { return state.rawSynapseDataVersion },

    // Synapse State (LOD clusters)
    get synapseClusters() { return state.synapseClusters },
    get synapseClustersLod0() { return state.synapseClustersLod0 },
    get synapseClustersLod1() { return state.synapseClustersLod1 },
    get synapseClustersLod2() { return state.synapseClustersLod2 },

    // Ship State (LOD clusters + user's ships)
    get shipClusters() { return state.shipClusters },
    get shipClustersLod0() { return state.shipClustersLod0 },
    get shipClustersLod1() { return state.shipClustersLod1 },
    get shipClustersLod2() { return state.shipClustersLod2 },
    get userShips() { return state.userShips },
    get selectedShipId() { return state.selectedShipId },

    // Current Exploration (for selected ship)
    get currentExplorationSynapse() { return state.currentExplorationSynapse },
    get currentExplorers() { return state.currentExplorers },

    // Exploration Target (for searching ships)
    get explorationTarget() { return state.explorationTarget },

    // Discovery Progress
    get discoveryProgress() { return state.discoveryProgress },

    // Recent Events
    get recentDiscoveries() { return state.recentDiscoveries },
    get recentLoot() { return state.recentLoot },

    // UI State
    get viewMode() { return state.viewMode },
    get showShipPaths() { return state.showShipPaths },
    get showDiscoveredOnly() { return state.showDiscoveredOnly },
    get currentLodLevel() { return state.currentLodLevel },

    // Loading States
    get isLoadingWorld() { return state.isLoadingWorld },
    get isLoadingShips() { return state.isLoadingShips },
    get deployingShipIds() { return state.deployingShipIds },

    // ============ COMPUTED SELECTORS ============
    get selectedShip() {
      const ships = state.userShips
      if (!Array.isArray(ships)) return null
      return ships.find(s => s.id === state.selectedShipId) || null
    },
    get exploringShips() {
      const ships = state.userShips
      if (!Array.isArray(ships)) return []
      return ships.filter(s => s.state === 'exploring')
    },
    get idleShips() {
      const ships = state.userShips
      if (!Array.isArray(ships)) return []
      return ships.filter(s => s.state === 'idle')
    },
    get currentExploration() {
      return {
        synapse: state.currentExplorationSynapse,
        explorers: state.currentExplorers,
      }
    },

    // ============ ACTIONS ============
    // Connection
    connect,
    disconnect,

    // Ship Actions
    createShip,
    selectShip,

    // Exploration Actions
    setExplorationTarget,
    setExplorationTargetByPosition,
    startExploration,
    leaveExploration,
    updateSpendingRate,

    // Autopilot
    toggleAutopilot,
    setAutopilotPreferences,

    // Items
    equipItem,
    unequipItem,

    // Deploy/Recall
    deployShip,
    deployToSynapse,
    travelToSynapse,
    recallShip,

    // API Actions
    fetchUserShips,
    fetchWorldState,
    fetchBulkSynapses,
    fetchSynapseDetails,
    fetchSynapseByPosition,
    fetchSynapseExplorers,

    // UI Actions
    setViewMode,
    setShowShipPaths,
    setShowDiscoveredOnly,
    setLodLevel,

    // Utility
    getSynapseClustersForLod,
    getShipClustersForLod,
    canCreateShip,

    // State Reset
    clearUserShips,
  }
}

export const shipStore = createRoot(createShipStore)
