import { createRoot } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import type { SynapseType } from '@/types/game'
import { userStore } from './userStore'

// API Configuration - empty string means same-origin (App Platform deployment)
const API_URL = import.meta.env.VITE_API_URL ?? ''
const WS_URL = import.meta.env.VITE_WS_URL ?? ''

// ============================================================================
// MASTERPLAN 2026: SHIP STORE
// Replaces agentStore - no fuel/traits, adds autopilot + items
// ============================================================================

// Ship Status (simplified from Agent)
export type ShipStatus = 'idle' | 'exploring' | 'deploying' | 'returning'

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

  // Position (for visualization)
  positionX: number
  positionY: number
  positionZ: number

  // Start position for travel animation
  startPositionX?: number
  startPositionY?: number
  startPositionZ?: number

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
  totalLoot: number
  totalAgiEarned: number
  createdAt: number
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
  shipClusters: ShipCluster[]
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

// Server Messages
export type ServerMessage =
  | { type: 'state:sync'; data: WorldState }
  | { type: 'synapse:completed'; data: SynapseDiscoveryEvent }
  | { type: 'loot:distributed'; data: LootEvent }
  | { type: 'ships:update'; data: Ship[] }
  | { type: 'exploration:progress'; data: { synapseId: string; pointsAccumulated: number; eta: number } }
  | { type: 'lottery:winner'; data: { synapseId: string; winnerId: string; winnerShipId: string; reward: number } }
  | { type: 'error'; data: { message: string } }

// Store State
export interface ShipStoreState {
  // Connection State
  isConnected: boolean
  ws: WebSocket | null

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

  // Synapses
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

        // Map server clusters to client format and separate by LOD level
        const rawClusters = world.synapseClusters || []
        const mappedClusters = rawClusters.map(mapServerClusterToClient)

        const synapseClustersLod0 = mappedClusters.filter(c => c.lodLevel === 0)
        const synapseClustersLod1 = mappedClusters.filter(c => c.lodLevel === 1)
        const synapseClustersLod2 = mappedClusters.filter(c => c.lodLevel === 2)

        const shipClustersLod0 = (world.shipClusters || []).filter(c => c.lodLevel === 0)
        const shipClustersLod1 = (world.shipClusters || []).filter(c => c.lodLevel === 1)
        const shipClustersLod2 = (world.shipClusters || []).filter(c => c.lodLevel === 2)

