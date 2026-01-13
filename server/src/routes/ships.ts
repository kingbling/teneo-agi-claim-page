/**
 * Ship API Routes - Masterplan 2026
 *
 * Ships are the player's exploration vessels in the brain visualization.
 * Ships can be deployed to synapses, equipped with items, and have autopilot settings.
 */

import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import {
  getAgent,
  getAgentsByOwner,
  createAgent,
  getUser,
} from '../db/index.js'
import { deployAgentToSearch, recallAgent } from '../simulation/engine.js'
import { WORLD, USER_LEVEL_CONFIG, calculateUserLevel } from '../config/gameConfig.js'
import type { Agent } from '../types/index.js'
import {
  asyncHandler,
  validateShipExists,
  validateUserExists,
  sendError,
} from '../middleware/errorHandler.js'

const router = Router()

// Type for ship response (transformed from Agent)
interface ShipResponse {
  id: string
  ownerId: string
  name: string
  state: string
  positionX: number
  positionY: number
  positionZ: number
  startPositionX: number | null
  startPositionY: number | null
  startPositionZ: number | null
  currentSynapseId: string | null
  travelStartTime: number | null
  travelDuration: number | null
  autopilotEnabled: boolean
  autopilotTargetTypes: string[]
  equippedItems: string[]
  currentPointsPerMin: number
  spacesDiscovered: number
  totalLoot: number
  totalAgiEarned: number
  totalBrainXpEarned: number
  createdAt: number
}

// Helper to transform Agent to Ship response
function agentToShip(agent: Agent): ShipResponse {
  // Get autopilot settings and stats from DB
  const shipData = db.prepare(`
    SELECT autopilot_enabled, current_points_per_min, total_agi_earned, total_brain_xp_earned
    FROM agents WHERE id = ?
  `).get(agent.id) as {
    autopilot_enabled: number
    current_points_per_min: number
    total_agi_earned: number
    total_brain_xp_earned: number
  } | undefined

  // Get equipped items for this ship
  const equippedItems = db.prepare(`
    SELECT up.id FROM user_purchases up
    WHERE up.ship_id = ? AND up.is_active = 1
  `).all(agent.id) as Array<{ id: string }>

  return {
    id: agent.id,
    ownerId: agent.ownerId,
    name: agent.name,
    // Map server states to frontend states: searching/solving -> exploring, traveling -> deploying
    state: (agent.state === 'solving' || agent.state === 'searching') ? 'exploring'
         : agent.state === 'traveling' ? 'deploying'
         : agent.state,
    positionX: agent.positionX,
    positionY: agent.positionY,
    positionZ: agent.positionZ,
    startPositionX: agent.startPositionX,
    startPositionY: agent.startPositionY,
    startPositionZ: agent.startPositionZ,
    currentSynapseId: agent.currentSpaceId || agent.targetSpaceId,
    travelStartTime: agent.travelStartTime,
    travelDuration: agent.travelDuration,
    autopilotEnabled: shipData?.autopilot_enabled === 1,
    autopilotTargetTypes: [], // TODO: Add autopilot_target_types column if needed
    equippedItems: equippedItems.map(e => e.id),
    currentPointsPerMin: shipData?.current_points_per_min || 100,
    spacesDiscovered: agent.spacesDiscovered,
    totalLoot: agent.totalLoot,
    totalAgiEarned: shipData?.total_agi_earned || 0,
    totalBrainXpEarned: shipData?.total_brain_xp_earned || 0,
    createdAt: agent.createdAt,
  }
}

