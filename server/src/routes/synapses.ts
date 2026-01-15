/**
 * Synapse API Routes - Masterplan 2026
 *
 * Synapses are explorable points in the brain that reward players with $AGI and Brain XP.
 * Players deploy ships to explore synapses by contributing points over time.
 */

import { Router, Request, Response } from 'express'
import { db } from '../db/index.js'
import { getSpace, getAgent, updateAgent } from '../db/index.js'
import {
  joinSynapseExploration,
  leaveSynapseExploration,
  updateExplorationRate,
} from '../simulation/engine.js'
import { SYNAPSE_CONFIG, USER_LEVEL_CONFIG, calculateUserLevel, type SynapseType, type UserLevel } from '../config/gameConfig.js'
import { agentToShip } from './ships.js'
import { triggerShipUpdate } from '../index.js'

const router = Router()

// Type for synapse response
interface SynapseResponse {
  id: string
  positionX: number
  positionY: number
  positionZ: number
  region: string
  zone: string
  synapseType: SynapseType
  state: 'undiscovered' | 'being_explored' | 'completed'
  pointsRequired: number
  pointsAccumulated: number
  currentEtaMinutes: number | null
  explorerCount: number
  maxExplorers: number
  agiReward: number
  sectorId: string | null
  explorers?: ExplorerInfo[]
}

interface ExplorerInfo {
  shipId: string
  userId: string
  shipName: string
  pointsContributed: number
  pointsPerMinute: number
  joinedAt: number
}

// Helper to get synapse type config
function getSynapseConfig(type: SynapseType) {
  return SYNAPSE_CONFIG[type] || SYNAPSE_CONFIG.minor
}

// Helper to convert a space DB object to synapse response
function spaceToSynapse(space: any): SynapseResponse {
  const synapseType = (space.synapseType || space.synapse_type || 'minor') as SynapseType
  const config = getSynapseConfig(synapseType)

  return {
    id: space.id,
    positionX: space.positionX || space.position_x,
    positionY: space.positionY || space.position_y,
    positionZ: space.positionZ || space.position_z,
    region: space.region || '',
    zone: space.zone || '',
    synapseType,
    state: space.state === 'undiscovered' ? 'undiscovered' :
           space.state === 'being_solved' ? 'being_explored' : 'completed',
    pointsRequired: space.pointsRequired || space.points_required || config.points,
    pointsAccumulated: space.pointsAccumulated || space.points_accumulated || 0,
    currentEtaMinutes: space.currentEtaMinutes || space.current_eta_minutes || null,
    explorerCount: 0, // Will be updated by real-time sync
    maxExplorers: config.maxExplorers,
    agiReward: space.agiReward || space.agi_reward || config.agiReward,
    sectorId: space.sectorId || space.sector_id || null,
  }
}

/**
 * GET /api/synapses/near
 * Find the closest synapse to given coordinates
 * Query params: x, y, z (required), radius (optional, default 0.5)
 */
router.get('/near', (req: Request, res: Response) => {
  try {
    const x = parseFloat(req.query.x as string)
    const y = parseFloat(req.query.y as string)
    const z = parseFloat(req.query.z as string)
    const radius = parseFloat(req.query.radius as string) || 0.5

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      return res.status(400).json({ error: 'x, y, z coordinates are required' })
    }

    // Find closest synapse within radius using Euclidean distance
    const stmt = db.prepare(`
      SELECT *,
        (position_x - ?) * (position_x - ?) +
        (position_y - ?) * (position_y - ?) +
        (position_z - ?) * (position_z - ?) as dist_sq
      FROM spaces
      WHERE position_x BETWEEN ? AND ?
        AND position_y BETWEEN ? AND ?
        AND position_z BETWEEN ? AND ?
      ORDER BY dist_sq ASC
      LIMIT 1
    `)

    const row = stmt.get(
      x, x, y, y, z, z,
      x - radius, x + radius,
      y - radius, y + radius,
      z - radius, z + radius
    ) as any

    if (!row) {
      return res.status(404).json({ error: 'No synapse found near coordinates' })
    }

    const synapseType = (row.synapse_type || 'minor') as SynapseType
    const config = getSynapseConfig(synapseType)

    // Get explorers
    const explorersStmt = db.prepare(`
      SELECT
        se.ship_id as shipId,
        se.user_id as userId,
        a.name as shipName,
        se.points_contributed as pointsContributed,
        se.points_per_minute as pointsPerMinute,
        se.joined_at as joinedAt
      FROM synapse_explorers se
      JOIN agents a ON a.id = se.ship_id
      WHERE se.synapse_id = ?
    `)
    const explorers = explorersStmt.all(row.id) as ExplorerInfo[]

    const synapse: SynapseResponse = {
      id: row.id,
      positionX: row.position_x,
      positionY: row.position_y,
      positionZ: row.position_z,
      region: row.region,
      zone: row.zone,
      synapseType,
      state: row.state === 'undiscovered' ? 'undiscovered' :
             row.state === 'being_solved' ? 'being_explored' : 'completed',
      pointsRequired: row.points_required || config.points,
      pointsAccumulated: row.points_accumulated || 0,
      currentEtaMinutes: row.current_eta_minutes || null,
      explorerCount: explorers.length,
      maxExplorers: config.maxExplorers,
      agiReward: row.agi_reward || config.agiReward,
      sectorId: row.sector_id || null,
      explorers,
    }

    res.json({ synapse })
  } catch (error) {
    console.error('Failed to find nearby synapse:', error)
    res.status(500).json({ error: 'Failed to find nearby synapse' })
  }
})

