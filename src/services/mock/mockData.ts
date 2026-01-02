import type { User, SynapseNode, SynapseRecord, Reward, Milestone, BrainRegion } from '@/types'

// Mock User
export const MOCK_USER: User = {
  id: 'user_001',
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  email: 'user@teneo.ai',
  points: 12450,
  totalPointsEarned: 24800,
  synapsesConnected: 47,
  journeyProgress: 23.5,
  createdAt: new Date('2024-01-01'),
  lastSynapseAt: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20 hours ago
  nextSynapseAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
  connections: {
    wallet: { connected: true, address: '0x1234...5678' },
    twitter: { connected: true, username: '@teneo_user' },
    discord: { connected: true, username: 'TeneoFan#1234' },
    telegram: { connected: true, username: '@teneo_fan' },
    email: { connected: true, address: 'user@teneo.ai' },
    tiktok: { connected: true, username: '@teneo_tok' },
    instagram: { connected: true, username: '@teneo_gram' },
    farcaster: { connected: true, fid: '12345' },
  },
}

// Generate synapse nodes for the brain visualization
function generateSynapseNodes(): SynapseNode[] {
  const nodes: SynapseNode[] = []
  const regions: BrainRegion[] = ['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum', 'brainstem']

  // Generate ~100 nodes distributed across brain regions
  const nodesPerRegion = {
    frontal: 25,
    parietal: 20,
    temporal: 20,
    occipital: 15,
    cerebellum: 12,
    brainstem: 8,
  }

  let nodeId = 0

  for (const region of regions) {
    const count = nodesPerRegion[region]
    for (let i = 0; i < count; i++) {
      // Generate position based on region
      let x = 0, y = 0, z = 0

      switch (region) {
        case 'frontal':
          x = (Math.random() - 0.5) * 0.6
          y = Math.random() * 0.4 + 0.2
          z = Math.random() * 0.4 + 0.5
          break
        case 'parietal':
          x = (Math.random() - 0.5) * 0.8
          y = Math.random() * 0.3 + 0.5
          z = (Math.random() - 0.5) * 0.4
          break
        case 'temporal':
          x = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.3 + 0.5)
          y = (Math.random() - 0.5) * 0.4
          z = Math.random() * 0.4
          break
        case 'occipital':
          x = (Math.random() - 0.5) * 0.5
          y = Math.random() * 0.3 + 0.1
          z = -Math.random() * 0.4 - 0.5
          break
        case 'cerebellum':
          x = (Math.random() - 0.5) * 0.5
          y = -Math.random() * 0.3 - 0.3
          z = -Math.random() * 0.3 - 0.3
          break
        case 'brainstem':
          x = (Math.random() - 0.5) * 0.2
          y = -Math.random() * 0.4 - 0.4
          z = (Math.random() - 0.5) * 0.2
          break
      }

      const state = nodeId < 47 ? 'connected' : nodeId === 47 ? 'available' : 'locked'

      // Generate mock wallet addresses for connected synapses
      const walletAddresses = [
        '0x1234...5678', '0xabcd...ef01', '0x9876...5432', '0xfedc...ba98',
        '0x2468...1357', '0x1357...2468', '0xaaaa...bbbb', '0xcccc...dddd',
        '0x5555...6666', '0x7777...8888', '0x9999...0000', '0x4321...8765',
      ]

      nodes.push({
        id: `node_${nodeId.toString().padStart(3, '0')}`,
        position: [x, y, z],
        region,
        state,
        connectedAt: state === 'connected' ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : undefined,
        connectedBy: state === 'connected' ? walletAddresses[nodeId % walletAddresses.length] : undefined,
        connectedToIds: [],
      })

      nodeId++
    }
  }

  // Create connections between nearby nodes
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].state === 'connected') {
      // Connect to 1-3 nearby connected nodes
      const nearbyNodes = nodes
        .filter((n, idx) => {
          if (idx === i || n.state !== 'connected') return false
          const dist = Math.sqrt(
            Math.pow(n.position[0] - nodes[i].position[0], 2) +
            Math.pow(n.position[1] - nodes[i].position[1], 2) +
            Math.pow(n.position[2] - nodes[i].position[2], 2)
          )
          return dist < 0.5
        })
        .slice(0, 3)

      nodes[i].connectedToIds = nearbyNodes.map(n => n.id)
    }
  }

  return nodes
}

