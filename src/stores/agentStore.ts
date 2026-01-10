import { create } from 'zustand'
import type {
  Agent,
  AgentTrait,
  SpaceCluster,
  AgentCluster,
  WorldState,
  DiscoveryProgress,
  ServerMessage,
  SpaceDiscoveryEvent,
  LootEvent,
  NetworkConnection,
} from '@/types/agent'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL
const WS_URL = import.meta.env.VITE_WS_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}
if (!WS_URL) {
  throw new Error('VITE_WS_URL environment variable is not set')
}

interface AgentStore {
  // Connection State
  isConnected: boolean
  ws: WebSocket | null

  // User State
  userId: string | null
  userWallet: string | null
  userPoints: number
  userTier: string

  // Space State (LOD clusters)
  spaceClusters: SpaceCluster[]
  spaceClustersLod0: SpaceCluster[]  // Far view
  spaceClustersLod1: SpaceCluster[]  // Medium view
  spaceClustersLod2: SpaceCluster[]  // Close view

  // Agent State (LOD clusters + user's agents)
  agentClusters: AgentCluster[]
  agentClustersLod0: AgentCluster[]
  agentClustersLod1: AgentCluster[]
  agentClustersLod2: AgentCluster[]
  userAgents: Agent[]
  selectedAgentId: string | null

  // Discovery Progress
  discoveryProgress: DiscoveryProgress

  // Network Connections (Death Stranding-style shared infrastructure)
  networkConnections: NetworkConnection[]

  // Recent Events
  recentDiscoveries: SpaceDiscoveryEvent[]
  recentLoot: LootEvent[]

  // UI State
  viewMode: '3d' | '2d-top'
  showAgentPaths: boolean
  showDiscoveredOnly: boolean
  currentLodLevel: number

  // Loading States
  isLoadingWorld: boolean
  isLoadingAgents: boolean
  deployingAgentIds: Set<string>

  // Actions
  connect: () => void
  disconnect: () => void

  // User Actions
  loginUser: (wallet: string) => Promise<void>

  // Agent Actions
  createAgent: (name: string, traits: AgentTrait[]) => Promise<Agent | null>
  deployAgent: (agentId: string, targetX: number, targetY: number, targetZ: number) => Promise<boolean>
  deployRandomly: (agentId: string) => Promise<boolean>
  recallAgent: (agentId: string) => Promise<void>
  refuelAgent: (agentId: string, points: number) => Promise<void>
  repairAgent: (agentId: string) => Promise<boolean>
  selectAgent: (agentId: string | null) => void
  autoDeployIdleAgents: () => Promise<void>

  // API Actions
  fetchUserAgents: () => Promise<void>
  fetchWorldState: () => Promise<void>

  // UI Actions
  setViewMode: (mode: '3d' | '2d-top') => void
  setShowAgentPaths: (show: boolean) => void
  setShowDiscoveredOnly: (show: boolean) => void
  setLodLevel: (level: number) => void

  // Utility
  getSpaceClustersForLod: () => SpaceCluster[]
  getAgentClustersForLod: () => AgentCluster[]
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  // Initial State
  isConnected: false,
  ws: null,
  userId: null,
  userWallet: null,
  userPoints: 0,
  userTier: 'free',
  spaceClusters: [],
  spaceClustersLod0: [],
  spaceClustersLod1: [],
  spaceClustersLod2: [],
  agentClusters: [],
  agentClustersLod0: [],
  agentClustersLod1: [],
  agentClustersLod2: [],
  userAgents: [],
  selectedAgentId: null,
  discoveryProgress: { total: 0, discovered: 0, beingSolved: 0 },
  networkConnections: [],
  recentDiscoveries: [],
  recentLoot: [],
  viewMode: '3d',
  showAgentPaths: true,
  showDiscoveredOnly: false,
  currentLodLevel: 0,

  // Loading States
  isLoadingWorld: true,
  isLoadingAgents: true,
  deployingAgentIds: new Set(),

  // WebSocket Connection
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
        handleServerMessage(message, set)
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

