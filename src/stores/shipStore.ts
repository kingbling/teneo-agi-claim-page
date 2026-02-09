import { createRoot } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import type { SynapseType } from '@/types/game'
import { authStore } from './authStore'
import { userStore } from './userStore'
import { toast } from '@/components/ui/Toast'
import { log, fmt } from '@/utils/logger'

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
// Client expects: idle, deploying, solving, returning
function mapServerShipState(serverState: string): ShipStatus {
  switch (serverState) {
    case 'traveling': return 'deploying'
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
export type ShipStatus = 'idle' | 'solving' | 'deploying' | 'returning'

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

function mapServerClusterToClient(cluster: ServerCluster): SynapseCluster {
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
  | { type: 'agents:update'; data: unknown[] }  // Legacy - server agent updates
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
        log.ws.info('state:sync - Received world, cluster count:', world.synapseClusters?.length)

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
        // Ship state updates from server - MERGES with local state (not a full replacement)
        // Server sends partial updates (single ship or subset), client merges them
        const { ships, timestamp } = message.data
        log.ws.info('ships:sync - Received', ships?.length, 'ships, timestamp:', timestamp)
        log.ws.debug('ships:sync data:', ships?.map((s: Ship) => ({
          id: fmt.shortId(s.id),
          state: s.state,
          pos: fmt.pos(s.positionX, s.positionY, s.positionZ),
          rotationY: fmt.deg(s.rotationY),
        })))
        if (!Array.isArray(ships)) break

        setState(produce((s) => {
          // Build a map of existing ships for O(1) lookup
          const existingShipsMap = new Map(safeUserShips(s).map(ship => [ship.id, ship]))

          // Merge incoming ships with existing ships
          for (const serverShip of ships) {
            const localShip = existingShipsMap.get(serverShip.id)

            // Keep local state if it was modified more recently than the server's timestamp
            // This prevents flickering when user action is followed by stale WebSocket sync
            if (localShip?._lastLocalUpdate && localShip._lastLocalUpdate > timestamp) {
              log.ws.debug('ships:sync - Skipping stale update for ship', fmt.shortId(serverShip.id))
              continue // Skip this update, keep local state
            }

            // === BULLETPROOF ANIMATION DATA PRESERVATION ===
            // Check if local ship has animation data AND travel is still in progress
            // This is independent of state - we preserve animation data based on timing, not state
            const hasLocalAnimationData = localShip?.travelStartTime != null &&
              localShip?.travelDuration != null &&
              localShip.travelDuration > 0
            const travelStillInProgress = hasLocalAnimationData &&
              Date.now() < (localShip!.travelStartTime! + localShip!.travelDuration!)

            // Map server state to client state (server: traveling/solving → client: deploying/solving)
            const mappedState = mapServerShipState(serverShip.state)
            const serverIsTraveling = serverShip.state === 'traveling'

            // Override state if travel is still in progress locally
            const finalState = travelStillInProgress ? 'deploying' as const : mappedState

            // Check if ship is solving (we need to preserve its targetPosition for synapse location)
            const shouldPreserveTargetPosition = (finalState === 'solving' || localShip?.state === 'solving') &&
              localShip?.targetPositionX !== undefined

            // Log animation data preservation
            if (travelStillInProgress) {
              log.ws.success('ships:sync - PRESERVING animation data!', fmt.shortId(serverShip.id), {
                localState: localShip?.state,
                serverState: serverShip.state,
                finalState,
                travelTimeRemaining: fmt.ms((localShip!.travelStartTime! + localShip!.travelDuration!) - Date.now()),
              })
            }

            // Determine position source
            const serverHasPosition = serverShip.positionX !== undefined &&
              serverShip.positionY !== undefined &&
              serverShip.positionZ !== undefined

            // Build merged ship
            const mergedShip: Ship = {
              ...serverShip,
              state: finalState,
              // Preserve local position if server doesn't send one
              positionX: serverHasPosition ? serverShip.positionX : localShip?.positionX,
              positionY: serverHasPosition ? serverShip.positionY : localShip?.positionY,
              positionZ: serverHasPosition ? serverShip.positionZ : localShip?.positionZ,
              // Preserve rotationY from local ship since server doesn't send it in ShipDTO
              rotationY: localShip?.rotationY ?? serverShip.rotationY,
              // ALWAYS preserve animation data if travel is still in progress
              ...(travelStillInProgress ? {
                startPositionX: localShip!.startPositionX,
                startPositionY: localShip!.startPositionY,
                startPositionZ: localShip!.startPositionZ,
                targetPositionX: localShip!.targetPositionX,
                targetPositionY: localShip!.targetPositionY,
                targetPositionZ: localShip!.targetPositionZ,
                travelStartTime: localShip!.travelStartTime,
                travelDuration: localShip!.travelDuration,
                currentSynapseId: localShip!.currentSynapseId,
                _lastLocalUpdate: localShip!._lastLocalUpdate,
              } : shouldPreserveTargetPosition && localShip ? {
                // Preserve target position for solving ships (synapse location)
                targetPositionX: localShip.targetPositionX,
                targetPositionY: localShip.targetPositionY,
                targetPositionZ: localShip.targetPositionZ,
                currentSynapseId: localShip.currentSynapseId,
              } : serverIsTraveling ? {
                // Server is traveling but local doesn't have data yet - use server data
                startPositionX: serverShip.startPositionX,
                startPositionY: serverShip.startPositionY,
                startPositionZ: serverShip.startPositionZ,
                targetPositionX: serverShip.targetPositionX,
                targetPositionY: serverShip.targetPositionY,
                targetPositionZ: serverShip.targetPositionZ,
                travelStartTime: serverShip.travelStartTime,
                travelDuration: serverShip.travelDuration,
                currentSynapseId: serverShip.currentSynapseId,
              } : {}),
            }

            // Add or update ship in the map
            existingShipsMap.set(serverShip.id, mergedShip)
          }

          // Convert map back to array
          s.userShips = Array.from(existingShipsMap.values())
          s.isLoadingShips = false
        }))

        // Update ship count in userStore with the actual count after merge
        setState((s) => {
          userStore.setCurrentShipCount(safeUserShips(s).length)
        })

        // For solving ships without targetPosition, fetch synapse details to get position
        // This handles fresh page load where ships are solving but we don't have synapse position yet
        for (const serverShip of ships) {
          const mappedState = mapServerShipState(serverShip.state)
          const synapseId = serverShip.currentSynapseId || serverShip.targetSpaceId
          if (mappedState === 'solving' && synapseId) {
            const localShip = state.userShips?.find(s => s.id === serverShip.id)
            // If ship is solving but has no targetPosition, fetch synapse to get it
            if (!localShip?.targetPositionX) {
              log.ws.info(`ships:sync - Solving ship ${fmt.shortId(serverShip.id)} needs synapse position, fetching...`)
              fetchSynapseDetails(synapseId).then(synapse => {
                if (synapse) {
                  setState(produce((s) => {
                    const shipIndex = safeUserShips(s).findIndex(ship => ship.id === serverShip.id)
                    if (shipIndex >= 0) {
                      s.userShips[shipIndex] = {
                        ...s.userShips[shipIndex],
                        targetPositionX: synapse.positionX,
                        targetPositionY: synapse.positionY,
                        targetPositionZ: synapse.positionZ,
                        currentSynapseId: synapse.id,
                      }
                    }
                  }))
                }
              })
            }
          }
        }
        break
      }

      case 'travel:started': {
        // Handle travel:started event - update ship with travel interpolation data
        const event = message.data
        log.travel.critical('travel:started RECEIVED!')
        log.travel.debug('Full event data:', event)

        const travelDuration = event.travelDuration
        const travelStartTime = event.travelStartTime

        // Calculate distance for logging
        const dx = event.targetPositionX - event.startPositionX
        const dy = (event.targetPositionY ?? 0) - (event.startPositionY ?? 0)
        const dz = (event.targetPositionZ ?? 0) - (event.startPositionZ ?? 0)
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        log.travel.info('travel:started key values:', {
          shipId: fmt.shortId(event.shipId),
          startPos: fmt.pos(event.startPositionX, event.startPositionY, event.startPositionZ),
          targetPos: fmt.pos(event.targetPositionX, event.targetPositionY, event.targetPositionZ),
          travelStartTime,
          travelDuration: fmt.ms(travelDuration),
          distance: distance.toFixed(3),
        })
        const now = Date.now()

        // Calculate initial rotation (yaw) toward target - same formula as engine
        const initialRotationY = Math.atan2(dx, -dz)  // Ship model faces -Z

        log.travel.debug('travel:started initial rotation:', fmt.deg(initialRotationY))

        setState(produce((s) => {
          // Use map pattern to ensure proper reactivity (like agents:update handler)
          s.userShips = safeUserShips(s).map(ship => {
            if (ship.id !== event.shipId) return ship
            log.travel.info('travel:started - Updating ship to deploying:', fmt.shortId(ship.id))
            return {
              ...ship,
              state: 'deploying' as const,
              startPositionX: event.startPositionX,
              startPositionY: event.startPositionY,
              startPositionZ: event.startPositionZ,
              targetPositionX: event.targetPositionX,
              targetPositionY: event.targetPositionY,
              targetPositionZ: event.targetPositionZ,
              travelStartTime,
              travelDuration,
              currentSynapseId: event.targetSynapseId,
              rotationY: initialRotationY,
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

        log.travel.debug('travel:position - Received', batch.ships.length, 'updates')
        log.travel.debug('travel:position updates:', batch.ships.map(u => ({
          shipId: fmt.shortId(u.shipId),
          pos: fmt.pos(u.positionX, u.positionY, u.positionZ),
          rotationY: fmt.deg(u.rotationY),
          progress: fmt.percent(u.progress),
        })))

        setState(produce((s) => {
          for (const update of batch.ships) {
            const index = safeUserShips(s).findIndex(ship => ship.id === update.shipId)
            if (index >= 0) {
              const beforeRotation = s.userShips[index].rotationY
              const beforeState = s.userShips[index].state
              // Update position, rotation, and ENSURE state is 'deploying'
              // This fixes the issue where ships:sync resets state to idle
              // while the ship is still traveling (receiving position updates)
              s.userShips[index] = {
                ...s.userShips[index],
                positionX: update.positionX,
                positionY: update.positionY,
                positionZ: update.positionZ,
                rotationY: update.rotationY,
                // If we're receiving position updates, the ship is definitely traveling
                state: 'deploying' as const,
                // Preserve timestamp to prevent ships:sync from overwriting
                _lastLocalUpdate: Date.now(),
              }
              const afterRotation = s.userShips[index].rotationY
              if (beforeState !== 'deploying') {
                log.travel.success(`travel:position - Fixed state: ${beforeState} → deploying`)
              }
              log.travel.debug(`travel:position - Ship ${fmt.shortId(update.shipId)} rotation:`,
                fmt.deg(beforeRotation), '→', fmt.deg(afterRotation))
            }
          }
        }))
        log.travel.debug('travel:position - After update, userShips count:', safeUserShips(state).length)
        break
      }

      case 'auth:success': {
        log.ws.success('Authenticated as user:', message.data.userId)
        break
      }

      case 'auth:error': {
        log.ws.error('Auth failed:', message.data.message)
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

            // Merge the update, map server state to client state, preserve local timestamp and rotationY
            return {
              ...updated,
              state: mapServerShipState(updated.state),
              rotationY: ship.rotationY ?? updated.rotationY,
              _lastLocalUpdate: ship._lastLocalUpdate,
            }
          })
        }))
        break
      }

      case 'agents:update': {
        // Agent updates from simulation engine - includes state changes on arrival
        const agents = message.data
        log.ws.debug('agents:update - Received:', agents)
        if (!Array.isArray(agents)) break

        // Only process if we have ships
        if (safeUserShips(state).length === 0) {
          log.ws.debug('agents:update - No user ships, skipping')
          break
        }

        // Track ships that just arrived (deploying → solving) for synapse fetch
        const newlyArrived: { shipId: string; synapseId: string }[] = []

        setState(produce((s) => {
          s.userShips = safeUserShips(s).map((ship) => {
            const agent = agents.find(a => a.id === ship.id)
            if (!agent) return ship

            const newState = agent.state ? mapServerShipState(agent.state) : ship.state
            const synapseId = agent.targetSpaceId ?? agent.currentSpaceId ?? ship.currentSynapseId
            log.ws.debug(`agents:update - Ship ${fmt.shortId(ship.id)} state: ${ship.state} → ${newState} (server: ${agent.state})`)

            // Detect arrival: was deploying, now solving, has synapse ID
            if (ship.state === 'deploying' && newState === 'solving' && synapseId) {
              log.ws.info(`agents:update - Ship ${fmt.shortId(ship.id)} ARRIVED at synapse ${fmt.shortId(synapseId)}`)
              newlyArrived.push({ shipId: ship.id, synapseId })
            }

            // Preserve current position if server doesn't send one (prevents ships from disappearing)
            // Also preserve targetPosition if ship was traveling (for smooth arrival animation)
            const hasValidServerPosition = agent.positionX !== undefined &&
              agent.positionX !== null &&
              agent.positionY !== undefined &&
              agent.positionY !== null &&
              agent.positionZ !== undefined &&
              agent.positionZ !== null

            // When ship arrives at destination, use targetPosition as current position
            const arrivalPosition = ship.state === 'deploying' && newState === 'solving'
              ? {
                  positionX: ship.targetPositionX ?? ship.positionX,
                  positionY: ship.targetPositionY ?? ship.positionY,
                  positionZ: ship.targetPositionZ ?? ship.positionZ,
                }
              : {}

            // SAFEGUARD: Always preserve targetPosition for solving ships, even if server doesn't send it
            // This is the synapse location and must be preserved
            const shouldKeepTargetPosition = (newState === 'solving' || ship.state === 'solving')
              && ship.targetPositionX !== undefined

            return {
              ...ship,
              // Use server position if valid, otherwise preserve current position
              // On arrival, use targetPosition to ensure ship stays at synapse
              positionX: hasValidServerPosition ? agent.positionX : arrivalPosition.positionX ?? ship.positionX,
              positionY: hasValidServerPosition ? agent.positionY : arrivalPosition.positionY ?? ship.positionY,
              positionZ: hasValidServerPosition ? agent.positionZ : arrivalPosition.positionZ ?? ship.positionZ,
              // Update state if provided (arrival transitions: traveling->solving, etc.)
              state: newState,
              // Update synapse ID if provided
              currentSynapseId: synapseId,
              // Clear travel data on arrival (when state changes from traveling)
              // NOTE: Keep targetPosition for solving ships - it represents the synapse location
              ...(agent.state === 'solving' ? {
                travelStartTime: null,
                travelDuration: null,
                startPositionX: undefined,
                startPositionY: undefined,
                startPositionZ: undefined,
                // DO NOT clear targetPosition - it's the synapse location for solving ships
                // This ensures ships stay at the correct position when solving
                // targetPositionX: undefined,
                // targetPositionY: undefined,
                // targetPositionZ: undefined,
                // Keep rotationY to maintain ship orientation at target
                // rotationY: undefined,
              } : {}),
              // EXPLICITLY preserve targetPosition for solving ships
              ...(shouldKeepTargetPosition ? {
                targetPositionX: ship.targetPositionX,
                targetPositionY: ship.targetPositionY,
                targetPositionZ: ship.targetPositionZ,
              } : {}),
            }
          })
        }))

        // Fetch synapse details for arrived ships (outside produce to avoid nested state updates)
        for (const { shipId, synapseId } of newlyArrived) {
          // Fetch if this ship is selected OR if we don't have any synapse loaded
          const selectedId = state.selectedShipId
          if (selectedId === shipId || !state.currentExplorationSynapse) {
            log.ws.info(`agents:update - Fetching synapse details for arrived ship ${fmt.shortId(shipId)}`)
            fetchSynapseDetails(synapseId)
            fetchSynapseExplorers(synapseId)
          }
        }
        break
      }

      case 'exploration:progress': {
        const { synapseId, pointsAccumulated, eta, currentETAMinutes, etaMinutes: serverEtaMinutes } = message.data
        // Support multiple field names: etaMinutes (server), eta (legacy), currentETAMinutes (alternative)
        const etaMinutes = serverEtaMinutes ?? eta ?? currentETAMinutes
        log.ws.debug(`exploration:progress - synapse ${fmt.shortId(synapseId)}, points: ${pointsAccumulated}, eta: ${etaMinutes}`)

        // Update if we have matching synapse loaded
        if (state.currentExplorationSynapse?.id === synapseId) {
          setState('currentExplorationSynapse', {
            ...state.currentExplorationSynapse,
            pointsAccumulated,
            currentEtaMinutes: etaMinutes,
          })
        } else {
          // Check if any of our ships is solving this synapse - if so, fetch details
          const solvingShip = state.userShips?.find(
            s => s.state === 'solving' && s.currentSynapseId === synapseId
          )
          if (solvingShip && !state.currentExplorationSynapse) {
            log.ws.info(`exploration:progress - Ship ${fmt.shortId(solvingShip.id)} solving synapse ${fmt.shortId(synapseId)}, fetching details`)
            fetchSynapseDetails(synapseId)
          }
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
        log.ws.error('Server error:', message.data.message)
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

    log.ws.info('Connecting to:', WS_URL)
    const socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      log.ws.success('Connected successfully')
      setState({ isConnected: true, ws: socket })
      // Reset backoff on successful connection
      reconnectDelay = INITIAL_RECONNECT_DELAY

      // Send auth token if available
      const token = authStore.token
      if (token) {
        log.ws.info('Sending auth:identify')
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
        log.ws.error('Failed to parse server message:', error)
      }
    }

    socket.onclose = (event) => {
      log.ws.warn('Disconnected, code:', event.code, 'reason:', event.reason)
      setState({ isConnected: false, ws: null })

      // Auto-reconnect with exponential backoff
      log.ws.info(`Reconnecting in ${fmt.ms(reconnectDelay)}...`)
      setTimeout(() => {
        if (!state.ws) {
          connect()
        }
      }, reconnectDelay)

      // Increase delay for next attempt (exponential backoff)
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
    }

    socket.onerror = (error) => {
      log.ws.error('Connection error:', error)
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

    const response = await fetch(`${API_URL}/api/ships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      // Propagate error to caller
      const error = new Error(errorData.error || 'Failed to create ship')
      ;(error as Error & { serverError?: unknown }).serverError = errorData
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
  }

  const selectShip = (shipId: string | null) => {
    setState({ selectedShipId: shipId })

    // If selecting a ship that's solving, fetch synapse details
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
      log.ship.error('Ship not found:', fmt.shortId(shipId))
      return false
    }
    if (ship.state !== 'idle') {
      log.ship.error('Ship must be idle to start exploration:', ship.state)
      return false
    }

    const userId = userStore.userId
    if (!userId) return false

    // Optimistic update with timestamp for reconciliation
    const now = Date.now()
    const optimisticShip = { ...ship, state: 'solving' as const, currentSynapseId: synapseId, _lastLocalUpdate: now }
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
      log.ship.error('Start exploration failed:', error.error || error)
      toast.error(error.error || 'Failed to start exploration')
      setState(produce((s) => {
        updateShipInList(s, ship)  // Revert to original state
      }))
      return false
    } catch (error) {
      log.ship.error('Failed to start exploration:', error)
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
    if (!ship || ship.state !== 'solving' || !ship.currentSynapseId) {
      // This can happen due to race condition with WebSocket updates - not an error
      log.ship.debug('Ship is not solving (state may have changed):', fmt.shortId(shipId), ship?.state)
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
      log.ship.error('Leave exploration failed:', error.error || error)
      return false
    } catch (error) {
      log.ship.error('Failed to leave exploration:', error)
      return false
    }
  }

  const updateSpendingRate = async (shipId: string, pointsPerMin: number): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship || ship.state !== 'solving' || !ship.currentSynapseId) {
      log.ship.error('Ship is not solving:', fmt.shortId(shipId))
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
      log.ship.error('Failed to update spending rate:', error)
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
      log.ship.error('Failed to toggle autopilot:', error)
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
      log.ship.error('Failed to set autopilot preferences:', error)
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
      log.ship.error('Failed to equip item:', error)
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
      log.ship.error('Failed to unequip item:', error)
      return false
    }
  }

  // ============ DEPLOY/RECALL ============

  const deployShip = async (shipId: string, targetX: number, targetY: number, targetZ: number): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship) {
      log.deploy.error('Ship not found:', fmt.shortId(shipId))
      return false
    }
    if (ship.state !== 'idle') {
      log.deploy.error('Ship must be idle to deploy:', ship.state)
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
      log.deploy.error('Deploy failed:', error.error || error)
      return false
    } catch (error) {
      log.deploy.error('Failed to deploy ship:', error)
      return false
    }
  }

  const deployToSynapse = async (shipId: string, synapseId: string): Promise<boolean> => {
    const synapse = await fetchSynapseDetails(synapseId)
    if (!synapse) {
      log.deploy.error('Synapse not found:', fmt.shortId(synapseId))
      return false
    }

    return deployShip(shipId, synapse.positionX, synapse.positionY, synapse.positionZ)
  }

  // Travel to synapse - ship moves to synapse position and auto-starts solving on arrival
  const travelToSynapse = async (shipId: string, synapseId: string, pointsPerMin?: number): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship) {
      log.travel.error('Ship not found:', fmt.shortId(shipId))
      return false
    }
    if (ship.state !== 'idle') {
      log.travel.error('Ship must be idle to travel:', ship.state)
      return false
    }

    log.travel.info('Starting travel: ship', fmt.shortId(shipId), '→ synapse', fmt.shortId(synapseId))

    // Set ship to deploying state while waiting for server response
    const now = Date.now()
    setState(produce((s) => {
      s.userShips = safeUserShips(s).map(ss =>
        ss.id === shipId ? { ...ss, state: 'deploying' as const, _lastLocalUpdate: now } : ss
      )
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
        log.travel.debug('API response:', {
          state: updatedShip.state,
          startX: updatedShip.startPositionX,
          targetX: updatedShip.targetPositionX,
          travelStartTime: updatedShip.travelStartTime,
          travelDuration: fmt.ms(updatedShip.travelDuration),
        })

        setState(produce((s) => {
          // Get current ship state - it may have been updated by WebSocket travel:started
          const currentShip = safeUserShips(s).find(ss => ss.id === shipId)

          // Prefer WebSocket data (currentShip) if it has animation data, otherwise use API response
          const hasWebSocketData = currentShip?.travelStartTime && currentShip?.travelDuration
          const mergedShip = {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
            _lastLocalUpdate: now,
            // Use WebSocket animation data if available, otherwise API response
            ...(hasWebSocketData ? {
              startPositionX: currentShip.startPositionX,
              startPositionY: currentShip.startPositionY,
              startPositionZ: currentShip.startPositionZ,
              targetPositionX: currentShip.targetPositionX,
              targetPositionY: currentShip.targetPositionY,
              targetPositionZ: currentShip.targetPositionZ,
              travelStartTime: currentShip.travelStartTime,
              travelDuration: currentShip.travelDuration,
            } : {}),
          }

          log.travel.info('Ship data:', {
            state: mergedShip.state,
            startPos: fmt.pos(mergedShip.startPositionX, mergedShip.startPositionY, mergedShip.startPositionZ),
            targetPos: fmt.pos(mergedShip.targetPositionX, mergedShip.targetPositionY, mergedShip.targetPositionZ),
            travelStartTime: mergedShip.travelStartTime,
            travelDuration: fmt.ms(mergedShip.travelDuration),
            source: hasWebSocketData ? 'websocket' : 'api',
          })

          updateShipInList(s, mergedShip)
        }))
        return true
      }

      // Rollback on error
      const error = await response.json()
      log.travel.error('Travel to synapse failed:', error.error || error)
      toast.error(error.error || 'Failed to travel to synapse')
      setState(produce((s) => {
        updateShipInList(s, ship)  // Revert to original state
      }))
      return false
    } catch (error) {
      log.travel.error('Failed to travel to synapse:', error)
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
      log.ship.error('Failed to recall ship:', error)
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
      // Map server states to client states and preserve local animation data
      setState(produce((s) => {
        // Build a map of existing ships to preserve animation data
        const existingShipsMap = new Map(safeUserShips(s).map(ship => [ship.id, ship]))

        s.userShips = rawShips.map((serverShip: Ship) => {
          const localShip = existingShipsMap.get(serverShip.id)
          const mappedState = mapServerShipState(serverShip.state)

          // Preserve animation data if ship is still traveling
          const localIsDeploying = localShip?.state === 'deploying' &&
            localShip.travelStartTime &&
            localShip.travelDuration &&
            Date.now() < localShip.travelStartTime + localShip.travelDuration

          return {
            ...serverShip,
            state: mappedState,
            // Preserve animation data for actively traveling ships
            ...(localIsDeploying ? {
              startPositionX: localShip.startPositionX,
              startPositionY: localShip.startPositionY,
              startPositionZ: localShip.startPositionZ,
              targetPositionX: localShip.targetPositionX,
              targetPositionY: localShip.targetPositionY,
              targetPositionZ: localShip.targetPositionZ,
              travelStartTime: localShip.travelStartTime,
              travelDuration: localShip.travelDuration,
              rotationY: localShip.rotationY,
            } : {}),
          }
        })
        s.isLoadingShips = false
      }))

      // Update ship count in userStore
      setState((s) => {
        userStore.setCurrentShipCount(safeUserShips(s).length)
      })
    } catch (error) {
      log.ship.error('Failed to fetch user ships:', error)
      setState({ isLoadingShips: false })
    }
  }

  /**
   * Force refresh ships from server - replaces all local state with server state
   * Use this to fix stuck/out-of-sync ship states
   */
  const refreshShips = async () => {
    log.ship.info('Force refreshing ships from server...')
    await fetchUserShips()
  }

  const fetchWorldState = async () => {
    setState({ isLoadingWorld: true })
    try {
      const response = await fetch(`${API_URL}/api/world`)
      if (!response.ok) throw new Error('Failed to fetch world state')

      const world = await response.json()
      log.ship.debug('fetchWorldState - Received world data, cluster count:', world.synapseClusters?.length)

      // Map server clusters to client format and separate by LOD level
      // Server sends 'synapseClusters' with SpaceCluster properties (spaceCount, beingSolvedCount)
      // Client expects SynapseCluster properties (synapseCount, beingExploredCount)
      const rawClusters = world.synapseClusters || []
      const mappedClusters = rawClusters.map(mapServerClusterToClient)

      const synapseClustersLod0 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 0)
      const synapseClustersLod1 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 1)
      const synapseClustersLod2 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 2)

      log.ship.debug('fetchWorldState - LOD0 clusters:', synapseClustersLod0.length)

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
      log.ship.error('Failed to fetch world state:', error)
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
      log.ship.info('Fetching bulk synapses...')
      const response = await fetch(`${API_URL}/api/synapses/bulk`)
      if (!response.ok) throw new Error('Failed to fetch bulk synapses')

      const buffer = await response.arrayBuffer()
      const view = new DataView(buffer)

      // Read header: version (1 byte) + count (4 bytes)
      const version = view.getUint8(0)
      const count = view.getUint32(1, true) // little-endian

      log.ship.success(`Loaded ${fmt.num(count)} raw synapses (v${version})`)

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
      log.ship.error('Failed to fetch bulk synapses:', error)
      return false
    }
  }

  const fetchSynapseDetails = async (synapseId: string): Promise<Synapse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}`)
      if (!response.ok) return null

      const data = await response.json()
      const synapse = data.synapse  // API returns { synapse: {...} }
      if (!synapse) return null

      // Map server state to client state
      if (synapse.state) {
        synapse.state = mapServerSynapseState(synapse.state)
      }
      setState({ currentExplorationSynapse: synapse })
      return synapse
    } catch (error) {
      log.ship.error('Failed to fetch synapse details:', error)
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
      log.ship.error('Failed to fetch synapse by position:', error)
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
      log.ship.error('Failed to fetch synapse explorers:', error)
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
    get solvingShips() {
      const ships = state.userShips
      if (!Array.isArray(ships)) return []
      return ships.filter(s => s.state === 'solving')
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
    refreshShips,
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
