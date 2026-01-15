/**
 * Admin Analytics Routes
 *
 * System-wide stats, metrics, and time series data for dashboards.
 */

import { Router, Request, Response } from 'express'
import { db } from '../../db/index.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

/**
 * GET /api/admin/analytics/overview
 * Get high-level system metrics
 */
router.get('/overview', asyncHandler(async (_req: Request, res: Response) => {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  // User counts
  const userStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as new_24h,
      SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as new_7d,
      SUM(CASE WHEN banned_at IS NOT NULL THEN 1 ELSE 0 END) as banned
    FROM users
  `).get(oneDayAgo, sevenDaysAgo) as {
    total: number
    new_24h: number
    new_7d: number
    banned: number
  }

  // Active users (have synapse activity)
  const activeUsers = db.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN joined_at > ? THEN user_id END) as active_24h,
      COUNT(DISTINCT CASE WHEN joined_at > ? THEN user_id END) as active_7d
    FROM synapse_explorers
  `).get(oneDayAgo, sevenDaysAgo) as {
    active_24h: number
    active_7d: number
  }

  // Space/synapse stats
  const spaceStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN state = 'discovered' THEN 1 ELSE 0 END) as discovered,
      SUM(CASE WHEN state = 'being_solved' THEN 1 ELSE 0 END) as in_progress
    FROM spaces
  `).get() as {
    total: number
    discovered: number
    in_progress: number
  }

  // Ship stats
  const shipStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) as idle,
      SUM(CASE WHEN state IN ('exploring', 'solving', 'searching', 'traveling') THEN 1 ELSE 0 END) as deployed
    FROM agents
  `).get() as {
    total: number
    idle: number
    deployed: number
  }

  res.json({
    users: {
      total: userStats.total,
      new24h: userStats.new_24h,
      new7d: userStats.new_7d,
      active24h: activeUsers.active_24h,
      active7d: activeUsers.active_7d,
      banned: userStats.banned,
    },
    spaces: {
      total: spaceStats.total,
      discovered: spaceStats.discovered,
      inProgress: spaceStats.in_progress,
      discoveryRate: spaceStats.total > 0 ? (spaceStats.discovered / spaceStats.total * 100).toFixed(2) : '0',
    },
    ships: {
      total: shipStats.total,
      idle: shipStats.idle,
      deployed: shipStats.deployed,
    },
  })
}))

/**
 * GET /api/admin/analytics/economy
 * Get token economy metrics
 */
router.get('/economy', asyncHandler(async (_req: Request, res: Response) => {
  const economy = db.prepare(`
    SELECT
      SUM(points) as total_points,
      SUM(agentic_balance) as total_agentic,
      SUM(total_agi_earned) as total_agi,
      SUM(total_teneo_earned) as total_teneo,
      SUM(usdc_spent) as total_usdc_spent,
      AVG(points) as avg_points,
      AVG(total_agi_earned) as avg_agi
    FROM users
  `).get() as {
    total_points: number
    total_agentic: number
    total_agi: number
    total_teneo: number
    total_usdc_spent: number
    avg_points: number
    avg_agi: number
  }

  // User level distribution
  const levelDistribution = db.prepare(`
    SELECT user_level, COUNT(*) as count
    FROM users
    GROUP BY user_level
    ORDER BY user_level
  `).all() as Array<{ user_level: number; count: number }>

  res.json({
    circulation: {
      totalPoints: economy.total_points || 0,
      totalAgentic: economy.total_agentic || 0,
      totalAgi: economy.total_agi || 0,
      totalTeneo: economy.total_teneo || 0,
      totalUsdcSpent: economy.total_usdc_spent || 0,
    },
    averages: {
      points: Math.round(economy.avg_points || 0),
      agi: Math.round(economy.avg_agi || 0),
    },
    levelDistribution: levelDistribution.map(l => ({
      level: l.user_level,
      count: l.count,
    })),
  })
}))

/**
 * GET /api/admin/analytics/synapse-types
 * Get synapse type distribution and completion stats
 */
