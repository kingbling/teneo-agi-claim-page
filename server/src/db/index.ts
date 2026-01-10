import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { v4 as uuid } from 'uuid'
import type { Agent, Space, AgentCluster, SpaceCluster, User, AgentTrait, AgentState, SpaceState } from '../types/index.js'
import { runMigrations } from './migrations.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Database path from environment
const DB_PATH = process.env.DATABASE_PATH

if (!DB_PATH) {
  throw new Error('DATABASE_PATH environment variable is not set')
}

// Create database connection
export const db: DatabaseType = new Database(DB_PATH)

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

// Initialize database schema
export function initializeDatabase() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  db.exec(schema)
  console.log('Database initialized at:', DB_PATH)

  // Run any pending migrations
  runMigrations(db)
}

// Check if database needs seeding (call after initializeDatabase)
export async function ensureDatabaseSeeded() {
  const spaceCount = (db.prepare('SELECT COUNT(*) as count FROM spaces').get() as { count: number }).count

  if (spaceCount === 0) {
    console.log('No spaces found in database, generating...')
    const { generateSpaces, generateSpaceClusters } = await import('./generateSpaces.js')
    generateSpaces()
    generateSpaceClusters()
    console.log('Space generation complete')
  } else {
    console.log(`Database has ${spaceCount.toLocaleString()} spaces`)

    // Check if clusters exist, regenerate if not
    const clusterCount = (db.prepare('SELECT COUNT(*) as count FROM space_clusters').get() as { count: number }).count
    if (clusterCount === 0) {
      console.log('No space clusters found, recomputing...')
      recomputeSpaceClusters()
      console.log('Space clusters computed')
    } else {
      console.log(`Database has ${clusterCount.toLocaleString()} space clusters`)
    }
  }
}

// ============ SPACE OPERATIONS ============

export function getSpace(id: string): Space | null {
  const row = db.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as any
  if (!row) return null
  return rowToSpace(row)
}

export function getSpacesByRegion(region: string): Space[] {
  const rows = db.prepare('SELECT * FROM spaces WHERE region = ?').all(region) as any[]
  return rows.map(rowToSpace)
}

export function getSpacesByState(state: SpaceState): Space[] {
  const rows = db.prepare('SELECT * FROM spaces WHERE state = ?').all(state) as any[]
  return rows.map(rowToSpace)
}

