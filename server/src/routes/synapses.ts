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
import { SYNAPSE_CONFIG, type SynapseType } from '../config/gameConfig.js'

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
  brainXpReward: number
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
    const extendedStmt = db.prepare('SELECT synapse_type, points_required, points_accumulated, current_eta_minutes, agi_reward, brain_xp_reward, sector_id FROM spaces WHERE id = ?')
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
      brainXpReward: extended.brain_xp_reward || config.brainXpReward,
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

    // Validate and cap points per minute
    const requestedRate = pointsPerMin || 100
    const cappedRate = Math.min(requestedRate, config.maxPerMin)

    // Check explorer limit
    const explorerCountStmt = db.prepare('SELECT COUNT(*) as count FROM synapse_explorers WHERE synapse_id = ?')
    const { count } = explorerCountStmt.get(id) as { count: number }

    if (config.maxExplorers !== -1 && count >= config.maxExplorers) {
      return res.status(400).json({
        error: `Synapse has reached maximum explorers (${config.maxExplorers})`
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

      const updatedAgent = getAgent(shipId)

      res.json({
        success: true,
        ship: {
          id: updatedAgent!.id,
          name: updatedAgent!.name,
          state: 'exploring',
          currentSynapseId: id,
          currentPointsPerMin: cappedRate,
        },
        synapse: {
          id,
          state: 'being_explored',
          explorerCount: count + 1,
        },
        message: `Ship ${updatedAgent!.name} is now exploring synapse at ${cappedRate} points/min`
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

      const updatedAgent = getAgent(shipId)

      // Get remaining explorer count
      const explorerCountStmt = db.prepare('SELECT COUNT(*) as count FROM synapse_explorers WHERE synapse_id = ?')
      const { count } = explorerCountStmt.get(id) as { count: number }

      res.json({
        success: true,
        ship: {
          id: updatedAgent!.id,
          name: updatedAgent!.name,
          state: 'idle',
          currentSynapseId: null,
        },
        synapse: {
          id,
          explorerCount: count,
        },
        message: `Ship ${updatedAgent!.name} has left the exploration`
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
      res.json({
        success: true,
        ship: {
          id: agent.id,
          name: agent.name,
          currentSynapseId: id,
          currentPointsPerMin: cappedRate,
        },
        message: cappedRate !== pointsPerMin
          ? `Rate set to ${cappedRate} points/min (capped from ${pointsPerMin})`
          : `Rate updated to ${cappedRate} points/min`
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
