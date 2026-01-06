import { create } from 'zustand'
import type {
  User,
  SynapseNode,
  SynapseRecord,
  Reward,
  RevealPhase,
  GlobalStats,
  BrainRegionConfig,
  RegionUnlockProgress,
  PassiveBonus,
  DBUser,
} from '@/types'
import {
  loadDatabaseState,
  convertToVisualizationNodes,
  generateClaimRewards,
  checkRegionUnlock,
  calculateTotalPassiveBonus,
  getRegionMultiplier,
  getSynapseNodesHierarchical,
  getSynapseConnectionsHierarchical,
} from '@/services/api/brainRegionsApi'
import { generateRewards, getSynapseCost } from '@/services/mock/mockData'

// Connection distance threshold - synapses can only connect within this range
// This simulates axon length limits in real neural networks
const MAX_CONNECTION_DISTANCE = 0.8 // In normalized brain units
const MAX_CONNECTIONS_PER_NODE = 30

interface ClaimStore {
  // User State
  user: User | null
  dbUser: DBUser | null
  isAuthenticated: boolean

  // Points
  points: number
  pendingPoints: number

  // Global Stats
  globalStats: GlobalStats | null
  brainRegions: BrainRegionConfig[]
  regionProgress: RegionUnlockProgress[]
  userPassiveBonuses: PassiveBonus[]
  totalPassiveBonus: number

  // Synapse State - Hierarchical LOD
  synapseNodes: SynapseNode[]  // Current active LOD level
  synapseLod0: SynapseNode[]   // Far view (300 super-clusters)
  synapseLod1: SynapseNode[]   // Medium view (2000 clusters)
  synapseLod2: SynapseNode[]   // Close view (10000 clusters)
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
  pendingSynapseId: string | null
  currentRewards: Reward[] | null
  newlyUnlockedRegion: BrainRegionConfig | null

  // Search State
  searchQuery: string
  searchResults: SynapseNode[]
  navigateToNodeId: string | null

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
  searchSynapseByAddress: (address: string) => SynapseNode[]
  clearSearch: () => void
  setNavigateToNode: (nodeId: string | null) => void
}

