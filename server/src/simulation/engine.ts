import {
  db,
  getActiveAgents,
  getAgent,
  getSpace,
  updateAgent,
  updateSpace,
  updateSimulationState,
  getSimulationState,
  batchUpdateAgents,
  recomputeSpaceClusters,
  recomputeAgentClusters,
  findNearestUndiscoveredSpace,
} from '../db/index.js'
import type { Agent, Space, AgentTrait, SpaceDiscovery, LootEvent, AgentUpdate } from '../types/index.js'
import { v4 as uuid } from 'uuid'
import {
  RATES,
  WORLD,
  TRAIT_EFFECTS,
  calculateBurnRate as configCalculateBurnRate,
  calculateTravelTime as configCalculateTravelTime,
  calculateSolveProbability as configCalculateSolveProbability,
  calculateLootShare as configCalculateLootShare,
  // V1 Masterplan: Single player, USDC-based level system
  SYNAPSE_CONFIG,
  USER_LEVEL_CONFIG,
  calculateFinalETA,
  calculateUserLevel,
  type SynapseType,
  type UserLevel,
} from '../config/gameConfig.js'

// Use configuration constants
const TICK_INTERVAL_MS = RATES.TICK_INTERVAL_MS
const BASE_BURN_RATE = RATES.BASE_BURN_RATE
const BASE_SPEED = RATES.BASE_SPEED
const SEARCH_SPEED = RATES.BASE_SEARCH_SPEED
const DETECTION_RADIUS = RATES.DETECTION_RADIUS
const WANDER_TURN_RATE = RATES.WANDER_TURN_RATE
const BRAIN_BOUNDS = { min: WORLD.BRAIN_BOUNDS_MIN, max: WORLD.BRAIN_BOUNDS_MAX }
// Ellipsoid scaling factors - must match synapse generation (generateSpaces.ts)
const BRAIN_ELLIPSOID = { x: 1.3, y: 1.0, z: 1.1 }

// Event emitter for broadcasting updates
type DiscoveryCallback = (event: SpaceDiscovery) => void
type LootCallback = (event: LootEvent) => void
type AgentUpdateCallback = (agents: Agent[]) => void

let discoveryCallback: DiscoveryCallback | null = null
let lootCallback: LootCallback | null = null
let agentUpdateCallback: AgentUpdateCallback | null = null

export function onSpaceDiscovered(callback: DiscoveryCallback) {
  discoveryCallback = callback
}

export function onLootDistributed(callback: LootCallback) {
  lootCallback = callback
}

export function onAgentsUpdated(callback: AgentUpdateCallback) {
  agentUpdateCallback = callback
}

// ============ MASTERPLAN 2026: EVENT CALLBACKS ============

export interface SynapseCompletionEvent {
  synapseId: string
  synapseType: SynapseType
  totalReward: number
  distribution: 'fair_share' | 'lottery'
  explorers: Array<{ userId: string; shipId: string; reward: number; isWinner?: boolean }>
  timestamp: number
}

export interface ExplorationProgressEvent {
  synapseId: string
  synapseType: SynapseType
  pointsAccumulated: number
  pointsRequired: number
  currentETAMinutes: number
  explorerCount: number
  timestamp: number
}

export interface UserLevelUpEvent {
  userId: string
  newLevel: UserLevel
  timestamp: number
}

type SynapseCompletionCallback = (event: SynapseCompletionEvent) => void
type ExplorationProgressCallback = (event: ExplorationProgressEvent) => void
type UserLevelUpCallback = (event: UserLevelUpEvent) => void

let synapseCompletionCallback: SynapseCompletionCallback | null = null
let explorationProgressCallback: ExplorationProgressCallback | null = null
let userLevelUpCallback: UserLevelUpCallback | null = null

export function onSynapseCompleted(callback: SynapseCompletionCallback) {
  synapseCompletionCallback = callback
}

export function onExplorationProgress(callback: ExplorationProgressCallback) {
  explorationProgressCallback = callback
}

export function onUserLevelUp(callback: UserLevelUpCallback) {
  userLevelUpCallback = callback
}

// ============ TRAIT CALCULATIONS ============

function getTraitBonus(traits: AgentTrait[], type: string): number {
  const trait = traits.find(t => t.type === type)
  return trait ? trait.level : 0
}

function calculateBurnRate(traits: AgentTrait[]): number {
  const efficientLevel = getTraitBonus(traits, 'efficient')
  return configCalculateBurnRate(efficientLevel)
}

function calculateTravelTime(distance: number, traits: AgentTrait[]): number {
  const swiftLevel = getTraitBonus(traits, 'swift')
  return configCalculateTravelTime(distance, swiftLevel)
}

function calculateSolveProbability(agent: Agent, _space: Space, solverCount: number): number {
  const explorerLevel = getTraitBonus(agent.traits, 'explorer')
  const collaborativeLevel = getTraitBonus(agent.traits, 'collaborative')

  // Use default probability (legacy system - now using points-based system)
  const defaultProbability = 0.01
  return configCalculateSolveProbability(
    defaultProbability,
    explorerLevel,
    collaborativeLevel,
    solverCount
  )
}