/**
 * POST /api/ships
 * Create a new ship for a user
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId, name } = req.body as {
    userId: string
    name: string
  }

  if (!userId || !name) {
    sendError(res, 400, 'userId and name are required')
    return
  }

  const user = getUser(userId)
  if (!user) {
    sendError(res, 404, 'User not found')
    return
  }

  // Check ship limit based on user level (USDC-based, Masterplan 2026)
  const existingShips = getAgentsByOwner(userId)
  const userLevel = calculateUserLevel(user.usdc_spent ?? 0)
  const maxShips = USER_LEVEL_CONFIG[userLevel]?.maxShips ?? 1

  if (existingShips.length >= maxShips) {
    sendError(res, 400, `Ship limit reached (${maxShips} ships at user level ${userLevel})`)
    return
  }

  // Create ship (stored as agent internally)
  const ship: Agent = {
    id: uuid(),
    ownerId: userId,
    name,
    state: 'idle',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    homeX: 0,
    homeY: 0,
    homeZ: 0,
    targetX: null,
    targetY: null,
    targetZ: null,
    startPositionX: null,
    startPositionY: null,
    startPositionZ: null,
    wanderDirX: 0,
    wanderDirY: 0,
    wanderDirZ: 0,
    wanderPhase: 0,
    targetSpaceId: null,
    currentSpaceId: null,
    solveStartTime: null,
    travelStartTime: null,
    travelDuration: null,
    pointsBalance: 0,         // No fuel system in Masterplan 2026
    pointsBurnRate: 0,        // No fuel system
    traits: [],               // No traits in Masterplan 2026
    spacesDiscovered: 0,
    totalLoot: 0,
    totalPointsBurned: 0,
    distanceTraveled: 0,
    createdAt: Date.now(),
    deployedAt: null,
    creationCost: 0,
    needsRepair: false,
    tranceActive: false,
    tranceEndTime: null,
    tranceLevel: 0,
  }

  createAgent(ship)

  res.status(201).json({ ship: agentToShip(ship) })
}))

/**
 * GET /api/users/:userId/ships
 * Get all ships owned by a user
 */
router.get('/users/:userId/ships', validateUserExists, asyncHandler(async (_req: Request, res: Response) => {
  const user = res.locals.user
  const ships = getAgentsByOwner(user.id)
  const shipsFormatted = ships.map(agentToShip)

  res.json({ ships: shipsFormatted })
}))

/**
 * POST /api/ships/:id/deploy
 * Deploy a ship to a specific position in the brain
 */
router.post('/:id/deploy', validateShipExists, asyncHandler(async (req: Request, res: Response) => {
  const agent = res.locals.agent as Agent
  const { synapseId, positionX, positionY, positionZ } = req.body as {
    synapseId?: string
    positionX?: number
    positionY?: number
    positionZ?: number
  }

  if (agent.state !== 'idle') {
    sendError(res, 400, `Ship is not idle (current state: ${agent.state})`)
    return
  }

  // Use synapse position if provided, otherwise use explicit coordinates
  let targetX = positionX ?? 0
  let targetY = positionY ?? 0
  let targetZ = positionZ ?? 0

  if (synapseId) {
    const synapseStmt = db.prepare('SELECT position_x, position_y, position_z FROM spaces WHERE id = ?')
    const synapse = synapseStmt.get(synapseId) as { position_x: number; position_y: number; position_z: number } | undefined

    if (!synapse) {
      sendError(res, 404, 'Synapse not found')
      return
    }

    targetX = synapse.position_x
    targetY = synapse.position_y
    targetZ = synapse.position_z
  }

  // Validate position bounds
  const { BRAIN_BOUNDS_MIN, BRAIN_BOUNDS_MAX } = WORLD
  if (
    targetX < BRAIN_BOUNDS_MIN || targetX > BRAIN_BOUNDS_MAX ||
    targetY < BRAIN_BOUNDS_MIN || targetY > BRAIN_BOUNDS_MAX ||
    targetZ < BRAIN_BOUNDS_MIN || targetZ > BRAIN_BOUNDS_MAX
  ) {
    sendError(res, 400, `Position out of bounds (must be within ${BRAIN_BOUNDS_MIN} to ${BRAIN_BOUNDS_MAX})`)
    return
  }

  // Deploy the ship
  const success = deployAgentToSearch(agent.id, { x: targetX, y: targetY, z: targetZ })

  if (success) {
    const updatedAgent = getAgent(agent.id)
    res.json({
      ship: agentToShip(updatedAgent!),
      deployedTo: synapseId ? { synapseId } : { positionX: targetX, positionY: targetY, positionZ: targetZ }
    })
  } else {
    sendError(res, 400, 'Failed to deploy ship')
  }
}))

