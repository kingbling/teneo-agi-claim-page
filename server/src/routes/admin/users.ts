/**
 * Admin User Management Routes
 *
 * List, view, edit, ban/unban users and grant tokens.
 */

import { Router, Request, Response } from 'express'
import { db } from '../../db/index.js'
import { asyncHandler, sendError } from '../../middleware/errorHandler.js'

const router = Router()

interface UserRow {
  id: string
  wallet: string
  tier: string
  user_level: number
  usdc_spent: number
  points: number
  agentic_balance: number
  total_agi_earned: number
  total_teneo_earned: number
  max_ships: number
  is_admin: number
  banned_at: number | null
  ban_reason: string | null
  created_at: number
}

/**
 * GET /api/admin/users
 * List all users with pagination, search, and filters
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
  const offset = (page - 1) * limit
  const search = (req.query.search as string)?.toLowerCase() || ''
  const sortBy = (req.query.sortBy as string) || 'created_at'
  const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const filter = req.query.filter as string // 'banned', 'admin', 'all'

  // Build WHERE clause
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (search) {
    conditions.push('(LOWER(wallet) LIKE ? OR LOWER(id) LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  if (filter === 'banned') {
    conditions.push('banned_at IS NOT NULL')
  } else if (filter === 'admin') {
    conditions.push('is_admin = 1')
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Validate sort column
  const validSortColumns = ['created_at', 'user_level', 'points', 'total_agi_earned', 'wallet']
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'

  // Get total count
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM users ${whereClause}`).get(...params) as { total: number }

  // Get users
  const users = db.prepare(`
    SELECT id, wallet, tier, user_level, usdc_spent, points, agentic_balance,
           total_agi_earned, total_teneo_earned, max_ships, is_admin, banned_at, ban_reason, created_at
    FROM users
    ${whereClause}
    ORDER BY ${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as UserRow[]

  res.json({
    users: users.map(u => ({
      id: u.id,
      wallet: u.wallet,
      tier: u.tier,
      userLevel: u.user_level,
      usdcSpent: u.usdc_spent,
      points: u.points,
      agenticBalance: u.agentic_balance,
      totalAgiEarned: u.total_agi_earned,
      totalTeneoEarned: u.total_teneo_earned,
      maxShips: u.max_ships,
      isAdmin: u.is_admin === 1,
      bannedAt: u.banned_at,
      banReason: u.ban_reason,
      createdAt: u.created_at,
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
 * GET /api/admin/users/:id
 * Get detailed user info including ships
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const user = db.prepare(`
    SELECT * FROM users WHERE id = ?
  `).get(id) as UserRow | undefined

  if (!user) {
    sendError(res, 404, 'User not found')
    return
  }

  // Get user's ships
  const ships = db.prepare(`
    SELECT id, name, state, spaces_discovered, total_agi_earned, created_at
    FROM agents WHERE owner_id = ?
  `).all(id) as Array<{
    id: string
    name: string
    state: string
    spaces_discovered: number
    total_agi_earned: number
    created_at: number
  }>

  // Get recent activity (synapse contributions)
  const recentActivity = db.prepare(`
    SELECT se.synapse_id, se.points_contributed, se.joined_at, s.synapse_type
    FROM synapse_explorers se
    JOIN spaces s ON se.synapse_id = s.id
    WHERE se.user_id = ?
    ORDER BY se.joined_at DESC
    LIMIT 20
  `).all(id) as Array<{
    synapse_id: string
    points_contributed: number
    joined_at: number
    synapse_type: string
  }>

  res.json({
    user: {
      id: user.id,
      wallet: user.wallet,
      tier: user.tier,
      userLevel: user.user_level,
      usdcSpent: user.usdc_spent,
      points: user.points,
      agenticBalance: user.agentic_balance,
      totalAgiEarned: user.total_agi_earned,
      totalTeneoEarned: user.total_teneo_earned,
      maxShips: user.max_ships,
      isAdmin: user.is_admin === 1,
      bannedAt: user.banned_at,
      banReason: user.ban_reason,
      createdAt: user.created_at,
    },
    ships: ships.map(s => ({
      id: s.id,
      name: s.name,
      state: s.state,
      spacesDiscovered: s.spaces_discovered,
      totalAgiEarned: s.total_agi_earned,
      createdAt: s.created_at,
    })),
    recentActivity: recentActivity.map(a => ({
      synapseId: a.synapse_id,
      pointsContributed: a.points_contributed,
      joinedAt: a.joined_at,
      synapseType: a.synapse_type,
    })),
  })
}))

/**
 * PATCH /api/admin/users/:id
 * Update user fields
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { points, agenticBalance, userLevel, maxShips, tier } = req.body as {
    points?: number
    agenticBalance?: number
    userLevel?: number
    maxShips?: number
    tier?: string
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!user) {
    sendError(res, 404, 'User not found')
    return
  }

  const updates: string[] = []
  const params: (string | number)[] = []

  if (points !== undefined) {
    updates.push('points = ?')
    params.push(Math.max(0, points))
  }
  if (agenticBalance !== undefined) {
    updates.push('agentic_balance = ?')
    params.push(Math.max(0, agenticBalance))
  }
  if (userLevel !== undefined) {
    updates.push('user_level = ?')
    params.push(Math.max(1, Math.min(5, userLevel)))
  }
  if (maxShips !== undefined) {
    updates.push('max_ships = ?')
    params.push(Math.max(1, maxShips))
  }
  if (tier !== undefined && ['free', 'pro'].includes(tier)) {
    updates.push('tier = ?')
    params.push(tier)
  }

  if (updates.length === 0) {
    sendError(res, 400, 'No valid fields to update')
    return
  }

  params.push(id)
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const updatedUser = db.prepare(`
    SELECT id, wallet, tier, user_level, points, agentic_balance, max_ships
    FROM users WHERE id = ?
  `).get(id) as UserRow

  res.json({
    success: true,
    user: {
      id: updatedUser.id,
      wallet: updatedUser.wallet,
      tier: updatedUser.tier,
      userLevel: updatedUser.user_level,
      points: updatedUser.points,
      agenticBalance: updatedUser.agentic_balance,
      maxShips: updatedUser.max_ships,
    },
  })
}))

/**
 * POST /api/admin/users/:id/ban
 * Ban a user
 */
