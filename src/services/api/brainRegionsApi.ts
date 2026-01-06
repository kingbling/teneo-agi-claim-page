/**
 * Brain Regions API Layer
 *
 * Provides access to the mock database data via JSON imports.
 * In production, these would be actual API calls.
 */

import type {
  GlobalStats,
  BrainRegionConfig,
  RegionUnlockProgress,
  DBUser,
  DBUserConnection,
  DBSynapseNode,
  DBSynapseConnection,
  Allocation,
  PassiveBonus,
  LeaderboardEntry,
  Transaction,
  DatabaseState,
  UserTier,
} from '@/types/database'
import type { BrainRegion, SynapseNode, Reward } from '@/types'

// Import JSON data
import globalStatsJson from '@/data/globalStats.json'
import brainRegionsJson from '@/data/brainRegions.json'
import regionProgressJson from '@/data/regionProgress.json'
import usersJson from '@/data/users.json'
import currentUserJson from '@/data/currentUser.json'
import userConnectionsJson from '@/data/userConnections.json'
import passiveBonusesJson from '@/data/passiveBonuses.json'
import synapseNodesJson from '@/data/synapseNodes.json'
import synapseConnectionsJson from '@/data/synapseConnections.json'
import allocationsJson from '@/data/allocations.json'
import leaderboardJson from '@/data/leaderboard.json'
import transactionsJson from '@/data/transactions.json'

// ============================================
// DATA TRANSFORMERS
// ============================================

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null
  return new Date(dateStr.replace(' ', 'T') + 'Z')
}

function transformGlobalStats(raw: any): GlobalStats {
  return {
    totalSynapses: raw.total_synapses,
    totalUsers: raw.total_users,
    totalPointsDistributed: raw.total_points_distributed,
    networkCreatedAt: parseDate(raw.network_created_at) || new Date(),
    lastUpdatedAt: parseDate(raw.last_updated_at) || new Date(),
  }
}

function transformBrainRegion(raw: any): BrainRegionConfig {
  return {
    id: raw.id as BrainRegion,
    name: raw.name,
    description: raw.description || '',
    unlockThreshold: raw.unlock_threshold,
    rewardMultiplier: raw.reward_multiplier,
    passiveBonusPercent: raw.passive_bonus_percent,
    colorHex: raw.color_hex,
    glowColorHex: raw.glow_color_hex,
    isUnlocked: raw.is_unlocked === 1,
    unlockedAt: parseDate(raw.unlocked_at),
    displayOrder: raw.display_order,
  }
}

function transformRegionProgress(raw: any): RegionUnlockProgress {
  return {
    id: raw.id as BrainRegion,
    name: raw.name,
    unlockThreshold: raw.unlock_threshold,
    rewardMultiplier: raw.reward_multiplier,
    passiveBonusPercent: raw.passive_bonus_percent,
    isUnlocked: raw.is_unlocked === 1,
    displayOrder: raw.display_order,
    totalSynapses: raw.total_synapses,
    progressPercent: raw.progress_percent,
    synapsesRemaining: raw.synapses_remaining,
  }
}

function transformUser(raw: any): DBUser {
  return {
    id: raw.id,
    walletAddress: raw.wallet_address,
    displayName: raw.display_name,
    tier: raw.tier as UserTier,
    totalPoints: raw.total_points,
    synapseCount: raw.synapse_count,
    journeyProgress: raw.journey_progress,
    createdAt: parseDate(raw.created_at) || new Date(),
    lastActiveAt: parseDate(raw.last_active_at) || new Date(),
    isCurrentUser: raw.is_current_user === 1,
  }
}

function transformUserConnection(raw: any): DBUserConnection {
  return {
    id: raw.id,
    userId: raw.user_id,
    connectionType: raw.connection_type,
    connectionId: raw.connection_id,
    displayName: raw.display_name,
    isVerified: raw.is_verified === 1,
    connectedAt: parseDate(raw.connected_at) || new Date(),
  }
}