/**
 * POST /api/ships/:id/recall
 * Recall a ship from exploration back to idle state
 */
router.post('/:id/recall', validateShipExists, asyncHandler(async (_req: Request, res: Response) => {
  const agent = res.locals.agent as Agent

  if (agent.state === 'idle') {
    sendError(res, 400, 'Ship is already idle')
    return
  }

  const success = recallAgent(agent.id)

  if (success) {
    const updatedAgent = getAgent(agent.id)
    res.json({ ship: agentToShip(updatedAgent!) })
  } else {
    sendError(res, 400, 'Failed to recall ship')
  }
}))

/**
 * POST /api/ships/:id/autopilot
 * Toggle or configure autopilot settings for a ship
 */
router.post('/:id/autopilot', validateShipExists, asyncHandler(async (req: Request, res: Response) => {
  const agent = res.locals.agent as Agent
  const { enabled, targetSynapseTypes } = req.body as {
    enabled: boolean
    targetSynapseTypes?: string[]  // e.g., ['minor', 'complex']
  }

  const validSynapseTypes = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']
  const filteredTypes = targetSynapseTypes?.filter(t => validSynapseTypes.includes(t)) || []

  // Store autopilot settings in DB
  db.prepare(`
    UPDATE agents SET autopilot_enabled = ? WHERE id = ?
  `).run(enabled ? 1 : 0, agent.id)

  // Also store target types in DB
  db.prepare(`
    UPDATE agents SET autopilot_target_types = ? WHERE id = ?
  `).run(JSON.stringify(filteredTypes), agent.id)

  const updatedAgent = getAgent(agent.id)
  res.json({
    ship: {
      ...agentToShip(updatedAgent!),
      autopilotEnabled: enabled,
      autopilotTargetTypes: filteredTypes,
    },
    message: enabled
      ? `Autopilot enabled${filteredTypes.length > 0 ? ` for ${filteredTypes.join(', ')} synapses` : ''}`
      : 'Autopilot disabled'
  })
}))

/**
 * POST /api/ships/:id/autopilot/preferences
 * Configure detailed autopilot preferences for a ship
 */
router.post('/:id/autopilot/preferences', validateShipExists, asyncHandler(async (req: Request, res: Response) => {
  const agent = res.locals.agent as Agent
  const { targetSynapseTypes, maxPointsCap, avoidCrowded } = req.body as {
    targetSynapseTypes?: string[]
    maxPointsCap?: number
    avoidCrowded?: boolean
  }

  const validSynapseTypes = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']
  const filteredTypes = targetSynapseTypes?.filter(t => validSynapseTypes.includes(t)) || []

  // Get current preferences
  const currentPrefs = db.prepare(`
    SELECT autopilot_target_types, autopilot_max_points_cap, autopilot_avoid_crowded
    FROM agents WHERE id = ?
  `).get(agent.id) as {
    autopilot_target_types: string
    autopilot_max_points_cap: number
    autopilot_avoid_crowded: number
  } | undefined

  // Merge with new values (only update provided values)
  const newTargetTypes = targetSynapseTypes !== undefined
    ? JSON.stringify(filteredTypes)
    : (currentPrefs?.autopilot_target_types || '[]')

  const newMaxPointsCap = maxPointsCap !== undefined
    ? Math.max(0, maxPointsCap)
    : (currentPrefs?.autopilot_max_points_cap || 0)

  const newAvoidCrowded = avoidCrowded !== undefined
    ? (avoidCrowded ? 1 : 0)
    : (currentPrefs?.autopilot_avoid_crowded || 0)

  // Update preferences
  db.prepare(`
    UPDATE agents
    SET autopilot_target_types = ?,
        autopilot_max_points_cap = ?,
        autopilot_avoid_crowded = ?
    WHERE id = ?
  `).run(newTargetTypes, newMaxPointsCap, newAvoidCrowded, agent.id)

  const parsedTargetTypes = JSON.parse(newTargetTypes) as string[]

  res.json({
    success: true,
    preferences: {
      targetSynapseTypes: parsedTargetTypes,
      maxPointsCap: newMaxPointsCap,
      avoidCrowded: newAvoidCrowded === 1,
    },
    message: 'Autopilot preferences updated'
  })
}))