function calculateLootShare(baseLoot: number, traits: AgentTrait[], solverCount: number): number {
  const stakerLevel = getTraitBonus(traits, 'staker')
  const luckyLevel = getTraitBonus(traits, 'lucky')

  return configCalculateLootShare(baseLoot, stakerLevel, luckyLevel, solverCount)
}

// ============ POSITION CALCULATIONS ============

function distance(a: { positionX: number; positionY: number; positionZ: number },
                  b: { positionX: number; positionY: number; positionZ: number }): number {
  const dx = b.positionX - a.positionX
  const dy = b.positionY - a.positionY
  const dz = b.positionZ - a.positionZ
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function interpolatePosition(
  start: { positionX: number; positionY: number; positionZ: number },
  end: { positionX: number; positionY: number; positionZ: number },
  progress: number
): { positionX: number; positionY: number; positionZ: number } {
  const t = Math.max(0, Math.min(1, progress))
  return {
    positionX: start.positionX + (end.positionX - start.positionX) * t,
    positionY: start.positionY + (end.positionY - start.positionY) * t,
    positionZ: start.positionZ + (end.positionZ - start.positionZ) * t,
  }
}

// ============ ORGANIC WANDER MOVEMENT ============

// Generate a random normalized direction
function randomDirection(): { x: number; y: number; z: number } {
  // Use spherical coordinates for uniform distribution
  const theta = Math.random() * 2 * Math.PI
  const phi = Math.acos(2 * Math.random() - 1)
  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.sin(phi) * Math.sin(theta),
    z: Math.cos(phi),
  }
}

// Smoothly rotate direction with organic curves (Perlin-like wandering)
function updateWanderDirection(
  dirX: number, dirY: number, dirZ: number,
  phase: number, tickCount: number
): { dirX: number; dirY: number; dirZ: number } {
  // Use sine waves with different frequencies for organic movement
  const t = (tickCount + phase) * 0.1
  const turnX = Math.sin(t * 0.7) * Math.cos(t * 0.3) * WANDER_TURN_RATE
  const turnY = Math.sin(t * 0.5) * Math.cos(t * 0.8) * WANDER_TURN_RATE
  const turnZ = Math.sin(t * 0.9) * Math.cos(t * 0.4) * WANDER_TURN_RATE

  // Apply rotation
  let newDirX = dirX + turnX
  let newDirY = dirY + turnY
  let newDirZ = dirZ + turnZ

  // Normalize
  const len = Math.sqrt(newDirX * newDirX + newDirY * newDirY + newDirZ * newDirZ)
  if (len > 0.001) {
    newDirX /= len
    newDirY /= len
    newDirZ /= len
  }

  return { dirX: newDirX, dirY: newDirY, dirZ: newDirZ }
}

// Keep position within brain ELLIPSOID bounds with soft boundary (steer away from edges)
// Uses ellipsoid bounds to match the brain shape where synapses are generated
function applyBrainBounds(
  posX: number, posY: number, posZ: number,
  dirX: number, dirY: number, dirZ: number
): { dirX: number; dirY: number; dirZ: number } {
  const steerStrength = WORLD.BOUNDARY_STEER_STRENGTH

  // Normalize position to unit sphere using ellipsoid scaling
  const normX = posX / BRAIN_ELLIPSOID.x
  const normY = posY / BRAIN_ELLIPSOID.y
  const normZ = posZ / BRAIN_ELLIPSOID.z

  // Distance from center in normalized space (1.0 = on ellipsoid surface)
  const distFromCenter = Math.sqrt(normX * normX + normY * normY + normZ * normZ)

  // Start steering when past 80% of the ellipsoid radius (margin = 0.2)
  const boundaryThreshold = 1.0 - WORLD.BOUNDARY_MARGIN

  if (distFromCenter > boundaryThreshold) {
    // Calculate steering force toward center, scaled by how far past threshold
    const overshoot = (distFromCenter - boundaryThreshold) / WORLD.BOUNDARY_MARGIN
    const steerScale = Math.min(overshoot, 1.0) * steerStrength

    // Steer toward center (opposite of normalized position direction)
    let steerX = -normX * steerScale
    let steerY = -normY * steerScale
    let steerZ = -normZ * steerScale

    // Apply steering to direction
    let newDirX = dirX + steerX
    let newDirY = dirY + steerY
    let newDirZ = dirZ + steerZ

    // Normalize
    const len = Math.sqrt(newDirX * newDirX + newDirY * newDirY + newDirZ * newDirZ)
    if (len > 0.001) {
      newDirX /= len
      newDirY /= len
      newDirZ /= len
    }

    return { dirX: newDirX, dirY: newDirY, dirZ: newDirZ }
  }

  // Inside safe zone, no steering needed
  return { dirX, dirY, dirZ }
}

// ============ AGENT ACTIONS ============

