#!/usr/bin/env npx tsx
/**
 * Mock Database Generator for Teneo Brain Regions System
 *
 * Generates a SQLite database with:
 * - 50-100 users with power-law distribution
 * - 100 synapse nodes across 6 brain regions
 * - 500-1000 allocations
 * - Transaction history
 *
 * Usage: npm run generate-db
 */

import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const CONFIG = {
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
  nodesPerRegion: {
    brainstem: 15,
    cerebellum: 15,
    occipital: 17,
    temporal: 18,
    parietal: 17,
    frontal: 18,
  },
  baseRewardPoints: {
    brainstem: 100,
    cerebellum: 120,
    occipital: 150,
    temporal: 180,
    parietal: 220,
    frontal: 300,
  },
  // Connection distance threshold (in normalized brain units)
  // Synapses can only connect if within this distance
  // Think of it as axon length limit - neurons can only reach so far
  maxConnectionDistance: 0.5, // ~0.5 brain units ≈ a few cm in a real brain
  maxConnectionsPerNode: 3,   // Max connections per synapse
}

// Types
type BrainRegion = 'frontal' | 'parietal' | 'temporal' | 'occipital' | 'cerebellum' | 'brainstem'
type UserTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

interface GeneratedUser {
  id: string
  walletAddress: string
  displayName: string | null
  tier: UserTier
  category: 'power' | 'active' | 'casual'
}

interface GeneratedNode {
  id: string
  regionId: BrainRegion
  positionX: number
  positionY: number
  positionZ: number
  baseRewardPoints: number
}

// Utility functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateWalletAddress(): string {
  const chars = '0123456789abcdef'
  let addr = '0x'
  for (let i = 0; i < 40; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)]
  }
  return addr
}

function generateUserId(): string {
  return `user_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`
}

function generateNodeId(region: BrainRegion, index: number): string {
  return `synapse_${region}_${index.toString().padStart(3, '0')}`
}

function calculateTier(synapseCount: number): UserTier {
  if (synapseCount >= 40) return 'diamond'
  if (synapseCount >= 25) return 'platinum'
  if (synapseCount >= 15) return 'gold'
  if (synapseCount >= 5) return 'silver'
  return 'bronze'
}

// Generate positions on brain surface for each region
function generateBrainPosition(region: BrainRegion): [number, number, number] {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)

  let x = Math.sin(phi) * Math.cos(theta)
  let y = Math.cos(phi)
  let z = Math.sin(phi) * Math.sin(theta)

  // Bias positions based on region
  switch (region) {
    case 'frontal':
      // Front-top of brain
      z = Math.abs(z) * 0.5 + 0.5 // Push to front
      y = Math.abs(y) * 0.5 + 0.2 // Push up
      break
    case 'parietal':
      // Top of brain
      y = Math.abs(y) * 0.5 + 0.5 // Push up
      break
    case 'temporal':
      // Sides
      x = x * 0.8 + (x > 0 ? 0.4 : -0.4) // Push to sides
      y = y * 0.5 - 0.2 // Middle to lower
      break
    case 'occipital':
      // Back
      z = -Math.abs(z) * 0.5 - 0.3 // Push to back
      y = y * 0.5 + 0.1 // Middle
      break
    case 'cerebellum':
      // Back-bottom
      z = -Math.abs(z) * 0.4 - 0.4
      y = -Math.abs(y) * 0.5 - 0.2
      break
    case 'brainstem':
      // Bottom-center
      x = x * 0.3
      y = -Math.abs(y) * 0.4 - 0.5
      z = z * 0.3
      break
  }

  // Normalize to unit sphere and add some noise
  const len = Math.sqrt(x * x + y * y + z * z)
  x = x / len + (Math.random() - 0.5) * 0.1
  y = y / len + (Math.random() - 0.5) * 0.1
  z = z / len + (Math.random() - 0.5) * 0.1

  return [x, y, z]
}

// Names for display
const FIRST_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Quinn',
  'Blake', 'Drew', 'Jamie', 'Avery', 'Cameron', 'Dakota', 'Emery', 'Finley',
]
const SUFFIXES = ['_nft', '_eth', '_dao', '_web3', '.eth', '_crypto', '', '', '']

function generateDisplayName(): string | null {
  if (Math.random() > 0.7) return null // 30% no display name
  const name = randomChoice(FIRST_NAMES)
  const suffix = randomChoice(SUFFIXES)
  const num = Math.random() > 0.5 ? randomInt(1, 999).toString() : ''
  return `${name}${num}${suffix}`
}

