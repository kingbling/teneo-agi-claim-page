/**
 * Admin Authentication Middleware
 *
 * Validates JWT token and checks that the user has admin privileges.
 */

import { Request, Response, NextFunction } from 'express'
import { verifyToken, JWTPayload } from '../utils/jwt.js'
import { sendError } from './errorHandler.js'
import { db } from '../db/index.js'

// Admin wallets from environment variable - always have admin access
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(w => w.length > 0)

export interface AdminRequest extends Request {
  admin?: JWTPayload
}

/**
 * Middleware that requires a valid JWT token from an admin user.
 * Attaches admin info to req.admin if successful.
 */
export function requireAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 401, 'Authorization header required')
    return
  }

  const token = authHeader.slice(7)
  const payload = verifyToken(token)

  if (!payload) {
    sendError(res, 401, 'Invalid or expired token')
    return
  }

  // Check if user exists and has admin flag
  const user = db.prepare('SELECT is_admin, banned_at FROM users WHERE id = ?').get(payload.userId) as
    | { is_admin: number; banned_at: number | null }
    | undefined

  if (!user) {
    sendError(res, 401, 'User not found')
    return
  }

  if (user.banned_at) {
    sendError(res, 403, 'Account is banned')
    return
  }

  // Check if wallet is hardcoded admin OR has admin flag in database
  const isHardcodedAdmin = ADMIN_WALLETS.includes(payload.wallet.toLowerCase())
  if (!isHardcodedAdmin && user.is_admin !== 1) {
    sendError(res, 403, 'Admin access required')
    return
  }

  req.admin = payload
  next()
}
