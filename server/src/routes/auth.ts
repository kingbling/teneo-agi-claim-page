/**
 * Auth Routes
 *
 * Wallet-based authentication using message signing.
 */

import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { db, getUserByWallet, getUser } from '../db/index.js'
import { generateToken, verifyToken } from '../utils/jwt.js'
import {
  generateNonce,
  createSignMessage,
  verifyWalletSignature,
  isValidWalletAddress,
  normalizeWalletAddress,
} from '../utils/walletAuth.js'
import { asyncHandler, sendError } from '../middleware/errorHandler.js'

const router = Router()

// Starting points for new users
const STARTING_USER_POINTS = 1000

// Nonce expiry time (5 minutes)
const NONCE_EXPIRY_MS = 5 * 60 * 1000

/**
 * GET /api/auth/nonce
 *
 * Request a nonce for wallet signature authentication.
 * Creates a user record if one doesn't exist.
 */
router.get('/nonce', asyncHandler(async (req: Request, res: Response) => {
  const { wallet } = req.query as { wallet?: string }

  if (!wallet) {
    sendError(res, 400, 'Wallet address required')
    return
  }

  if (!isValidWalletAddress(wallet)) {
    sendError(res, 400, 'Invalid wallet address')
    return
  }

  const normalizedWallet = normalizeWalletAddress(wallet)
  const nonce = generateNonce()
  const message = createSignMessage(normalizedWallet, nonce)
  const issuedAt = Date.now()

  // Get or create user record
  const user = getUserByWallet(normalizedWallet)

  if (user) {
    // Update existing user with new nonce
    db.prepare(`
      UPDATE users SET auth_nonce = ?, auth_nonce_issued_at = ? WHERE id = ?
    `).run(nonce, issuedAt, user.id)
  } else {
    // Create new user with nonce
    const userId = uuid()
    db.prepare(`
      INSERT INTO users (id, wallet, tier, staked_amount, points, total_loot_earned, created_at, auth_nonce, auth_nonce_issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedWallet, 'free', 0, STARTING_USER_POINTS, 0, Date.now(), nonce, issuedAt)
  }

  res.json({
    nonce,
    message,
    expiresIn: NONCE_EXPIRY_MS,
  })
}))

/**
 * POST /api/auth/verify
 *
 * Verify a wallet signature and issue JWT token.
 */
router.post('/verify', asyncHandler(async (req: Request, res: Response) => {
  const { wallet, signature } = req.body as {
    wallet?: string
    signature?: string
  }

  if (!wallet || !signature) {
    sendError(res, 400, 'Wallet and signature required')
    return
  }

  if (!isValidWalletAddress(wallet)) {
    sendError(res, 400, 'Invalid wallet address')
    return
  }

  const normalizedWallet = normalizeWalletAddress(wallet)

  // Get user with nonce
  const userRow = db.prepare(`
    SELECT * FROM users WHERE wallet = ?
  `).get(normalizedWallet) as any

  if (!userRow) {
    sendError(res, 400, 'No pending authentication for this wallet')
    return
  }

  if (!userRow.auth_nonce || !userRow.auth_nonce_issued_at) {
    sendError(res, 400, 'No pending authentication for this wallet')
    return
  }

  // Check nonce expiry
  const nonceAge = Date.now() - userRow.auth_nonce_issued_at
  if (nonceAge > NONCE_EXPIRY_MS) {
    // Clear expired nonce
    db.prepare('UPDATE users SET auth_nonce = NULL, auth_nonce_issued_at = NULL WHERE id = ?')
      .run(userRow.id)
    sendError(res, 400, 'Authentication expired. Please request a new nonce.')
    return
  }

  // Recreate the message that was signed
  const message = createSignMessage(normalizedWallet, userRow.auth_nonce)

  // Verify signature
  const isValid = await verifyWalletSignature(
    message,
    signature as `0x${string}`,
    normalizedWallet
  )

  if (!isValid) {
    sendError(res, 401, 'Invalid signature')
    return
  }

  // Clear the nonce (one-time use)
  db.prepare('UPDATE users SET auth_nonce = NULL, auth_nonce_issued_at = NULL WHERE id = ?')
    .run(userRow.id)

  // Generate JWT
  const token = generateToken({
    userId: userRow.id,
    wallet: normalizedWallet,
  })

  // Get full user object
  const user = getUser(userRow.id)

  res.json({
    token,
    user,
  })
}))

/**
 * GET /api/auth/me
 *
 * Get current authenticated user from JWT.
 */
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
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

  const user = getUser(payload.userId)

  if (!user) {
    sendError(res, 401, 'User not found')
    return
  }

  res.json({ user })
}))

/**
 * POST /api/auth/refresh
 *
 * Refresh an existing JWT token (extends expiry).
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
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

  // Verify user still exists
  const user = getUser(payload.userId)
  if (!user) {
    sendError(res, 401, 'User not found')
    return
  }

  // Generate new token
  const newToken = generateToken({
    userId: payload.userId,
    wallet: payload.wallet,
  })

  res.json({ token: newToken })
}))

export default router
