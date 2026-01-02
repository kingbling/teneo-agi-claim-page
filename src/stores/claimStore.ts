import { create } from 'zustand'
import type { User, SynapseNode, SynapseRecord, Reward, RevealPhase } from '@/types'
import { MOCK_USER, MOCK_SYNAPSE_NODES, MOCK_SYNAPSE_HISTORY, generateRewards, getSynapseCost } from '@/services/mock/mockData'

interface ClaimStore {
  // User State
  user: User | null
  isAuthenticated: boolean

  // Points
  points: number
  pendingPoints: number

  // Synapse State
  synapseNodes: SynapseNode[]
  connectedSynapseIds: string[]
  synapseHistory: SynapseRecord[]
  nextSynapseAt: Date | null
  isSynapseReady: boolean

  // Brain Visualization State
  zoomLevel: number
  selectedNodeId: string | null
  highlightedRegion: string | null

  // Reveal State
  isRevealOpen: boolean
  revealPhase: RevealPhase
  currentRewards: Reward[] | null

  // Actions
  initializeStore: () => void
  setZoom: (level: number) => void
  selectNode: (id: string | null) => void
  setHighlightedRegion: (region: string | null) => void
  openReveal: () => void
  closeReveal: () => void
  setRevealPhase: (phase: RevealPhase) => void
  connectSynapse: () => Promise<void>
  completeReveal: () => void
}

export const useClaimStore = create<ClaimStore>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  points: 0,
  pendingPoints: 245,
  synapseNodes: [],
  connectedSynapseIds: [],
  synapseHistory: [],
  nextSynapseAt: null,
  isSynapseReady: false,
  zoomLevel: 5,
  selectedNodeId: null,
  highlightedRegion: null,
  isRevealOpen: false,
  revealPhase: 'idle',
  currentRewards: null,

  // Initialize with mock data
  initializeStore: () => {
    const now = new Date()
    const nextSynapse = new Date(now.getTime() + 4 * 60 * 60 * 1000) // 4 hours from now (for demo, make it ready soon)

    // For demo purposes, let's make the synapse ready immediately
    const isSynapseReady = true // Set to true for demo

    set({
      user: MOCK_USER,
      isAuthenticated: true,
      points: MOCK_USER.points,
      synapseNodes: MOCK_SYNAPSE_NODES,
      connectedSynapseIds: MOCK_SYNAPSE_NODES.filter(n => n.state === 'connected').map(n => n.id),
      synapseHistory: MOCK_SYNAPSE_HISTORY,
      nextSynapseAt: isSynapseReady ? null : nextSynapse,
      isSynapseReady,
    })
  },

  // Brain visualization controls
  setZoom: (level) => set({ zoomLevel: level }),

  selectNode: (id) => set({ selectedNodeId: id }),

  setHighlightedRegion: (region) => set({ highlightedRegion: region }),

  // Reveal controls
  openReveal: () => {
    const { isSynapseReady } = get()
    if (!isSynapseReady) return

    set({
      isRevealOpen: true,
      revealPhase: 'idle',
      currentRewards: null,
    })
  },

  closeReveal: () => set({
    isRevealOpen: false,
    revealPhase: 'idle',
  }),

  setRevealPhase: (phase) => set({ revealPhase: phase }),

  // Connect synapse action
  connectSynapse: async () => {
    const { user, points, synapseNodes, synapseHistory } = get()
    if (!user) return

    const cost = getSynapseCost(user.synapsesConnected)
    if (points < cost) return

    // Generate rewards
    const rewards = generateRewards()

    // Find the available node
    const availableNode = synapseNodes.find(n => n.state === 'available')
    if (!availableNode) return

    // Start reveal animation - neural connection forming
    set({
      currentRewards: rewards,
      revealPhase: 'locating',
    })

    // Phase 1: Locating - camera finds the target location
    await new Promise(resolve => setTimeout(resolve, 1200))
    set({ revealPhase: 'connecting' })

    // Phase 2: Connecting - synapse appears, connection lines draw
    await new Promise(resolve => setTimeout(resolve, 1800))
    set({ revealPhase: 'activating' })

    // Phase 3: Activating - synapse glows, pulse ripples
    await new Promise(resolve => setTimeout(resolve, 800))
    set({ revealPhase: 'complete' })
  },

  completeReveal: () => {
    const { user, points, synapseNodes, synapseHistory, currentRewards, connectedSynapseIds } = get()
    if (!user || !currentRewards) return

    const cost = getSynapseCost(user.synapsesConnected)

    // Find the available node and mark it as connected
    const availableNode = synapseNodes.find(n => n.state === 'available')
    if (!availableNode) return

    const updatedNodes = synapseNodes.map(node => {
      if (node.id === availableNode.id) {
        return { ...node, state: 'connected' as const, connectedAt: new Date() }
      }
      // Make the next locked node available
      if (node.state === 'locked' && !synapseNodes.some(n => n.state === 'available' && n.id !== availableNode.id)) {
        const availableIdx = synapseNodes.findIndex(n => n.id === availableNode.id)
        const nodeIdx = synapseNodes.findIndex(n => n.id === node.id)
        if (nodeIdx === availableIdx + 1) {
          return { ...node, state: 'available' as const }
        }
      }
      return node
    })

    // Create synapse record
    const newRecord: SynapseRecord = {
      id: `syn_${Date.now()}`,
      nodeId: availableNode.id,
      rewards: currentRewards,
      connectedAt: new Date(),
      pointsSpent: cost,
    }

    // Calculate token rewards
    const tokenReward = currentRewards.find(r => r.type === 'AGI_TOKENS')
    const tokensEarned = tokenReward && 'amount' in tokenReward ? tokenReward.amount : 0

    // Update state
    set({
      points: points - cost + tokensEarned,
      user: {
        ...user,
        points: points - cost + tokensEarned,
        synapsesConnected: user.synapsesConnected + 1,
        journeyProgress: ((user.synapsesConnected + 1) / 200) * 100,
        lastSynapseAt: new Date(),
      },
      synapseNodes: updatedNodes,
      connectedSynapseIds: [...connectedSynapseIds, availableNode.id],
      synapseHistory: [newRecord, ...synapseHistory],
      isRevealOpen: false,
      revealPhase: 'idle',
      currentRewards: null,
      nextSynapseAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isSynapseReady: false,
    })

    // For demo: make synapse ready again after 5 seconds
    setTimeout(() => {
      set({ isSynapseReady: true, nextSynapseAt: null })
    }, 5000)
  },
}))