  // User Actions
  loginUser: async (wallet: string) => {
    set({ isLoadingAgents: true })
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      })

      if (!response.ok) {
        throw new Error('Failed to login/register user')
      }

      const user = await response.json()
      set({
        userId: user.id,
        userWallet: user.wallet,
        userPoints: user.points,
        userTier: user.tier,
      })

      // Fetch user's agents after login
      await get().fetchUserAgents()
      set({ isLoadingAgents: false })
    } catch (error) {
      console.error('Failed to login user:', error)
      set({ isLoadingAgents: false })
    }
  },

  // Agent Actions
  createAgent: async (name: string, traits: AgentTrait[]): Promise<Agent | null> => {
    const { userId } = get()
    if (!userId) {
      console.error('Cannot create agent: userId is null')
      return null
    }

    try {
      const response = await fetch(`${API_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name, traits }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Agent creation failed:', error)
        throw new Error(error.error || 'Failed to create agent')
      }

      const result = await response.json()

      // Server returns { agent, user } with updated user points
      const agent = result.agent
      if (!agent) {
        throw new Error('Server response did not contain an agent')
      }
      const updatedPoints = result.user?.points

      set((state) => ({
        userAgents: [...state.userAgents, agent],
        ...(updatedPoints !== undefined && { userPoints: updatedPoints }),
      }))

      console.log('Agent created:', agent.name, 'Points remaining:', updatedPoints)
      return agent
    } catch (error) {
      console.error('Failed to create agent:', error)
      return null
    }
  },

  // Deploy agent from center with biased random walk toward target
  deployAgent: async (agentId: string, targetX: number, targetY: number, targetZ: number) => {
    // Check if agent can be deployed (idle or exhausted+repaired)
    const agent = get().userAgents.find(a => a.id === agentId)
    if (!agent) {
      console.error('Agent not found:', agentId)
      return false
    }
    if (agent.state !== 'idle') {
      console.error('Agent must be idle to deploy:', agent.state)
      return false
    }
    if (agent.needsRepair) {
      console.error('Agent needs repair before deploying')
      return false
    }

    try {
      // Use deploy-to-region endpoint for position-based deployment
      // This puts the agent in 'searching' mode, wandering and auto-discovering spaces
      const response = await fetch(`${API_URL}/api/agents/${agentId}/deploy-to-region`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionX: targetX,
          positionY: targetY,
          positionZ: targetZ,
        }),
      })

      if (response.ok) {
        const { agent: updatedAgent } = await response.json()
        set((state) => ({
          userAgents: state.userAgents.map((a) => (a.id === updatedAgent.id ? updatedAgent : a)),
        }))
        console.log(`Agent ${updatedAgent.name} deployed from center toward (${targetX.toFixed(2)}, ${targetY.toFixed(2)}, ${targetZ.toFixed(2)})`)
        return true
      }

      const error = await response.json()
      console.error('Deploy failed:', error.error || error)
      return false
    } catch (error) {
      console.error('Failed to deploy agent:', error)
      return false
    }
  },

  deployRandomly: async (agentId: string) => {
    const { spaceClustersLod0, spaceClustersLod1, spaceClusters, fetchWorldState, deployAgent } = get()

    // Mark agent as deploying
    set((state) => ({
      deployingAgentIds: new Set(state.deployingAgentIds).add(agentId),
    }))

    try {
      // Use LOD0 first, fallback to LOD1, then all clusters
      let clusters = spaceClustersLod0.length > 0
        ? spaceClustersLod0
        : spaceClustersLod1.length > 0
          ? spaceClustersLod1
          : spaceClusters

      // If still no clusters, try fetching world state first
      if (clusters.length === 0) {
        console.log('No clusters loaded, fetching world state...')
        await fetchWorldState()
        const state = get()
        clusters = state.spaceClustersLod0.length > 0
          ? state.spaceClustersLod0
          : state.spaceClusters
      }

      if (clusters.length === 0) {
        console.log('No space clusters available after fetch')
        return false
      }

      // Filter to clusters that have undiscovered spaces (or just use all if none match)
      let targetClusters = clusters.filter(c => c.spaceCount > c.discoveredCount)

      // If all are discovered, just pick any cluster
      if (targetClusters.length === 0) {
        console.log('All clusters discovered, picking random cluster anyway')
        targetClusters = clusters
      }

      // Pick a random cluster as the target for biased random walk
      const randomCluster = targetClusters[Math.floor(Math.random() * targetClusters.length)]
      console.log('Deploying toward random cluster:', randomCluster.id, 'at', randomCluster.positionX, randomCluster.positionY, randomCluster.positionZ)

      // Deploy from center toward that cluster's position
      const result = await deployAgent(
        agentId,
        randomCluster.positionX,
        randomCluster.positionY,
        randomCluster.positionZ
      )

      return result
    } finally {
      // Remove agent from deploying state
      set((state) => {
        const newSet = new Set(state.deployingAgentIds)
        newSet.delete(agentId)
        return { deployingAgentIds: newSet }
      })
    }
  },

  // Recall agent - sets agent back to idle state
  recallAgent: async (agentId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        set((state) => ({
          userAgents: state.userAgents.map((a) => (a.id === data.agent.id ? data.agent : a)),
        }))
      } else {
        // If API doesn't support recall, just update locally
        set((state) => ({
          userAgents: state.userAgents.map((a) =>
            a.id === agentId ? { ...a, state: 'idle' as const } : a
          ),
        }))
      }
    } catch (error) {
      // Fallback: update locally
      set((state) => ({
        userAgents: state.userAgents.map((a) =>
          a.id === agentId ? { ...a, state: 'idle' as const } : a
        ),
      }))
    }
  },

  refuelAgent: async (agentId: string, points: number) => {
    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/refuel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      })

      if (response.ok) {
        const data = await response.json()
        set((state) => ({
          userAgents: state.userAgents.map((a) => (a.id === data.agent.id ? data.agent : a)),
          userPoints: data.userPoints,
        }))
      }
    } catch (error) {
      console.error('Failed to refuel agent:', error)
    }
  },

  // Repair exhausted agent (costs 50% of creation cost)
  repairAgent: async (agentId: string) => {
    const agent = get().userAgents.find(a => a.id === agentId)
    if (!agent) {
      console.error('Agent not found:', agentId)
      return false
    }
    if (!agent.needsRepair) {
      console.error('Agent does not need repair:', agent.state, agent.needsRepair)
      return false
    }

    const repairCost = Math.ceil(agent.creationCost * 0.5)
    const { userPoints } = get()
    if (userPoints < repairCost) {
      console.error('Not enough points to repair. Need:', repairCost, 'Have:', userPoints)
      return false
    }

    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        set((state) => ({
          userAgents: state.userAgents.map((a) => (a.id === data.agent.id ? data.agent : a)),
          userPoints: data.userPoints,
        }))
        console.log(`Agent ${agent.name} repaired for ${repairCost} points`)
        return true
      }

      const error = await response.json()
      console.error('Repair failed:', error.error || error)
      return false
    } catch (error) {
      console.error('Failed to repair agent:', error)
      return false
    }
  },

  selectAgent: (agentId: string | null) => {
    set({ selectedAgentId: agentId })
  },

  // Auto-deploy all idle agents with sufficient fuel (100+ pts)
  autoDeployIdleAgents: async () => {
    const { userAgents, deployRandomly } = get()
    const idleAgentsWithFuel = userAgents.filter(
      agent => agent.state === 'idle' &&
               agent.pointsBalance >= 100 &&
               !agent.needsRepair
    )

    // Deploy each idle agent
    for (const agent of idleAgentsWithFuel) {
      await deployRandomly(agent.id)
    }
  },

  // API Actions
  fetchUserAgents: async () => {
    const { userId } = get()
    if (!userId) return

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/agents`)
      if (!response.ok) throw new Error('Failed to fetch agents')

      const agents = await response.json()
      set({ userAgents: agents })
    } catch (error) {
      console.error('Failed to fetch user agents:', error)
    }
  },

  fetchWorldState: async () => {
    set({ isLoadingWorld: true })
    try {
      const response = await fetch(`${API_URL}/api/world`)
      if (!response.ok) throw new Error('Failed to fetch world state')

      const world: WorldState = await response.json()

      // Separate clusters by LOD level
      const spaceClustersLod0 = world.spaceClusters.filter((c) => c.lodLevel === 0)
      const spaceClustersLod1 = world.spaceClusters.filter((c) => c.lodLevel === 1)
      const spaceClustersLod2 = world.spaceClusters.filter((c) => c.lodLevel === 2)

      const agentClustersLod0 = world.agentClusters.filter((c) => c.lodLevel === 0)
      const agentClustersLod1 = world.agentClusters.filter((c) => c.lodLevel === 1)
      const agentClustersLod2 = world.agentClusters.filter((c) => c.lodLevel === 2)

      set({
        spaceClusters: world.spaceClusters,
        spaceClustersLod0,
        spaceClustersLod1,
        spaceClustersLod2,
        agentClusters: world.agentClusters,
        agentClustersLod0,
        agentClustersLod1,
        agentClustersLod2,
        discoveryProgress: world.discoveryProgress,
        networkConnections: world.networkConnections ?? [],
        isLoadingWorld: false,
      })
    } catch (error) {
      console.error('Failed to fetch world state:', error)
      set({ isLoadingWorld: false })
    }
  },

  // UI Actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setShowAgentPaths: (show) => set({ showAgentPaths: show }),
  setShowDiscoveredOnly: (show) => set({ showDiscoveredOnly: show }),
  setLodLevel: (level) => set({ currentLodLevel: Math.max(0, Math.min(2, level)) }),

  // Utility
  getSpaceClustersForLod: () => {
    const { currentLodLevel, spaceClustersLod0, spaceClustersLod1, spaceClustersLod2 } = get()
    switch (currentLodLevel) {
      case 0: return spaceClustersLod0
      case 1: return spaceClustersLod1
      case 2: return spaceClustersLod2
      default: return spaceClustersLod0
    }
  },

  getAgentClustersForLod: () => {
    const { currentLodLevel, agentClustersLod0, agentClustersLod1, agentClustersLod2 } = get()
    switch (currentLodLevel) {
      case 0: return agentClustersLod0
      case 1: return agentClustersLod1
      case 2: return agentClustersLod2
      default: return agentClustersLod0
    }
  },
}))

