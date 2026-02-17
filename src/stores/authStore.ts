/**
 * Auth Store
 *
 * Manages wallet connection and JWT authentication state.
 */

import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  connect,
  disconnect,
  getAccount,
  signMessage,
  watchAccount,
  reconnect,
  type GetAccountReturnType,
} from '@wagmi/core'
import { injected } from '@wagmi/connectors'
import { wagmiConfig } from '@/lib/wagmi'
import { API_URL } from '@/constants/api'
import { log } from '@/utils/logger'
import { teneoStore } from './teneoStore'

export interface AuthState {
  // Wallet connection
  isConnected: boolean
  walletAddress: string | null
  isConnecting: boolean
  connectionError: string | null

  // Authentication
  isAuthenticated: boolean
  token: string | null
  isAuthenticating: boolean
  authError: string | null

  // Initialization
  isInitialized: boolean
}

const initialState: AuthState = {
  isConnected: false,
  walletAddress: null,
  isConnecting: false,
  connectionError: null,

  isAuthenticated: false,
  token: null,
  isAuthenticating: false,
  authError: null,

  isInitialized: false,
}

function createAuthStore() {
  const [state, setState] = createStore<AuthState>({ ...initialState })

  // Callback for auto-login when wallet reconnects
  let onWalletReconnected: ((address: string) => void) | null = null

  /**
   * Initialize the auth store
   * - Watches for wallet connection changes
   * - Attempts to reconnect previously connected wallet
   */
  async function init(): Promise<{ token: string | null; walletAddress: string | null }> {
    // Restore token from localStorage before anything else
    const savedToken = localStorage.getItem('auth_token')
    if (savedToken) {
      setState({ token: savedToken, isAuthenticated: true })
    }

    // Watch for account changes (disconnect, switch account)
    watchAccount(wagmiConfig, {
      onChange: (account: GetAccountReturnType) => {
        if (account.isConnected && account.address) {
          const newAddress = account.address
          const previousAddress = state.walletAddress

          setState({
            isConnected: true,
            walletAddress: newAddress,
          })

          // If wallet changed to a different address, clear authentication
          if (previousAddress && previousAddress.toLowerCase() !== newAddress.toLowerCase()) {
            clearAuth()
          } else if (!previousAddress && state.token && onWalletReconnected) {
            // Wallet just reconnected and we have a token - trigger auto-login
            onWalletReconnected(newAddress)
          }
        } else if (state.isConnected) {
          // Only clear auth if we were previously connected (actual disconnect)
          clearAuth()
        }
      },
    })

    // Try to reconnect previously connected wallet
    try {
      const result = await reconnect(wagmiConfig)
      if (result && result.length > 0 && result[0].accounts.length > 0) {
        const address = result[0].accounts[0]
        setState({
          isConnected: true,
          walletAddress: address,
          isInitialized: true,
        })
        return { token: state.token, walletAddress: address }
      }
    } catch {
      // No previous connection or reconnect failed - that's fine
    }

    // Check initial connection state (fallback)
    const account = getAccount(wagmiConfig)
    if (account.isConnected && account.address) {
      setState({
        isConnected: true,
        walletAddress: account.address,
        isInitialized: true,
      })
      return { token: state.token, walletAddress: account.address }
    }

    setState({ isInitialized: true })
    return { token: state.token, walletAddress: null }
  }

  /**
   * Set callback for when wallet reconnects (used for auto-login)
   */
  function setOnWalletReconnected(callback: ((address: string) => void) | null) {
    onWalletReconnected = callback
  }

  /**
   * Connect to MetaMask wallet
   */
  async function connectWallet(): Promise<boolean> {
    setState({ isConnecting: true, connectionError: null })

    try {
      const result = await connect(wagmiConfig, {
        connector: injected(),
      })

      setState({
        isConnected: true,
        walletAddress: result.accounts[0],
        isConnecting: false,
      })

      return true
    } catch (error) {
      log.auth.error('Failed to connect wallet:', error)
      const err = error as { shortMessage?: string; message?: string }
      setState({
        isConnecting: false,
        connectionError: err.shortMessage || err.message || 'Failed to connect wallet',
      })
      return false
    }
  }

  /**
   * Disconnect wallet and clear all auth state
   */
  async function disconnectWallet(): Promise<void> {
    try {
      await disconnect(wagmiConfig)
    } catch {
      // Disconnect might fail if already disconnected
    }
    clearAuth()
  }

  /**
   * Clear all authentication state
   */
  function clearAuth() {
    localStorage.removeItem('auth_token')
    setState({
      isConnected: false,
      walletAddress: null,
      isAuthenticated: false,
      token: null,
      authError: null,
    })
    teneoStore.reset()
  }

  /**
   * Authenticate with the server using wallet signature
   * 1. Request nonce from server
   * 2. Sign message with MetaMask
   * 3. Verify signature and get JWT
   */
  async function authenticate(): Promise<{ success: boolean; user?: unknown }> {
    if (!state.walletAddress) {
      setState({ authError: 'Wallet not connected' })
      return { success: false }
    }

    setState({ isAuthenticating: true, authError: null })

    try {
      // Step 1: Request nonce
      const nonceResponse = await fetch(
        `${API_URL}/api/auth/nonce?wallet=${encodeURIComponent(state.walletAddress)}`
      )

      if (!nonceResponse.ok) {
        const error = await nonceResponse.json()
        throw new Error(error.error || 'Failed to get nonce')
      }

      const { message } = await nonceResponse.json()

      // Step 2: Sign the message
      const signature = await signMessage(wagmiConfig, {
        message,
      })

      // Step 3: Verify signature and get token
      const verifyResponse = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: state.walletAddress,
          signature,
        }),
      })

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json()
        throw new Error(error.error || 'Authentication failed')
      }

      const { token, user } = await verifyResponse.json()

      localStorage.setItem('auth_token', token)
      setState({
        isAuthenticated: true,
        token,
        isAuthenticating: false,
      })

      // Link Teneo account (non-blocking)
      teneoStore.linkTeneoAccount()

      return { success: true, user }
    } catch (error) {
      log.auth.error('Authentication failed:', error)
      const err = error as { shortMessage?: string; message?: string }
      setState({
        isAuthenticating: false,
        authError: err.shortMessage || err.message || 'Authentication failed',
      })
      return { success: false }
    }
  }

  /**
   * Verify stored token is still valid
   */
  async function verifyToken(): Promise<boolean> {
    if (!state.token) return false

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${state.token}`,
        },
      })

      if (!response.ok) {
        clearAuth()
        return false
      }

      return true
    } catch {
      clearAuth()
      return false
    }
  }

  /**
   * Get authorization header for API requests
   */
  function getAuthHeader(): Record<string, string> {
    if (!state.token) return {}
    return { 'Authorization': `Bearer ${state.token}` }
  }

  /**
   * Logout - disconnect wallet and clear auth
   */
  function logout() {
    disconnectWallet()
  }

  return {
    // State (reactive getters)
    get isConnected() { return state.isConnected },
    get walletAddress() { return state.walletAddress },
    get isConnecting() { return state.isConnecting },
    get connectionError() { return state.connectionError },
    get isAuthenticated() { return state.isAuthenticated },
    get token() { return state.token },
    get isAuthenticating() { return state.isAuthenticating },
    get authError() { return state.authError },
    get isInitialized() { return state.isInitialized },

    // Computed
    get isFullyAuthenticated() {
      return state.isConnected && state.isAuthenticated
    },

    // Actions
    init,
    setOnWalletReconnected,
    connectWallet,
    disconnectWallet,
    authenticate,
    verifyToken,
    getAuthHeader,
    logout,
    clearAuth,
  }
}

export const authStore = createRoot(createAuthStore)