function transformSynapseNode(raw: any): DBSynapseNode {
  return {
    id: raw.id,
    regionId: raw.region_id as BrainRegion,
    positionX: raw.position_x,
    positionY: raw.position_y,
    positionZ: raw.position_z,
    state: raw.state as 'available' | 'pending' | 'connected',
    connectedByUserId: raw.connected_by_user_id,
    connectedByWallet: raw.connected_by_wallet, // Full wallet address for search
    connectedAt: parseDate(raw.connected_at),
    baseRewardPoints: raw.base_reward_points,
    clusterWeight: raw.cluster_weight ?? 1,
    synapseCount: raw.synapse_count ?? raw.cluster_weight ?? 1, // Actual synapses in cluster
  }
}

function transformSynapseConnection(raw: any): DBSynapseConnection {
  return {
    id: raw.id,
    fromNodeId: raw.from_node_id,
    toNodeId: raw.to_node_id,
    strength: raw.strength,
    createdAt: parseDate(raw.created_at) || new Date(),
  }
}

function transformAllocation(raw: any): Allocation {
  return {
    id: raw.id,
    userId: raw.user_id,
    nodeId: raw.node_id,
    regionId: raw.region_id as BrainRegion,
    basePoints: raw.base_points,
    multiplierApplied: raw.multiplier_applied,
    passiveBonusApplied: raw.passive_bonus_applied,
    finalPoints: raw.final_points,
    allocatedAt: parseDate(raw.allocated_at) || new Date(),
  }
}

function transformPassiveBonus(raw: any): PassiveBonus {
  return {
    id: raw.id,
    userId: raw.user_id,
    regionId: raw.region_id as BrainRegion,
    bonusPercent: raw.bonus_percent,
    activatedAt: parseDate(raw.activated_at) || new Date(),
  }
}

function transformLeaderboardEntry(raw: any): LeaderboardEntry {
  return {
    id: raw.id,
    walletAddress: raw.wallet_address,
    displayName: raw.display_name,
    tier: raw.tier as UserTier,
    totalPoints: raw.total_points,
    synapseCount: raw.synapse_count,
    rank: raw.rank,
  }
}

