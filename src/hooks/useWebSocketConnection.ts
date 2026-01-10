import { useEffect } from 'react'
import { useAgentStore } from '@/stores/agentStore'

/**
 * useWebSocketConnection - Manages WebSocket connection lifecycle
 *
 * Automatically connects on mount, fetches initial world state,
 * and disconnects on unmount.
 */
export function useWebSocketConnection() {
  const { connect, disconnect, fetchWorldState, isConnected } = useAgentStore()

  useEffect(() => {
    connect()
    fetchWorldState()
    return () => disconnect()
  }, [connect, disconnect, fetchWorldState])

  return { isConnected }
}