// Deploy agent to search mode - wanders and auto-discovers spaces
export function deployAgentToSearch(agentId: string, startPosition: { x: number; y: number; z: number }): boolean {
  const agent = getAgent(agentId)
  if (!agent) return false
  if (agent.state !== 'idle') return false
  // Note: pointsBalance check removed - no fuel system in Masterplan 2026

  // Generate random initial wander direction
  const dir = randomDirection()

  updateAgent({
    id: agentId,
    state: 'searching',
    positionX: startPosition.x,
    positionY: startPosition.y,
    positionZ: startPosition.z,
    wanderDirX: dir.x,
    wanderDirY: dir.y,
    wanderDirZ: dir.z,
    wanderPhase: Math.random() * 1000,  // Random phase for unique movement pattern
    targetSpaceId: null,
  })

  return true
}

export function recallAgent(agentId: string): boolean {
  const agent = getAgent(agentId)
  if (!agent) return false
  if (agent.state === 'idle') return false

  // If exploring a synapse, leave the exploration first
  // leaveSynapseExploration handles setting state to idle
  const leftExploration = leaveSynapseExploration(agentId)

  if (!leftExploration) {
    // Not exploring a synapse, just set to idle and return to home
    updateAgent({
      id: agentId,
      state: 'idle',
      positionX: agent.homeX,
      positionY: agent.homeY,
      positionZ: agent.homeZ,
      targetSpaceId: null,
      travelStartTime: null,
      travelDuration: null,
    })
  } else {
    // Left exploration, also reset position to home
    updateAgent({
      id: agentId,
      positionX: agent.homeX,
      positionY: agent.homeY,
      positionZ: agent.homeZ,
    })
  }

  return true
}

// ============ SIMULATION TICK ============

let tickCount = 0
let isRunning = false
let tickTimer: NodeJS.Timeout | null = null

export function startSimulation() {
  if (isRunning) return

  isRunning = true

  // Resume from saved state
  const state = getSimulationState()
  tickCount = state.tick_count

  tick()
}

export function stopSimulation() {
  isRunning = false
  if (tickTimer) {
    clearTimeout(tickTimer)
    tickTimer = null
  }
}

async function tick() {
  if (!isRunning) return

  const startTime = Date.now()

  try {
    await processTick()
  } catch (error) {
    console.error('Tick error:', error)
  }

  tickCount++

  // Save simulation state periodically
  if (tickCount % 10 === 0) {
    updateSimulationState(tickCount)
  }

  // Recompute clusters periodically (every 30 seconds)
  if (tickCount % 30 === 0) {
    try {
      recomputeSpaceClusters()
      recomputeAgentClusters()
    } catch (error) {
      console.error('Error recomputing clusters:', error)
    }
  }

  // Schedule next tick
  const elapsed = Date.now() - startTime
  const delay = Math.max(0, TICK_INTERVAL_MS - elapsed)

  tickTimer = setTimeout(tick, delay)
}

// Process searching agents - update positions and broadcast via WebSocket
function processSearchingAgents(deltaSeconds: number) {
  const searchingAgents = db.prepare(`
    SELECT * FROM agents WHERE state = 'searching'
  `).all() as any[]

  if (searchingAgents.length === 0) return

  const updates: AgentUpdate[] = []

  for (const row of searchingAgents) {
    // Update wander direction (organic curves)
    const newDir = updateWanderDirection(
      row.wander_dir_x, row.wander_dir_y, row.wander_dir_z,
      row.wander_phase, tickCount
    )

    // Apply boundary steering
    const boundedDir = applyBrainBounds(
      row.position_x, row.position_y, row.position_z,
      newDir.dirX, newDir.dirY, newDir.dirZ
    )

    // Calculate new position (use real time, not accelerated time for movement)
    const realDeltaSeconds = TICK_INTERVAL_MS / 1000
    const speed = SEARCH_SPEED * realDeltaSeconds
    const newX = row.position_x + boundedDir.dirX * speed
    const newY = row.position_y + boundedDir.dirY * speed
    const newZ = row.position_z + boundedDir.dirZ * speed

    // Update database
    db.prepare(`
      UPDATE agents SET
        position_x = ?, position_y = ?, position_z = ?,
        wander_dir_x = ?, wander_dir_y = ?, wander_dir_z = ?
      WHERE id = ?
    `).run(newX, newY, newZ, boundedDir.dirX, boundedDir.dirY, boundedDir.dirZ, row.id)

    updates.push({
      id: row.id,
      positionX: newX,
      positionY: newY,
      positionZ: newZ,
      state: row.state,
      targetSpaceId: row.target_space_id,
    })
  }

  // Broadcast every 5 ticks (not every tick for performance)
  if (tickCount % 5 === 0 && updates.length > 0 && agentUpdateCallback) {
    agentUpdateCallback(updates as unknown as Agent[])
  }
}

