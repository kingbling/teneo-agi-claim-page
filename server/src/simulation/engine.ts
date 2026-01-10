import {
  db,
  getActiveAgents,
  getAgent,
  getSpace,
  updateAgent,
  updateSpace,
  getSpaceSolvers,
  addSpaceSolver,
  removeSpaceSolver,
  clearSpaceSolvers,
  updateSimulationState,
  getSimulationState,
  batchUpdateAgents,
  recomputeSpaceClusters,
  recomputeAgentClusters,
  findNearestUndiscoveredSpace,
} from '../db/index.js'
import type { Agent, Space, AgentTrait, SpaceDiscovery, LootEvent } from '../types/index.js'
import { v4 as uuid } from 'uuid'
import {
  RATES,
  WORLD,
  TRAIT_EFFECTS,
  calculateBurnRate as configCalculateBurnRate,
  calculateTravelTime as configCalculateTravelTime,
  calculateSolveProbability as configCalculateSolveProbability,
  calculateLootShare as configCalculateLootShare,
  calculateTranceDuration,
} from '../config/gameConfig.js'

// Use configuration constants
const TICK_INTERVAL_MS = RATES.TICK_INTERVAL_MS
const BASE_BURN_RATE = RATES.BASE_BURN_RATE
const BASE_SPEED = RATES.BASE_SPEED
const SEARCH_SPEED = RATES.BASE_SEARCH_SPEED
const DETECTION_RADIUS = RATES.DETECTION_RADIUS
const WANDER_TURN_RATE = RATES.WANDER_TURN_RATE
const BRAIN_BOUNDS = { min: WORLD.BRAIN_BOUNDS_MIN, max: WORLD.BRAIN_BOUNDS_MAX }

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

