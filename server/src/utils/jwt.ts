/**
 * JWT Utilities
 *
 * Token generation and verification for wallet authentication.
 */

import jwt, { SignOptions } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET as string
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const NODE_ENV = process.env.NODE_ENV || 'development'

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required')
}

// Validate JWT secret strength
const MIN_SECRET_LENGTH = 32
if (JWT_SECRET.length < MIN_SECRET_LENGTH) {
  throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${JWT_SECRET.length})`)
}

// Warn about weak secrets in production
if (NODE_ENV === 'production') {
  const weakPatterns = ['dev', 'test', 'secret', 'change', 'example', 'password']
  const lowerSecret = JWT_SECRET.toLowerCase()
  if (weakPatterns.some(p => lowerSecret.includes(p))) {
    console.warn('⚠️  WARNING: JWT_SECRET appears to be a weak/dev secret. Use: openssl rand -hex 32')
  }
}

export interface JWTPayload {
  userId: string
  wallet: string
  iat?: number
  exp?: number
}

/**
 * Generate a JWT token for an authenticated user
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions)
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}