// Handle server messages
function handleServerMessage(
  message: ServerMessage,
  set: (state: Partial<AgentStore> | ((state: AgentStore) => Partial<AgentStore>)) => void
) {
  switch (message.type) {
    case 'state:sync': {
      const world = message.data

      // Separate clusters by LOD level
      const spaceClustersLod0 = world.spaceClusters.filter((c) => c.lodLevel === 0)
      const spaceClustersLod1 = world.spaceClusters.filter((c) => c.lodLevel === 1)
      const spaceClustersLod2 = world.spaceClusters.filter((c) => c.lodLevel === 2)

      const agentClustersLod0 = world.agentClusters.filter((c) => c.lodLevel === 0)
      const agentClustersLod1 = world.agentClusters.filter((c) => c.lodLevel === 1)
      const agentClustersLod2 = world.agentClusters.filter((c) => c.lodLevel === 2)

      set({
        spaceClusters: world.spaceClusters,
        spaceClustersLod0,
        spaceClustersLod1,
        spaceClustersLod2,
        agentClusters: world.agentClusters,
        agentClustersLod0,
        agentClustersLod1,
        agentClustersLod2,
        discoveryProgress: world.discoveryProgress,
        networkConnections: world.networkConnections ?? [],
      })
      break
    }

    case 'space:discovered': {
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
      break
    }

    case 'agents:update': {
      const updatedAgents = message.data as Agent[]
      set((state) => {
        // Update user's agents if any of them are in the update
        const updatedUserAgents = state.userAgents.map((agent) => {
          const updated = updatedAgents.find((u) => u.id === agent.id)
          if (updated) {
            console.log(`Agent ${agent.name} updated:`, updated.state, `pos: (${updated.positionX.toFixed(2)}, ${updated.positionY.toFixed(2)}, ${updated.positionZ.toFixed(2)})`)
            return updated
          }
          return agent
        })

        return { userAgents: updatedUserAgents }
      })
      break
    }

    case 'error': {
      console.error('Server error:', message.data.message)
      break
    }
  }
}

// Auto-connect on store creation (optional)
// useAgentStore.getState().connect()
