/**
 * Wallet Authentication Utilities
 *
 * Cryptographic utilities for MetaMask wallet authentication.
 */

import { verifyMessage, getAddress, isAddress } from 'viem'
import { randomBytes } from 'crypto'

/**
 * Generate a cryptographically secure nonce
 */
export function generateNonce(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create the message that will be signed by the wallet
 */
export function createSignMessage(wallet: string, nonce: string): string {
  return `Sign this message to authenticate with Teneo Discovery Portal.

Wallet: ${wallet}
Nonce: ${nonce}

This signature will not trigger any blockchain transaction or cost any gas fees.`
}

/**
 * Verify a wallet signature
 * Returns true if the signature is valid and matches the expected wallet
 */
export async function verifyWalletSignature(
  message: string,
  signature: `0x${string}`,
  expectedWallet: string
): Promise<boolean> {
  try {
    // Normalize address for comparison
    const normalizedExpected = getAddress(expectedWallet)

    // Verify the signature matches the expected wallet
    const valid = await verifyMessage({
      address: normalizedExpected,
      message,
      signature,
    })

    return valid
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

/**
 * Validate wallet address format
 */
export function isValidWalletAddress(address: string): boolean {
  return isAddress(address)
}

/**
 * Normalize wallet address to checksum format
 */
export function normalizeWalletAddress(address: string): string {
  return getAddress(address)
}