// Process traveling agents - interpolate position toward target synapse, auto-explore on arrival
function processTravelingAgents() {
  const travelingAgents = db.prepare(`
    SELECT a.*, s.position_x as target_x, s.position_y as target_y, s.position_z as target_z
    FROM agents a
    JOIN spaces s ON a.target_space_id = s.id
    WHERE a.state = 'traveling'
  `).all() as any[]

  if (travelingAgents.length === 0) return

  const now = Date.now()
  const updates: AgentUpdate[] = []

  for (const row of travelingAgents) {
    if (!row.travel_start_time || !row.travel_duration) continue

    const elapsed = now - row.travel_start_time
    const progress = Math.min(elapsed / row.travel_duration, 1.0)

    // Interpolate position
    const start = {
      positionX: row.start_position_x,
      positionY: row.start_position_y,
      positionZ: row.start_position_z,
    }
    const end = {
      positionX: row.target_x,
      positionY: row.target_y,
      positionZ: row.target_z,
    }
    const newPos = interpolatePosition(start, end, progress)

    if (progress >= 1.0) {
      // Arrived at synapse - auto-transition to exploring
      const success = joinSynapseExploration(
        row.target_space_id,
        row.id,
        row.owner_id,
        row.current_points_per_min || 100
      )

      if (success) {
        // joinSynapseExploration already sets state to 'solving', but we need to update position and clear travel fields
        db.prepare(`
          UPDATE agents SET
            position_x = ?, position_y = ?, position_z = ?,
            travel_start_time = NULL, travel_duration = NULL,
            start_position_x = NULL, start_position_y = NULL, start_position_z = NULL
          WHERE id = ?
        `).run(newPos.positionX, newPos.positionY, newPos.positionZ, row.id)

        updates.push({
          id: row.id,
          positionX: newPos.positionX,
          positionY: newPos.positionY,
          positionZ: newPos.positionZ,
          state: 'solving',
          targetSpaceId: row.target_space_id,
        })

        console.log(`[Travel] Ship ${row.id.slice(0, 8)} arrived at synapse ${row.target_space_id.slice(0, 8)}, auto-started exploring`)
      } else {
        // Failed to join (synapse might be occupied or completed) - return to searching
        db.prepare(`
          UPDATE agents SET
            state = 'searching',
            position_x = ?, position_y = ?, position_z = ?,
            target_space_id = NULL,
            travel_start_time = NULL, travel_duration = NULL,
            start_position_x = NULL, start_position_y = NULL, start_position_z = NULL
          WHERE id = ?
        `).run(newPos.positionX, newPos.positionY, newPos.positionZ, row.id)

        updates.push({
          id: row.id,
          positionX: newPos.positionX,
          positionY: newPos.positionY,
          positionZ: newPos.positionZ,
          state: 'searching',
          targetSpaceId: null,
        })

        console.log(`[Travel] Ship ${row.id.slice(0, 8)} arrived but couldn't explore synapse, returning to searching`)
      }
    } else {
      // Still traveling - update position
      db.prepare(`
        UPDATE agents SET position_x = ?, position_y = ?, position_z = ? WHERE id = ?
      `).run(newPos.positionX, newPos.positionY, newPos.positionZ, row.id)

      updates.push({
        id: row.id,
        positionX: newPos.positionX,
        positionY: newPos.positionY,
        positionZ: newPos.positionZ,
        state: row.state,
        targetSpaceId: row.target_space_id,
      })
    }
  }

  // Broadcast every 5 ticks (not every tick for performance)
  if (tickCount % 5 === 0 && updates.length > 0 && agentUpdateCallback) {
    agentUpdateCallback(updates as unknown as Agent[])
  }
}

async function processTick() {
  // Apply TIME_MULTIPLIER to speed up simulation (288 = 24h in 5min)
  const deltaSeconds = (TICK_INTERVAL_MS / 1000) * RATES.TIME_MULTIPLIER

  // Log every 10 ticks with ship state summary and positions
  if (tickCount % 10 === 0) {
    const shipStats = db.prepare(`
      SELECT state, COUNT(*) as count FROM agents GROUP BY state
    `).all() as { state: string; count: number }[]

    const stateStr = shipStats.map(s => `${s.state}:${s.count}`).join(' ') || 'no ships'

    // Get ship positions
    const ships = db.prepare(`
      SELECT id, name, position_x, position_y, position_z, state FROM agents LIMIT 10
    `).all() as { id: string; name: string; position_x: number; position_y: number; position_z: number; state: string }[]

    const posStr = ships.map(s =>
      `${s.name || s.id.slice(0,4)}(${s.position_x.toFixed(1)},${s.position_y.toFixed(1)},${s.position_z.toFixed(1)})`
    ).join(' ')

    console.log(`[Tick ${tickCount}] ${RATES.TIME_MULTIPLIER}x speed | Ships: ${stateStr}`)
    if (posStr) console.log(`  Positions: ${posStr}`)
  }

  // ============ MASTERPLAN 2026: Process synapse exploration ============
  // All exploration now uses the synapse system (completeSynapse)
  // Legacy space discovery system has been removed
  await processSynapseExploration(deltaSeconds)

  // Process traveling agents - interpolate position toward synapse, auto-explore on arrival
  processTravelingAgents()

  // Process searching agents - update positions and broadcast
  processSearchingAgents(deltaSeconds)
}

// Export for external access
export function getTickCount() {
  return tickCount
}

export function isSimulationRunning() {
  return isRunning
}

// ============================================================================
// MASTERPLAN 2026: SYNAPSE EXPLORATION SYSTEM
// ============================================================================

/**
 * Get active live event multipliers
 * Returns the highest active reward multiplier and XP multiplier
 */
