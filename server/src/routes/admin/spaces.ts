/**
 * Admin Space/Synapse Inspection Routes
 *
 * Browse, search, and inspect synapses.
 */

import { Router, Request, Response } from 'express'
import { db } from '../../db/index.js'
import { asyncHandler, sendError } from '../../middleware/errorHandler.js'

const router = Router()

interface SpaceRow {
  id: string
  state: string
  synapse_type: string
  position_x: number
  position_y: number
  position_z: number
  points_required: number
  points_accumulated: number
  agi_reward: number
  discovered_at: number | null
}

/**
 * GET /api/admin/spaces
 * List spaces with pagination, search, and filters
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
  const offset = (page - 1) * limit
  const search = (req.query.search as string) || ''
  const state = req.query.state as string // 'undiscovered', 'being_solved', 'discovered'
  const synapseType = req.query.synapseType as string
  const sortBy = (req.query.sortBy as string) || 'created_at'
  const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (search) {
    conditions.push('id LIKE ?')
    params.push(`${search}%`)
  }

  if (state) {
    conditions.push('state = ?')
    params.push(state)
  }

  if (synapseType) {
    conditions.push('synapse_type = ?')
    params.push(synapseType)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const validSortColumns = ['discovered_at', 'points_accumulated', 'agi_reward', 'synapse_type', 'state']
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'discovered_at'

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM spaces ${whereClause}`).get(...params) as { total: number }

  const spaces = db.prepare(`
    SELECT id, state, synapse_type, position_x, position_y, position_z,
           points_required, points_accumulated, agi_reward, discovered_at
    FROM spaces
    ${whereClause}
    ORDER BY ${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as SpaceRow[]

  res.json({
    spaces: spaces.map(s => ({
      id: s.id,
      state: s.state,
      synapseType: s.synapse_type,
      position: { x: s.position_x, y: s.position_y, z: s.position_z },
      pointsRequired: s.points_required,
      pointsAccumulated: s.points_accumulated,
      progress: s.points_required > 0 ? (s.points_accumulated / s.points_required * 100).toFixed(2) : '0',
      agiReward: s.agi_reward,
      discoveredAt: s.discovered_at,
    })),
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  })
}))

/**
 * GET /api/admin/spaces/status/in-progress
 * Get spaces currently being explored
 * NOTE: Must be before /:id route to avoid conflict
 */
router.get('/status/in-progress', asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50))

  const spaces = db.prepare(`
    SELECT s.id, s.synapse_type, s.points_required, s.points_accumulated, s.agi_reward,
           COUNT(se.user_id) as explorer_count
    FROM spaces s
    LEFT JOIN synapse_explorers se ON s.id = se.synapse_id
    WHERE s.state = 'being_solved'
    GROUP BY s.id
    ORDER BY s.points_accumulated DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string
    synapse_type: string
    points_required: number
    points_accumulated: number
    agi_reward: number
    explorer_count: number
  }>

  res.json({
    spaces: spaces.map(s => ({
      id: s.id,
      synapseType: s.synapse_type,
      pointsRequired: s.points_required,
      pointsAccumulated: s.points_accumulated,
      progress: s.points_required > 0 ? (s.points_accumulated / s.points_required * 100).toFixed(2) : '0',
      agiReward: s.agi_reward,
      explorerCount: s.explorer_count,
    })),
  })
}))

/**
 * GET /api/admin/spaces/:id
 * Get detailed space info including explorers
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const space = db.prepare(`
    SELECT * FROM spaces WHERE id = ?
  `).get(id) as SpaceRow | undefined

  if (!space) {
    sendError(res, 404, 'Space not found')
    return
  }

  // Get current explorers
  const explorers = db.prepare(`
    SELECT se.user_id, se.points_contributed, se.joined_at, u.wallet
    FROM synapse_explorers se
    JOIN users u ON se.user_id = u.id
    WHERE se.synapse_id = ?
    ORDER BY se.points_contributed DESC
  `).all(id) as Array<{
    user_id: string
    points_contributed: number
    joined_at: number
    wallet: string
  }>

  // Get ships at this synapse
  const ships = db.prepare(`
    SELECT id, name, owner_id, state
    FROM agents
    WHERE current_space_id = ? OR target_space_id = ?
  `).all(id, id) as Array<{
    id: string
    name: string
    owner_id: string
    state: string
  }>

  res.json({
    space: {
      id: space.id,
      state: space.state,
      synapseType: space.synapse_type,
      position: { x: space.position_x, y: space.position_y, z: space.position_z },
      pointsRequired: space.points_required,
      pointsAccumulated: space.points_accumulated,
      progress: space.points_required > 0 ? (space.points_accumulated / space.points_required * 100).toFixed(2) : '0',
      agiReward: space.agi_reward,
      discoveredAt: space.discovered_at,
    },
    explorers: explorers.map(e => ({
      userId: e.user_id,
      wallet: e.wallet,
      pointsContributed: e.points_contributed,
      joinedAt: e.joined_at,
    })),
    ships: ships.map(s => ({
      id: s.id,
      name: s.name,
      ownerId: s.owner_id,
      state: s.state,
    })),
  })
}))

export default router
