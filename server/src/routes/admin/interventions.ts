/**
 * Admin Intervention Routes
 *
 * Manual actions: reset ships, complete synapses, trigger ticks.
 */

import { Router, Request, Response } from 'express'
import { db } from '../../db/index.js'
import { asyncHandler, sendError } from '../../middleware/errorHandler.js'
import { isSimulationRunning, getTickCount } from '../../simulation/engine.js'

const router = Router()

/**
 * POST /api/admin/interventions/reset-ship/:id
 * Reset a ship to idle state
 */
router.post('/reset-ship/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const agent = db.prepare('SELECT id, name, state, owner_id FROM agents WHERE id = ?').get(id) as {
    id: string
    name: string
    state: string
    owner_id: string
  } | undefined

  if (!agent) {
    sendError(res, 404, 'Ship not found')
    return
  }

  if (agent.state === 'idle') {
    sendError(res, 400, 'Ship is already idle')
    return
  }

  // Remove from synapse explorers if exploring
  db.prepare(`
    DELETE FROM synapse_explorers WHERE user_id = (
      SELECT owner_id FROM agents WHERE id = ?
    ) AND synapse_id = (
      SELECT current_space_id FROM agents WHERE id = ?
    )
  `).run(id, id)

  // Reset ship to idle
  db.prepare(`
    UPDATE agents
    SET state = 'idle',
        current_space_id = NULL,
        target_space_id = NULL,
        solve_start_time = NULL,
        travel_start_time = NULL,
        travel_duration = NULL,
        deployed_at = NULL,
        position_x = 0,
        position_y = 0,
        position_z = 0
    WHERE id = ?
  `).run(id)

  res.json({
    success: true,
    message: `Ship "${agent.name}" reset to idle`,
    previousState: agent.state,
  })
}))

/**
 * POST /api/admin/interventions/complete-synapse/:id
 * Force complete a synapse
 */
router.post('/complete-synapse/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { distributeRewards } = req.body as { distributeRewards?: boolean }

  const space = db.prepare(`
    SELECT id, state, synapse_type, agi_reward, points_accumulated
    FROM spaces WHERE id = ?
  `).get(id) as {
    id: string
    state: string
    synapse_type: string
    agi_reward: number
    points_accumulated: number
  } | undefined

  if (!space) {
    sendError(res, 404, 'Synapse not found')
    return
  }

  if (space.state === 'discovered') {
    sendError(res, 400, 'Synapse is already discovered')
    return
  }

  // Get explorers for reward distribution
  const explorers = db.prepare(`
    SELECT user_id, points_contributed
    FROM synapse_explorers
    WHERE synapse_id = ?
  `).all(id) as Array<{ user_id: string; points_contributed: number }>

  // Mark synapse as discovered
  db.prepare(`
    UPDATE spaces
    SET state = 'discovered',
        discovered_at = ?
    WHERE id = ?
  `).run(Date.now(), id)

  // Distribute rewards if requested and there are explorers
  let rewardsDistributed = 0
  if (distributeRewards !== false && explorers.length > 0) {
    const totalPoints = explorers.reduce((sum, e) => sum + e.points_contributed, 0)

    for (const explorer of explorers) {
      const share = totalPoints > 0 ? explorer.points_contributed / totalPoints : 1 / explorers.length
      const reward = Math.floor(space.agi_reward * share)

      if (reward > 0) {
        db.prepare(`
          UPDATE users SET total_agi_earned = total_agi_earned + ? WHERE id = ?
        `).run(reward, explorer.user_id)
        rewardsDistributed += reward
      }
    }
  }

  // Clean up synapse explorers
  db.prepare('DELETE FROM synapse_explorers WHERE synapse_id = ?').run(id)

  // Reset ships that were exploring this synapse
  db.prepare(`
    UPDATE agents
    SET state = 'idle',
        current_space_id = NULL,
        target_space_id = NULL,
        spaces_discovered = spaces_discovered + 1
    WHERE current_space_id = ?
  `).run(id)

  res.json({
    success: true,
    message: `Synapse "${id}" force completed`,
    synapseType: space.synapse_type,
    explorersCount: explorers.length,
    rewardsDistributed,
  })
}))