function getActiveEventMultipliers(): {
  rewardMultiplier: number
  xpMultiplier: number
  eventName: string | null
} {
  const now = Date.now()

  // Get all active events
  const events = db.prepare(`
    SELECT name, event_type, multiplier
    FROM live_events
    WHERE is_active = 1 AND start_time <= ? AND end_time >= ?
    ORDER BY multiplier DESC
  `).all(now, now) as Array<{ name: string; event_type: string; multiplier: number }>

  if (events.length === 0) {
    return { rewardMultiplier: 1, xpMultiplier: 1, eventName: null }
  }

  // Calculate multipliers based on event types
  let rewardMultiplier = 1
  let xpMultiplier = 1
  let eventName: string | null = null

  for (const event of events) {
    if (event.event_type === 'double_xp' || event.event_type === 'bonus_xp') {
      xpMultiplier = Math.max(xpMultiplier, event.multiplier)
    }
    if (event.event_type === 'bonus_agi' || event.event_type === 'double_rewards') {
      rewardMultiplier = Math.max(rewardMultiplier, event.multiplier)
    }
    // Use the first (highest multiplier) event name for display
    if (!eventName) eventName = event.name
  }

  return { rewardMultiplier, xpMultiplier, eventName }
}

/**
 * Get equipped item effects for a ship
 * Returns accumulated effect values for speed boost, luck, and XP multiplier
 */
function getShipItemEffects(shipId: string): {
  speedBoost: number
  luckBoost: number
  xpMultiplier: number
} {
  const effects = db.prepare(`
    SELECT ish.effect_type, ish.effect_value
    FROM user_purchases up
    JOIN item_shop ish ON up.item_id = ish.id
    WHERE up.ship_id = ? AND up.is_active = 1
      AND (up.expires_at IS NULL OR up.expires_at > ?)
  `).all(shipId, Date.now()) as Array<{ effect_type: string; effect_value: number }>

  let speedBoost = 0, luckBoost = 0, xpMultiplier = 0
  for (const effect of effects) {
    if (effect.effect_type === 'speed_boost') speedBoost += effect.effect_value
    if (effect.effect_type === 'luck_charm') luckBoost += effect.effect_value
    if (effect.effect_type === 'xp_amplifier') xpMultiplier += effect.effect_value
  }
  return { speedBoost, luckBoost, xpMultiplier }
}

/**
 * Process points accumulation for all active synapse explorers
 * Called every tick to add points based on each explorer's spending rate
 */
export async function processSynapseExploration(deltaSeconds: number) {
  // Get all synapses currently being explored
  const exploringSynapses = db.prepare(`
    SELECT DISTINCT synapse_id FROM synapse_explorers
  `).all() as { synapse_id: string }[]

  // Auto-repair: Check for state mismatch between agents and synapse_explorers
  const solvingShips = db.prepare(`
    SELECT a.id, a.target_space_id, a.owner_id, a.current_points_per_min
    FROM agents a
    WHERE a.state = 'solving'
  `).all() as { id: string; target_space_id: string | null; owner_id: string; current_points_per_min: number }[]

  for (const ship of solvingShips) {
    if (!ship.target_space_id) {
      // No target - reset to idle
      console.log(`[REPAIR] Ship ${ship.id.slice(0, 8)} solving with no target, resetting to idle`)
      db.prepare(`UPDATE agents SET state = 'idle', target_space_id = NULL WHERE id = ?`).run(ship.id)
      continue
    }

    // Check if ship has synapse_explorers entry
    const hasExplorer = db.prepare(`SELECT 1 FROM synapse_explorers WHERE ship_id = ?`).get(ship.id)
    if (!hasExplorer) {
      // Check if target synapse is still available
      const synapse = db.prepare(`SELECT state, synapse_type FROM spaces WHERE id = ?`).get(ship.target_space_id) as { state: string; synapse_type: string } | undefined

      if (!synapse || synapse.state === 'discovered') {
        console.log(`[REPAIR] Ship ${ship.id.slice(0, 8)} target synapse unavailable, resetting to idle`)
        db.prepare(`UPDATE agents SET state = 'idle', target_space_id = NULL WHERE id = ?`).run(ship.id)
      } else {
        // Re-add explorer entry
        const pointsPerMin = ship.current_points_per_min || 100
        console.log(`[REPAIR] Re-adding ship ${ship.id.slice(0, 8)} to synapse_explorers for ${synapse.synapse_type} synapse`)
        db.prepare(`
          INSERT INTO synapse_explorers (id, synapse_id, ship_id, user_id, points_contributed, points_per_minute, joined_at, last_updated_at)
          VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        `).run(uuid(), ship.target_space_id, ship.id, ship.owner_id, pointsPerMin, Date.now(), Date.now())

        // Update synapse state
        db.prepare(`UPDATE spaces SET state = 'being_solved' WHERE id = ? AND state = 'undiscovered'`).run(ship.target_space_id)
      }
    }
  }

  if (exploringSynapses.length > 0 && tickCount % 10 === 0) {
    console.log(`[Exploration] ${exploringSynapses.length} synapse(s) being explored`)
  }

  for (const { synapse_id } of exploringSynapses) {
    await updateSynapseProgress(synapse_id, deltaSeconds)
  }
}

