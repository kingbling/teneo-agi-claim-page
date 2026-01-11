/**
 * Event API Routes - Masterplan 2026
 *
 * Events are special time-limited activities that offer bonus rewards.
 * Examples include double XP weekends, rare synapse spawns, and community challenges.
 */

import { Router, Request, Response } from 'express'
import { db } from '../db/index.js'

const router = Router()

// Event types
type EventType =
  | 'double_xp'
  | 'bonus_agi'
  | 'special_synapse'
  | 'community_challenge'
  | 'sector_rush'
  | 'lucky_hour'

type EventState = 'upcoming' | 'active' | 'completed'

// Type for event response
interface EventResponse {
  id: string
  type: EventType
  name: string
  description: string
  state: EventState
  startTime: number
  endTime: number
  multiplier: number
  isActive: boolean
  createdAt: number
}

// Helper to determine event state
function getEventState(startTime: number, endTime: number): EventState {
  const now = Date.now()
  if (now < startTime) return 'upcoming'
  if (now > endTime) return 'completed'
  return 'active'
}

// Helper to format time remaining
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Ended'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${seconds}s`
}

// Helper to convert row to EventResponse
function rowToEvent(row: any): EventResponse {
  return {
    id: row.id,
    type: row.event_type as EventType,
    name: row.name,
    description: row.description || '',
    state: getEventState(row.start_time, row.end_time),
    startTime: row.start_time,
    endTime: row.end_time,
    multiplier: row.multiplier,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  }
}

/**
 * GET /api/events
 * Get all events with optional filtering
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { state, limit } = req.query
    const now = Date.now()

    let query = 'SELECT * FROM live_events WHERE 1=1'
    const params: any[] = []

    // Filter by state
    if (state === 'active') {
      query += ' AND start_time <= ? AND end_time >= ?'
      params.push(now, now)
    } else if (state === 'upcoming') {
      query += ' AND start_time > ?'
      params.push(now)
    } else if (state === 'completed') {
      query += ' AND end_time < ?'
      params.push(now)
    }

    query += ' ORDER BY start_time DESC'

    if (limit) {
      query += ' LIMIT ?'
      params.push(parseInt(limit as string, 10))
    }

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as any[]

    const events = rows.map(rowToEvent)

    res.json({ events })
  } catch (error) {
    console.error('Failed to get events:', error)
    res.status(500).json({ error: 'Failed to get events' })
  }
})

/**
 * GET /api/events/active
 * Get all currently active events
 */
router.get('/active', (req: Request, res: Response) => {
  try {
    const now = Date.now()

    // Get active events
    const activeStmt = db.prepare(`
      SELECT * FROM live_events
      WHERE start_time <= ? AND end_time >= ?
      ORDER BY end_time ASC
    `)
    const activeRows = activeStmt.all(now, now) as any[]
    const activeEvents = activeRows.map(rowToEvent)

    // Get upcoming events starting within the next 24 hours
    const upcomingStmt = db.prepare(`
      SELECT * FROM live_events
      WHERE start_time > ? AND start_time <= ?
      ORDER BY start_time ASC
      LIMIT 5
    `)
    const upcomingRows = upcomingStmt.all(now, now + 24 * 60 * 60 * 1000) as any[]
    const upcomingEvents = upcomingRows.map(rowToEvent)

    res.json({
      active: activeEvents,
      upcoming: upcomingEvents,
      message: activeEvents.length === 0 && upcomingEvents.length === 0
        ? 'No active or upcoming events at this time'
        : undefined
    })
  } catch (error) {
    console.error('Failed to get active events:', error)
    res.status(500).json({ error: 'Failed to get active events' })
  }
})

/**
 * GET /api/events/:id
 * Get detailed information about a specific event
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const stmt = db.prepare('SELECT * FROM live_events WHERE id = ?')
    const row = stmt.get(id) as any

    if (!row) {
      return res.status(404).json({ error: 'Event not found' })
    }

    const event = rowToEvent(row)

    // Calculate time remaining for active events
    let timeRemaining: { ms: number; formatted: string } | undefined
    if (event.state === 'active') {
      const ms = row.end_time - Date.now()
      timeRemaining = {
        ms,
        formatted: formatTimeRemaining(ms),
      }
    }

    res.json({
      event,
      timeRemaining,
    })
  } catch (error) {
    console.error('Failed to get event:', error)
    res.status(500).json({ error: 'Failed to get event details' })
  }
})

/**
 * GET /api/events/:id/multiplier
 * Get the current multiplier for an event (useful for real-time rewards calculation)
 */
router.get('/:id/multiplier', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const now = Date.now()

    const stmt = db.prepare(`
      SELECT multiplier, start_time, end_time FROM live_events
      WHERE id = ? AND start_time <= ? AND end_time >= ?
    `)
    const row = stmt.get(id, now, now) as { multiplier: number } | undefined

    if (!row) {
      // Event not active
      return res.json({ multiplier: 1.0, active: false })
    }

    res.json({
      multiplier: row.multiplier,
      active: true,
    })
  } catch (error) {
    console.error('Failed to get event multiplier:', error)
    res.status(500).json({ error: 'Failed to get event multiplier' })
  }
})

/**
 * GET /api/events/current-multipliers
 * Get all active event multipliers combined
 */
router.get('/current-multipliers', (req: Request, res: Response) => {
  try {
    const now = Date.now()

    const stmt = db.prepare(`
      SELECT event_type, multiplier FROM live_events
      WHERE start_time <= ? AND end_time >= ?
    `)
    const rows = stmt.all(now, now) as Array<{ event_type: string; multiplier: number }>

    // Combine multipliers by type
    const multipliers: Record<string, number> = {}
    let totalMultiplier = 1.0

    for (const row of rows) {
      multipliers[row.event_type] = row.multiplier
      // Stack multipliers additively for different types
      if (row.event_type === 'double_xp') {
        multipliers.brainXp = (multipliers.brainXp || 1) * row.multiplier
      } else if (row.event_type === 'bonus_agi') {
        multipliers.agi = (multipliers.agi || 1) * row.multiplier
      }
      totalMultiplier *= row.multiplier
    }

    res.json({
      multipliers,
      totalMultiplier,
      activeEventCount: rows.length,
    })
  } catch (error) {
    console.error('Failed to get current multipliers:', error)
    res.status(500).json({ error: 'Failed to get current multipliers' })
  }
})

export default router
