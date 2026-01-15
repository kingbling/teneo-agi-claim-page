/**
 * Leaderboard API Routes - Masterplan 2026
 *
 * Leaderboards track player rankings across different metrics:
 * - weekly_agi: $AGI earned in the current week
 * - total_discoveries: Total synapses discovered all-time
 * - user_level: User level based on USDC spent
 */

import { Router, Request, Response } from 'express'
import { db } from '../db/index.js'

const router = Router()

// Valid leaderboard types
type LeaderboardType = 'weekly_agi' | 'total_discoveries' | 'user_level'

// Type for leaderboard entry
interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  avatarUrl?: string
  value: number
  valueLabel: string
  change?: number  // Rank change from previous period
}

interface LeaderboardResponse {
  type: LeaderboardType
  title: string
  description: string
  entries: LeaderboardEntry[]
  totalParticipants: number
  lastUpdated: number
  periodStart?: number
  periodEnd?: number
}

// Helper to get week boundaries
function getWeekBoundaries(): { start: number; end: number } {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const startOfWeek = new Date(now)
  startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek)
  startOfWeek.setUTCHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7)

  return {
    start: startOfWeek.getTime(),
    end: endOfWeek.getTime(),
  }
}

// Format value for display
function formatValue(value: number, type: LeaderboardType): string {
  switch (type) {
    case 'weekly_agi':
    case 'total_discoveries':
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
      return value.toString()
    case 'user_level':
      return `Level ${value}`
    default:
      return value.toString()
  }
}

/**
 * GET /api/leaderboards/:type
 * Get leaderboard by type
 */
