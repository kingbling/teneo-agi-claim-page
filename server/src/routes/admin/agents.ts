/**
 * Admin Agent/Ship Inspection Routes
 *
 * Browse, search, and inspect ships.
 */

import { Router, Request, Response } from 'express'
import { db } from '../../db/index.js'
import { asyncHandler, sendError } from '../../middleware/errorHandler.js'

const router = Router()

interface AgentRow {
  id: string
  owner_id: string
  name: string
  state: string
  position_x: number
  position_y: number
  position_z: number
  current_space_id: string | null
  target_space_id: string | null
  autopilot_enabled: number
  spaces_discovered: number
  total_agi_earned: number
  created_at: number
  deployed_at: number | null
}

/**
 * GET /api/admin/agents
 * List agents with pagination, search, and filters
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
  const offset = (page - 1) * limit
  const search = (req.query.search as string) || ''
  const state = req.query.state as string
  const ownerId = req.query.ownerId as string
  const sortBy = (req.query.sortBy as string) || 'created_at'
  const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (search) {
    conditions.push('(id LIKE ? OR name LIKE ?)')
    params.push(`${search}%`, `%${search}%`)
  }

  if (state) {
    conditions.push('state = ?')
    params.push(state)
  }

  if (ownerId) {
    conditions.push('owner_id = ?')
    params.push(ownerId)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const validSortColumns = ['created_at', 'spaces_discovered', 'total_agi_earned', 'state', 'name']
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM agents ${whereClause}`).get(...params) as { total: number }

  const agents = db.prepare(`
    SELECT id, owner_id, name, state, position_x, position_y, position_z,
           current_space_id, target_space_id, autopilot_enabled,
           spaces_discovered, total_agi_earned, created_at, deployed_at
    FROM agents
    ${whereClause}
    ORDER BY ${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as AgentRow[]

  res.json({
    agents: agents.map(a => ({
      id: a.id,
      ownerId: a.owner_id,
      name: a.name,
      state: a.state,
      position: { x: a.position_x, y: a.position_y, z: a.position_z },
      currentSpaceId: a.current_space_id,
      targetSpaceId: a.target_space_id,
      autopilotEnabled: a.autopilot_enabled === 1,
      spacesDiscovered: a.spaces_discovered,
      totalAgiEarned: a.total_agi_earned,
      createdAt: a.created_at,
      deployedAt: a.deployed_at,
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
 * GET /api/admin/agents/by-owner/:userId
 * Get all agents for a specific user
 * NOTE: Must be before /:id route to avoid conflict
 */
router.get('/by-owner/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params

  const agents = db.prepare(`
    SELECT id, name, state, spaces_discovered, total_agi_earned, created_at, deployed_at
    FROM agents
    WHERE owner_id = ?
    ORDER BY created_at DESC
  `).all(userId) as Array<{
    id: string
    name: string
    state: string
    spaces_discovered: number
    total_agi_earned: number
    created_at: number
    deployed_at: number | null
  }>

  res.json({
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      state: a.state,
      spacesDiscovered: a.spaces_discovered,
      totalAgiEarned: a.total_agi_earned,
      createdAt: a.created_at,
      deployedAt: a.deployed_at,
    })),
  })
}))

/**
 * GET /api/admin/agents/status/stuck
 * Get agents that may be stuck (deployed for too long without progress)
 * NOTE: Must be before /:id route to avoid conflict
 */
router.get('/status/stuck', asyncHandler(async (req: Request, res: Response) => {
  const hoursThreshold = Math.max(1, parseInt(req.query.hours as string) || 24)
  const threshold = Date.now() - hoursThreshold * 60 * 60 * 1000

  const stuckAgents = db.prepare(`
    SELECT a.id, a.name, a.owner_id, a.state, a.deployed_at, a.current_space_id, u.wallet
    FROM agents a
    JOIN users u ON a.owner_id = u.id
    WHERE a.state NOT IN ('idle')
      AND a.deployed_at IS NOT NULL
      AND a.deployed_at < ?
    ORDER BY a.deployed_at ASC
    LIMIT 100
  `).all(threshold) as Array<{
    id: string
    name: string
    owner_id: string
    state: string
    deployed_at: number
    current_space_id: string | null
    wallet: string
  }>

  res.json({
    threshold: `${hoursThreshold} hours`,
    agents: stuckAgents.map(a => ({
      id: a.id,
      name: a.name,
      ownerId: a.owner_id,
      ownerWallet: a.wallet,
      state: a.state,
      deployedAt: a.deployed_at,
      hoursDeployed: Math.round((Date.now() - a.deployed_at) / (60 * 60 * 1000)),
      currentSpaceId: a.current_space_id,
    })),
  })
}))

/**
 * GET /api/admin/agents/:id
 * Get detailed agent info
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const agent = db.prepare(`
    SELECT a.*, u.wallet as owner_wallet
    FROM agents a
    JOIN users u ON a.owner_id = u.id
    WHERE a.id = ?
  `).get(id) as (AgentRow & { owner_wallet: string }) | undefined

  if (!agent) {
    sendError(res, 404, 'Agent not found')
    return
  }

  // Get equipped items
  const equippedItems = db.prepare(`
    SELECT up.id, ish.name, ish.effect_type
    FROM user_purchases up
    JOIN item_shop ish ON up.item_id = ish.id
    WHERE up.ship_id = ? AND up.is_active = 1
  `).all(id) as Array<{
    id: string
    name: string
    effect_type: string
  }>

  // Get current synapse info if exploring
  let currentSynapse = null
  if (agent.current_space_id) {
    currentSynapse = db.prepare(`
      SELECT id, synapse_type, points_accumulated, points_required
      FROM spaces WHERE id = ?
    `).get(agent.current_space_id) as {
      id: string
      synapse_type: string
      points_accumulated: number
      points_required: number
    } | undefined
  }

  res.json({
    agent: {
      id: agent.id,
      ownerId: agent.owner_id,
      ownerWallet: agent.owner_wallet,
      name: agent.name,
      state: agent.state,
      position: { x: agent.position_x, y: agent.position_y, z: agent.position_z },
      currentSpaceId: agent.current_space_id,
      targetSpaceId: agent.target_space_id,
      autopilotEnabled: agent.autopilot_enabled === 1,
      spacesDiscovered: agent.spaces_discovered,
      totalAgiEarned: agent.total_agi_earned,
      createdAt: agent.created_at,
      deployedAt: agent.deployed_at,
    },
    equippedItems: equippedItems.map(i => ({
      id: i.id,
      name: i.name,
      effectType: i.effect_type,
    })),
    currentSynapse: currentSynapse ? {
      id: currentSynapse.id,
      synapseType: currentSynapse.synapse_type,
      progress: currentSynapse.points_required > 0
        ? (currentSynapse.points_accumulated / currentSynapse.points_required * 100).toFixed(2)
        : '0',
    } : null,
  })
}))

export default router
