import { onMount, onCleanup, createEffect } from 'solid-js'
import { authStore } from '@/stores/authStore'
import { shipStore } from '@/stores/shipStore'
import { userStore } from '@/stores/userStore'

/**
 * useWebSocketConnection - Manages WebSocket connection lifecycle
 *
 * Masterplan 2026: Full WebSocket state sync
 * - Connects on mount and fetches world state (clusters, progress)
 * - Sends auth token to receive user-specific ship data via WebSocket
 * - Re-authenticates when user logs in/out
 * - Ships are delivered via ships:sync messages, not REST
 */
export function useWebSocketConnection() {
  // Connect on mount and fetch initial world state
  onMount(() => {
    shipStore.connect()
    shipStore.fetchWorldState()
  })

  // Re-authenticate when userId changes (login/logout)
  createEffect(() => {
    const userId = userStore.userId
    const ws = shipStore.ws

    if (userId && ws && ws.readyState === WebSocket.OPEN) {
      // User just logged in - send auth token
      const token = authStore.token
      if (token) {
        ws.send(JSON.stringify({
          type: 'auth:identify',
          data: { token },
        }))
      }
      // Also fetch ships via REST as fallback (WebSocket ships:sync may not arrive immediately)
      shipStore.fetchUserShips()
    } else if (userId && (!ws || ws.readyState !== WebSocket.OPEN)) {
      // User logged in but WebSocket not ready - fetch ships via REST
      shipStore.fetchUserShips()
    } else if (!userId && ws && ws.readyState === WebSocket.OPEN) {
      // User logged out - clear auth
      ws.send(JSON.stringify({
        type: 'auth:logout',
        data: {},
      }))
    }
  })

  // Cleanup on unmount
  onCleanup(() => {
    shipStore.disconnect()
  })

  // Return accessor function to preserve reactivity when destructured
  return {
    isConnected: () => shipStore.isConnected
  }
}