router.get('/:type', (req: Request, res: Response) => {
  try {
    const { type } = req.params as { type: LeaderboardType }
    const { limit, offset, userId } = req.query

    const validTypes: LeaderboardType[] = ['weekly_agi', 'total_discoveries', 'user_level']
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid leaderboard type. Must be one of: ${validTypes.join(', ')}`
      })
    }

    const queryLimit = Math.min(parseInt(limit as string, 10) || 100, 500)
    const queryOffset = parseInt(offset as string, 10) || 0

    let query: string
    let countQuery: string
    let params: any[] = []
    let title: string
    let description: string
    let periodStart: number | undefined
    let periodEnd: number | undefined

    switch (type) {
      case 'weekly_agi':
        const weekBounds = getWeekBoundaries()
        periodStart = weekBounds.start
        periodEnd = weekBounds.end

        // Use lottery_draws table for weekly AGI tracking
        query = `
          SELECT
            u.id as userId,
            u.wallet as username,
            COALESCE(SUM(ld.reward_agi), 0) as value
          FROM users u
          LEFT JOIN lottery_draws ld ON ld.winner_user_id = u.id
            AND ld.drawn_at >= ? AND ld.drawn_at < ?
          GROUP BY u.id
          HAVING value > 0
          ORDER BY value DESC
          LIMIT ? OFFSET ?
        `
        countQuery = `
          SELECT COUNT(DISTINCT winner_user_id) as total FROM lottery_draws
          WHERE drawn_at >= ? AND drawn_at < ?
        `
        params = [weekBounds.start, weekBounds.end, queryLimit, queryOffset]
        title = 'Weekly $AGI Earned'
        description = 'Top earners this week'
        break

      case 'total_discoveries':
        // Sum spaces_discovered from agents grouped by owner
        query = `
          SELECT
            u.id as userId,
            u.wallet as username,
            COALESCE(SUM(a.spaces_discovered), 0) as value
          FROM users u
          LEFT JOIN agents a ON a.owner_id = u.id
          GROUP BY u.id
          HAVING value > 0
          ORDER BY value DESC
          LIMIT ? OFFSET ?
        `
        countQuery = `
          SELECT COUNT(DISTINCT owner_id) as total FROM agents
          WHERE spaces_discovered > 0
        `
        params = [queryLimit, queryOffset]
        title = 'Total Discoveries'
        description = 'All-time synapse discoveries'
        break

      case 'user_level':
        // Use user_level based on USDC spent (Masterplan 2026)
        query = `
          SELECT
            u.id as userId,
            u.wallet as username,
            u.user_level as value
          FROM users u
          WHERE u.user_level > 1
          ORDER BY u.user_level DESC, u.usdc_spent DESC
          LIMIT ? OFFSET ?
        `
        countQuery = `
          SELECT COUNT(*) as total FROM users
          WHERE user_level > 1
        `
        params = [queryLimit, queryOffset]
        title = 'User Level'
        description = 'Highest user levels achieved (USDC-based)'
        break

      default:
        return res.status(400).json({ error: 'Invalid leaderboard type' })
    }

    // Execute queries
    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as any[]

    // Get total participant count
    let totalParticipants = 0
    try {
      const countStmt = db.prepare(countQuery)
      const countParams = type === 'weekly_agi'
        ? [periodStart, periodEnd]
        : []
      const countResult = countStmt.get(...countParams) as { total: number }
      totalParticipants = countResult?.total || 0
    } catch {
      totalParticipants = rows.length
    }

    // Transform to leaderboard entries
    const entries: LeaderboardEntry[] = rows.map((row, index) => ({
      rank: queryOffset + index + 1,
      userId: row.userId,
      username: row.username || `User ${row.userId.slice(0, 8)}`,
      value: row.value,
      valueLabel: formatValue(row.value, type),
      change: undefined,  // TODO: Calculate rank change from previous period
    }))

    // If userId is provided, find their rank
    let userEntry: LeaderboardEntry | undefined
    if (userId && !entries.find(e => e.userId === userId)) {
      // User not in current page, find their position
      let userQuery: string
      let userParams: any[]

      switch (type) {
        case 'weekly_agi':
          userQuery = `
            SELECT
              (SELECT COUNT(*) + 1 FROM (
                SELECT winner_user_id, SUM(reward_agi) as total
                FROM lottery_draws
                WHERE drawn_at >= ? AND drawn_at < ?
                GROUP BY winner_user_id
                HAVING total > (
                  SELECT COALESCE(SUM(reward_agi), 0)
                  FROM lottery_draws
                  WHERE winner_user_id = ? AND drawn_at >= ? AND drawn_at < ?
                )
              )) as rank,
              COALESCE(SUM(reward_agi), 0) as value
            FROM lottery_draws
            WHERE winner_user_id = ? AND drawn_at >= ? AND drawn_at < ?
          `
          userParams = [periodStart, periodEnd, userId, periodStart, periodEnd, userId, periodStart, periodEnd]
          break

        case 'total_discoveries':
          userQuery = `
            SELECT
              (SELECT COUNT(*) + 1 FROM (
                SELECT owner_id, SUM(spaces_discovered) as total
                FROM agents
                GROUP BY owner_id
                HAVING total > (
                  SELECT COALESCE(SUM(spaces_discovered), 0) FROM agents WHERE owner_id = ?
                )
              )) as rank,
              COALESCE(SUM(spaces_discovered), 0) as value
            FROM agents
            WHERE owner_id = ?
          `
          userParams = [userId, userId]
          break

        case 'user_level':
          userQuery = `
            SELECT
              (SELECT COUNT(*) + 1 FROM users WHERE user_level > (
                SELECT COALESCE(user_level, 1) FROM users WHERE id = ?
              )) as rank,
              COALESCE(user_level, 1) as value
            FROM users
            WHERE id = ?
          `
          userParams = [userId, userId]
          break

        default:
          userQuery = ''
          userParams = []
      }

      if (userQuery) {
        try {
          const userStmt = db.prepare(userQuery)
          const userRow = userStmt.get(...userParams) as { rank: number; value: number } | undefined

          if (userRow && userRow.value > 0) {
            userEntry = {
              rank: userRow.rank,
              userId: userId as string,
              username: `User ${(userId as string).slice(0, 8)}`,
              value: userRow.value,
              valueLabel: formatValue(userRow.value, type),
            }
          }
        } catch {
          // User position lookup failed, ignore
        }
      }
    }

    const response: LeaderboardResponse & { userPosition?: LeaderboardEntry } = {
      type,
      title,
      description,
      entries,
      totalParticipants,
      lastUpdated: Date.now(),
      periodStart,
      periodEnd,
    }

    if (userEntry) {
      response.userPosition = userEntry
    }

    res.json(response)
  } catch (error) {
    console.error('Failed to get leaderboard:', error)
    res.status(500).json({ error: 'Failed to get leaderboard' })
  }
})

export default router
