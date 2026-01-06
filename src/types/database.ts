// Database Types for Brain Regions System
// These types map to the SQLite schema

import type { BrainRegion, RewardType, SynapseState } from './index'

// ============================================
// GLOBAL STATS
// ============================================
export interface GlobalStats {
  totalSynapses: number
  totalUsers: number
  totalPointsDistributed: number
  networkCreatedAt: Date
  lastUpdatedAt: Date
}

// ============================================
// BRAIN REGIONS
// ============================================
export interface BrainRegionConfig {
  id: BrainRegion
  name: string
  description: string
  unlockThreshold: number
  rewardMultiplier: number
  passiveBonusPercent: number
  colorHex: string
  glowColorHex: string
  isUnlocked: boolean
  unlockedAt: Date | null
  displayOrder: number
}

export interface RegionUnlockProgress {
  id: BrainRegion
  name: string
  unlockThreshold: number
  rewardMultiplier: number
  passiveBonusPercent: number
  isUnlocked: boolean
  displayOrder: number
  totalSynapses: number
  progressPercent: number
  synapsesRemaining: number
}

// ============================================
// USERS
// ============================================
export type UserTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface DBUser {
  id: string
  walletAddress: string
  displayName: string | null
  tier: UserTier
  totalPoints: number
  synapseCount: number
  journeyProgress: number
  createdAt: Date
  lastActiveAt: Date
  isCurrentUser: boolean
}

export interface DBUserConnection {
  id: number
  userId: string
  connectionType: 'twitter' | 'discord' | 'telegram' | 'email' | 'wallet'
  connectionId: string
  displayName: string | null
  isVerified: boolean
  connectedAt: Date
}

// ============================================
// SYNAPSE NODES
// ============================================
export interface DBSynapseNode {
  id: string
  regionId: BrainRegion
  positionX: number
  positionY: number
  positionZ: number
  state: SynapseState
  connectedByUserId: string | null
  connectedByWallet?: string | null // Full wallet address for search
  connectedAt: Date | null
  baseRewardPoints: number
  clusterWeight?: number // How many synapses this cluster represents
  synapseCount?: number // Actual number of synapses in this cluster
}

export interface DBSynapseConnection {
  id: number
  fromNodeId: string
  toNodeId: string
  strength: number
  createdAt: Date
}

// ============================================
// ALLOCATIONS
// ============================================
export interface Allocation {
  id: number
  userId: string
  nodeId: string
  regionId: BrainRegion
  basePoints: number
  multiplierApplied: number
  passiveBonusApplied: number
  finalPoints: number
  allocatedAt: Date
}

// ============================================
// REWARDS
// ============================================
export interface DBReward {
  id: number
  allocationId: number
  rewardType: RewardType
  amount: number
  description: string | null
  isClaimed: boolean
  claimedAt: Date | null
  expiresAt: Date | null
}

// ============================================
// PASSIVE BONUSES
// ============================================
export interface PassiveBonus {
  id: number
  userId: string
  regionId: BrainRegion
  bonusPercent: number
  activatedAt: Date
}

export interface UserBonusSummary {
  userId: string
  walletAddress: string
  displayName: string | null
  totalPassiveBonus: number
}

// ============================================
// TRANSACTIONS
// ============================================
export type TransactionType =
  | 'SYNAPSE_CLAIM'
  | 'REGION_UNLOCK'
  | 'POINTS_EARNED'
  | 'REWARD_CLAIMED'
  | 'PASSIVE_BONUS_ACTIVATED'
  | 'TIER_UPGRADE'

export interface Transaction {
  id: number
  userId: string | null
  transactionType: TransactionType
  referenceId: string | null
  pointsDelta: number
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

// ============================================
// LEADERBOARD
// ============================================
export interface LeaderboardEntry {
  id: string
  walletAddress: string
  displayName: string | null
  tier: UserTier
  totalPoints: number
  synapseCount: number
  rank: number
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================
export interface ClaimSynapseRequest {
  userId: string
  nodeId: string
}

export interface ClaimSynapseResponse {
  success: boolean
  allocation: Allocation | null
  rewards: DBReward[]
  regionUnlocked: BrainRegionConfig | null
  newPassiveBonuses: PassiveBonus[]
  error?: string
}

export interface DatabaseState {
  globalStats: GlobalStats
  brainRegions: BrainRegionConfig[]
  regionProgress: RegionUnlockProgress[]
  currentUser: DBUser | null
  userConnections: DBUserConnection[]
  userPassiveBonuses: PassiveBonus[]
  synapseNodes: DBSynapseNode[]
  synapseConnections: DBSynapseConnection[]
  allocations: Allocation[]
  leaderboard: LeaderboardEntry[]
}

// ============================================
// GENERATOR CONFIG
// ============================================
export interface GeneratorConfig {
  userCount: {
    min: number
    max: number
  }
  distribution: {
    powerUsers: number // percentage (e.g., 0.10 for 10%)
    activeUsers: number // percentage
    casualUsers: number // percentage
  }
  synapseRanges: {
    powerUsers: { min: number; max: number }
    activeUsers: { min: number; max: number }
    casualUsers: { min: number; max: number }
  }
  totalNodes: number
}

export const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
  userCount: { min: 50, max: 100 },
  distribution: {
    powerUsers: 0.1,
    activeUsers: 0.25,
    casualUsers: 0.65,
  },
  synapseRanges: {
    powerUsers: { min: 20, max: 50 },
    activeUsers: { min: 5, max: 20 },
    casualUsers: { min: 1, max: 5 },
  },
  totalNodes: 100,
}