/**
 * GET /api/synapses/:id
 * Get synapse details including current explorers
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const space = getSpace(id)
    if (!space) {
      return res.status(404).json({ error: 'Synapse not found' })
    }

    // Get synapse type from extended data
    const extendedStmt = db.prepare('SELECT synapse_type, points_required, points_accumulated, current_eta_minutes, agi_reward, sector_id FROM spaces WHERE id = ?')
    const extended = extendedStmt.get(id) as any || {}

    const synapseType = (extended.synapse_type || 'minor') as SynapseType
    const config = getSynapseConfig(synapseType)

    // Get explorer count and details
    const explorersStmt = db.prepare(`
      SELECT
        se.ship_id as shipId,
        se.user_id as userId,
        a.name as shipName,
        se.points_contributed as pointsContributed,
        se.points_per_minute as pointsPerMinute,
        se.joined_at as joinedAt
      FROM synapse_explorers se
      JOIN agents a ON a.id = se.ship_id
      WHERE se.synapse_id = ?
    `)
    const explorers = explorersStmt.all(id) as ExplorerInfo[]

    const synapse: SynapseResponse = {
      id: space.id,
      positionX: space.positionX,
      positionY: space.positionY,
      positionZ: space.positionZ,
      region: space.region,
      zone: space.zone,
      synapseType,
      state: space.state === 'undiscovered' ? 'undiscovered' :
             space.state === 'being_solved' ? 'being_explored' : 'completed',
      pointsRequired: extended.points_required || config.points,
      pointsAccumulated: extended.points_accumulated || 0,
      currentEtaMinutes: extended.current_eta_minutes || null,
      explorerCount: explorers.length,
      maxExplorers: config.maxExplorers,
      agiReward: extended.agi_reward || config.agiReward,
      sectorId: extended.sector_id || null,
      explorers,
    }

    res.json({ synapse })
  } catch (error) {
    console.error('Failed to get synapse:', error)
    res.status(500).json({ error: 'Failed to get synapse details' })
  }
})

/**
 * POST /api/synapses/:id/explore
 * Start exploring a synapse with a ship
 */
router.post('/:id/explore', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { shipId, userId, pointsPerMin } = req.body as {
      shipId: string
      userId: string
      pointsPerMin?: number
    }

    if (!shipId || !userId) {
      return res.status(400).json({ error: 'shipId and userId are required' })
    }

    const space = getSpace(id)
    if (!space) {
      return res.status(404).json({ error: 'Synapse not found' })
    }

    if (space.state === 'discovered') {
      return res.status(400).json({ error: 'Synapse has already been completed' })
    }

    const agent = getAgent(shipId)
    if (!agent) {
      return res.status(404).json({ error: 'Ship not found' })
    }

    if (agent.ownerId !== userId) {
      return res.status(403).json({ error: 'Ship does not belong to user' })
    }

    if (agent.state !== 'idle' && agent.state !== 'searching') {
      return res.status(400).json({ error: `Ship is not available (current state: ${agent.state})` })
    }

    // Get synapse config for max points/min validation
    const extendedStmt = db.prepare('SELECT synapse_type FROM spaces WHERE id = ?')
    const extended = extendedStmt.get(id) as { synapse_type?: string } | undefined
    const synapseType = (extended?.synapse_type || 'minor') as SynapseType
    const config = getSynapseConfig(synapseType)

    // Check User Level requirement (Masterplan 2026: USDC-based level gating)
    const userStmt = db.prepare('SELECT usdc_spent FROM users WHERE id = ?')
    const user = userStmt.get(userId) as { usdc_spent: number } | undefined
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const userLevel = calculateUserLevel(user.usdc_spent)
    const requiredLevel = config.unlockUserLevel

    if (userLevel < requiredLevel) {
      const requiredUSDC = USER_LEVEL_CONFIG[requiredLevel as UserLevel].minUSDC
      return res.status(403).json({
        error: `User level ${userLevel} too low for ${synapseType} synapse (requires level ${requiredLevel}, $${requiredUSDC}+ USDC spent)`
      })
    }

    // Apply level multiplier to points per minute (Masterplan 2026: Level Boost)
    const levelMultiplier = USER_LEVEL_CONFIG[userLevel].multiplier

    // Validate and cap points per minute (after applying level boost)
    const requestedRate = pointsPerMin || 100
    const boostedRate = Math.floor(requestedRate * levelMultiplier)
    const cappedRate = Math.min(boostedRate, config.maxPerMin)

    // V1 Masterplan: Single player only - max 1 explorer per synapse
    const explorerCountStmt = db.prepare('SELECT COUNT(*) as count FROM synapse_explorers WHERE synapse_id = ?')
    const { count } = explorerCountStmt.get(id) as { count: number }

    if (count >= 1) {
      return res.status(400).json({
        error: 'Synapse is already being explored. Try a different synapse or wait for it to complete.'
      })
    }

    // Join the exploration
    const success = joinSynapseExploration(id, shipId, userId, cappedRate)

    if (success) {
      // Update agent state to solving (exploring)
      updateAgent({
        id: shipId,
        state: 'solving',
        currentSpaceId: id,
        targetSpaceId: id,
        positionX: space.positionX,
        positionY: space.positionY,
        positionZ: space.positionZ,
      })

      // Trigger WebSocket update for the user
      triggerShipUpdate(userId)

      // Get updated agent and return as ship (client expects { ship: ..., synapse: ... })
      const updatedAgent = getAgent(shipId)
      res.json({
        success: true,
        ship: updatedAgent ? agentToShip(updatedAgent) : null,
        synapse: spaceToSynapse(space),
      })
    } else {
      res.status(400).json({ error: 'Failed to start exploration' })
    }
  } catch (error) {
    console.error('Failed to start exploration:', error)
    res.status(500).json({ error: 'Failed to start exploration' })
  }
})