function transformTransaction(raw: any): Transaction {
  return {
    id: raw.id,
    userId: raw.user_id,
    transactionType: raw.transaction_type,
    referenceId: raw.reference_id,
    pointsDelta: raw.points_delta,
    description: raw.description,
    metadata: raw.metadata ? JSON.parse(raw.metadata) : null,
    createdAt: parseDate(raw.created_at) || new Date(),
  }
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Load all database state for app initialization
 */
export function loadDatabaseState(): DatabaseState {
  const globalStats = transformGlobalStats(globalStatsJson)
  const brainRegions = (brainRegionsJson as any[]).map(transformBrainRegion)
  const regionProgress = (regionProgressJson as any[]).map(transformRegionProgress)
  const currentUser = currentUserJson ? transformUser(currentUserJson) : null
  const userConnections = (userConnectionsJson as any[]).map(transformUserConnection)
  const userPassiveBonuses = (passiveBonusesJson as any[]).map(transformPassiveBonus)

  // Handle hierarchical LOD format - use LOD 2 for compatibility
  const data = synapseNodesJson as { lod0?: any[]; lod1?: any[]; lod2?: any[] }
  const rawNodes = data.lod2 || (synapseNodesJson as any[])
  const synapseNodes = rawNodes.map(transformSynapseNode)

  // Handle hierarchical LOD format for connections - use LOD 2 for compatibility
  const connData = synapseConnectionsJson as { lod0?: any[]; lod1?: any[]; lod2?: any[] }
  const rawConns = connData.lod2 || (synapseConnectionsJson as any[])
  const synapseConnections = rawConns.map(transformSynapseConnection)
  const allocations = (allocationsJson as any[]).map(transformAllocation)
  const leaderboard = (leaderboardJson as any[]).map(transformLeaderboardEntry)

  return {
    globalStats,
    brainRegions,
    regionProgress,
    currentUser,
    userConnections,
    userPassiveBonuses,
    synapseNodes,
    synapseConnections,
    allocations,
    leaderboard,
  }
}

/**
 * Get global network statistics
 */
export function getGlobalStats(): GlobalStats {
  return transformGlobalStats(globalStatsJson)
}

/**
 * Get all brain region configurations
 */
export function getAllRegions(): BrainRegionConfig[] {
  return (brainRegionsJson as any[]).map(transformBrainRegion)
}

/**
 * Get region unlock progress
 */
export function getRegionProgress(): RegionUnlockProgress[] {
  return (regionProgressJson as any[]).map(transformRegionProgress)
}

/**
 * Get current user
 */
export function getCurrentUser(): DBUser | null {
  return currentUserJson ? transformUser(currentUserJson) : null
}

/**
 * Get user by ID
 */
export function getUserById(userId: string): DBUser | null {
  const user = (usersJson as any[]).find((u) => u.id === userId)
  return user ? transformUser(user) : null
}

/**
 * Get user connections
 */
export function getUserConnections(userId: string): DBUserConnection[] {
  return (userConnectionsJson as any[])
    .filter((c) => c.user_id === userId)
    .map(transformUserConnection)
}

/**
 * Get user passive bonuses
 */
export function getUserPassiveBonuses(userId: string): PassiveBonus[] {
  return (passiveBonusesJson as any[])
    .filter((b) => b.user_id === userId)
    .map(transformPassiveBonus)
}

/**
 * Calculate total passive bonus for a user
 */
export function calculateTotalPassiveBonus(userId: string): number {
  const bonuses = getUserPassiveBonuses(userId)
  return bonuses.reduce((sum, b) => sum + b.bonusPercent, 0)
}

/**
 * Get all synapse nodes (hierarchical LOD data)
 * Returns { lod0, lod1, lod2 } where each is an array of nodes
 */
export function getSynapseNodesHierarchical(): {
  lod0: DBSynapseNode[]
  lod1: DBSynapseNode[]
  lod2: DBSynapseNode[]
} {
  const data = synapseNodesJson as { lod0: any[]; lod1: any[]; lod2: any[] }
  return {
    lod0: data.lod0.map(transformSynapseNode),
    lod1: data.lod1.map(transformSynapseNode),
    lod2: data.lod2.map(transformSynapseNode),
  }
}

/**
 * Get all synapse nodes (flattened - uses LOD 2 for compatibility)
 */
export function getSynapseNodes(): DBSynapseNode[] {
  const data = synapseNodesJson as { lod0?: any[]; lod1?: any[]; lod2?: any[] }
  // Handle both old flat array and new hierarchical format
  if (data.lod2) {
    return data.lod2.map(transformSynapseNode)
  }
  return (synapseNodesJson as any[]).map(transformSynapseNode)
}

/**
 * Get synapse connections (hierarchical LOD data)
 */
export function getSynapseConnectionsHierarchical(): {
  lod0: DBSynapseConnection[]
  lod1: DBSynapseConnection[]
  lod2: DBSynapseConnection[]
} {
  const data = synapseConnectionsJson as { lod0: any[]; lod1: any[]; lod2: any[] }
  return {
    lod0: data.lod0.map(transformSynapseConnection),
    lod1: data.lod1.map(transformSynapseConnection),
    lod2: data.lod2.map(transformSynapseConnection),
  }
}

/**
 * Get synapse connections (flattened - uses LOD 2 for compatibility)
 */
export function getSynapseConnections(): DBSynapseConnection[] {
  const data = synapseConnectionsJson as { lod0?: any[]; lod1?: any[]; lod2?: any[] }
  if (data.lod2) {
    return data.lod2.map(transformSynapseConnection)
  }
  return (synapseConnectionsJson as any[]).map(transformSynapseConnection)
}

/**
 * Get leaderboard
 */
export function getLeaderboard(limit = 50): LeaderboardEntry[] {
  return (leaderboardJson as any[]).slice(0, limit).map(transformLeaderboardEntry)
}

/**
 * Convert DB synapse nodes to visualization format
 * @param dbNodes - The nodes to convert
 * @param dbConnections - Optional connections (if not provided, uses default LOD 2)
 */
export function convertToVisualizationNodes(
  dbNodes: DBSynapseNode[],
  dbConnections?: DBSynapseConnection[]
): SynapseNode[] {
  // Build connection map from provided connections or default
  const connections = dbConnections ?? getSynapseConnections()
  const connectionMap = new Map<string, string[]>()

  for (const conn of connections) {
    const fromConns = connectionMap.get(conn.fromNodeId) || []
    fromConns.push(conn.toNodeId)
    connectionMap.set(conn.fromNodeId, fromConns)
  }

  return dbNodes.map((node) => {
    // Get wallet address - prefer direct wallet, fallback to user lookup
    let shortWallet: string | undefined
    let fullWallet: string | undefined

    if (node.connectedByWallet) {
      // New format: wallet directly on synapse
      fullWallet = node.connectedByWallet
      shortWallet = node.connectedByUserId || (fullWallet.slice(0, 6) + '...' + fullWallet.slice(-4))
    } else if (node.connectedByUserId) {
      // Old format: lookup wallet from users
      const user = (usersJson as any[]).find((u) => u.id === node.connectedByUserId)
      if (user?.wallet_address) {
        fullWallet = user.wallet_address
        shortWallet = fullWallet.slice(0, 10) + '...'
      }
    }

    return {
      id: node.id,
      position: [node.positionX, node.positionY, node.positionZ] as [number, number, number],
      region: node.regionId,
      state: node.state === 'pending' ? 'available' : node.state,
      connectedAt: node.connectedAt || undefined,
      connectedBy: shortWallet,
      fullWalletAddress: fullWallet || undefined,
      connectedToIds: connectionMap.get(node.id) || [],
      clusterWeight: node.clusterWeight ?? 1,
      synapseCount: node.synapseCount ?? node.clusterWeight ?? 1,
    }
  })
}

/**
 * Get region multiplier for a synapse claim
 */
export function getRegionMultiplier(regionId: BrainRegion): number {
  const regions = getAllRegions()
  const region = regions.find((r) => r.id === regionId)
  return region?.isUnlocked ? region.rewardMultiplier : 1.0
}

/**
 * Generate rewards for a synapse claim (mock implementation)
 */
export function generateClaimRewards(
  regionId: BrainRegion,
  basePoints: number,
  userPassiveBonus: number
): { rewards: Reward[]; finalPoints: number } {
  const regionMultiplier = getRegionMultiplier(regionId)
  const totalMultiplier = regionMultiplier * (1 + userPassiveBonus / 100)
  const finalPoints = Math.floor(basePoints * totalMultiplier)

  const rewards: Reward[] = [
    {
      id: `r_${Date.now()}_1`,
      type: 'AGI_TOKENS',
      amount: finalPoints,
      rarity: 'common',
    },
  ]

  // Roll for additional rewards
  const roll = Math.random()
  if (roll < 0.02) {
    rewards.push({
      id: `r_${Date.now()}_2`,
      type: 'NEURAL_KEY',
      keyType: ['genesis', 'alpha', 'beta'][Math.floor(Math.random() * 3)] as
        | 'genesis'
        | 'alpha'
        | 'beta',
      rarity: 'legendary',
    })
  } else if (roll < 0.1) {
    rewards.push({
      id: `r_${Date.now()}_2`,
      type: 'STAKING_BOOST',
      tier: (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3,
      rarity: 'rare',
    })
  } else if (roll < 0.3) {
    rewards.push({
      id: `r_${Date.now()}_2`,
      type: 'MULTIPLIER',
      value: [1.25, 1.5, 2.0][Math.floor(Math.random() * 3)],
      duration: 24,
      rarity: 'uncommon',
    })
  }

  return { rewards, finalPoints }
}

/**
 * Check if claiming a synapse would unlock a new region
 */
export function checkRegionUnlock(
  currentTotalSynapses: number,
  claimCount: number
): BrainRegionConfig | null {
  const newTotal = currentTotalSynapses + claimCount
  const regions = getAllRegions()

  for (const region of regions) {
    if (!region.isUnlocked && newTotal >= region.unlockThreshold) {
      return region
    }
  }

  return null
}