router.post('/:id/ban', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { reason } = req.body as { reason?: string }

  const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(id) as { id: string; is_admin: number } | undefined
  if (!user) {
    sendError(res, 404, 'User not found')
    return
  }

  if (user.is_admin === 1) {
    sendError(res, 400, 'Cannot ban an admin user')
    return
  }

  db.prepare(`
    UPDATE users SET banned_at = ?, ban_reason = ? WHERE id = ?
  `).run(Date.now(), reason || null, id)

  res.json({ success: true, message: 'User banned' })
}))

/**
 * POST /api/admin/users/:id/unban
 * Unban a user
 */
router.post('/:id/unban', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!user) {
    sendError(res, 404, 'User not found')
    return
  }

  db.prepare(`
    UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = ?
  `).run(id)

  res.json({ success: true, message: 'User unbanned' })
}))

/**
 * POST /api/admin/users/:id/grant
 * Grant tokens to a user
 */
router.post('/:id/grant', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { tokenType, amount } = req.body as {
    tokenType: 'points' | 'agi' | 'agentic' | 'teneo'
    amount: number
  }

  if (!tokenType || !amount || amount <= 0) {
    sendError(res, 400, 'tokenType and positive amount are required')
    return
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!user) {
    sendError(res, 404, 'User not found')
    return
  }

  const columnMap: Record<string, string> = {
    points: 'points',
    agi: 'total_agi_earned',
    agentic: 'agentic_balance',
    teneo: 'total_teneo_earned',
  }

  const column = columnMap[tokenType]
  if (!column) {
    sendError(res, 400, 'Invalid tokenType. Must be: points, agi, agentic, or teneo')
    return
  }

  db.prepare(`UPDATE users SET ${column} = ${column} + ? WHERE id = ?`).run(amount, id)

  const updatedUser = db.prepare(`SELECT ${column} as balance FROM users WHERE id = ?`).get(id) as { balance: number }

  res.json({
    success: true,
    message: `Granted ${amount} ${tokenType} to user`,
    newBalance: updatedUser.balance,
  })
}))

/**
 * POST /api/admin/users/:id/set-admin
 * Set or remove admin status
 */
router.post('/:id/set-admin', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { isAdmin } = req.body as { isAdmin: boolean }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!user) {
    sendError(res, 404, 'User not found')
    return
  }

  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, id)

  res.json({
    success: true,
    message: isAdmin ? 'User granted admin access' : 'Admin access revoked',
  })
}))

export default router
