// User Types
export interface User {
  id: string
  walletAddress: string
  email?: string
  points: number
  totalPointsEarned: number
  synapsesConnected: number
  journeyProgress: number
  createdAt: Date
  lastSynapseAt: Date | null
  nextSynapseAt: Date | null
  connections: UserConnections
}

export interface UserConnections {
  wallet: { connected: boolean; address?: string }
  twitter: { connected: boolean; username?: string }
  discord: { connected: boolean; username?: string }
  telegram: { connected: boolean; username?: string }
  email: { connected: boolean; address?: string }
  tiktok: { connected: boolean; username?: string }
  instagram: { connected: boolean; username?: string }
  farcaster: { connected: boolean; fid?: string }
}

// Brain/Synapse Types
export type BrainRegion =
  | 'frontal'
  | 'parietal'
  | 'temporal'
  | 'occipital'
  | 'cerebellum'
  | 'brainstem'

export type SynapseState = 'locked' | 'available' | 'connected'

export interface SynapseNode {
  id: string
  position: [number, number, number]
  region: BrainRegion
  state: SynapseState
  connectedAt?: Date
  connectedBy?: string // wallet address of who connected this synapse
  connectedToIds: string[]
}

export interface Synapse {
  id: string
  userId: string
  nodeId: string
  position: [number, number, number]
  region: BrainRegion
  rewards: Reward[]
  connectedAt: Date
  pointsSpent: number
}

// Reward Types
export type RewardType = 'AGI_TOKENS' | 'MULTIPLIER' | 'STAKING_BOOST' | 'NEURAL_KEY'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface BaseReward {
  id: string
  type: RewardType
  rarity: Rarity
}

export interface AGITokenReward extends BaseReward {
  type: 'AGI_TOKENS'
  amount: number
}

export interface MultiplierReward extends BaseReward {
  type: 'MULTIPLIER'
  value: number
  duration: number
  expiresAt?: Date
}

export interface StakingBoostReward extends BaseReward {
  type: 'STAKING_BOOST'
  tier: 1 | 2 | 3
  poolId?: string
}

export interface NeuralKeyReward extends BaseReward {
  type: 'NEURAL_KEY'
  keyType: 'genesis' | 'alpha' | 'beta'
  tokenId?: string
}

export type Reward = AGITokenReward | MultiplierReward | StakingBoostReward | NeuralKeyReward

// Store Types
export type RevealPhase = 'idle' | 'locating' | 'connecting' | 'activating' | 'complete'

export interface SynapseRecord {
  id: string
  nodeId: string
  rewards: Reward[]
  connectedAt: Date
  pointsSpent: number
}

// Milestone Types
export interface Milestone {
  id: string
  progress: number
  name: string
  reward: string
  achieved: boolean
}