/**
 * GET /api/ships/:id/autopilot/preferences
 * Get current autopilot preferences for a ship
 */
router.get('/:id/autopilot/preferences', validateShipExists, asyncHandler(async (_req: Request, res: Response) => {
  const agent = res.locals.agent as Agent

  const prefs = db.prepare(`
    SELECT autopilot_enabled, autopilot_target_types, autopilot_max_points_cap, autopilot_avoid_crowded
    FROM agents WHERE id = ?
  `).get(agent.id) as {
    autopilot_enabled: number
    autopilot_target_types: string
    autopilot_max_points_cap: number
    autopilot_avoid_crowded: number
  } | undefined

  const targetTypes = prefs?.autopilot_target_types
    ? JSON.parse(prefs.autopilot_target_types) as string[]
    : []

  res.json({
    preferences: {
      enabled: prefs?.autopilot_enabled === 1,
      targetSynapseTypes: targetTypes,
      maxPointsCap: prefs?.autopilot_max_points_cap || 0,
      avoidCrowded: prefs?.autopilot_avoid_crowded === 1,
    }
  })
}))

/**
 * POST /api/ships/:id/equip
 * Equip an item to a ship
 */
router.post('/:id/equip', validateShipExists, asyncHandler(async (req: Request, res: Response) => {
  const agent = res.locals.agent as Agent
  const { itemId } = req.body as {
    itemId: string
    slot?: number  // Optional slot number for ships with multiple slots
  }

  if (!itemId) {
    sendError(res, 400, 'itemId is required')
    return
  }

  // Check if user owns the item (user_purchases table)
  const itemStmt = db.prepare(`
    SELECT up.*, ish.name as item_name, ish.effect_type
    FROM user_purchases up
    JOIN item_shop ish ON up.item_id = ish.id
    WHERE up.id = ? AND up.user_id = ? AND up.is_active = 1
      AND (up.ship_id IS NULL OR up.ship_id = ?)
  `)
  const item = itemStmt.get(itemId, agent.ownerId, agent.id) as any

  if (!item) {
    // Check if item exists but is equipped elsewhere
    const anyItemStmt = db.prepare(`
      SELECT * FROM user_purchases WHERE id = ? AND user_id = ? AND is_active = 1
    `)
    const anyItem = anyItemStmt.get(itemId, agent.ownerId) as any

    if (anyItem && anyItem.ship_id && anyItem.ship_id !== agent.id) {
      sendError(res, 400, 'Item is equipped to another ship')
      return
    }
    sendError(res, 404, 'Item not found or not owned by user')
    return
  }

  // Update the item to be equipped to this ship
  db.prepare(`
    UPDATE user_purchases SET ship_id = ? WHERE id = ?
  `).run(agent.id, itemId)

  // Get all equipped items for this ship
  const equippedItems = db.prepare(`
    SELECT up.id, up.item_id, ish.effect_type
    FROM user_purchases up
    JOIN item_shop ish ON up.item_id = ish.id
    WHERE up.ship_id = ? AND up.is_active = 1
  `).all(agent.id) as Array<{ id: string; item_id: string; effect_type: string }>

  const equippedItemIds = equippedItems.map(e => e.id)

  res.json({
    ship: {
      ...agentToShip(agent),
      equippedItems: equippedItemIds,
    },
    message: `Item ${item.item_name || item.effect_type || itemId} equipped to ship ${agent.name}`
  })
}))

export default router
