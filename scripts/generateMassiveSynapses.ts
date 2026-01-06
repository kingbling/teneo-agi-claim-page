/**
 * Generate 200 million synapses with HIERARCHICAL clustering
 *
 * Strategy:
 * - LOD 0 (far): ~300 super-clusters (visible z > 4)
 * - LOD 1 (medium): ~2,000 clusters (visible z 2-4)
 * - LOD 2 (close): ~10,000 clusters (visible z < 2)
 * - 200,000 unique wallet addresses
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TOTAL_SYNAPSES = 200_000_000
const UNIQUE_WALLETS = 200_000

// LOD levels - each level has different cluster counts
// Note: Close-up shows FEWER but MORE DETAILED clusters (you're looking at a small area)
// Far view shows MORE clusters to represent the whole brain
const LOD_CONFIG = {
  lod0: { clusters: 500, label: 'overview clusters (far)' },
  lod1: { clusters: 1500, label: 'medium clusters' },
  lod2: { clusters: 800, label: 'detailed local clusters (close)' },
}

const REGIONS = ['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum', 'brainstem'] as const
const REGION_WEIGHTS = [0.25, 0.20, 0.20, 0.15, 0.12, 0.08]

// Generate random wallet address
function generateWallet(): string {
  const chars = '0123456789abcdef'
  let address = '0x'
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)]
  }
  return address
}

// Apply brain shape deformations
function applyBrainShape(x: number, y: number, z: number): [number, number, number] {
  let px = x, py = y, pz = z

  // Central groove (longitudinal fissure)
  const grooveDepth = 0.15
  const grooveWidth = 0.1
  const grooveFactor = Math.exp(-(px * px) / (grooveWidth * grooveWidth))
  if (py > 0) {
    py -= grooveDepth * grooveFactor * py
  }

  // Frontal lobe bulge
  if (pz > 0.3 && py > 0) {
    const bulge = 0.15 * Math.max(0, (pz - 0.3)) * Math.max(0, py)
    pz += bulge
    py += bulge * 0.5
  }

  // Temporal lobes (sides)
  const temporalBulge = 0.12
  const sideStrength = Math.abs(px) * (1 - Math.abs(py)) * Math.max(0, -pz + 0.3)
  px += Math.sign(px) * temporalBulge * sideStrength

  // Occipital bulge (back)
  if (pz < -0.3) {
    const occipitalBulge = 0.1 * Math.max(0, (-pz - 0.3)) * (1 - py * py)
    pz -= occipitalBulge
  }

  // Cerebellum (back bottom)
  if (pz < -0.2 && py < 0) {
    const cerebellumBulge = 0.15 * Math.max(0, (-pz - 0.2)) * Math.max(0, (-py - 0.2))
    pz -= cerebellumBulge * 0.5
    py -= cerebellumBulge
  }

  // Flatten bottom
  if (py < -0.7) {
    py = -0.7 - (py + 0.7) * 0.3
  }

  return [px, py, pz]
}

// Generate position on brain with region-based distribution
function generatePosition(region: string): [number, number, number] {
  const theta = Math.random() * Math.PI * 2
  let phi = Math.acos(2 * Math.random() - 1)

  switch (region) {
    case 'frontal':
      phi = Math.random() * Math.PI * 0.4
      break
    case 'parietal':
      phi = Math.PI * 0.2 + Math.random() * Math.PI * 0.35
      break
    case 'temporal':
      phi = Math.PI * 0.35 + Math.random() * Math.PI * 0.35
      break
    case 'occipital':
      phi = Math.PI * 0.3 + Math.random() * Math.PI * 0.35
      break
    case 'cerebellum':
      phi = Math.PI * 0.65 + Math.random() * Math.PI * 0.25
      break
    case 'brainstem':
      phi = Math.PI * 0.8 + Math.random() * Math.PI * 0.15
      break
  }

  let x = Math.sin(phi) * Math.cos(theta)
  let y = Math.cos(phi)
  let z = Math.sin(phi) * Math.sin(theta)

  if (region === 'frontal') z = Math.abs(z) * 0.8 + 0.2
  if (region === 'occipital') z = -Math.abs(z) * 0.8 - 0.2
  if (region === 'cerebellum') z = -Math.abs(z) * 0.6 - 0.3

  // Volume distribution: 0.4 to 1.0
  const radialVar = 0.4 + Math.sqrt(Math.random()) * 0.6
  x *= radialVar
  y *= radialVar
  z *= radialVar

  const [bx, by, bz] = applyBrainShape(x, y, z)

  const noise = 0.08
  return [
    bx + (Math.random() - 0.5) * noise,
    by + (Math.random() - 0.5) * noise,
    bz + (Math.random() - 0.5) * noise,
  ]
}

function selectRegion(): string {
  const rand = Math.random()
  let cumulative = 0
  for (let i = 0; i < REGIONS.length; i++) {
    cumulative += REGION_WEIGHTS[i]
    if (rand < cumulative) return REGIONS[i]
  }
  return REGIONS[0]
}

// Generate clusters for a specific LOD level
function generateClusters(count: number, wallets: string[], prefix: string) {
  const nodes: any[] = []
  const walletSynapseCounts = new Map<string, number>()
  const avgWeight = Math.floor(TOTAL_SYNAPSES / count)

  for (let i = 0; i < count; i++) {
    const region = selectRegion()
    const position = generatePosition(region)

    // Vary cluster weight (some bigger, some smaller)
    const clusterWeight = Math.floor(avgWeight * (0.3 + Math.random() * 1.4))

    // Assign to a random wallet
    const walletIndex = Math.floor(Math.pow(Math.random(), 1.5) * UNIQUE_WALLETS)
    const wallet = wallets[walletIndex]
    const shortWallet = wallet.slice(0, 6) + '...' + wallet.slice(-4)

    walletSynapseCounts.set(wallet, (walletSynapseCounts.get(wallet) || 0) + clusterWeight)

    nodes.push({
      id: `${prefix}_${region}_${String(i).padStart(5, '0')}`,
      region_id: region,
      position_x: position[0],
      position_y: position[1],
      position_z: position[2],
      state: 'connected',
      connected_by_user_id: shortWallet,
      connected_by_wallet: wallet,
      connected_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      base_reward_points: 100 + Math.floor(Math.random() * 100),
      cluster_weight: clusterWeight,
      synapse_count: clusterWeight,
    })
  }

  return { nodes, walletSynapseCounts }
}

// Generate connections for clusters
function generateConnections(nodes: any[], maxConnections: number, maxDistance: number) {
  const connections: any[] = []

  // Build spatial index
  const GRID_SIZE = 0.15
  const spatialIndex = new Map<string, number[]>()

  nodes.forEach((node, idx) => {
    const gx = Math.floor(node.position_x / GRID_SIZE)
    const gy = Math.floor(node.position_y / GRID_SIZE)
    const gz = Math.floor(node.position_z / GRID_SIZE)
    const key = `${gx},${gy},${gz}`
    if (!spatialIndex.has(key)) spatialIndex.set(key, [])
    spatialIndex.get(key)!.push(idx)
  })

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const gx = Math.floor(node.position_x / GRID_SIZE)
    const gy = Math.floor(node.position_y / GRID_SIZE)
    const gz = Math.floor(node.position_z / GRID_SIZE)

    const nearby: { idx: number; dist: number }[] = []

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${gx + dx},${gy + dy},${gz + dz}`
          const indices = spatialIndex.get(key)
          if (!indices) continue

          for (const j of indices) {
            if (j <= i) continue
            const other = nodes[j]
            const dist = Math.sqrt(
              Math.pow(node.position_x - other.position_x, 2) +
              Math.pow(node.position_y - other.position_y, 2) +
              Math.pow(node.position_z - other.position_z, 2)
            )
            if (dist < maxDistance) {
              nearby.push({ idx: j, dist })
            }
          }
        }
      }
    }

    nearby.sort((a, b) => a.dist - b.dist)
    const toConnect = nearby.slice(0, maxConnections)

    for (const { idx: j } of toConnect) {
      connections.push({
        id: connections.length,
        from_node_id: node.id,
        to_node_id: nodes[j].id,
        strength: 0.5 + Math.random() * 0.5,
        created_at: new Date().toISOString(),
      })
    }
  }

  return connections
}

console.log('Generating 200 million synapses with HIERARCHICAL clustering...')
console.log(`LOD 0: ${LOD_CONFIG.lod0.clusters} ${LOD_CONFIG.lod0.label}`)
console.log(`LOD 1: ${LOD_CONFIG.lod1.clusters} ${LOD_CONFIG.lod1.label}`)
console.log(`LOD 2: ${LOD_CONFIG.lod2.clusters} ${LOD_CONFIG.lod2.label}`)
console.log(`Unique wallets: ${UNIQUE_WALLETS.toLocaleString()}`)

// Generate wallets
console.log('\nGenerating wallets...')
const wallets: string[] = []
for (let i = 0; i < UNIQUE_WALLETS; i++) {
  wallets.push(generateWallet())
  if (i % 50000 === 0) console.log(`  ${i.toLocaleString()} wallets...`)
}
console.log(`  ${wallets.length.toLocaleString()} wallets generated`)

// Generate clusters for each LOD level
console.log('\nGenerating LOD 0 (super-clusters for far view)...')
const lod0 = generateClusters(LOD_CONFIG.lod0.clusters, wallets, 'lod0')
console.log(`  ${lod0.nodes.length} super-clusters generated`)

console.log('\nGenerating LOD 1 (medium clusters)...')
const lod1 = generateClusters(LOD_CONFIG.lod1.clusters, wallets, 'lod1')
console.log(`  ${lod1.nodes.length} clusters generated`)

console.log('\nGenerating LOD 2 (detailed clusters for close view)...')
const lod2 = generateClusters(LOD_CONFIG.lod2.clusters, wallets, 'lod2')
console.log(`  ${lod2.nodes.length} detailed clusters generated`)

// Calculate totals
const totalSynapses =
  lod0.nodes.reduce((sum, n) => sum + n.cluster_weight, 0) +
  lod1.nodes.reduce((sum, n) => sum + n.cluster_weight, 0) +
  lod2.nodes.reduce((sum, n) => sum + n.cluster_weight, 0)
console.log(`\nTotal synapses represented (across all LODs): ${totalSynapses.toLocaleString()}`)

// Generate connections for ALL LOD levels
console.log('\nGenerating connections for LOD 0 (super-clusters)...')
const connectionsLod0 = generateConnections(lod0.nodes, 8, 0.6) // More connections, larger radius
console.log(`  ${connectionsLod0.length.toLocaleString()} connections generated`)

console.log('\nGenerating connections for LOD 1...')
const connectionsLod1 = generateConnections(lod1.nodes, 6, 0.4)
console.log(`  ${connectionsLod1.length.toLocaleString()} connections generated`)

console.log('\nGenerating connections for LOD 2 (detailed)...')
const connectionsLod2 = generateConnections(lod2.nodes, 5, 0.25)
console.log(`  ${connectionsLod2.length.toLocaleString()} connections generated`)

// Merge wallet counts from LOD 2 (most accurate)
console.log('\nGenerating user data...')
const sortedWallets = Array.from(lod2.walletSynapseCounts.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 1000)

const users = sortedWallets.map(([wallet, count], idx) => ({
  id: `user_${idx}`,
  wallet_address: wallet,
  synapse_count: count,
  total_points: count * 150,
  created_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
}))

// Write files
const dataDir = path.join(__dirname, '..', 'src', 'data')

console.log('\nWriting files...')

// Write hierarchical synapse nodes
const hierarchicalNodes = {
  lod0: lod0.nodes,
  lod1: lod1.nodes,
  lod2: lod2.nodes,
}
fs.writeFileSync(
  path.join(dataDir, 'synapseNodes.json'),
  JSON.stringify(hierarchicalNodes, null, 2)
)
console.log('  synapseNodes.json written (hierarchical)')

// Write hierarchical connections
const hierarchicalConnections = {
  lod0: connectionsLod0,
  lod1: connectionsLod1,
  lod2: connectionsLod2,
}
fs.writeFileSync(
  path.join(dataDir, 'synapseConnections.json'),
  JSON.stringify(hierarchicalConnections, null, 2)
)
console.log('  synapseConnections.json written (hierarchical)')

fs.writeFileSync(
  path.join(dataDir, 'users.json'),
  JSON.stringify(users, null, 2)
)
console.log('  users.json written')

// Write stats
const stats = {
  totalSynapses: TOTAL_SYNAPSES,
  lod0Clusters: LOD_CONFIG.lod0.clusters,
  lod1Clusters: LOD_CONFIG.lod1.clusters,
  lod2Clusters: LOD_CONFIG.lod2.clusters,
  uniqueWallets: UNIQUE_WALLETS,
  lod0Connections: connectionsLod0.length,
  lod1Connections: connectionsLod1.length,
  lod2Connections: connectionsLod2.length,
  generatedAt: new Date().toISOString(),
}

fs.writeFileSync(
  path.join(dataDir, 'stats.json'),
  JSON.stringify(stats, null, 2)
)
console.log('  stats.json written')

console.log('\n✓ Generation complete!')
console.log(`  LOD 0: ${LOD_CONFIG.lod0.clusters} super-clusters, ${connectionsLod0.length} connections`)
console.log(`  LOD 1: ${LOD_CONFIG.lod1.clusters} clusters, ${connectionsLod1.length} connections`)
console.log(`  LOD 2: ${LOD_CONFIG.lod2.clusters} detailed clusters, ${connectionsLod2.length} connections`)
