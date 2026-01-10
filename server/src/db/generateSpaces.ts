/**
 * Generate 1M+ spaces with hierarchical LOD clustering
 * Run with: npx tsx src/db/generateSpaces.ts
 */

import { v4 as uuid } from 'uuid'
import { db, initializeDatabase } from './index.js'
import type { BrainRegion } from '../types/index.js'

// Configuration
const TOTAL_SPACES = 100_000  // Start with 100K, can scale to 1M
const TOTAL_SYNAPSES = 500_000_000_000_000  // 500 trillion

const REGIONS: BrainRegion[] = ['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum', 'brainstem']
const REGION_WEIGHTS = [0.25, 0.20, 0.20, 0.15, 0.12, 0.08]

// LOD levels for clustering
const LOD_CONFIG = {
  lod0: { clusters: 500, label: 'zone-level (far)' },
  lod1: { clusters: 3000, label: 'medium clusters' },
  lod2: { clusters: 15000, label: 'detailed clusters' },
}

// Perlin-like noise for organic distribution
function noise3D(x: number, y: number, z: number, scale: number = 1): number {
  const nx = Math.sin(x * scale * 12.9898 + y * scale * 78.233) * 43758.5453
  const ny = Math.sin(y * scale * 12.9898 + z * scale * 78.233) * 43758.5453
  const nz = Math.sin(z * scale * 12.9898 + x * scale * 78.233) * 43758.5453
  return (Math.sin(nx + ny + nz) + 1) / 2
}

// Brain shape morphology (matches client-side)
function applyBrainShape(x: number, y: number, z: number): [number, number, number] {
  let nx = x, ny = y, nz = z

  // Longitudinal fissure (center groove)
  const centerDist = Math.abs(nx)
  if (centerDist < 0.15 && ny > 0) {
    ny -= (0.15 - centerDist) * 0.3
  }

  // Frontal lobe bulge
  if (nz > 0.3 && ny > -0.2) {
    nz *= 1.1
    ny += 0.05
  }

  // Temporal lobe bulges (sides)
  if (Math.abs(nx) > 0.4 && ny < 0.2) {
    nx *= 1.15
  }

  // Occipital bulge (back)
  if (nz < -0.5) {
    nz *= 1.1
  }

  // Cerebellum bulge (back-bottom)
  if (nz < -0.3 && ny < -0.3) {
    nz *= 1.2
    ny -= 0.1
  }

  return [nx, ny, nz]
}

// Get region for position
function getRegionForPosition(x: number, y: number, z: number): BrainRegion {
  // Simple region assignment based on position
  if (z > 0.3) return 'frontal'
  if (z < -0.4 && y < -0.2) return 'cerebellum'
  if (z < -0.3) return 'occipital'
  if (y < -0.4) return 'brainstem'
  if (Math.abs(x) > 0.4) return 'temporal'
  return 'parietal'
}

// Generate zone name
function getZoneName(region: BrainRegion, index: number): string {
  const prefixes: Record<BrainRegion, string> = {
    frontal: 'F',
    parietal: 'P',
    temporal: 'T',
    occipital: 'O',
    cerebellum: 'C',
    brainstem: 'B',
  }
  return `${prefixes[region]}-${String(index).padStart(3, '0')}`
}

