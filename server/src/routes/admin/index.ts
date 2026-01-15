/**
 * Admin Routes Index
 *
 * Mounts all admin sub-routes with requireAdmin middleware.
 */

import { Router } from 'express'
import { requireAdmin } from '../../middleware/adminAuth.js'
import usersRouter from './users.js'
import analyticsRouter from './analytics.js'
import spacesRouter from './spaces.js'
import agentsRouter from './agents.js'
import interventionsRouter from './interventions.js'
import eventsRouter from './events.js'
import logsRouter from './logs.js'

const router = Router()

// All admin routes require admin authentication
router.use(requireAdmin)

// Admin access check endpoint
router.get('/check', (_req, res) => {
  res.json({ isAdmin: true })
})

// Mount sub-routers
router.use('/users', usersRouter)
router.use('/analytics', analyticsRouter)
router.use('/spaces', spacesRouter)
router.use('/agents', agentsRouter)
router.use('/interventions', interventionsRouter)
router.use('/events', eventsRouter)
router.use('/logs', logsRouter)

export default router
