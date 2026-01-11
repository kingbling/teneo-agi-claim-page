import { useEffect } from 'react'
import { useShipStore } from '@/stores/shipStore'
import { useUserStore } from '@/stores/userStore'

/**
 * useWebSocketConnection - Manages WebSocket connection lifecycle
 *
 * Masterplan 2026: Updated to use shipStore instead of agentStore
 * Automatically connects on mount, fetches initial world state and user ships,
 * and disconnects on unmount.
 */
export function useWebSocketConnection() {
  const { connect, disconnect, fetchWorldState, fetchUserShips, isConnected } = useShipStore()
  const { userId } = useUserStore()

  useEffect(() => {
    connect()
    fetchWorldState()
  }, [connect, fetchWorldState])

  // Fetch user ships when userId is available
  useEffect(() => {
    if (userId) {
      fetchUserShips()
    }
  }, [userId, fetchUserShips])

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect()
  }, [disconnect])

  return { isConnected }
}