/**
 * GET /api/admin/interventions/simulation-status
 * Get current simulation status
 */
router.get('/simulation-status', asyncHandler(async (_req: Request, res: Response) => {
  const simState = db.prepare(`
    SELECT last_tick_at, tick_count FROM simulation_state WHERE id = 1
  `).get() as { last_tick_at: number; tick_count: number } | undefined

  res.json({
    isRunning: isSimulationRunning(),
    currentTick: getTickCount(),
    lastTickTime: simState?.last_tick_at,
    dbTickCount: simState?.tick_count,
  })
}))

/**
 * POST /api/admin/interventions/bulk-reset-ships
 * Reset all ships matching criteria to idle
 */
router.post('/bulk-reset-ships', asyncHandler(async (req: Request, res: Response) => {
  const { state, olderThanHours } = req.body as {
    state?: string
    olderThanHours?: number
  }

  const conditions: string[] = ["state != 'idle'"]
  const params: (string | number)[] = []

  if (state) {
    conditions.push('state = ?')
    params.push(state)
  }

  if (olderThanHours && olderThanHours > 0) {
    const threshold = Date.now() - olderThanHours * 60 * 60 * 1000
    conditions.push('deployed_at < ?')
    params.push(threshold)
  }

  const whereClause = conditions.join(' AND ')

  // Get count first
  const countResult = db.prepare(`SELECT COUNT(*) as count FROM agents WHERE ${whereClause}`).get(...params) as { count: number }

  if (countResult.count === 0) {
    res.json({ success: true, message: 'No ships matched criteria', count: 0 })
    return
  }

  // Get IDs of ships to reset
  const ships = db.prepare(`SELECT id, current_space_id, owner_id FROM agents WHERE ${whereClause}`).all(...params) as Array<{
    id: string
    current_space_id: string | null
    owner_id: string
  }>

  // Remove from synapse explorers
  for (const ship of ships) {
    if (ship.current_space_id) {
      db.prepare(`
        DELETE FROM synapse_explorers
        WHERE user_id = ? AND synapse_id = ?
      `).run(ship.owner_id, ship.current_space_id)
    }
  }

  // Bulk reset
  db.prepare(`
    UPDATE agents
    SET state = 'idle',
        current_space_id = NULL,
        target_space_id = NULL,
        solve_start_time = NULL,
        travel_start_time = NULL,
        travel_duration = NULL,
        deployed_at = NULL,
        position_x = 0,
        position_y = 0,
        position_z = 0
    WHERE ${whereClause}
  `).run(...params)

  res.json({
    success: true,
    message: `${countResult.count} ships reset to idle`,
    count: countResult.count,
  })
}))

/**
 * POST /api/admin/interventions/recalculate-user-levels
 * Recalculate all user levels based on USDC spent
 */
router.post('/recalculate-user-levels', asyncHandler(async (_req: Request, res: Response) => {
  // User level thresholds
  const levelThresholds = [
    { level: 1, minUsdc: 0 },
    { level: 2, minUsdc: 1 },
    { level: 3, minUsdc: 10 },
    { level: 4, minUsdc: 100 },
    { level: 5, minUsdc: 1000 },
  ]

  let updated = 0

  for (const { level, minUsdc } of levelThresholds.reverse()) {
    const result = db.prepare(`
      UPDATE users
      SET user_level = ?
      WHERE usdc_spent >= ? AND user_level != ?
    `).run(level, minUsdc, level)
    updated += result.changes
  }

  res.json({
    success: true,
    message: `User levels recalculated`,
    usersUpdated: updated,
  })
}))

export default router
