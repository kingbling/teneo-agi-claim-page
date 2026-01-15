/**
 * Admin Logs Routes
 *
 * Endpoints for retrieving and managing server logs.
 */

import { Router, Request, Response } from 'express'
import { getLogs, clearLogs, LogLevel } from '../../utils/logCapture.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

/**
 * GET /api/admin/logs
 * Get recent server logs with optional filtering
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 100))
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0)
  const level = req.query.level as LogLevel | undefined
  const search = req.query.search as string | undefined
  const since = req.query.since ? parseInt(req.query.since as string) : undefined

  const { logs, total } = getLogs({ limit, offset, level, search, since })

  res.json({
    logs,
    total,
    limit,
    offset,
    hasMore: offset + logs.length < total,
  })
}))

/**
 * DELETE /api/admin/logs
 * Clear all logs (admin only)
 */
router.delete('/', asyncHandler(async (_req: Request, res: Response) => {
  clearLogs()
  res.json({ success: true, message: 'Logs cleared' })
}))

export default router