router.get('/synapse-types', asyncHandler(async (_req: Request, res: Response) => {
  const synapseStats = db.prepare(`
    SELECT
      synapse_type,
      COUNT(*) as total,
      SUM(CASE WHEN state = 'discovered' THEN 1 ELSE 0 END) as discovered,
      SUM(CASE WHEN state = 'being_solved' THEN 1 ELSE 0 END) as in_progress,
      AVG(points_accumulated) as avg_progress,
      SUM(agi_reward) as total_agi_rewards
    FROM spaces
    GROUP BY synapse_type
    ORDER BY
      CASE synapse_type
        WHEN 'minor' THEN 1
        WHEN 'complex' THEN 2
        WHEN 'deep' THEN 3
        WHEN 'core' THEN 4
        WHEN 'rare' THEN 5
        WHEN 'legendary' THEN 6
        WHEN 'unique' THEN 7
      END
  `).all() as Array<{
    synapse_type: string
    total: number
    discovered: number
    in_progress: number
    avg_progress: number
    total_agi_rewards: number
  }>

  res.json({
    synapseTypes: synapseStats.map(s => ({
      type: s.synapse_type,
      total: s.total,
      discovered: s.discovered,
      inProgress: s.in_progress,
      completionRate: s.total > 0 ? (s.discovered / s.total * 100).toFixed(2) : '0',
      avgProgress: Math.round(s.avg_progress || 0),
      totalAgiRewards: s.total_agi_rewards || 0,
    })),
  })
}))

/**
 * GET /api/admin/analytics/discovery-rate
 * Get discovery rate over time (for charts)
 */
router.get('/discovery-rate', asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days as string) || 30))
  const now = Date.now()
  const startTime = now - days * 24 * 60 * 60 * 1000

  // Group discoveries by day
  const discoveries = db.prepare(`
    SELECT
      DATE(discovered_at / 1000, 'unixepoch') as date,
      COUNT(*) as count
    FROM spaces
    WHERE state = 'discovered' AND discovered_at > ?
    GROUP BY DATE(discovered_at / 1000, 'unixepoch')
    ORDER BY date
  `).all(startTime) as Array<{ date: string; count: number }>

  res.json({
    period: `${days} days`,
    data: discoveries.map(d => ({
      date: d.date,
      discoveries: d.count,
    })),
  })
}))

/**
 * GET /api/admin/analytics/user-growth
 * Get user registration over time
 */
router.get('/user-growth', asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days as string) || 30))
  const now = Date.now()
  const startTime = now - days * 24 * 60 * 60 * 1000

  const growth = db.prepare(`
    SELECT
      DATE(created_at / 1000, 'unixepoch') as date,
      COUNT(*) as new_users
    FROM users
    WHERE created_at > ?
    GROUP BY DATE(created_at / 1000, 'unixepoch')
    ORDER BY date
  `).all(startTime) as Array<{ date: string; new_users: number }>

  // Calculate cumulative total
  const totalBefore = db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE created_at <= ?
  `).get(startTime) as { count: number }

  let cumulative = totalBefore.count
  const dataWithCumulative = growth.map(g => {
    cumulative += g.new_users
    return {
      date: g.date,
      newUsers: g.new_users,
      totalUsers: cumulative,
    }
  })

  res.json({
    period: `${days} days`,
    data: dataWithCumulative,
  })
}))

/**
 * GET /api/admin/analytics/top-users
 * Get top users by various metrics
 */
router.get('/top-users', asyncHandler(async (req: Request, res: Response) => {
  const metric = (req.query.metric as string) || 'agi'
  const limit = Math.min(50, Math.max(10, parseInt(req.query.limit as string) || 20))

  const columnMap: Record<string, string> = {
    agi: 'total_agi_earned',
    points: 'points',
    usdc: 'usdc_spent',
    agentic: 'agentic_balance',
  }

  const column = columnMap[metric] || 'total_agi_earned'

  const topUsers = db.prepare(`
    SELECT id, wallet, user_level, ${column} as value
    FROM users
    WHERE banned_at IS NULL
    ORDER BY ${column} DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string
    wallet: string
    user_level: number
    value: number
  }>

  res.json({
    metric,
    users: topUsers.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      wallet: u.wallet,
      userLevel: u.user_level,
      value: u.value,
    })),
  })
}))

export default router