function calculateSolveProbability(agent: Agent, space: Space, solverCount: number): number {
  const explorerLevel = getTraitBonus(agent.traits, 'explorer')
  const collaborativeLevel = getTraitBonus(agent.traits, 'collaborative')

  return configCalculateSolveProbability(
    space.baseProbability,
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

// Keep position within brain bounds with soft boundary (steer away from edges)
function applyBrainBounds(
  posX: number, posY: number, posZ: number,
  dirX: number, dirY: number, dirZ: number
): { dirX: number; dirY: number; dirZ: number } {
  const margin = WORLD.BOUNDARY_MARGIN  // Start steering when this close to boundary
  const steerStrength = WORLD.BOUNDARY_STEER_STRENGTH

  let steerX = 0, steerY = 0, steerZ = 0

  // Steer away from boundaries
  if (posX < BRAIN_BOUNDS.min + margin) steerX = steerStrength
  if (posX > BRAIN_BOUNDS.max - margin) steerX = -steerStrength
  if (posY < BRAIN_BOUNDS.min + margin) steerY = steerStrength
  if (posY > BRAIN_BOUNDS.max - margin) steerY = -steerStrength
  if (posZ < BRAIN_BOUNDS.min + margin) steerZ = steerStrength
  if (posZ > BRAIN_BOUNDS.max - margin) steerZ = -steerStrength

  // Apply steering
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

// ============ AGENT ACTIONS ============

// Deploy agent to search mode - wanders and auto-discovers spaces
export function deployAgentToSearch(agentId: string, startPosition: { x: number; y: number; z: number }): boolean {
  const agent = getAgent(agentId)
  if (!agent) return false
  if (agent.state !== 'idle') return false
  if (agent.pointsBalance <= 0) return false

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

  // Remove from space solvers if solving
  if (agent.state === 'solving' && agent.targetSpaceId) {
    removeSpaceSolver(agent.targetSpaceId, agentId)
  }

  // Set to idle at current position
  updateAgent({
    id: agentId,
    state: 'idle',
    targetSpaceId: null,
    travelStartTime: null,
    travelDuration: null,
  })

  return true
}

export function refuelAgent(agentId: string, points: number): boolean {
  const agent = getAgent(agentId)
  if (!agent) return false

  updateAgent({
    id: agentId,
    pointsBalance: agent.pointsBalance + points,
  })

  return true
}

// ============ SIMULATION TICK ============

let tickCount = 0
let isRunning = false
let tickTimer: NodeJS.Timeout | null = null

export function startSimulation() {
  if (isRunning) return

  isRunning = true
  console.log('Simulation started')

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
  console.log('Simulation stopped at tick', tickCount)
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

async function processTick() {
  const now = Date.now()
  const deltaSeconds = TICK_INTERVAL_MS / 1000

  // Check for agents with active trance that should end
  const allAgents = getActiveAgents() // We'll use this later too
  for (const agent of allAgents) {
    if (agent.tranceActive && agent.tranceEndTime && now >= agent.tranceEndTime) {
      // Trance ended - auto-continue exploration
      const newDir = randomDirection()
      updateAgent({
        id: agent.id,
        tranceActive: false,
        tranceEndTime: null,
        state: 'searching',
        wanderDirX: newDir.x,
        wanderDirY: newDir.y,
        wanderDirZ: newDir.z,
      })
      console.log(`Agent ${agent.id} trance ended, continuing exploration`)
    }
  }

  // Get all active agents (traveling or solving)
  const activeAgents = allAgents

  const agentUpdates: (Partial<Agent> & { id: string })[] = []

  for (const agent of activeAgents) {
    const burnRate = calculateBurnRate(agent.traits)
    const pointsBurned = burnRate * deltaSeconds
    let newBalance = agent.pointsBalance - pointsBurned

    if (newBalance <= 0) {
      // Out of fuel - go idle and mark as needing repair
      agentUpdates.push({
        id: agent.id,
        state: 'idle',
        pointsBalance: 0,
        totalPointsBurned: agent.totalPointsBurned + agent.pointsBalance,
        targetSpaceId: null,
        travelStartTime: null,
        travelDuration: null,
        needsRepair: true,  // Agent is exhausted and needs repair
        // Return to center (home position)
        positionX: 0,
        positionY: 0,
        positionZ: 0,
      })

      // Remove from solvers if was solving
      if (agent.state === 'solving' && agent.targetSpaceId) {
        removeSpaceSolver(agent.targetSpaceId, agent.id)
      }
      continue
    }

    switch (agent.state) {
      case 'searching': {
        // Update wander direction with organic movement
        let { dirX, dirY, dirZ } = updateWanderDirection(
          agent.wanderDirX, agent.wanderDirY, agent.wanderDirZ,
          agent.wanderPhase, tickCount
        )

        // Apply brain bounds steering
        const bounded = applyBrainBounds(
          agent.positionX, agent.positionY, agent.positionZ,
          dirX, dirY, dirZ
        )
        dirX = bounded.dirX
        dirY = bounded.dirY
        dirZ = bounded.dirZ

        // Move position based on direction and speed
        const swiftLevel = getTraitBonus(agent.traits, 'swift')
        const swiftBonus = 1 + (swiftLevel * TRAIT_EFFECTS.swift.speedBonus!)
        const speed = SEARCH_SPEED * swiftBonus * deltaSeconds
        const newPosX = agent.positionX + dirX * speed
        const newPosY = agent.positionY + dirY * speed
        const newPosZ = agent.positionZ + dirZ * speed

        // Check for nearby undiscovered spaces
        const nearbySpace = findNearestUndiscoveredSpace(newPosX, newPosY, newPosZ, DETECTION_RADIUS)

        if (nearbySpace) {
          // Found a space! Move to it and start solving
          agentUpdates.push({
            id: agent.id,
            state: 'solving',
            positionX: nearbySpace.positionX,
            positionY: nearbySpace.positionY,
            positionZ: nearbySpace.positionZ,
            targetSpaceId: nearbySpace.id,
            pointsBalance: newBalance,
            totalPointsBurned: agent.totalPointsBurned + pointsBurned,
          })

          // Add to space solvers
          addSpaceSolver(nearbySpace.id, agent.id)

          // Update space state
          if (nearbySpace.state === 'undiscovered') {
            updateSpace({ id: nearbySpace.id, state: 'being_solved' })
          }
        } else {
          // Continue searching
          agentUpdates.push({
            id: agent.id,
            positionX: newPosX,
            positionY: newPosY,
            positionZ: newPosZ,
            wanderDirX: dirX,
            wanderDirY: dirY,
            wanderDirZ: dirZ,
            pointsBalance: newBalance,
            totalPointsBurned: agent.totalPointsBurned + pointsBurned,
          })
        }
        break
      }

      case 'traveling': {
        const space = getSpace(agent.targetSpaceId!)
        if (!space) {
          // Invalid target - go idle
          agentUpdates.push({
            id: agent.id,
            state: 'idle',
            targetSpaceId: null,
          })
          continue
        }

        // Calculate travel progress
        const elapsed = now - agent.travelStartTime!
        const progress = elapsed / agent.travelDuration!

        if (progress >= 1) {
          // Arrived at destination - start solving
          agentUpdates.push({
            id: agent.id,
            state: 'solving',
            positionX: space.positionX,
            positionY: space.positionY,
            positionZ: space.positionZ,
            pointsBalance: newBalance,
            totalPointsBurned: agent.totalPointsBurned + pointsBurned,
          })

          // Add to space solvers
          addSpaceSolver(space.id, agent.id)

          // Update space state if not already being solved
          if (space.state === 'undiscovered') {
            updateSpace({ id: space.id, state: 'being_solved' })
          }
        } else {
          // Still traveling - interpolate position from stored start position
          const startPos = {
            positionX: agent.startPositionX ?? agent.positionX,
            positionY: agent.startPositionY ?? agent.positionY,
            positionZ: agent.startPositionZ ?? agent.positionZ,
          }
          const endPos = {
            positionX: space.positionX,
            positionY: space.positionY,
            positionZ: space.positionZ,
          }

          // Calculate current position based on travel progress
          const newPos = interpolatePosition(startPos, endPos, progress)

          agentUpdates.push({
            id: agent.id,
            positionX: newPos.positionX,
            positionY: newPos.positionY,
            positionZ: newPos.positionZ,
            pointsBalance: newBalance,
            totalPointsBurned: agent.totalPointsBurned + pointsBurned,
          })
        }
        break
      }

      case 'solving': {
        const space = getSpace(agent.targetSpaceId!)
        if (!space || space.state === 'discovered') {
          // Space already discovered or invalid - go idle
          agentUpdates.push({
            id: agent.id,
            state: 'idle',
            targetSpaceId: null,
          })
          continue
        }

        // Check for solve success
        const solvers = getSpaceSolvers(space.id)
        const solveChance = calculateSolveProbability(agent, space, solvers.length)

        // Roll for success (per tick)
        if (Math.random() < solveChance) {
          // Space discovered!
          await solveSpace(space.id, solvers)

          // Generate new wander direction for continued searching
          const newDir = randomDirection()

          // Update this agent - go back to searching for more spaces
          agentUpdates.push({
            id: agent.id,
            state: 'searching',
            targetSpaceId: null,
            spacesDiscovered: agent.spacesDiscovered + 1,
            pointsBalance: newBalance,
            totalPointsBurned: agent.totalPointsBurned + pointsBurned,
            wanderDirX: newDir.x,
            wanderDirY: newDir.y,
            wanderDirZ: newDir.z,
          })
        } else {
          // Still solving - increment progress slightly
          const progressIncrement = solveChance * 10  // Visual progress
          const newProgress = Math.min(99, space.solveProgress + progressIncrement)
          updateSpace({ id: space.id, solveProgress: newProgress })

          agentUpdates.push({
            id: agent.id,
            pointsBalance: newBalance,
            totalPointsBurned: agent.totalPointsBurned + pointsBurned,
          })
        }
        break
      }
    }
  }

  // Batch update all agents
  if (agentUpdates.length > 0) {
    batchUpdateAgents(agentUpdates)

    // Emit agent updates for broadcasting
    if (agentUpdateCallback) {
      // Get full agent objects for the updated agents
      const updatedAgents = agentUpdates
        .map((u) => getAgent(u.id))
        .filter((a): a is Agent => a !== null)

      if (updatedAgents.length > 0) {
        agentUpdateCallback(updatedAgents)
      }
    }
  }
}

async function solveSpace(spaceId: string, solverAgentIds: string[]) {
  const space = getSpace(spaceId)
  if (!space) return

  // Mark space as discovered
  updateSpace({
    id: spaceId,
    state: 'discovered',
    solveProgress: 100,
    discoveredAt: Date.now(),
  })

  // Clear all solvers
  clearSpaceSolvers(spaceId)

  // Distribute loot and check for trance
  const lootDistribution: { agentId: string; ownerId: string; amount: number }[] = []
  const agentsWithTrance: string[] = []

  for (const agentId of solverAgentIds) {
    const agent = getAgent(agentId)
    if (!agent) continue

    const lootAmount = calculateLootShare(space.lootPool, agent.traits, solverAgentIds.length)

    // Update agent loot
    updateAgent({
      id: agentId,
      totalLoot: agent.totalLoot + lootAmount,
    })

    lootDistribution.push({
      agentId,
      ownerId: agent.ownerId,
      amount: lootAmount,
    })

    // Check if agent has trance trait
    if (agent.tranceLevel > 0) {
      agentsWithTrance.push(agentId)
    }

    // Emit loot event
    if (lootCallback) {
      lootCallback({
        userId: agent.ownerId,
        agentId,
        spaceId,
        amount: lootAmount,
        timestamp: Date.now(),
      })
    }
  }

  // Trigger trance for agents with trance trait
  if (agentsWithTrance.length > 0) {
    const now = Date.now()
    for (const agentId of agentsWithTrance) {
      const agent = getAgent(agentId)
      if (!agent) continue

      const tranceDuration = calculateTranceDuration(agent.tranceLevel)
      const tranceEndTime = now + tranceDuration

      updateAgent({
        id: agentId,
        tranceActive: true,
        tranceEndTime,
        state: 'idle', // Agent enters trance state (idle but will auto-resume)
      })

      console.log(`Agent ${agentId} entered trance for ${tranceDuration}ms (level ${agent.tranceLevel})`)
    }
  }

  // Record discovery event
  const eventId = uuid()
  db.prepare(`
    INSERT INTO discovery_events (id, space_id, discovered_at, total_loot)
    VALUES (?, ?, ?, ?)
  `).run(eventId, spaceId, Date.now(), space.lootPool)

  // Record loot distributions
  for (const dist of lootDistribution) {
    db.prepare(`
      INSERT INTO loot_distributions (id, discovery_event_id, agent_id, owner_id, amount)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), eventId, dist.agentId, dist.ownerId, dist.amount)
  }

  // Emit discovery event
  if (discoveryCallback) {
    discoveryCallback({
      spaceId,
      positionX: space.positionX,
      positionY: space.positionY,
      positionZ: space.positionZ,
      discoveredBy: solverAgentIds,
      lootDistribution,
      timestamp: Date.now(),
    })
  }

  console.log(`Space ${spaceId} discovered by ${solverAgentIds.length} agents, ${space.lootPool} loot distributed`)
}

// Export for external access
export function getTickCount() {
  return tickCount
}

export function isSimulationRunning() {
  return isRunning
}
