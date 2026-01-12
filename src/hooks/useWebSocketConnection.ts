import { onMount, onCleanup, createEffect } from 'solid-js'
import { shipStore } from '@/stores/shipStore'
import { userStore } from '@/stores/userStore'

/**
 * useWebSocketConnection - Manages WebSocket connection lifecycle
 *
 * Masterplan 2026: Updated to use shipStore instead of agentStore
 * Automatically connects on mount, fetches initial world state and user ships,
 * and disconnects on unmount.
 */
export function useWebSocketConnection() {
  // Connect on mount and fetch initial world state
  onMount(() => {
    shipStore.connect()
    shipStore.fetchWorldState()
  })

  // Fetch user ships when userId is available
  createEffect(() => {
    const userId = userStore.userId
    if (userId) {
      shipStore.fetchUserShips()
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