        setState({
          synapseClusters: mappedClusters,
          synapseClustersLod0,
          synapseClustersLod1,
          synapseClustersLod2,
          shipClusters: world.shipClusters || [],
          shipClustersLod0,
          shipClustersLod1,
          shipClustersLod2,
          discoveryProgress: world.discoveryProgress,
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
        const updatedShips = message.data
        if (!Array.isArray(updatedShips)) break
        setState(produce((s) => {
          // Update user's ships if any of them are in the update
          s.userShips = safeUserShips(s).map((ship) => {
            const updated = updatedShips.find(u => u.id === ship.id)
            return updated || ship
          })
        }))
        break
      }

      case 'exploration:progress': {
        const { synapseId, pointsAccumulated, eta } = message.data
        if (state.currentExplorationSynapse?.id === synapseId) {
          setState('currentExplorationSynapse', {
            ...state.currentExplorationSynapse,
            pointsAccumulated,
            currentEtaMinutes: eta,
          })
        }
        break
      }

      case 'lottery:winner': {
        // Could trigger a notification UI here
        break
      }

      case 'error': {
        console.error('Server error:', message.data.message)
        break
      }
    }
  }

  // ============ CONNECTION ============

  const connect = () => {
    if (state.ws) return

    const socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      setState({ isConnected: true, ws: socket })
    }

    socket.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)
        handleServerMessage(message)
      } catch (error) {
        console.error('Failed to parse server message:', error)
      }
    }

    socket.onclose = () => {
      setState({ isConnected: false, ws: null })

      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (!state.ws) {
          connect()
        }
      }, 3000)
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
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

    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}/explore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId, userId, pointsPerMin }),
      })

      if (response.ok) {
        const { ship: updatedShip, synapse } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, updatedShip)
          s.currentExplorationSynapse = synapse
        }))
        return true
      }

      const error = await response.json()
      console.error('Start exploration failed:', error.error || error)
      return false
    } catch (error) {
      console.error('Failed to start exploration:', error)
      return false
    }
  }

  const leaveExploration = async (shipId: string): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship || ship.state !== 'exploring' || !ship.currentSynapseId) {
      console.error('Ship is not exploring:', shipId)
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
          updateShipInList(s, updatedShip)
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
          updateShipInList(s, updatedShip)
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
          updateShipInList(s, updatedShip)
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
          updateShipInList(s, updatedShip)
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
          updateShipInList(s, updatedShip)
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
          updateShipInList(s, updatedShip)
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
          updateShipInList(s, updatedShip)
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

  const recallShip = async (shipId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, updatedShip)
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
      const ships = Array.isArray(data) ? data : (Array.isArray(data?.ships) ? data.ships : [])
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

      // Map server clusters to client format and separate by LOD level
      // Server sends 'synapseClusters' with SpaceCluster properties (spaceCount, beingSolvedCount)
      // Client expects SynapseCluster properties (synapseCount, beingExploredCount)
      const rawClusters = world.synapseClusters || []
      const mappedClusters = rawClusters.map(mapServerClusterToClient)

      const synapseClustersLod0 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 0)
      const synapseClustersLod1 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 1)
      const synapseClustersLod2 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 2)

      const shipClustersLod0 = (world.shipClusters || []).filter((c: ShipCluster) => c.lodLevel === 0)
      const shipClustersLod1 = (world.shipClusters || []).filter((c: ShipCluster) => c.lodLevel === 1)
      const shipClustersLod2 = (world.shipClusters || []).filter((c: ShipCluster) => c.lodLevel === 2)

      setState({
        synapseClusters: mappedClusters,
        synapseClustersLod0,
        synapseClustersLod1,
        synapseClustersLod2,
        shipClusters: world.agentClusters || [],
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

  const fetchSynapseDetails = async (synapseId: string): Promise<Synapse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}`)
      if (!response.ok) return null

      const synapse = await response.json()
      setState({ currentExplorationSynapse: synapse })
      return synapse
    } catch (error) {
      console.error('Failed to fetch synapse details:', error)
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
    recallShip,

    // API Actions
    fetchUserShips,
    fetchWorldState,
    fetchSynapseDetails,
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

    // Debug: Inject test ship for development
    _debugInjectShip: (ship: Partial<Ship>) => {
      const testShip: Ship = {
        id: ship.id || `test-ship-${Date.now()}`,
        ownerId: ship.ownerId || 'test-user',
        name: ship.name || 'Test Ship',
        state: ship.state || 'idle',
        positionX: ship.positionX ?? 0,
        positionY: ship.positionY ?? 0,
        positionZ: ship.positionZ ?? 0,
        currentSynapseId: ship.currentSynapseId || null,
        travelStartTime: ship.travelStartTime || null,
        travelDuration: ship.travelDuration || null,
        autopilotEnabled: ship.autopilotEnabled || false,
        equippedItems: ship.equippedItems || [],
        currentPointsPerMin: ship.currentPointsPerMin || 0,
        spacesDiscovered: ship.spacesDiscovered || 0,
        totalLoot: ship.totalLoot || 0,
        totalAgiEarned: ship.totalAgiEarned || 0,
        createdAt: ship.createdAt || Date.now(),
      }
      setState(produce(s => {
        s.userShips = [...safeUserShips(s), testShip]
      }))
      return testShip
    },
  }
}

export const shipStore = createRoot(createShipStore)