/**
 * POST /api/synapses/:id/leave
 * Leave synapse exploration
 */
router.post('/:id/leave', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { shipId } = req.body as { shipId: string }

    if (!shipId) {
      return res.status(400).json({ error: 'shipId is required' })
    }

    const agent = getAgent(shipId)
    if (!agent) {
      return res.status(404).json({ error: 'Ship not found' })
    }

    // Verify ship is exploring this synapse
    if (agent.currentSpaceId !== id && agent.targetSpaceId !== id) {
      return res.status(400).json({ error: 'Ship is not exploring this synapse' })
    }

    const success = leaveSynapseExploration(shipId)

    if (success) {
      // Update agent state back to idle
      updateAgent({
        id: shipId,
        state: 'idle',
        currentSpaceId: null,
        targetSpaceId: null,
      })

      // Trigger WebSocket update for the user
      triggerShipUpdate(agent.ownerId)

      // Get updated agent and return as ship (client expects { ship: ... })
      const updatedAgent = getAgent(shipId)
      res.json({
        success: true,
        ship: updatedAgent ? agentToShip(updatedAgent) : null,
      })
    } else {
      res.status(400).json({ error: 'Failed to leave exploration' })
    }
  } catch (error) {
    console.error('Failed to leave exploration:', error)
    res.status(500).json({ error: 'Failed to leave exploration' })
  }
})

/**
 * POST /api/synapses/:id/rate
 * Update spending rate for an active exploration
 */
router.post('/:id/rate', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { shipId, pointsPerMin } = req.body as {
      shipId: string
      pointsPerMin: number
    }

    if (!shipId || pointsPerMin === undefined) {
      return res.status(400).json({ error: 'shipId and pointsPerMin are required' })
    }

    if (pointsPerMin < 0) {
      return res.status(400).json({ error: 'pointsPerMin must be non-negative' })
    }

    const agent = getAgent(shipId)
    if (!agent) {
      return res.status(404).json({ error: 'Ship not found' })
    }

    // Verify ship is exploring this synapse
    if (agent.currentSpaceId !== id && agent.targetSpaceId !== id) {
      return res.status(400).json({ error: 'Ship is not exploring this synapse' })
    }

    // Get synapse config for max rate
    const extendedStmt = db.prepare('SELECT synapse_type FROM spaces WHERE id = ?')
    const extended = extendedStmt.get(id) as { synapse_type?: string } | undefined
    const synapseType = (extended?.synapse_type || 'minor') as SynapseType
    const config = getSynapseConfig(synapseType)

    // Cap the rate to maximum allowed
    const cappedRate = Math.min(pointsPerMin, config.maxPerMin)

    const success = updateExplorationRate(shipId, cappedRate)

    if (success) {
      // Trigger WebSocket update for the user
      triggerShipUpdate(agent.ownerId)

      // Get updated agent and return as ship (client expects { ship: ... })
      const updatedAgent = getAgent(shipId)
      res.json({
        success: true,
        ship: updatedAgent ? agentToShip(updatedAgent) : null,
      })
    } else {
      res.status(400).json({ error: 'Failed to update spending rate' })
    }
  } catch (error) {
    console.error('Failed to update rate:', error)
    res.status(500).json({ error: 'Failed to update spending rate' })
  }
})

export default router