export const useClaimStore = create<ClaimStore>((set, get) => ({
  // Initial state
  user: null,
  dbUser: null,
  isAuthenticated: false,
  points: 0,
  pendingPoints: 245,
  globalStats: null,
  brainRegions: [],
  regionProgress: [],
  userPassiveBonuses: [],
  totalPassiveBonus: 0,
  synapseNodes: [],
  synapseLod0: [],
  synapseLod1: [],
  synapseLod2: [],
  connectedSynapseIds: [],
  synapseHistory: [],
  nextSynapseAt: null,
  isSynapseReady: false,
  zoomLevel: 5,
  selectedNodeId: null,
  highlightedRegion: null,
  isRevealOpen: false,
  revealPhase: 'idle',
  pendingSynapseId: null,
  currentRewards: null,
  newlyUnlockedRegion: null,
  searchQuery: '',
  searchResults: [],
  navigateToNodeId: null,

  // Initialize with database data
  initializeStore: () => {
    const dbState = loadDatabaseState()

    // Convert DB user to app User format
    const dbUser = dbState.currentUser
    const user: User | null = dbUser
      ? {
          id: dbUser.id,
          walletAddress: dbUser.walletAddress,
          email: undefined,
          points: dbUser.totalPoints,
          totalPointsEarned: dbUser.totalPoints,
          synapsesConnected: dbUser.synapseCount,
          journeyProgress: dbUser.journeyProgress,
          createdAt: dbUser.createdAt,
          lastSynapseAt: dbUser.lastActiveAt,
          nextSynapseAt: null,
          connections: {
            wallet: { connected: true, address: dbUser.walletAddress.slice(0, 10) + '...' },
            twitter: {
              connected: dbState.userConnections.some((c) => c.connectionType === 'twitter'),
              username: dbState.userConnections.find((c) => c.connectionType === 'twitter')
                ?.displayName,
            },
            discord: {
              connected: dbState.userConnections.some((c) => c.connectionType === 'discord'),
              username: dbState.userConnections.find((c) => c.connectionType === 'discord')
                ?.displayName,
            },
            telegram: {
              connected: dbState.userConnections.some((c) => c.connectionType === 'telegram'),
              username: dbState.userConnections.find((c) => c.connectionType === 'telegram')
                ?.displayName,
            },
            email: { connected: false },
            tiktok: { connected: false },
            instagram: { connected: false },
            farcaster: { connected: false },
          },
        }
      : null

    // Load hierarchical LOD synapse data with matching connections
    const lodData = getSynapseNodesHierarchical()
    const connData = getSynapseConnectionsHierarchical()
    let synapseLod0 = convertToVisualizationNodes(lodData.lod0, connData.lod0)
    let synapseLod1 = convertToVisualizationNodes(lodData.lod1, connData.lod1)
    let synapseLod2 = convertToVisualizationNodes(lodData.lod2, connData.lod2)

    // Make one node available in each LOD for demo claiming
    if (synapseLod0.length > 0) {
      synapseLod0 = [{ ...synapseLod0[0], state: 'available' as const, connectedBy: undefined, connectedAt: undefined }, ...synapseLod0.slice(1)]
    }
    if (synapseLod1.length > 0) {
      synapseLod1 = [{ ...synapseLod1[0], state: 'available' as const, connectedBy: undefined, connectedAt: undefined }, ...synapseLod1.slice(1)]
    }
    if (synapseLod2.length > 0) {
      synapseLod2 = [{ ...synapseLod2[0], state: 'available' as const, connectedBy: undefined, connectedAt: undefined }, ...synapseLod2.slice(1)]
    }

    // Start with LOD 0 (far view) since camera starts zoomed out
    const synapseNodes = synapseLod0
    const connectedSynapseIds = synapseLod2.filter((n) => n.state === 'connected').map((n) => n.id)

    // Calculate total passive bonus
    const totalPassiveBonus = dbState.userPassiveBonuses.reduce((sum, b) => sum + b.bonusPercent, 0)

    // For demo purposes, make synapse ready immediately
    const isSynapseReady = true

    set({
      user,
      dbUser,
      isAuthenticated: !!user,
      points: user?.points ?? 0,
      globalStats: dbState.globalStats,
      brainRegions: dbState.brainRegions,
      regionProgress: dbState.regionProgress,
      userPassiveBonuses: dbState.userPassiveBonuses,
      totalPassiveBonus,
      synapseNodes,
      synapseLod0,
      synapseLod1,
      synapseLod2,
      connectedSynapseIds,
      synapseHistory: [],
      nextSynapseAt: isSynapseReady ? null : new Date(Date.now() + 4 * 60 * 60 * 1000),
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
      newlyUnlockedRegion: null,
    })
  },

  closeReveal: () =>
    set({
      isRevealOpen: false,
      revealPhase: 'idle',
      pendingSynapseId: null,
      newlyUnlockedRegion: null,
    }),

  setRevealPhase: (phase) => set({ revealPhase: phase }),

  // Connect synapse action with region perks
  connectSynapse: async () => {
    const { user, points, synapseNodes, totalPassiveBonus, globalStats } = get()
    if (!user) return

    const cost = getSynapseCost(user.synapsesConnected)
    if (points < cost) return

    // Find the available node
    const availableNode = synapseNodes.find((n) => n.state === 'available')
    if (!availableNode) return

    // Get region multiplier and generate rewards with perks applied
    const regionMultiplier = getRegionMultiplier(availableNode.region)
    const basePoints = 100 + Math.floor(Math.random() * 100)
    const { rewards, finalPoints } = generateClaimRewards(
      availableNode.region,
      basePoints,
      totalPassiveBonus
    )

    // Check if this claim would unlock a new region
    const currentTotal = globalStats?.totalSynapses ?? 0
    const newlyUnlockedRegion = checkRegionUnlock(currentTotal, 1)

    // Start reveal animation
    set({
      currentRewards: rewards,
      revealPhase: 'locating',
      pendingSynapseId: availableNode.id,
      newlyUnlockedRegion,
    })

    // Phase 1: Locating
    await new Promise((resolve) => setTimeout(resolve, 1200))
    set({ revealPhase: 'connecting' })

    // Phase 2: Connecting
    await new Promise((resolve) => setTimeout(resolve, 1800))
    set({ revealPhase: 'activating' })

    // Phase 3: Activating
    await new Promise((resolve) => setTimeout(resolve, 800))
    set({ revealPhase: 'complete' })
  },

  completeReveal: () => {
    const {
      user,
      points,
      synapseNodes,
      synapseHistory,
      currentRewards,
      connectedSynapseIds,
      globalStats,
      brainRegions,
      regionProgress,
      newlyUnlockedRegion,
      totalPassiveBonus,
      userPassiveBonuses,
    } = get()
    if (!user || !currentRewards) return

    const cost = getSynapseCost(user.synapsesConnected)

    // Find the available node and mark it as connected
    const availableNode = synapseNodes.find((n) => n.state === 'available')
    if (!availableNode) return

    // Find nearby connected nodes within distance threshold to create connections
    // This simulates how neurons can only connect to nearby cells (limited axon length)
    const connectedNodes = synapseNodes.filter((n) => n.state === 'connected')
    const nearestNodeIds = connectedNodes
      .map((node) => {
        const dx = node.position[0] - availableNode.position[0]
        const dy = node.position[1] - availableNode.position[1]
        const dz = node.position[2] - availableNode.position[2]
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        return { id: node.id, distance }
      })
      .filter((n) => n.distance <= MAX_CONNECTION_DISTANCE) // Only connect if within range!
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_CONNECTIONS_PER_NODE)
      .map((n) => n.id)

    const updatedNodes = synapseNodes.map((node) => {
      if (node.id === availableNode.id) {
        return {
          ...node,
          state: 'connected' as const,
          connectedAt: new Date(),
          connectedBy: user.walletAddress.slice(0, 10) + '...',
          connectedToIds: nearestNodeIds, // Add connections to nearest nodes
        }
      }
      // Add bidirectional connection from existing nodes to new node
      if (nearestNodeIds.includes(node.id)) {
        return {
          ...node,
          connectedToIds: [...(node.connectedToIds || []), availableNode.id],
        }
      }
      // Make the next locked node available
      if (
        node.state === 'locked' &&
        !synapseNodes.some((n) => n.state === 'available' && n.id !== availableNode.id)
      ) {
        const availableIdx = synapseNodes.findIndex((n) => n.id === availableNode.id)
        const nodeIdx = synapseNodes.findIndex((n) => n.id === node.id)
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
    const tokenReward = currentRewards.find((r) => r.type === 'AGI_TOKENS')
    const tokensEarned = tokenReward && 'amount' in tokenReward ? tokenReward.amount : 0

    // Update global stats
    const newTotalSynapses = (globalStats?.totalSynapses ?? 0) + 1
    const updatedGlobalStats: GlobalStats = {
      ...(globalStats ?? {
        totalSynapses: 0,
        totalUsers: 0,
        totalPointsDistributed: 0,
        networkCreatedAt: new Date(),
        lastUpdatedAt: new Date(),
      }),
      totalSynapses: newTotalSynapses,
      totalPointsDistributed: (globalStats?.totalPointsDistributed ?? 0) + tokensEarned,
      lastUpdatedAt: new Date(),
    }

    // Update region progress
    const updatedRegionProgress = regionProgress.map((rp) => ({
      ...rp,
      totalSynapses: newTotalSynapses,
      progressPercent:
        rp.unlockThreshold === 0
          ? 100
          : Math.min(100, (newTotalSynapses * 100) / rp.unlockThreshold),
      synapsesRemaining: rp.isUnlocked ? 0 : Math.max(0, rp.unlockThreshold - newTotalSynapses),
      isUnlocked: rp.isUnlocked || newTotalSynapses >= rp.unlockThreshold,
    }))

    // Update brain regions unlock status
    const updatedBrainRegions = brainRegions.map((br) => ({
      ...br,
      isUnlocked: br.isUnlocked || newTotalSynapses >= br.unlockThreshold,
      unlockedAt:
        !br.isUnlocked && newTotalSynapses >= br.unlockThreshold ? new Date() : br.unlockedAt,
    }))

    // Add new passive bonus if region was unlocked
    let updatedPassiveBonuses = [...userPassiveBonuses]
    let newTotalPassiveBonus = totalPassiveBonus
    if (newlyUnlockedRegion && newlyUnlockedRegion.passiveBonusPercent > 0) {
      updatedPassiveBonuses.push({
        id: Date.now(),
        userId: user.id,
        regionId: newlyUnlockedRegion.id,
        bonusPercent: newlyUnlockedRegion.passiveBonusPercent,
        activatedAt: new Date(),
      })
      newTotalPassiveBonus += newlyUnlockedRegion.passiveBonusPercent
    }

    // ATOMIC UPDATE: All state changes in one set() call to prevent race conditions
    // pendingSynapseId and synapseNodes must update together
    set({
      // Close dialog and clear animation state
      isRevealOpen: false,
      revealPhase: 'idle',
      currentRewards: null,

      // Update synapse nodes TOGETHER with pendingSynapseId (prevents race condition)
      synapseNodes: updatedNodes,
      pendingSynapseId: null,
      connectedSynapseIds: [...connectedSynapseIds, availableNode.id],

      // Update points and user
      points: points - cost + tokensEarned,
      user: {
        ...user,
        points: points - cost + tokensEarned,
        synapsesConnected: user.synapsesConnected + 1,
        journeyProgress: ((user.synapsesConnected + 1) / 200) * 100,
        lastSynapseAt: new Date(),
      },

      // Update global stats and regions
      globalStats: updatedGlobalStats,
      brainRegions: updatedBrainRegions,
      regionProgress: updatedRegionProgress,
      userPassiveBonuses: updatedPassiveBonuses,
      totalPassiveBonus: newTotalPassiveBonus,
      synapseHistory: [newRecord, ...synapseHistory],
      nextSynapseAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isSynapseReady: false,
    })

    // For demo: make synapse ready again after 5 seconds
    setTimeout(() => {
      set({ isSynapseReady: true, nextSynapseAt: null })
    }, 5000)
  },

  // Search synapse by wallet address
  searchSynapseByAddress: (address: string) => {
    const { synapseNodes } = get()
    const query = address.toLowerCase()
    const results = synapseNodes.filter(
      (node) =>
        node.state === 'connected' &&
        (node.fullWalletAddress?.toLowerCase().includes(query) ||
          node.connectedBy?.toLowerCase().includes(query))
    )
    set({ searchResults: results, searchQuery: address })
    return results
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [] }),

  setNavigateToNode: (nodeId: string | null) => set({ navigateToNodeId: nodeId }),
}))