export const MOCK_SYNAPSE_NODES = generateSynapseNodes()

// Mock Synapse History
export const MOCK_SYNAPSE_HISTORY: SynapseRecord[] = [
  {
    id: 'syn_001',
    nodeId: 'node_046',
    rewards: [
      { id: 'r1', type: 'AGI_TOKENS', amount: 175, rarity: 'common' },
      { id: 'r2', type: 'MULTIPLIER', value: 1.5, duration: 24, rarity: 'uncommon' },
    ],
    connectedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    pointsSpent: 250,
  },
  {
    id: 'syn_002',
    nodeId: 'node_045',
    rewards: [
      { id: 'r3', type: 'AGI_TOKENS', amount: 120, rarity: 'common' },
    ],
    connectedAt: new Date(Date.now() - 44 * 60 * 60 * 1000),
    pointsSpent: 250,
  },
  {
    id: 'syn_003',
    nodeId: 'node_044',
    rewards: [
      { id: 'r4', type: 'AGI_TOKENS', amount: 200, rarity: 'common' },
      { id: 'r5', type: 'STAKING_BOOST', tier: 2, rarity: 'rare' },
    ],
    connectedAt: new Date(Date.now() - 68 * 60 * 60 * 1000),
    pointsSpent: 250,
  },
]

// Generate random rewards
export function generateRewards(): Reward[] {
  const rewards: Reward[] = []

  // Always give AGI tokens
  rewards.push({
    id: `r_${Date.now()}_1`,
    type: 'AGI_TOKENS',
    amount: Math.floor(Math.random() * 150) + 50,
    rarity: 'common',
  })

  // Roll for additional rewards
  const roll = Math.random()
  if (roll < 0.02) {
    rewards.push({
      id: `r_${Date.now()}_2`,
      type: 'NEURAL_KEY',
      keyType: ['genesis', 'alpha', 'beta'][Math.floor(Math.random() * 3)] as 'genesis' | 'alpha' | 'beta',
      rarity: 'legendary',
    })
  } else if (roll < 0.10) {
    rewards.push({
      id: `r_${Date.now()}_2`,
      type: 'STAKING_BOOST',
      tier: (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3,
      rarity: 'rare',
    })
  } else if (roll < 0.30) {
    rewards.push({
      id: `r_${Date.now()}_2`,
      type: 'MULTIPLIER',
      value: [1.25, 1.5, 2.0][Math.floor(Math.random() * 3)],
      duration: 24,
      rarity: 'uncommon',
    })
  }

  return rewards
}

// Milestones
export const MILESTONES: Milestone[] = [
  { id: 'm1', progress: 10, name: 'Neuron Awakening', reward: '500 AGI bonus', achieved: true },
  { id: 'm2', progress: 25, name: 'Neural Pathway', reward: 'Permanent 1.1x multiplier', achieved: false },
  { id: 'm3', progress: 50, name: 'Cognitive Emergence', reward: 'Tier 3 staking access', achieved: false },
  { id: 'm4', progress: 75, name: 'Intelligence Threshold', reward: '5000 AGI bonus', achieved: false },
  { id: 'm5', progress: 100, name: 'AGI Achieved', reward: 'Legendary status + NFT', achieved: false },
]

// How to earn points
export const EARNING_METHODS = [
  {
    id: 'community_node',
    title: 'Community Node',
    description: 'Run a Teneo community node to contribute to the network',
    pointsRange: '100-500 / day',
    icon: 'server',
  },
  {
    id: 'ai_agent',
    title: 'AI Agent',
    description: 'Operate an AI agent within the Teneo network',
    pointsRange: '200-1000 / day',
    icon: 'bot',
  },
  {
    id: 'queries',
    title: 'Network Queries',
    description: 'Pay for commands and queries on the network',
    pointsRange: '1-10 / query',
    icon: 'terminal',
  },
  {
    id: 'referrals',
    title: 'Referrals',
    description: 'Invite friends to join the Teneo ecosystem',
    pointsRange: '50 / referral',
    icon: 'users',
  },
]

// Calculate synapse cost based on number connected
export function getSynapseCost(synapsesConnected: number): number {
  if (synapsesConnected < 10) return 100
  if (synapsesConnected < 25) return 250
  if (synapsesConnected < 50) return 500
  return 1000
}