// Generate spaces
function generateSpaces() {
  console.log(`Generating ${TOTAL_SPACES.toLocaleString()} spaces...`)
  console.log(`Representing ${TOTAL_SYNAPSES.toLocaleString()} synapses`)

  const synapsesPerSpace = Math.floor(TOTAL_SYNAPSES / TOTAL_SPACES)
  const zoneCounts: Record<BrainRegion, number> = {
    frontal: 0, parietal: 0, temporal: 0,
    occipital: 0, cerebellum: 0, brainstem: 0,
  }

  const insertStmt = db.prepare(`
    INSERT INTO spaces (
      id, position_x, position_y, position_z, region, zone,
      synapse_count, base_probability, state, solve_progress, loot_pool
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'undiscovered', 0, ?)
  `)

  const insertMany = db.transaction((spaces: any[]) => {
    for (const space of spaces) {
      insertStmt.run(...space)
    }
  })

  const batchSize = 10000
  let batch: any[] = []
  let generated = 0

  for (let i = 0; i < TOTAL_SPACES; i++) {
    // Generate position with uniform volume distribution
    // Using cube root for proper volumetric distribution (not just surface)
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    // Cube root gives uniform distribution throughout volume
    // Mix: 70% volume-distributed, 30% weighted toward surface (for brain density)
    const volumeR = Math.cbrt(Math.random())  // 0 to 1, uniform in volume
    const surfaceR = 0.6 + Math.random() * 0.4  // 0.6 to 1.0, surface shell
    const r = Math.random() < 0.7 ? volumeR : surfaceR

    let x = r * Math.sin(phi) * Math.cos(theta)
    let y = r * Math.sin(phi) * Math.sin(theta)
    let z = r * Math.cos(phi)

    // Apply brain shape
    ;[x, y, z] = applyBrainShape(x, y, z)

    // Add noise for organic distribution
    const noiseVal = noise3D(x, y, z, 3)
    x += (noiseVal - 0.5) * 0.1
    y += (noiseVal - 0.5) * 0.1
    z += (noiseVal - 0.5) * 0.1

    // Scale to brain dimensions
    x *= 1.3
    y *= 1.0
    z *= 1.1

    // Determine region and zone
    const region = getRegionForPosition(x, y, z)
    zoneCounts[region]++
    const zone = getZoneName(region, Math.floor(zoneCounts[region] / 100))

    // Synapse count with variance
    const variance = 0.5 + Math.random() * 1.0  // 50% to 150%
    const synapseCount = Math.floor(synapsesPerSpace * variance)

    // Base probability (harder spaces have lower probability)
    const baseProbability = 0.001 + Math.random() * 0.009  // 0.1% to 1%

    // Loot pool based on synapse count (1 AGI per 1B synapses)
    const lootPool = Math.floor(synapseCount / 1_000_000_000)

    batch.push([
      uuid(),
      x, y, z,
      region,
      zone,
      synapseCount,
      baseProbability,
      Math.max(1, lootPool),  // Minimum 1 loot
    ])

    if (batch.length >= batchSize) {
      insertMany(batch)
      generated += batch.length
      console.log(`  ${generated.toLocaleString()} spaces generated...`)
      batch = []
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    insertMany(batch)
    generated += batch.length
  }

  console.log(`\nGenerated ${generated.toLocaleString()} spaces`)
  console.log('\nRegion distribution:')
  for (const [region, count] of Object.entries(zoneCounts)) {
    console.log(`  ${region}: ${count.toLocaleString()} spaces`)
  }
}

// Generate space clusters for LOD
function generateSpaceClusters() {
  console.log('\nGenerating space clusters for LOD...')

  for (const [lodKey, config] of Object.entries(LOD_CONFIG)) {
    const lodLevel = parseInt(lodKey.replace('lod', ''))
    console.log(`\n${config.label} (LOD ${lodLevel}): ${config.clusters} clusters`)

    // Clear existing clusters for this LOD
    db.prepare('DELETE FROM space_clusters WHERE lod_level = ?').run(lodLevel)

    // Simple grid-based clustering
    const gridSize = Math.cbrt(config.clusters)
    const cellSize = 3 / gridSize  // Brain spans roughly -1.5 to 1.5

    const clusters = new Map<string, {
      positions: [number, number, number][]
      spaceCount: number
      discoveredCount: number
      beingSolvedCount: number
      totalLoot: number
    }>()

    // Assign spaces to clusters
    const spaces = db.prepare('SELECT * FROM spaces').all() as any[]

    for (const space of spaces) {
      const gx = Math.floor((space.position_x + 1.5) / cellSize)
      const gy = Math.floor((space.position_y + 1.5) / cellSize)
      const gz = Math.floor((space.position_z + 1.5) / cellSize)
      const key = `${gx},${gy},${gz}`

      if (!clusters.has(key)) {
        clusters.set(key, {
          positions: [],
          spaceCount: 0,
          discoveredCount: 0,
          beingSolvedCount: 0,
          totalLoot: 0,
        })
      }

      const cluster = clusters.get(key)!
      cluster.positions.push([space.position_x, space.position_y, space.position_z])
      cluster.spaceCount++
      if (space.state === 'discovered') cluster.discoveredCount++
      if (space.state === 'being_solved') cluster.beingSolvedCount++
      cluster.totalLoot += space.loot_pool
    }

    // Insert clusters
    const insertStmt = db.prepare(`
      INSERT INTO space_clusters (
        id, lod_level, position_x, position_y, position_z,
        space_count, discovered_count, being_solved_count, avg_loot_pool, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = Date.now()
    for (const [key, data] of clusters) {
      // Calculate centroid
      const cx = data.positions.reduce((s, p) => s + p[0], 0) / data.positions.length
      const cy = data.positions.reduce((s, p) => s + p[1], 0) / data.positions.length
      const cz = data.positions.reduce((s, p) => s + p[2], 0) / data.positions.length
      const avgLoot = data.totalLoot / data.spaceCount

      insertStmt.run(
        uuid(), lodLevel, cx, cy, cz,
        data.spaceCount, data.discoveredCount, data.beingSolvedCount,
        avgLoot, now
      )
    }

    console.log(`  Created ${clusters.size} clusters`)
  }
}

// Seed some test agents
function seedTestAgents() {
  console.log('\nSeeding test agents...')

  // Create test users
  const testUsers = [
    { wallet: '0x1234...demo1', tier: 'gold' },
    { wallet: '0x5678...demo2', tier: 'platinum' },
    { wallet: '0x9abc...demo3', tier: 'diamond' },
  ]

  const userIds: string[] = []

  for (const user of testUsers) {
    const id = uuid()
    userIds.push(id)
    db.prepare(`
      INSERT OR IGNORE INTO users (id, wallet, tier, staked_amount, points, total_loot_earned, created_at)
      VALUES (?, ?, ?, 0, 10000, 0, ?)
    `).run(id, user.wallet, user.tier, Date.now())
  }

  // Create test agents
  const agentCount = 1000  // Start with 1K agents
  console.log(`  Creating ${agentCount} test agents...`)

  const insertStmt = db.prepare(`
    INSERT INTO agents (
      id, owner_id, name, state, position_x, position_y, position_z,
      start_position_x, start_position_y, start_position_z,
      target_space_id, travel_start_time, travel_duration,
      points_balance, points_burn_rate, traits, spaces_discovered,
      total_loot, total_points_burned, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const traitTypes = ['explorer', 'efficient', 'swift', 'lucky', 'collaborative']

  for (let i = 0; i < agentCount; i++) {
    const ownerId = userIds[i % userIds.length]
    const name = `Agent-${String(i).padStart(4, '0')}`

    // Random starting position near brain center
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 0.1 + Math.random() * 0.3
    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.sin(phi) * Math.sin(theta)
    const z = r * Math.cos(phi)

    // Random traits (1-3)
    const traitCount = 1 + Math.floor(Math.random() * 3)
    const traits = []
    const usedTypes = new Set<string>()
    for (let t = 0; t < traitCount; t++) {
      let type: string
      do {
        type = traitTypes[Math.floor(Math.random() * traitTypes.length)]
      } while (usedTypes.has(type))
      usedTypes.add(type)
      traits.push({ type, level: 1 + Math.floor(Math.random() * 3) })
    }

    insertStmt.run(
      uuid(), ownerId, name, 'idle',
      x, y, z,
      null, null, null,  // start_position_x/y/z
      null, null, null,  // target_space_id, travel_start_time, travel_duration
      500 + Math.random() * 500,  // 500-1000 starting points
      1.0,
      JSON.stringify(traits),
      0, 0, 0, Date.now()
    )
  }

  console.log(`  Created ${agentCount} test agents`)
}

// Main
async function main() {
  console.log('Initializing database...\n')
  initializeDatabase()

  // Clear existing data
  console.log('Clearing existing data...')
  db.prepare('DELETE FROM loot_distributions').run()
  db.prepare('DELETE FROM discovery_events').run()
  db.prepare('DELETE FROM space_solvers').run()
  db.prepare('DELETE FROM agents').run()
  db.prepare('DELETE FROM spaces').run()
  db.prepare('DELETE FROM space_clusters').run()
  db.prepare('DELETE FROM agent_clusters').run()
  db.prepare('DELETE FROM users').run()

  generateSpaces()
  generateSpaceClusters()
  seedTestAgents()

  console.log('\n✓ Database seeded successfully!')
}

// Export functions for use from other modules
export { generateSpaces, generateSpaceClusters, seedTestAgents }

// Only run main when executed directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  main().catch(console.error)
}
