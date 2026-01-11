import { create } from 'zustand'
import type { SynapseType } from '@/types/game'
import { useUserStore } from './userStore'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL
const WS_URL = import.meta.env.VITE_WS_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}
if (!WS_URL) {
  throw new Error('VITE_WS_URL environment variable is not set')
}

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
  totalBrainXpEarned: number
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
  brainXpReward: number

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapServerClusterToClient(cluster: any): SynapseCluster {
  return {
    id: cluster.id,
    lodLevel: cluster.lodLevel,
    positionX: cluster.positionX,
    positionY: cluster.positionY,
    positionZ: cluster.positionZ,
    synapseCount: cluster.spaceCount ?? cluster.synapseCount ?? 0,
    discoveredCount: cluster.discoveredCount ?? 0,
    beingExploredCount: cluster.beingSolvedCount ?? cluster.beingExploredCount ?? 0,
    avgLootPool: cluster.avgLootPool ?? 0,
    typeCounts: cluster.typeCounts ?? {},
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
  brainXp: number
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

export interface ShipActions {
  // Connection
  connect: () => void
  disconnect: () => void

  // Ship Actions
  createShip: (name: string) => Promise<Ship | null>
  selectShip: (shipId: string | null) => void

  // Exploration Actions
  startExploration: (shipId: string, synapseId: string, pointsPerMin: number) => Promise<boolean>
  leaveExploration: (shipId: string) => Promise<boolean>
  updateSpendingRate: (shipId: string, pointsPerMin: number) => Promise<boolean>

  // Autopilot
  toggleAutopilot: (shipId: string, enabled: boolean) => Promise<boolean>
  setAutopilotPreferences: (shipId: string, prefs: AutopilotPreferences) => Promise<boolean>

  // Items
  equipItem: (shipId: string, itemId: string, slotIndex: number) => Promise<boolean>
  unequipItem: (shipId: string, slotIndex: number) => Promise<boolean>

  // Deploy (navigate to synapse position)
  deployShip: (shipId: string, targetX: number, targetY: number, targetZ: number) => Promise<boolean>
  deployToSynapse: (shipId: string, synapseId: string) => Promise<boolean>
  recallShip: (shipId: string) => Promise<void>

  // API Actions
  fetchUserShips: () => Promise<void>
  fetchWorldState: () => Promise<void>
  fetchSynapseDetails: (synapseId: string) => Promise<Synapse | null>
  fetchSynapseExplorers: (synapseId: string) => Promise<ExplorerInfo[]>

  // UI Actions
  setViewMode: (mode: '3d' | '2d-top') => void
  setShowShipPaths: (show: boolean) => void
  setShowDiscoveredOnly: (show: boolean) => void
  setLodLevel: (level: number) => void

  // Utility
  getSynapseClustersForLod: () => SynapseCluster[]
  getShipClustersForLod: () => ShipCluster[]
  canCreateShip: () => boolean
}

export type ShipStore = ShipStoreState & ShipActions

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

export const useShipStore = create<ShipStore>((set, get) => ({
  ...initialState,

  // ============ CONNECTION ============

  connect: () => {
    const { ws } = get()
    if (ws) return

    const socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      console.log('WebSocket connected to server')
      set({ isConnected: true, ws: socket })
    }

    socket.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)
        handleServerMessage(message, set, get)
      } catch (error) {
        console.error('Failed to parse server message:', error)
      }
    }

    socket.onclose = () => {
      console.log('WebSocket disconnected')
      set({ isConnected: false, ws: null })

      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        const { ws: currentWs } = get()
        if (!currentWs) {
          get().connect()
        }
      }, 3000)
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    set({ ws: socket })
  },

  disconnect: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
      set({ ws: null, isConnected: false })
    }
  },

  // ============ SHIP ACTIONS ============

  createShip: async (name: string): Promise<Ship | null> => {
    const userId = useUserStore.getState().userId
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

      set((state) => ({
        userShips: [...state.userShips, ship],
      }))

      // Update ship count in userStore
      useUserStore.getState().setCurrentShipCount(get().userShips.length)

      return ship
    } catch (err) {
      // Re-throw to let caller handle the error
      throw err
    }
  },

  selectShip: (shipId: string | null) => {
    set({ selectedShipId: shipId })

    // If selecting a ship that's exploring, fetch synapse details
    if (shipId) {
      const ship = get().userShips.find(s => s.id === shipId)
      if (ship?.currentSynapseId) {
        get().fetchSynapseDetails(ship.currentSynapseId)
        get().fetchSynapseExplorers(ship.currentSynapseId)
      }
    }
  },

  // ============ EXPLORATION ACTIONS ============

  startExploration: async (shipId: string, synapseId: string, pointsPerMin: number): Promise<boolean> => {
    const ship = get().userShips.find(s => s.id === shipId)
    if (!ship) {
      console.error('Ship not found:', shipId)
      return false
    }
    if (ship.state !== 'idle') {
      console.error('Ship must be idle to start exploration:', ship.state)
      return false
    }

    const userId = useUserStore.getState().userId
    if (!userId) return false

    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}/explore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId, userId, pointsPerMin }),
      })

      if (response.ok) {
        const { ship: updatedShip, synapse } = await response.json()
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
          currentExplorationSynapse: synapse,
        }))
        console.log(`Ship ${updatedShip.name} started exploring synapse ${synapseId} at ${pointsPerMin} pts/min`)
        return true
      }

      const error = await response.json()
      console.error('Start exploration failed:', error.error || error)
      return false
    } catch (error) {
      console.error('Failed to start exploration:', error)
      return false
    }
  },

  leaveExploration: async (shipId: string): Promise<boolean> => {
    const ship = get().userShips.find(s => s.id === shipId)
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
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
          currentExplorationSynapse: null,
          currentExplorers: [],
        }))
        console.log(`Ship ${updatedShip.name} left exploration`)
        return true
      }

      const error = await response.json()
      console.error('Leave exploration failed:', error.error || error)
      return false
    } catch (error) {
      console.error('Failed to leave exploration:', error)
      return false
    }
  },

  updateSpendingRate: async (shipId: string, pointsPerMin: number): Promise<boolean> => {
    const ship = get().userShips.find(s => s.id === shipId)
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
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
        }))
        console.log(`Ship ${updatedShip.name} spending rate updated to ${pointsPerMin} pts/min`)
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to update spending rate:', error)
      return false
    }
  },

  // ============ AUTOPILOT ============

  toggleAutopilot: async (shipId: string, enabled: boolean): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
        }))
        console.log(`Ship autopilot ${enabled ? 'enabled' : 'disabled'}`)
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to toggle autopilot:', error)
      return false
    }
  },

  setAutopilotPreferences: async (shipId: string, prefs: AutopilotPreferences): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/autopilot/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to set autopilot preferences:', error)
      return false
    }
  },

  // ============ ITEMS ============

  equipItem: async (shipId: string, itemId: string, slotIndex: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, slotIndex }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to equip item:', error)
      return false
    }
  },

  unequipItem: async (shipId: string, slotIndex: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/unequip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
        }))
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to unequip item:', error)
      return false
    }
  },

  // ============ DEPLOY/RECALL ============

  deployShip: async (shipId: string, targetX: number, targetY: number, targetZ: number): Promise<boolean> => {
    const ship = get().userShips.find(s => s.id === shipId)
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
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
        }))
        console.log(`Ship ${updatedShip.name} deploying to (${targetX.toFixed(2)}, ${targetY.toFixed(2)}, ${targetZ.toFixed(2)})`)
        return true
      }

      const error = await response.json()
      console.error('Deploy failed:', error.error || error)
      return false
    } catch (error) {
      console.error('Failed to deploy ship:', error)
      return false
    }
  },

  deployToSynapse: async (shipId: string, synapseId: string): Promise<boolean> => {
    const synapse = await get().fetchSynapseDetails(synapseId)
    if (!synapse) {
      console.error('Synapse not found:', synapseId)
      return false
    }

    return get().deployShip(shipId, synapse.positionX, synapse.positionY, synapse.positionZ)
  },

  recallShip: async (shipId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        set((state) => ({
          userShips: state.userShips.map(s => s.id === updatedShip.id ? updatedShip : s),
          currentExplorationSynapse: null,
          currentExplorers: [],
        }))
      }
    } catch (error) {
      // Fallback: update locally
      set((state) => ({
        userShips: state.userShips.map(s =>
          s.id === shipId ? { ...s, state: 'idle' as const, currentSynapseId: null } : s
        ),
      }))
    }
  },

  // ============ API ACTIONS ============

  fetchUserShips: async () => {
    const userId = useUserStore.getState().userId
    if (!userId) return

    set({ isLoadingShips: true })
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/ships`)
      if (!response.ok) throw new Error('Failed to fetch ships')

      const ships = await response.json()
      set({ userShips: ships, isLoadingShips: false })

      // Update ship count in userStore
      useUserStore.getState().setCurrentShipCount(ships.length)
    } catch (error) {
      console.error('Failed to fetch user ships:', error)
      set({ isLoadingShips: false })
    }
  },

  fetchWorldState: async () => {
    set({ isLoadingWorld: true })
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

      console.log(`DEBUG fetchWorldState: ${rawClusters.length} raw clusters, ${synapseClustersLod0.length} LOD0, ${synapseClustersLod1.length} LOD1, ${synapseClustersLod2.length} LOD2`)

      set({
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
      set({ isLoadingWorld: false })
    }
  },

  fetchSynapseDetails: async (synapseId: string): Promise<Synapse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}`)
      if (!response.ok) return null

      const synapse = await response.json()
      set({ currentExplorationSynapse: synapse })
      return synapse
    } catch (error) {
      console.error('Failed to fetch synapse details:', error)
      return null
    }
  },

  fetchSynapseExplorers: async (synapseId: string): Promise<ExplorerInfo[]> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}/explorers`)
      if (!response.ok) return []

      const explorers = await response.json()
      set({ currentExplorers: explorers })
      return explorers
    } catch (error) {
      console.error('Failed to fetch synapse explorers:', error)
      return []
    }
  },

  // ============ UI ACTIONS ============

  setViewMode: (mode) => set({ viewMode: mode }),
  setShowShipPaths: (show) => set({ showShipPaths: show }),
  setShowDiscoveredOnly: (show) => set({ showDiscoveredOnly: show }),
  setLodLevel: (level) => set({ currentLodLevel: Math.max(0, Math.min(2, level)) }),

  // ============ UTILITY ============

  getSynapseClustersForLod: () => {
    const { currentLodLevel, synapseClustersLod0, synapseClustersLod1, synapseClustersLod2 } = get()
    switch (currentLodLevel) {
      case 0: return synapseClustersLod0
      case 1: return synapseClustersLod1
      case 2: return synapseClustersLod2
      default: return synapseClustersLod0
    }
  },

  getShipClustersForLod: () => {
    const { currentLodLevel, shipClustersLod0, shipClustersLod1, shipClustersLod2 } = get()
    switch (currentLodLevel) {
      case 0: return shipClustersLod0
      case 1: return shipClustersLod1
      case 2: return shipClustersLod2
      default: return shipClustersLod0
    }
  },

  canCreateShip: () => {
    const { userShips } = get()
    const { maxShips } = useUserStore.getState()
    return userShips.length < maxShips
  },
}))

// ============ SERVER MESSAGE HANDLER ============

function handleServerMessage(
  message: ServerMessage,
  set: (state: Partial<ShipStore> | ((state: ShipStore) => Partial<ShipStore>)) => void,
  _get: () => ShipStore
) {
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

      set({
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
      set((state) => ({
        recentDiscoveries: [event, ...state.recentDiscoveries].slice(0, 50),
      }))
      break
    }

    case 'loot:distributed': {
      const event = message.data
      set((state) => ({
        recentLoot: [event, ...state.recentLoot].slice(0, 50),
      }))

      // Update user's AGI and brain XP
      const userId = useUserStore.getState().userId
      if (event.userId === userId) {
        useUserStore.getState().addAgi(event.agiAmount)
        useUserStore.getState().addBrainXP(event.brainXp)
        if (event.lotteryTicketsAwarded > 0) {
          useUserStore.getState().addLotteryTickets(event.lotteryTicketsAwarded)
        }
      }
      break
    }

    case 'ships:update': {
      const updatedShips = message.data
      set((state) => {
        // Update user's ships if any of them are in the update
        const updatedUserShips = state.userShips.map((ship) => {
          const updated = updatedShips.find(u => u.id === ship.id)
          if (updated) {
            console.log(`Ship ${ship.name} updated:`, updated.state, `pos: (${updated.positionX.toFixed(2)}, ${updated.positionY.toFixed(2)}, ${updated.positionZ.toFixed(2)})`)
            return updated
          }
          return ship
        })

        return { userShips: updatedUserShips }
      })
      break
    }

    case 'exploration:progress': {
      const { synapseId, pointsAccumulated, eta } = message.data
      set((state) => {
        if (state.currentExplorationSynapse?.id === synapseId) {
          return {
            currentExplorationSynapse: {
              ...state.currentExplorationSynapse,
              pointsAccumulated,
              currentEtaMinutes: eta,
            },
          }
        }
        return {}
      })
      break
    }

    case 'lottery:winner': {
      const { synapseId, winnerId, winnerShipId, reward } = message.data
      console.log(`Lottery winner for synapse ${synapseId}: ${winnerId} (ship ${winnerShipId}) won ${reward} AGI!`)
      // Could trigger a notification UI here
      break
    }

    case 'error': {
      console.error('Server error:', message.data.message)
      break
    }
  }
}

// ============ SELECTORS ============

export const selectUserShips = (state: ShipStore) => state.userShips
export const selectSelectedShip = (state: ShipStore) =>
  state.userShips.find(s => s.id === state.selectedShipId) || null
export const selectExploringShips = (state: ShipStore) =>
  state.userShips.filter(s => s.state === 'exploring')
export const selectIdleShips = (state: ShipStore) =>
  state.userShips.filter(s => s.state === 'idle')
export const selectCurrentExploration = (state: ShipStore) => ({
  synapse: state.currentExplorationSynapse,
  explorers: state.currentExplorers,
})
export const selectDiscoveryProgress = (state: ShipStore) => state.discoveryProgress
export const selectRecentLoot = (state: ShipStore) => state.recentLoot
