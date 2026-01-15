/**
 * Routes Index - Masterplan 2026
 *
 * Central export for all API route modules.
 * Import this file and mount routes in the main server.
 *
 * Usage in index.ts:
 *   import { shipsRouter, synapsesRouter, ... } from './routes/index.js'
 *   app.use('/api/ships', shipsRouter)
 *   app.use('/api/synapses', synapsesRouter)
 *   ...
 */

export { default as authRouter } from './auth.js'
export { default as shipsRouter } from './ships.js'
export { default as synapsesRouter } from './synapses.js'
export { default as shopRouter } from './shop.js'
export { default as sectorsRouter } from './sectors.js'
export { default as leaderboardsRouter } from './leaderboards.js'
export { default as eventsRouter } from './events.js'
export { default as adminRouter } from './admin/index.js'

/**
 * Route mounting helper
 *
 * Mounts all Masterplan 2026 routes to an Express app.
 * Note: This does NOT include legacy agent routes.
 *
 * @param app - Express application instance
 */
import { Express } from 'express'
import authRouter from './auth.js'
import shipsRouter from './ships.js'
import synapsesRouter from './synapses.js'
import shopRouter from './shop.js'
import sectorsRouter from './sectors.js'
import leaderboardsRouter from './leaderboards.js'
import eventsRouter from './events.js'
import adminRouter from './admin/index.js'

export function mountMasterplanRoutes(app: Express): void {
  // Auth routes (unauthenticated)
  app.use('/api/auth', authRouter)

  // Ship routes
  app.use('/api/ships', shipsRouter)

  // Ship routes that need user context
  // Note: ships.ts also exports a handler for GET /api/users/:userId/ships
  // This route is mounted directly to handle the user-specific path
  app.get('/api/users/:userId/ships', (req, res, next) => {
    // Forward to ships router's user ships handler
    req.url = `/users/${req.params.userId}/ships`
    shipsRouter(req, res, next)
  })

  // Synapse routes
  app.use('/api/synapses', synapsesRouter)

  // Shop routes
  app.use('/api/shop', shopRouter)

  // User items route (mounted separately for path)
  app.get('/api/users/:userId/items', (req, res, next) => {
    req.url = `/users/${req.params.userId}/items`
    shopRouter(req, res, next)
  })

  // Sector routes
  app.use('/api/sectors', sectorsRouter)

  // Leaderboard routes
  app.use('/api/leaderboards', leaderboardsRouter)

  // Event routes
  app.use('/api/events', eventsRouter)

  // Admin routes (requires admin auth)
  app.use('/api/admin', adminRouter)
}
