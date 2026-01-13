/**
 * Error Handling Middleware - Masterplan 2026
 *
 * Provides shared error handling utilities to reduce duplication across routes.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'
import { getAgent, getUser } from '../db/index.js'

/**
 * Async handler wrapper - catches errors from async route handlers
 * and passes them to Express error middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Validates that a ship (agent) exists and attaches it to req.locals
 */
export function validateShipExists(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { id } = req.params
  const agent = getAgent(id)

  if (!agent) {
    res.status(404).json({ error: 'Ship not found' })
    return
  }

  res.locals.agent = agent
  next()
}

/**
 * Validates that a user exists and attaches it to req.locals
 */
export function validateUserExists(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { userId } = req.params
  const user = getUser(userId)

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.locals.user = user
  next()
}

/**
 * Standard error response helper
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  details?: unknown
): Response {
  const response: { error: string; details?: unknown } = { error: message }
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details
  }
  return res.status(status).json(response)
}