/**
 * Update progress for a single synapse based on all explorers' contributions
 */
async function updateSynapseProgress(synapseId: string, deltaSeconds: number) {
  // Get synapse details
  const synapse = db.prepare(`
    SELECT id, synapse_type, points_required, points_accumulated, state
    FROM spaces WHERE id = ?
  `).get(synapseId) as {
    id: string
    synapse_type: SynapseType
    points_required: number
    points_accumulated: number
    state: string
  } | undefined

  if (!synapse || synapse.state === 'discovered') return

  // Get all explorers for this synapse
  const explorers = db.prepare(`
    SELECT se.id, se.ship_id, se.user_id, se.points_per_minute, se.points_contributed,
           u.user_level
    FROM synapse_explorers se
    JOIN users u ON se.user_id = u.id
    WHERE se.synapse_id = ?
  `).all(synapseId) as Array<{
    id: string
    ship_id: string
    user_id: string
    points_per_minute: number
    points_contributed: number
    user_level: number
  }>

  if (explorers.length === 0) return

  const config = SYNAPSE_CONFIG[synapse.synapse_type]
  const now = Date.now()
  let totalPointsThisTick = 0

  // Calculate points contributed by each explorer this tick
  for (const explorer of explorers) {
    // Get item effects for this ship (speed boost applies to exploration rate)
    const itemEffects = getShipItemEffects(explorer.ship_id)
    const speedMultiplier = 1 + itemEffects.speedBoost

    // Apply speed boost then clamp to max points per minute for this synapse type
    const boostedRate = explorer.points_per_minute * speedMultiplier
    const effectiveRate = Math.min(boostedRate, config.maxPerMin)
    const pointsThisTick = (effectiveRate / 60) * deltaSeconds

    totalPointsThisTick += pointsThisTick

    // Update explorer's contribution
    db.prepare(`
      UPDATE synapse_explorers
      SET points_contributed = points_contributed + ?,
          last_updated_at = ?
      WHERE id = ?
    `).run(pointsThisTick, now, explorer.id)
  }

  // Update synapse's total accumulated points
  const newAccumulated = synapse.points_accumulated + totalPointsThisTick
  const isCompleted = newAccumulated >= synapse.points_required
  const progressPct = ((newAccumulated / synapse.points_required) * 100).toFixed(1)

  // Log progress every 10 ticks
  if (tickCount % 10 === 0) {
    console.log(`[Progress] ${synapse.synapse_type} synapse: ${progressPct}% (${Math.floor(newAccumulated)}/${synapse.points_required} pts) +${totalPointsThisTick.toFixed(1)}/tick`)
  }

  // V1 Masterplan: Calculate ETA based on user level + items (single player)
  // Get the single explorer's level and item effects
  const explorer = explorers[0]
  const userLevel = (explorer.user_level || 1) as UserLevel
  const itemEffects = getShipItemEffects(explorer.ship_id)
  const currentETA = calculateFinalETA(config.etaMinutes, userLevel, itemEffects.speedBoost)

  db.prepare(`
    UPDATE spaces
    SET points_accumulated = ?,
        current_eta_minutes = ?,
        state = ?
    WHERE id = ?
  `).run(
    Math.min(newAccumulated, synapse.points_required),
    currentETA,
    isCompleted ? 'discovered' : 'being_solved',
    synapseId
  )

  // Emit progress event
  if (explorationProgressCallback) {
    explorationProgressCallback({
      synapseId,
      synapseType: synapse.synapse_type,
      pointsAccumulated: Math.min(newAccumulated, synapse.points_required),
      pointsRequired: synapse.points_required,
      currentETAMinutes: currentETA,
      explorerCount: explorers.length,
      timestamp: now,
    })
  }

  // Check if synapse is completed
  if (isCompleted) {
    await completeSynapse(synapseId, synapse.synapse_type, explorers)
  }
}

/**
 * Complete a synapse and distribute rewards
 */
