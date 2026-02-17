/**
 * Teneo Store
 *
 * Manages Teneo community points integration.
 * Links game users to their Teneo accounts and tracks point balances.
 */

import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import { API_URL } from '@/constants/api'
import { authStore } from './authStore'
import { log } from '@/utils/logger'
import type { TeneoPointsEvent, TeneoBurnEvent } from '@/types/api.generated'

export interface TeneoState {
  isLinked: boolean
  pointsTotal: number
  isLinking: boolean
  linkError: string | null
}

const initialState: TeneoState = {
  isLinked: false,
  pointsTotal: 0,
  isLinking: false,
  linkError: null,
}

function createTeneoStore() {
  const [state, setState] = createStore<TeneoState>({ ...initialState })

  /**
   * Link the current user's wallet to their Teneo community account.
   * Called automatically after auth succeeds.
   */
  async function linkTeneoAccount(): Promise<boolean> {
    setState({ isLinking: true, linkError: null })

    try {
      const response = await fetch(`${API_URL}/api/teneo/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authStore.getAuthHeader(),
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to link Teneo account')
      }

      const data = await response.json()

      setState({
        isLinked: data.linked,
        pointsTotal: data.pointsTotal ?? 0,
        isLinking: false,
      })
      if (data.linked) {
        log.auth.success('Teneo account linked, points:', data.pointsTotal)
      } else {
        log.auth.info('Teneo link skipped:', data.error)
      }
      return data.linked
    } catch (error) {
      const err = error as { message?: string }
      setState({
        isLinking: false,
        linkError: err.message || 'Failed to link Teneo account',
      })
      log.auth.error('Teneo link failed:', error)
      return false
    }
  }

  /**
   * Refresh balance from community API.
   */
  async function refreshBalance(): Promise<void> {
    if (!state.isLinked) return

    try {
      const response = await fetch(`${API_URL}/api/teneo/balance`, {
        headers: authStore.getAuthHeader(),
      })

      if (response.ok) {
        const data = await response.json()
        setState({ pointsTotal: data.pointsTotal })
      }
    } catch {
      // Silent fail - balance will sync via WebSocket
    }
  }

  /**
   * Handle teneo:points WebSocket event (sent on auth or balance refresh).
   */
  function handleTeneoPoints(data: TeneoPointsEvent) {
    setState({
      isLinked: data.linked,
      pointsTotal: data.pointsTotal,
    })
  }

  /**
   * Handle teneo:burn WebSocket event (sent when travel costs are deducted).
   */
  function handleTeneoBurn(data: TeneoBurnEvent) {
    setState({ pointsTotal: data.newBalance })
  }

  /**
   * Reset state on logout.
   */
  function reset() {
    setState({ ...initialState })
  }

  return {
    // State (reactive getters)
    get isLinked() { return state.isLinked },
    get pointsTotal() { return state.pointsTotal },
    get isLinking() { return state.isLinking },
    get linkError() { return state.linkError },

    // Actions
    linkTeneoAccount,
    refreshBalance,
    handleTeneoPoints,
    handleTeneoBurn,
    reset,
  }
}

export const teneoStore = createRoot(createTeneoStore)
