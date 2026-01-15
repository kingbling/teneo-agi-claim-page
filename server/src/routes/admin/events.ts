/**
 * Admin Live Events Routes
 *
 * CRUD for live events with multipliers and timing.
 */

import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { db } from '../../db/index.js'
import { asyncHandler, sendError } from '../../middleware/errorHandler.js'

const router = Router()

interface EventRow {
  id: string
  name: string
  description: string | null
  event_type: string
  multiplier: number
  is_active: number
  start_time: number
  end_time: number
  created_at: number
}

/**
 * GET /api/admin/events
 * List all live events
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const includeExpired = req.query.includeExpired === 'true'

  let query = 'SELECT * FROM live_events'
  if (!includeExpired) {
    query += ' WHERE end_time > ? OR is_active = 1'
  }
  query += ' ORDER BY start_time DESC'

  const events = includeExpired
    ? db.prepare(query).all() as EventRow[]
    : db.prepare(query).all(Date.now()) as EventRow[]

  res.json({
    events: events.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      eventType: e.event_type,
      multiplier: e.multiplier,
      isActive: e.is_active === 1,
      startTime: e.start_time,
      endTime: e.end_time,
      createdAt: e.created_at,
      status: getEventStatus(e),
    })),
  })
}))

function getEventStatus(event: EventRow): string {
  const now = Date.now()
  if (event.is_active !== 1) return 'inactive'
  if (now < event.start_time) return 'upcoming'
  if (now > event.end_time) return 'expired'
  return 'active'
}

/**
 * GET /api/admin/events/:id
 * Get event details
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const event = db.prepare('SELECT * FROM live_events WHERE id = ?').get(id) as EventRow | undefined

  if (!event) {
    sendError(res, 404, 'Event not found')
    return
  }

  res.json({
    event: {
      id: event.id,
      name: event.name,
      description: event.description,
      eventType: event.event_type,
      multiplier: event.multiplier,
      isActive: event.is_active === 1,
      startTime: event.start_time,
      endTime: event.end_time,
      createdAt: event.created_at,
      status: getEventStatus(event),
    },
  })
}))

/**
 * POST /api/admin/events
 * Create a new live event
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, description, eventType, multiplier, startTime, endTime, isActive } = req.body as {
    name: string
    description?: string
    eventType: string
    multiplier: number
    startTime: number
    endTime: number
    isActive?: boolean
  }

  if (!name || !eventType || !multiplier || !startTime || !endTime) {
    sendError(res, 400, 'name, eventType, multiplier, startTime, and endTime are required')
    return
  }

  if (startTime >= endTime) {
    sendError(res, 400, 'startTime must be before endTime')
    return
  }

  const validEventTypes = ['points_boost', 'agi_boost', 'discovery_boost', 'global_boost']
  if (!validEventTypes.includes(eventType)) {
    sendError(res, 400, `eventType must be one of: ${validEventTypes.join(', ')}`)
    return
  }

  const id = uuid()
  const now = Date.now()

  db.prepare(`
    INSERT INTO live_events (id, name, description, event_type, multiplier, is_active, start_time, end_time, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || null, eventType, multiplier, isActive ? 1 : 0, startTime, endTime, now)

  const event = db.prepare('SELECT * FROM live_events WHERE id = ?').get(id) as EventRow

  res.status(201).json({
    success: true,
    event: {
      id: event.id,
      name: event.name,
      description: event.description,
      eventType: event.event_type,
      multiplier: event.multiplier,
      isActive: event.is_active === 1,
      startTime: event.start_time,
      endTime: event.end_time,
      createdAt: event.created_at,
      status: getEventStatus(event),
    },
  })
}))

/**
 * PATCH /api/admin/events/:id
 * Update an event
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, description, eventType, multiplier, startTime, endTime, isActive } = req.body as {
    name?: string
    description?: string
    eventType?: string
    multiplier?: number
    startTime?: number
    endTime?: number
    isActive?: boolean
  }

  const event = db.prepare('SELECT id FROM live_events WHERE id = ?').get(id)
  if (!event) {
    sendError(res, 404, 'Event not found')
    return
  }

  const updates: string[] = []
  const params: (string | number | null)[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(name)
  }
  if (description !== undefined) {
    updates.push('description = ?')
    params.push(description || null)
  }
  if (eventType !== undefined) {
    const validEventTypes = ['points_boost', 'agi_boost', 'discovery_boost', 'global_boost']
    if (!validEventTypes.includes(eventType)) {
      sendError(res, 400, `eventType must be one of: ${validEventTypes.join(', ')}`)
      return
    }
    updates.push('event_type = ?')
    params.push(eventType)
  }
  if (multiplier !== undefined) {
    updates.push('multiplier = ?')
    params.push(Math.max(0.1, multiplier))
  }
  if (startTime !== undefined) {
    updates.push('start_time = ?')
    params.push(startTime)
  }
  if (endTime !== undefined) {
    updates.push('end_time = ?')
    params.push(endTime)
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?')
    params.push(isActive ? 1 : 0)
  }

  if (updates.length === 0) {
    sendError(res, 400, 'No valid fields to update')
    return
  }

  params.push(id)
  db.prepare(`UPDATE live_events SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const updatedEvent = db.prepare('SELECT * FROM live_events WHERE id = ?').get(id) as EventRow

  res.json({
    success: true,
    event: {
      id: updatedEvent.id,
      name: updatedEvent.name,
      description: updatedEvent.description,
      eventType: updatedEvent.event_type,
      multiplier: updatedEvent.multiplier,
      isActive: updatedEvent.is_active === 1,
      startTime: updatedEvent.start_time,
      endTime: updatedEvent.end_time,
      createdAt: updatedEvent.created_at,
      status: getEventStatus(updatedEvent),
    },
  })
}))

/**
 * DELETE /api/admin/events/:id
 * Delete an event
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const event = db.prepare('SELECT id, name FROM live_events WHERE id = ?').get(id) as { id: string; name: string } | undefined
  if (!event) {
    sendError(res, 404, 'Event not found')
    return
  }

  db.prepare('DELETE FROM live_events WHERE id = ?').run(id)

  res.json({
    success: true,
    message: `Event "${event.name}" deleted`,
  })
}))

/**
 * POST /api/admin/events/:id/activate
 * Activate an event
 */
router.post('/:id/activate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const event = db.prepare('SELECT id, name FROM live_events WHERE id = ?').get(id) as { id: string; name: string } | undefined
  if (!event) {
    sendError(res, 404, 'Event not found')
    return
  }

  db.prepare('UPDATE live_events SET is_active = 1 WHERE id = ?').run(id)

  res.json({
    success: true,
    message: `Event "${event.name}" activated`,
  })
}))

/**
 * POST /api/admin/events/:id/deactivate
 * Deactivate an event
 */
router.post('/:id/deactivate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const event = db.prepare('SELECT id, name FROM live_events WHERE id = ?').get(id) as { id: string; name: string } | undefined
  if (!event) {
    sendError(res, 404, 'Event not found')
    return
  }

  db.prepare('UPDATE live_events SET is_active = 0 WHERE id = ?').run(id)

  res.json({
    success: true,
    message: `Event "${event.name}" deactivated`,
  })
}))

export default router