// Date generation
function randomDate(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  date.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59))
  return date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19)
}

// Main generation
function generateDatabase(dbPath: string): void {
  console.log('🧠 Teneo Mock Database Generator')
  console.log('================================\n')

  // Create database
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // Load and execute schema
  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')
  db.exec(schema)
  console.log('✓ Schema created\n')

  // Generate users
  const userCount = randomInt(CONFIG.userCount.min, CONFIG.userCount.max)
  const powerUserCount = Math.floor(userCount * CONFIG.distribution.powerUsers)
  const activeUserCount = Math.floor(userCount * CONFIG.distribution.activeUsers)
  const casualUserCount = userCount - powerUserCount - activeUserCount

  console.log(`Generating ${userCount} users:`)
  console.log(`  - ${powerUserCount} power users (10%)`)
  console.log(`  - ${activeUserCount} active users (25%)`)
  console.log(`  - ${casualUserCount} casual users (65%)\n`)

  const users: GeneratedUser[] = []

  // Generate power users
  for (let i = 0; i < powerUserCount; i++) {
    users.push({
      id: generateUserId(),
      walletAddress: generateWalletAddress(),
      displayName: generateDisplayName(),
      tier: 'bronze', // Will be updated after allocations
      category: 'power',
    })
  }

  // Generate active users
  for (let i = 0; i < activeUserCount; i++) {
    users.push({
      id: generateUserId(),
      walletAddress: generateWalletAddress(),
      displayName: generateDisplayName(),
      tier: 'bronze',
      category: 'active',
    })
  }

  // Generate casual users
  for (let i = 0; i < casualUserCount; i++) {
    users.push({
      id: generateUserId(),
      walletAddress: generateWalletAddress(),
      displayName: generateDisplayName(),
      tier: 'bronze',
      category: 'casual',
    })
  }

  // Mark one as current user
  const currentUserIdx = randomInt(0, users.length - 1)

  // Insert users
  const insertUser = db.prepare(`
    INSERT INTO users (id, wallet_address, display_name, tier, created_at, last_active_at, is_current_user)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const userCreationStart = Date.now() - 90 * 24 * 60 * 60 * 1000 // 90 days ago
  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const createdAt = randomDate(90)
    insertUser.run(
      user.id,
      user.walletAddress,
      user.displayName,
      user.tier,
      createdAt,
      randomDate(7),
      i === currentUserIdx ? 1 : 0
    )
  }
  console.log(`✓ Inserted ${users.length} users\n`)

  // Generate synapse nodes
  console.log('Generating synapse nodes:')
  const nodes: GeneratedNode[] = []
  const regions: BrainRegion[] = ['brainstem', 'cerebellum', 'occipital', 'temporal', 'parietal', 'frontal']

  for (const region of regions) {
    const count = CONFIG.nodesPerRegion[region]
    console.log(`  - ${region}: ${count} nodes`)
    for (let i = 0; i < count; i++) {
      const [x, y, z] = generateBrainPosition(region)
      nodes.push({
        id: generateNodeId(region, i),
        regionId: region,
        positionX: x,
        positionY: y,
        positionZ: z,
        baseRewardPoints: CONFIG.baseRewardPoints[region],
      })
    }
  }

  // Insert nodes
  const insertNode = db.prepare(`
    INSERT INTO synapse_nodes (id, region_id, position_x, position_y, position_z, state, base_reward_points)
    VALUES (?, ?, ?, ?, ?, 'available', ?)
  `)

  for (const node of nodes) {
    insertNode.run(node.id, node.regionId, node.positionX, node.positionY, node.positionZ, node.baseRewardPoints)
  }
  console.log(`✓ Inserted ${nodes.length} nodes\n`)

  // Generate allocations
  console.log('Generating allocations:')
  let totalAllocations = 0
  const userAllocations = new Map<string, number>()
  const allocatedNodeIds = new Set<string>()
  const availableNodes = [...nodes]

  // Shuffle users for random allocation order
  const shuffledUsers = [...users].sort(() => Math.random() - 0.5)

  const insertAllocation = db.prepare(`
    INSERT INTO allocations (user_id, node_id, region_id, base_points, multiplier_applied, passive_bonus_applied, final_points, allocated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const updateNodeState = db.prepare(`
    UPDATE synapse_nodes SET state = 'connected', connected_by_user_id = ?, connected_at = ?
    WHERE id = ?
  `)

  const updateUserStats = db.prepare(`
    UPDATE users SET synapse_count = ?, total_points = ?, tier = ?, journey_progress = ?
    WHERE id = ?
  `)

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (user_id, transaction_type, reference_id, points_delta, description, created_at)
    VALUES (?, 'SYNAPSE_CLAIM', ?, ?, ?, ?)
  `)

  for (const user of shuffledUsers) {
    // Determine how many synapses this user should claim
    let targetSynapses: number
    switch (user.category) {
      case 'power':
        targetSynapses = randomInt(CONFIG.synapseRanges.powerUsers.min, CONFIG.synapseRanges.powerUsers.max)
        break
      case 'active':
        targetSynapses = randomInt(CONFIG.synapseRanges.activeUsers.min, CONFIG.synapseRanges.activeUsers.max)
        break
      case 'casual':
        targetSynapses = randomInt(CONFIG.synapseRanges.casualUsers.min, CONFIG.synapseRanges.casualUsers.max)
        break
    }

    // Limit to available nodes
    targetSynapses = Math.min(targetSynapses, availableNodes.length)

    let userPoints = 0
    for (let i = 0; i < targetSynapses; i++) {
      if (availableNodes.length === 0) break

      // Pick a random available node
      const nodeIdx = randomInt(0, availableNodes.length - 1)
      const node = availableNodes[nodeIdx]
      availableNodes.splice(nodeIdx, 1)

      // Calculate rewards (simple for now, region multiplier will be applied later)
      const basePoints = node.baseRewardPoints
      const multiplier = 1.0 // Will be enhanced with region perks
      const finalPoints = Math.floor(basePoints * multiplier)

      const allocatedAt = randomDate(60)

      // Insert allocation
      insertAllocation.run(
        user.id,
        node.id,
        node.regionId,
        basePoints,
        multiplier,
        0, // passive bonus
        finalPoints,
        allocatedAt
      )

      // Update node state
      updateNodeState.run(user.id, allocatedAt, node.id)

      // Track stats
      userPoints += finalPoints
      totalAllocations++
      allocatedNodeIds.add(node.id)
      userAllocations.set(user.id, (userAllocations.get(user.id) || 0) + 1)

      // Insert transaction
      insertTransaction.run(
        user.id,
        node.id,
        finalPoints,
        `Claimed synapse in ${node.regionId}`,
        allocatedAt
      )
    }

    // Update user stats
    const synapseCount = userAllocations.get(user.id) || 0
    const tier = calculateTier(synapseCount)
    const journeyProgress = Math.min(100, (synapseCount / 50) * 100)

    updateUserStats.run(synapseCount, userPoints, tier, journeyProgress, user.id)
  }

  console.log(`✓ Created ${totalAllocations} allocations\n`)

  // Generate synapse connections between connected nodes
  // Only connect nodes within MAX_CONNECTION_DISTANCE (simulating axon length limits)
  console.log('Generating synapse connections:')
  console.log(`  Max connection distance: ${CONFIG.maxConnectionDistance} brain units`)
  console.log(`  Max connections per node: ${CONFIG.maxConnectionsPerNode}`)

  const connectedNodes = nodes.filter((n) => allocatedNodeIds.has(n.id))
  let connectionCount = 0
  let skippedTooFar = 0

  const insertConnection = db.prepare(`
    INSERT OR IGNORE INTO synapse_connections (from_node_id, to_node_id, strength)
    VALUES (?, ?, ?)
  `)

  // Connect each node to nearby nodes within distance threshold
  for (const node of connectedNodes) {
    const nearby = connectedNodes
      .filter((n) => n.id !== node.id)
      .map((n) => ({
        node: n,
        distance: Math.sqrt(
          Math.pow(n.positionX - node.positionX, 2) +
            Math.pow(n.positionY - node.positionY, 2) +
            Math.pow(n.positionZ - node.positionZ, 2)
        ),
      }))
      .filter((n) => n.distance <= CONFIG.maxConnectionDistance) // Distance threshold!
      .sort((a, b) => a.distance - b.distance)
      .slice(0, CONFIG.maxConnectionsPerNode)

    // Track how many were skipped due to distance
    const allNodes = connectedNodes.filter((n) => n.id !== node.id)
    skippedTooFar += allNodes.length - nearby.length

    for (const { node: target, distance } of nearby) {
      // Strength inversely proportional to distance (closer = stronger)
      // Normalized: 1.0 at distance 0, ~0.0 at maxConnectionDistance
      const strength = 1 - (distance / CONFIG.maxConnectionDistance)
      insertConnection.run(node.id, target.id, Math.max(0.1, strength))
      connectionCount++
    }
  }
  console.log(`✓ Created ${connectionCount} connections`)
  console.log(`  (${skippedTooFar} potential connections skipped - too far)\n`)

  // Update global stats
  const updateGlobalStats = db.prepare(`
    UPDATE global_stats SET
      total_synapses = ?,
      total_users = ?,
      total_points_distributed = (SELECT COALESCE(SUM(final_points), 0) FROM allocations),
      last_updated_at = datetime('now')
    WHERE id = 1
  `)
  updateGlobalStats.run(totalAllocations, users.length)

  // Update region unlock status based on total synapses
  const regionThresholds = [
    { id: 'brainstem', threshold: 0 },
    { id: 'cerebellum', threshold: 100 },
    { id: 'occipital', threshold: 250 },
    { id: 'temporal', threshold: 500 },
    { id: 'parietal', threshold: 750 },
    { id: 'frontal', threshold: 1000 },
  ]

  const updateRegionUnlock = db.prepare(`
    UPDATE brain_regions SET is_unlocked = 1, unlocked_at = datetime('now')
    WHERE id = ? AND unlock_threshold <= ?
  `)

  console.log('Updating region unlock status:')
  for (const region of regionThresholds) {
    if (totalAllocations >= region.threshold) {
      updateRegionUnlock.run(region.id, totalAllocations)
      console.log(`  ✓ ${region.id} unlocked (threshold: ${region.threshold})`)
    } else {
      console.log(`  ○ ${region.id} locked (needs ${region.threshold - totalAllocations} more)`)
    }
  }

  // Insert passive bonuses for current user based on unlocked regions
  const currentUser = users[currentUserIdx]
  const insertPassiveBonus = db.prepare(`
    INSERT INTO passive_bonuses (user_id, region_id, bonus_percent)
    SELECT ?, id, passive_bonus_percent
    FROM brain_regions
    WHERE is_unlocked = 1 AND passive_bonus_percent > 0
  `)
  insertPassiveBonus.run(currentUser.id)

  // Generate some user connections for current user
  const insertUserConnection = db.prepare(`
    INSERT INTO user_connections (user_id, connection_type, connection_id, display_name, is_verified)
    VALUES (?, ?, ?, ?, ?)
  `)

  const connections = [
    ['wallet', currentUser.walletAddress, currentUser.walletAddress.slice(0, 10) + '...', 1],
    ['twitter', '@neural_explorer', 'NeuralExplorer', Math.random() > 0.5 ? 1 : 0],
    ['discord', 'neural#1234', 'neural#1234', 1],
  ]

  for (const [type, id, display, verified] of connections) {
    insertUserConnection.run(currentUser.id, type, id, display, verified)
  }

  // Final summary
  console.log('\n================================')
  console.log('📊 Database Summary')
  console.log('================================')

  const stats = db.prepare('SELECT * FROM global_stats WHERE id = 1').get() as any
  const tierCounts = db
    .prepare('SELECT tier, COUNT(*) as count FROM users GROUP BY tier ORDER BY count DESC')
    .all() as any[]
  const regionStats = db
    .prepare(
      `
    SELECT region_id, COUNT(*) as allocated
    FROM synapse_nodes
    WHERE state = 'connected'
    GROUP BY region_id
  `
    )
    .all() as any[]

  console.log(`\nTotal Users: ${stats.total_users}`)
  console.log(`Total Synapses Claimed: ${stats.total_synapses}`)
  console.log(`Total Points Distributed: ${stats.total_points_distributed.toLocaleString()}`)

  console.log('\nUser Tiers:')
  for (const { tier, count } of tierCounts) {
    console.log(`  ${tier}: ${count}`)
  }

  console.log('\nRegion Allocations:')
  for (const { region_id, allocated } of regionStats) {
    console.log(`  ${region_id}: ${allocated} synapses`)
  }

  console.log(`\nCurrent User: ${currentUser.walletAddress.slice(0, 10)}...`)
  console.log(`  Synapses: ${userAllocations.get(currentUser.id) || 0}`)

  db.close()
  console.log(`\n✅ Database saved to: ${dbPath}`)
}

// Run
const dbPath = join(__dirname, '../../data/teneo.db')
generateDatabase(dbPath)