async function completeSynapse(
  synapseId: string,
  synapseType: SynapseType,
  explorers: Array<{
    id: string
    ship_id: string
    user_id: string
    points_contributed: number
  }>
) {
  const config = SYNAPSE_CONFIG[synapseType]
  const now = Date.now()

  // Get live event multipliers (Masterplan 2026: single USDC-based level system, no brain XP)
  const eventMultipliers = getActiveEventMultipliers()
  const finalAgiReward = Math.floor(config.agiReward * eventMultipliers.rewardMultiplier)

  if (eventMultipliers.eventName) {
    console.log(`[Live Event] "${eventMultipliers.eventName}" active! Rewards: x${eventMultipliers.rewardMultiplier}`)
  }

  // V1 Masterplan: Single player - explorer gets 100% of reward
  const singleExplorer = explorers[0]
  const rewardDistribution: Array<{ userId: string; shipId: string; reward: number; isWinner?: boolean }> = [{
    userId: singleExplorer.user_id,
    shipId: singleExplorer.ship_id,
    reward: finalAgiReward,
    isWinner: true,
  }]

  // Award AGI rewards to users (Masterplan 2026: single USDC-based level system, no brain XP)
  for (const dist of rewardDistribution) {
    // Get AGI amplifier effect from items
    const itemEffects = getShipItemEffects(dist.shipId)
    const agiItemMultiplier = 1 + itemEffects.xpMultiplier  // Reusing xpMultiplier as AGI amplifier
    const amplifiedReward = Math.floor(dist.reward * agiItemMultiplier)

    if (amplifiedReward > 0) {
      // Update user's AGI balance
      db.prepare(`
        UPDATE users
        SET total_agi_earned = total_agi_earned + ?
        WHERE id = ?
      `).run(amplifiedReward, dist.userId)

      // Update ship stats
      db.prepare(`
        UPDATE agents
        SET total_agi_earned = total_agi_earned + ?,
            spaces_discovered = spaces_discovered + 1
        WHERE id = ?
      `).run(amplifiedReward, dist.shipId)
    }
    // Lottery losers get lottery tickets (already handled above) but no AGI
  }

  // ============ NFT MINTING FOR RARE SYNAPSES ============
  // Mint NFT for discoverer of Core, Legendary, or Unique synapses
  // V1 Masterplan: Single player - the explorer always gets the NFT
  const nftEligibleTypes: SynapseType[] = ['core', 'rare', 'legendary', 'unique']
  if (nftEligibleTypes.includes(synapseType)) {
    const nftRecipient = { userId: singleExplorer.user_id, shipId: singleExplorer.ship_id }
    if (nftRecipient) {
      const nftId = uuid()
      const nftMetadata = JSON.stringify({
        synapseType,
        discoveredAt: now,
        synapseId,
        rarity: synapseType,
        name: `${synapseType.charAt(0).toUpperCase() + synapseType.slice(1)} Synapse Discovery`,
        description: `First to discover a ${synapseType} synapse in the neural network.`,
      })

      // Insert NFT record
      db.prepare(`
        INSERT INTO nfts (id, user_id, nft_type, synapse_id, metadata, minted_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(nftId, nftRecipient.userId, 'synapse_discovery', synapseId, nftMetadata, now)

      // Increment user's NFT count
      db.prepare(`
        UPDATE users SET nft_count = nft_count + 1 WHERE id = ?
      `).run(nftRecipient.userId)

      console.log(`[Masterplan 2026] NFT minted for ${synapseType} synapse discovery to user ${nftRecipient.userId}`)
    }
  }

  // Clear all explorers from this synapse
  db.prepare(`DELETE FROM synapse_explorers WHERE synapse_id = ?`).run(synapseId)

  // Update synapse state
  db.prepare(`
    UPDATE spaces
    SET state = 'discovered',
        discovered_at = ?
    WHERE id = ?
  `).run(now, synapseId)

  // Emit synapse completion event
  if (synapseCompletionCallback) {
    synapseCompletionCallback({
      synapseId,
      synapseType,
      totalReward: finalAgiReward,
      distribution: config.distribution,
      explorers: rewardDistribution,
      timestamp: now,
    })
  }

  console.log(`\n[SOLVED] ✓ ${synapseType.toUpperCase()} synapse completed! +${finalAgiReward} $AGI${eventMultipliers.eventName ? ` (${eventMultipliers.eventName} active)` : ''}\n`)

  // Process autopilot for all ships that were exploring this synapse
  for (const explorer of explorers) {
    await processAutopilot(explorer.ship_id, explorer.user_id)
  }
}

/**
 * Add a ship to explore a synapse
 */
export function joinSynapseExploration(
  synapseId: string,
  shipId: string,
  userId: string,
  pointsPerMinute: number
): boolean {
  const synapse = db.prepare(`
    SELECT synapse_type, state FROM spaces WHERE id = ?
  `).get(synapseId) as { synapse_type: SynapseType; state: string } | undefined

  if (!synapse || synapse.state === 'discovered') {
    return false
  }

  const config = SYNAPSE_CONFIG[synapse.synapse_type]

  // V1 Masterplan: Single player only - max 1 explorer per synapse
  const currentCount = db.prepare(`
    SELECT COUNT(*) as count FROM synapse_explorers WHERE synapse_id = ?
  `).get(synapseId) as { count: number }

  if (currentCount.count >= 1) {
    // Synapse already occupied
    return false
  }

  // Clamp points per minute to max allowed
  const effectiveRate = Math.min(pointsPerMinute, config.maxPerMin)
  const now = Date.now()

  // Add explorer
  db.prepare(`
    INSERT OR REPLACE INTO synapse_explorers
    (id, synapse_id, ship_id, user_id, points_contributed, points_per_minute, joined_at, last_updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `).run(uuid(), synapseId, shipId, userId, effectiveRate, now, now)

  // Update synapse state if needed
  db.prepare(`
    UPDATE spaces SET state = 'being_solved' WHERE id = ? AND state = 'undiscovered'
  `).run(synapseId)

  // Update ship state (solving = actively exploring a synapse)
  db.prepare(`
    UPDATE agents
    SET state = 'solving',
        target_space_id = ?,
        current_points_per_min = ?
    WHERE id = ?
  `).run(synapseId, effectiveRate, shipId)

  console.log(`[Exploration] Ship ${shipId.slice(0, 8)} started exploring synapse ${synapseId.slice(0, 8)} at ${effectiveRate} pts/min`)
  return true
}

/**
 * Remove a ship from synapse exploration
 */
export function leaveSynapseExploration(shipId: string): boolean {
  const explorer = db.prepare(`
    SELECT synapse_id FROM synapse_explorers WHERE ship_id = ?
  `).get(shipId) as { synapse_id: string } | undefined

  if (!explorer) {
    return false
  }

  // Remove explorer
  db.prepare(`DELETE FROM synapse_explorers WHERE ship_id = ?`).run(shipId)

  // Update ship state
  db.prepare(`
    UPDATE agents
    SET state = 'idle',
        target_space_id = NULL,
        current_points_per_min = 0
    WHERE id = ?
  `).run(shipId)

  // Check if synapse has no more explorers
  const remaining = db.prepare(`
    SELECT COUNT(*) as count FROM synapse_explorers WHERE synapse_id = ?
  `).get(explorer.synapse_id) as { count: number }

  if (remaining.count === 0) {
    // Reset synapse state if no explorers
    db.prepare(`
      UPDATE spaces SET state = 'undiscovered' WHERE id = ? AND state = 'being_solved'
    `).run(explorer.synapse_id)
  }

  console.log(`[Masterplan 2026] Ship ${shipId} left synapse exploration`)
  return true
}

/**
 * Process autopilot for ships that have completed exploration
 * Finds the next available synapse matching the ship's target types
 */
export async function processAutopilot(shipId: string, userId: string): Promise<boolean> {
  // Check if ship has autopilot enabled
  const ship = db.prepare(`
    SELECT autopilot_enabled, current_points_per_min FROM agents WHERE id = ?
  `).get(shipId) as { autopilot_enabled: number; current_points_per_min: number } | undefined

  if (!ship || !ship.autopilot_enabled) {
    return false
  }

  // Get user's level (USDC-based) to determine accessible synapse types (Masterplan 2026)
  const user = db.prepare(`
    SELECT usdc_spent FROM users WHERE id = ?
  `).get(userId) as { usdc_spent: number } | undefined

  const userLevel = calculateUserLevel(user?.usdc_spent || 0)

  // Find the next available synapse (prioritize by synapse type: minor < complex < deep etc.)
  // Only show synapses the user can access based on User Level
  const nextSynapse = db.prepare(`
    SELECT s.id, s.synapse_type, s.position_x, s.position_y, s.position_z
    FROM spaces s
    WHERE s.state = 'undiscovered' OR s.state = 'being_solved'
    ORDER BY
      CASE s.synapse_type
        WHEN 'minor' THEN 1
        WHEN 'complex' THEN 2
        WHEN 'deep' THEN 3
        WHEN 'core' THEN 4
        WHEN 'rare' THEN 5
        WHEN 'legendary' THEN 6
        WHEN 'unique' THEN 7
      END ASC,
      RANDOM()
    LIMIT 1
  `).get() as { id: string; synapse_type: string; position_x: number; position_y: number; position_z: number } | undefined

  if (!nextSynapse) {
    console.log(`[Autopilot] No available synapses for ship ${shipId}`)
    return false
  }

  // Check User Level requirements for synapse type (Masterplan 2026: USDC-based)
  const config = SYNAPSE_CONFIG[nextSynapse.synapse_type as SynapseType]
  const requiredLevel = config.unlockUserLevel
  if (userLevel < requiredLevel) {
    const requiredUSDC = USER_LEVEL_CONFIG[requiredLevel as UserLevel].minUSDC
    console.log(`[Autopilot] Ship ${shipId} owner level ${userLevel} too low for ${nextSynapse.synapse_type} (needs level ${requiredLevel}, $${requiredUSDC}+ USDC)`)
    return false
  }

  // Join the synapse exploration
  const pointsPerMin = ship.current_points_per_min || 100
  const success = joinSynapseExploration(nextSynapse.id, shipId, userId, pointsPerMin)

  if (success) {
    console.log(`[Autopilot] Ship ${shipId} automatically joined ${nextSynapse.synapse_type} synapse ${nextSynapse.id}`)
  }

  return success
}

/**
 * Update a ship's spending rate
 */
export function updateExplorationRate(shipId: string, newPointsPerMinute: number): boolean {
  const explorer = db.prepare(`
    SELECT se.synapse_id, s.synapse_type
    FROM synapse_explorers se
    JOIN spaces s ON se.synapse_id = s.id
    WHERE se.ship_id = ?
  `).get(shipId) as { synapse_id: string; synapse_type: SynapseType } | undefined

  if (!explorer) {
    return false
  }

  const config = SYNAPSE_CONFIG[explorer.synapse_type]
  const effectiveRate = Math.min(newPointsPerMinute, config.maxPerMin)

  db.prepare(`
    UPDATE synapse_explorers SET points_per_minute = ? WHERE ship_id = ?
  `).run(effectiveRate, shipId)

  db.prepare(`
    UPDATE agents SET current_points_per_min = ? WHERE id = ?
  `).run(effectiveRate, shipId)

  return true
}