export function updateSpace(space: Partial<Space> & { id: string }) {
  const updates: string[] = []
  const values: any[] = []

  if (space.state !== undefined) { updates.push('state = ?'); values.push(space.state) }
  if (space.solveProgress !== undefined) { updates.push('solve_progress = ?'); values.push(space.solveProgress) }
  if (space.discoveredAt !== undefined) { updates.push('discovered_at = ?'); values.push(space.discoveredAt) }

  if (updates.length > 0) {
    values.push(space.id)
    db.prepare(`UPDATE spaces SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }
}

export function getSpaceSolvers(spaceId: string): string[] {
  const rows = db.prepare('SELECT agent_id FROM space_solvers WHERE space_id = ?').all(spaceId) as any[]
  return rows.map(r => r.agent_id)
}

export function addSpaceSolver(spaceId: string, agentId: string) {
  db.prepare('INSERT OR IGNORE INTO space_solvers (space_id, agent_id, started_at) VALUES (?, ?, ?)').run(spaceId, agentId, Date.now())
}

export function removeSpaceSolver(spaceId: string, agentId: string) {
  db.prepare('DELETE FROM space_solvers WHERE space_id = ? AND agent_id = ?').run(spaceId, agentId)
}

export function clearSpaceSolvers(spaceId: string) {
  db.prepare('DELETE FROM space_solvers WHERE space_id = ?').run(spaceId)
}

function rowToSpace(row: any): Space {
  return {
    id: row.id,
    positionX: row.position_x,
    positionY: row.position_y,
    positionZ: row.position_z,
    region: row.region,
    zone: row.zone,
    synapseCount: row.synapse_count,
    baseProbability: row.base_probability,
    state: row.state as SpaceState,
    solveProgress: row.solve_progress,
    lootPool: row.loot_pool,
    discoveredAt: row.discovered_at,
  }
}

// Find the nearest undiscovered space within a radius
export function findNearestUndiscoveredSpace(
  x: number, y: number, z: number,
  maxRadius: number
): Space | null {
  // Query spaces within a bounding box first (for efficiency), then filter by actual distance
  const rows = db.prepare(`
    SELECT * FROM spaces
    WHERE state = 'undiscovered'
      AND position_x BETWEEN ? AND ?
      AND position_y BETWEEN ? AND ?
      AND position_z BETWEEN ? AND ?
    LIMIT 100
  `).all(
    x - maxRadius, x + maxRadius,
    y - maxRadius, y + maxRadius,
    z - maxRadius, z + maxRadius
  ) as any[]

  let nearest: Space | null = null
  let nearestDist = Infinity

  for (const row of rows) {
    const dx = row.position_x - x
    const dy = row.position_y - y
    const dz = row.position_z - z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist < nearestDist && dist <= maxRadius) {
      nearestDist = dist
      nearest = rowToSpace(row)
    }
  }

  return nearest
}

// ============ AGENT OPERATIONS ============

export function getAgent(id: string): Agent | null {
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any
  if (!row) return null
  return rowToAgent(row)
}

export function getAgentsByOwner(ownerId: string): Agent[] {
  const rows = db.prepare('SELECT * FROM agents WHERE owner_id = ?').all(ownerId) as any[]
  return rows.map(rowToAgent)
}

export function getAgentsByState(state: AgentState): Agent[] {
  const rows = db.prepare('SELECT * FROM agents WHERE state = ?').all(state) as any[]
  return rows.map(rowToAgent)
}

export function getActiveAgents(): Agent[] {
  const rows = db.prepare("SELECT * FROM agents WHERE state IN ('searching', 'traveling', 'solving')").all() as any[]
  return rows.map(rowToAgent)
}

export function createAgent(agent: Agent) {
  db.prepare(`
    INSERT INTO agents (
      id, owner_id, name, state, position_x, position_y, position_z,
      home_x, home_y, home_z, target_x, target_y, target_z,
      start_position_x, start_position_y, start_position_z,
      wander_dir_x, wander_dir_y, wander_dir_z, wander_phase,
      target_space_id, current_space_id, solve_start_time,
      travel_start_time, travel_duration,
      points_balance, points_burn_rate, traits, spaces_discovered,
      total_loot, total_points_burned, distance_traveled, created_at, deployed_at,
      creation_cost, needs_repair
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agent.id, agent.ownerId, agent.name, agent.state,
    agent.positionX, agent.positionY, agent.positionZ,
    agent.homeX ?? 0, agent.homeY ?? 0, agent.homeZ ?? 0,
    agent.targetX, agent.targetY, agent.targetZ,
    agent.startPositionX, agent.startPositionY, agent.startPositionZ,
    agent.wanderDirX, agent.wanderDirY, agent.wanderDirZ, agent.wanderPhase,
    agent.targetSpaceId, agent.currentSpaceId, agent.solveStartTime,
    agent.travelStartTime, agent.travelDuration,
    agent.pointsBalance, agent.pointsBurnRate, JSON.stringify(agent.traits),
    agent.spacesDiscovered, agent.totalLoot, agent.totalPointsBurned,
    agent.distanceTraveled ?? 0, agent.createdAt, agent.deployedAt,
    agent.creationCost ?? 100, agent.needsRepair ? 1 : 0
  )
}

export function updateAgent(agent: Partial<Agent> & { id: string }) {
  const updates: string[] = []
  const values: any[] = []

  if (agent.state !== undefined) { updates.push('state = ?'); values.push(agent.state) }
  if (agent.positionX !== undefined) { updates.push('position_x = ?'); values.push(agent.positionX) }
  if (agent.positionY !== undefined) { updates.push('position_y = ?'); values.push(agent.positionY) }
  if (agent.positionZ !== undefined) { updates.push('position_z = ?'); values.push(agent.positionZ) }
  if (agent.homeX !== undefined) { updates.push('home_x = ?'); values.push(agent.homeX) }
  if (agent.homeY !== undefined) { updates.push('home_y = ?'); values.push(agent.homeY) }
  if (agent.homeZ !== undefined) { updates.push('home_z = ?'); values.push(agent.homeZ) }
  if (agent.targetX !== undefined) { updates.push('target_x = ?'); values.push(agent.targetX) }
  if (agent.targetY !== undefined) { updates.push('target_y = ?'); values.push(agent.targetY) }
  if (agent.targetZ !== undefined) { updates.push('target_z = ?'); values.push(agent.targetZ) }
  if (agent.startPositionX !== undefined) { updates.push('start_position_x = ?'); values.push(agent.startPositionX) }
  if (agent.startPositionY !== undefined) { updates.push('start_position_y = ?'); values.push(agent.startPositionY) }
  if (agent.startPositionZ !== undefined) { updates.push('start_position_z = ?'); values.push(agent.startPositionZ) }
  if (agent.wanderDirX !== undefined) { updates.push('wander_dir_x = ?'); values.push(agent.wanderDirX) }
  if (agent.wanderDirY !== undefined) { updates.push('wander_dir_y = ?'); values.push(agent.wanderDirY) }
  if (agent.wanderDirZ !== undefined) { updates.push('wander_dir_z = ?'); values.push(agent.wanderDirZ) }
  if (agent.wanderPhase !== undefined) { updates.push('wander_phase = ?'); values.push(agent.wanderPhase) }
  if (agent.targetSpaceId !== undefined) { updates.push('target_space_id = ?'); values.push(agent.targetSpaceId) }
  if (agent.currentSpaceId !== undefined) { updates.push('current_space_id = ?'); values.push(agent.currentSpaceId) }
  if (agent.solveStartTime !== undefined) { updates.push('solve_start_time = ?'); values.push(agent.solveStartTime) }
  if (agent.travelStartTime !== undefined) { updates.push('travel_start_time = ?'); values.push(agent.travelStartTime) }
  if (agent.travelDuration !== undefined) { updates.push('travel_duration = ?'); values.push(agent.travelDuration) }
  if (agent.pointsBalance !== undefined) { updates.push('points_balance = ?'); values.push(agent.pointsBalance) }
  if (agent.spacesDiscovered !== undefined) { updates.push('spaces_discovered = ?'); values.push(agent.spacesDiscovered) }
  if (agent.totalLoot !== undefined) { updates.push('total_loot = ?'); values.push(agent.totalLoot) }
  if (agent.totalPointsBurned !== undefined) { updates.push('total_points_burned = ?'); values.push(agent.totalPointsBurned) }
  if (agent.distanceTraveled !== undefined) { updates.push('distance_traveled = ?'); values.push(agent.distanceTraveled) }
  if (agent.deployedAt !== undefined) { updates.push('deployed_at = ?'); values.push(agent.deployedAt) }
  if (agent.creationCost !== undefined) { updates.push('creation_cost = ?'); values.push(agent.creationCost) }
  if (agent.needsRepair !== undefined) { updates.push('needs_repair = ?'); values.push(agent.needsRepair ? 1 : 0) }

  if (updates.length > 0) {
    values.push(agent.id)
    db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }
}

export function batchUpdateAgents(agents: (Partial<Agent> & { id: string })[]) {
  const update = db.transaction(() => {
    for (const agent of agents) {
      updateAgent(agent)
    }
  })
  update()
}

function rowToAgent(row: any): Agent {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    state: row.state as AgentState,
    positionX: row.position_x,
    positionY: row.position_y,
    positionZ: row.position_z,
    homeX: row.home_x,
    homeY: row.home_y,
    homeZ: row.home_z,
    targetX: row.target_x,
    targetY: row.target_y,
    targetZ: row.target_z,
    startPositionX: row.start_position_x,
    startPositionY: row.start_position_y,
    startPositionZ: row.start_position_z,
    wanderDirX: row.wander_dir_x,
    wanderDirY: row.wander_dir_y,
    wanderDirZ: row.wander_dir_z,
    wanderPhase: row.wander_phase,
    targetSpaceId: row.target_space_id,
    currentSpaceId: row.current_space_id,
    solveStartTime: row.solve_start_time,
    travelStartTime: row.travel_start_time,
    travelDuration: row.travel_duration,
    pointsBalance: row.points_balance,
    pointsBurnRate: row.points_burn_rate,
    traits: JSON.parse(row.traits) as AgentTrait[],
    spacesDiscovered: row.spaces_discovered,
    totalLoot: row.total_loot,
    totalPointsBurned: row.total_points_burned,
    distanceTraveled: row.distance_traveled,
    createdAt: row.created_at,
    deployedAt: row.deployed_at,
    creationCost: row.creation_cost,
    needsRepair: row.needs_repair === 1,
    tranceActive: row.trance_active === 1,
    tranceEndTime: row.trance_end_time,
    tranceLevel: row.trance_level,
  }
}

// ============ USER OPERATIONS ============

export function getUser(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
  if (!row) return null
  return rowToUser(row)
}

export function getUserByWallet(wallet: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE wallet = ?').get(wallet) as any
  if (!row) return null
  return rowToUser(row)
}

export function createUser(user: User) {
  db.prepare(`
    INSERT INTO users (id, wallet, tier, staked_amount, points, total_loot_earned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, user.wallet, user.tier, user.stakedAmount, user.points, user.totalLootEarned, user.createdAt)
}

export function updateUser(user: Partial<User> & { id: string }) {
  const updates: string[] = []
  const values: any[] = []

  if (user.points !== undefined) { updates.push('points = ?'); values.push(user.points) }
  if (user.totalLootEarned !== undefined) { updates.push('total_loot_earned = ?'); values.push(user.totalLootEarned) }
  if (user.tier !== undefined) { updates.push('tier = ?'); values.push(user.tier) }
  if (user.stakedAmount !== undefined) { updates.push('staked_amount = ?'); values.push(user.stakedAmount) }

  if (updates.length > 0) {
    values.push(user.id)
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    wallet: row.wallet,
    tier: row.tier,
    stakedAmount: row.staked_amount,
    points: row.points,
    totalLootEarned: row.total_loot_earned,
    createdAt: row.created_at,
  }
}

// ============ CLUSTER OPERATIONS ============

export function getAgentClusters(lodLevel: number): AgentCluster[] {
  const rows = db.prepare('SELECT * FROM agent_clusters WHERE lod_level = ?').all(lodLevel) as any[]
  return rows.map(rowToAgentCluster)
}

export function getSpaceClusters(lodLevel: number): SpaceCluster[] {
  const rows = db.prepare('SELECT * FROM space_clusters WHERE lod_level = ?').all(lodLevel) as any[]
  return rows.map(rowToSpaceCluster)
}

function rowToAgentCluster(row: any): AgentCluster {
  return {
    id: row.id,
    lodLevel: row.lod_level,
    positionX: row.position_x,
    positionY: row.position_y,
    positionZ: row.position_z,
    agentCount: row.agent_count,
    dominantState: row.dominant_state as AgentState,
    avgProgress: row.avg_progress,
    updatedAt: row.updated_at,
  }
}

function rowToSpaceCluster(row: any): SpaceCluster {
  return {
    id: row.id,
    lodLevel: row.lod_level,
    positionX: row.position_x,
    positionY: row.position_y,
    positionZ: row.position_z,
    spaceCount: row.space_count,
    discoveredCount: row.discovered_count,
    beingSolvedCount: row.being_solved_count,
    avgLootPool: row.avg_loot_pool,
    updatedAt: row.updated_at,
  }
}

// ============ SIMULATION STATE ============

export function getSimulationState() {
  return db.prepare('SELECT * FROM simulation_state WHERE id = 1').get() as {
    tick_count: number
    last_tick_at: number
    is_running: number
  }
}

export function updateSimulationState(tickCount: number) {
  db.prepare('UPDATE simulation_state SET tick_count = ?, last_tick_at = ? WHERE id = 1').run(tickCount, Date.now())
}

// ============ STATS ============

export function getDiscoveryStats() {
  const total = (db.prepare('SELECT COUNT(*) as count FROM spaces').get() as any).count
  const discovered = (db.prepare("SELECT COUNT(*) as count FROM spaces WHERE state = 'discovered'").get() as any).count
  const beingSolved = (db.prepare("SELECT COUNT(*) as count FROM spaces WHERE state = 'being_solved'").get() as any).count

  return { total, discovered, beingSolved }
}

export function getAgentCount() {
  return (db.prepare('SELECT COUNT(*) as count FROM agents').get() as any).count
}

// ============ CLUSTER RECOMPUTATION ============

export function recomputeSpaceClusters() {
  // LOD levels: 0 = 500 clusters, 1 = 3000 clusters, 2 = 15000 clusters
  const lodConfig = [
    { level: 0, gridSize: Math.cbrt(500) },
    { level: 1, gridSize: Math.cbrt(3000) },
    { level: 2, gridSize: Math.cbrt(15000) },
  ]

  const cellSize = 3  // Brain spans roughly -1.5 to 1.5

  for (const lod of lodConfig) {
    const gridCellSize = cellSize / lod.gridSize
    const clusters = new Map<string, {
      positions: [number, number, number][]
      spaceCount: number
      discoveredCount: number
      beingSolvedCount: number
      totalLoot: number
    }>()

    const spaces = db.prepare('SELECT position_x, position_y, position_z, state, loot_pool FROM spaces').all() as any[]

    for (const space of spaces) {
      const gx = Math.floor((space.position_x + 1.5) / gridCellSize)
      const gy = Math.floor((space.position_y + 1.5) / gridCellSize)
      const gz = Math.floor((space.position_z + 1.5) / gridCellSize)
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

    // Clear and reinsert clusters for this LOD
    db.prepare('DELETE FROM space_clusters WHERE lod_level = ?').run(lod.level)

    const insertStmt = db.prepare(`
      INSERT INTO space_clusters (
        id, lod_level, position_x, position_y, position_z,
        space_count, discovered_count, being_solved_count, avg_loot_pool, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = Date.now()
    for (const [, data] of clusters) {
      const cx = data.positions.reduce((s, p) => s + p[0], 0) / data.positions.length
      const cy = data.positions.reduce((s, p) => s + p[1], 0) / data.positions.length
      const cz = data.positions.reduce((s, p) => s + p[2], 0) / data.positions.length
      const avgLoot = data.totalLoot / data.spaceCount

      insertStmt.run(
        uuid(), lod.level, cx, cy, cz,
        data.spaceCount, data.discoveredCount, data.beingSolvedCount,
        avgLoot, now
      )
    }
  }
}

export function recomputeAgentClusters() {
  const lodConfig = [
    { level: 0, gridSize: Math.cbrt(500) },
    { level: 1, gridSize: Math.cbrt(3000) },
    { level: 2, gridSize: Math.cbrt(15000) },
  ]

  const cellSize = 3

  for (const lod of lodConfig) {
    const gridCellSize = cellSize / lod.gridSize
    const clusters = new Map<string, {
      positions: [number, number, number][]
      agentCount: number
      states: AgentState[]
    }>()

    const agents = db.prepare('SELECT position_x, position_y, position_z, state FROM agents').all() as any[]

    for (const agent of agents) {
      const gx = Math.floor((agent.position_x + 1.5) / gridCellSize)
      const gy = Math.floor((agent.position_y + 1.5) / gridCellSize)
      const gz = Math.floor((agent.position_z + 1.5) / gridCellSize)
      const key = `${gx},${gy},${gz}`

      if (!clusters.has(key)) {
        clusters.set(key, {
          positions: [],
          agentCount: 0,
          states: [],
        })
      }

      const cluster = clusters.get(key)!
      cluster.positions.push([agent.position_x, agent.position_y, agent.position_z])
      cluster.agentCount++
      cluster.states.push(agent.state)
    }

    // Clear and reinsert
    db.prepare('DELETE FROM agent_clusters WHERE lod_level = ?').run(lod.level)

    const insertStmt = db.prepare(`
      INSERT INTO agent_clusters (
        id, lod_level, position_x, position_y, position_z,
        agent_count, dominant_state, avg_progress, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = Date.now()
    for (const [, data] of clusters) {
      const cx = data.positions.reduce((s, p) => s + p[0], 0) / data.positions.length
      const cy = data.positions.reduce((s, p) => s + p[1], 0) / data.positions.length
      const cz = data.positions.reduce((s, p) => s + p[2], 0) / data.positions.length

      // Find dominant state
      const stateCounts: Record<AgentState, number> = {
        idle: 0, searching: 0, traveling: 0, solving: 0, returning: 0
      }
      for (const state of data.states) {
        if (state in stateCounts) {
          stateCounts[state as AgentState]++
        }
      }
      const dominantState = Object.entries(stateCounts)
        .sort((a, b) => b[1] - a[1])[0][0] as AgentState

      insertStmt.run(
        uuid(), lod.level, cx, cy, cz,
        data.agentCount, dominantState, 0, now
      )
    }
  }
}
