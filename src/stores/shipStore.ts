import { createRoot } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { authStore } from './authStore'
import { userStore } from './userStore'
import { toast } from '@/components/ui/Toast'
import { log, fmt } from '@/utils/logger'

// Re-export all types so existing imports work unchanged
export type {
  ShipStatus,
  ShipType,
  EquippedItem,
  Ship,
  AutopilotPreferences,
  Synapse,
  SynapseCluster,
  ShipCluster,
  WorldState,
  ExplorerInfo,
  SynapseDiscoveryEvent,
  LootEvent,
  SynapseDelta,
  TravelStartedEvent,
  TravelPositionUpdate,
  TravelPositionBatch,
  ServerMessage,
  RawSynapseData,
  ShipStoreState,
} from './shipStore.types'

import type { Ship, ServerMessage, ShipStoreState } from './shipStore.types'
import {
  API_URL,
  initialState,
  mapServerShipState,
  safeUserShips,
  updateShipInList,
} from './shipStore.types'
import { createMessageHandler } from './shipStore.messages'
import { createApiActions } from './shipStore.api'

// ============================================================================
// MASTERPLAN 2026: SHIP STORE
// Replaces agentStore - no fuel/traits, adds autopilot + items
// ============================================================================

// WebSocket URL - ensure /ws path is appended
const WS_BASE = import.meta.env.VITE_WS_URL ?? ''
const WS_URL = WS_BASE ? `${WS_BASE.replace(/\/$/, '')}/ws` : '/ws'

function createShipStore() {
  const [state, setState] = createStore<ShipStoreState>({ ...initialState })

  // Wire up API actions
  const api = createApiActions(state, setState)

  // Wire up message handler (needs api.fetchSynapseDetails/fetchSynapseExplorers)
  const handleServerMessage = createMessageHandler(
    state,
    setState,
    api.fetchSynapseDetails,
    api.fetchSynapseExplorers,
  )

  // ============ CONNECTION ============

  // Exponential backoff for WebSocket reconnection
  const INITIAL_RECONNECT_DELAY = 3000 // 3 seconds
  const MAX_RECONNECT_DELAY = 30000 // 30 seconds
  let reconnectDelay = INITIAL_RECONNECT_DELAY

  const connect = () => {
    if (state.ws) return

    log.ws.info('Connecting to:', WS_URL)
    const socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      log.ws.success('Connected successfully')
      setState({ isConnected: true, ws: socket })
      // Reset backoff on successful connection
      reconnectDelay = INITIAL_RECONNECT_DELAY

      // Send auth token if available
      const token = authStore.token
      if (token) {
        log.ws.info('Sending auth:identify')
        socket.send(JSON.stringify({
          type: 'auth:identify',
          data: { token },
        }))
      }
    }

    socket.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)
        handleServerMessage(message)
      } catch (error) {
        log.ws.error('Failed to parse server message:', error)
      }
    }

    socket.onclose = (event) => {
      log.ws.warn('Disconnected, code:', event.code, 'reason:', event.reason)
      setState({ isConnected: false, ws: null })

      // Auto-reconnect with exponential backoff
      log.ws.info(`Reconnecting in ${fmt.ms(reconnectDelay)}...`)
      setTimeout(() => {
        if (!state.ws) {
          connect()
        }
      }, reconnectDelay)

      // Increase delay for next attempt (exponential backoff)
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
    }

    socket.onerror = (error) => {
      log.ws.error('Connection error:', error)
    }

    setState({ ws: socket })
  }

  const disconnect = () => {
    if (state.ws) {
      state.ws.close()
      setState({ ws: null, isConnected: false })
    }
  }

  // ============ SHIP ACTIONS ============

  const createShip = async (name: string): Promise<Ship | null> => {
    const userId = userStore.userId
    if (!userId) {
      throw new Error('Please login first')
    }

    const response = await fetch(`${API_URL}/api/ships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      // Propagate error to caller
      const error = new Error(errorData.error || 'Failed to create ship')
      ;(error as Error & { serverError?: unknown }).serverError = errorData
      throw error
    }

    const result = await response.json()
    const ship = result.ship

    setState(produce((s) => {
      const currentShips = Array.isArray(s.userShips) ? s.userShips : []
      // Check if WebSocket ships:sync already added this ship
      if (!currentShips.some(existing => existing.id === ship.id)) {
        s.userShips = [...currentShips, ship]
      }
    }))

    // Update ship count in userStore
    const shipCount = Array.isArray(state.userShips) ? state.userShips.length : 0
    userStore.setCurrentShipCount(shipCount)

    return ship
  }

  const selectShip = (shipId: string | null) => {
    setState({ selectedShipId: shipId })

    // If selecting a ship that's solving, fetch synapse details
    if (shipId) {
      const ship = state.userShips.find(s => s.id === shipId)
      if (ship?.currentSynapseId) {
        api.fetchSynapseDetails(ship.currentSynapseId)
        api.fetchSynapseExplorers(ship.currentSynapseId)
      }
    }
  }

  // Set exploration target (synapse selected for a searching ship)
  const setExplorationTarget = async (synapseId: string | null) => {
    if (synapseId) {
      const synapse = await api.fetchSynapseDetails(synapseId)
      setState({ explorationTarget: synapse })
    } else {
      setState({ explorationTarget: null })
    }
  }

  // Set exploration target by position (for cluster clicks)
  const setExplorationTargetByPosition = async (x: number, y: number, z: number) => {
    const synapse = await api.fetchSynapseByPosition(x, y, z)
    setState({ explorationTarget: synapse })
  }

  const leaveExploration = async (shipId: string): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship || ship.state !== 'solving' || !ship.currentSynapseId) {
      // This can happen due to race condition with WebSocket updates - not an error
      log.ship.debug('Ship is not solving (state may have changed):', fmt.shortId(shipId), ship?.state)
      return false
    }

    try {
      const response = await fetch(`${API_URL}/api/synapses/${ship.currentSynapseId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
          s.currentExplorationSynapse = null
          s.currentExplorers = []
        }))
        return true
      }

      const error = await response.json()
      log.ship.error('Leave exploration failed:', error.error || error)
      return false
    } catch (error) {
      log.ship.error('Failed to leave exploration:', error)
      return false
    }
  }

  // Travel to synapse - ship moves to synapse position and auto-starts solving on arrival
  const travelToSynapse = async (shipId: string, synapseId: string, pointsPerMin?: number): Promise<boolean> => {
    const ship = state.userShips.find(s => s.id === shipId)
    if (!ship) {
      log.travel.error('Ship not found:', fmt.shortId(shipId))
      return false
    }
    if (ship.state !== 'idle') {
      log.travel.error('Ship must be idle to travel:', ship.state)
      return false
    }

    log.travel.info('Starting travel: ship', fmt.shortId(shipId), '→ synapse', fmt.shortId(synapseId))

    // Set ship to deploying state while waiting for server response
    const now = Date.now()
    setState(produce((s) => {
      s.userShips = safeUserShips(s).map(ss =>
        ss.id === shipId ? { ...ss, state: 'deploying' as const, _lastLocalUpdate: now } : ss
      )
      s.explorationTarget = null  // Clear target after travel starts
    }))

    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/travel-to-synapse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synapseId, pointsPerMin: pointsPerMin || ship.currentPointsPerMin || 100 }),
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        log.travel.debug('API response:', {
          state: updatedShip.state,
          startX: updatedShip.startPositionX,
          targetX: updatedShip.targetPositionX,
          travelStartTime: updatedShip.travelStartTime,
          travelDuration: fmt.ms(updatedShip.travelDuration),
        })

        setState(produce((s) => {
          // Get current ship state - it may have been updated by WebSocket travel:started
          const currentShip = safeUserShips(s).find(ss => ss.id === shipId)

          // Prefer WebSocket data (currentShip) if it has animation data, otherwise use API response
          const hasWebSocketData = currentShip?.travelStartTime && currentShip?.travelDuration
          const mergedShip = {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
            _lastLocalUpdate: now,
            // Use WebSocket animation data if available, otherwise API response
            ...(hasWebSocketData ? {
              startPositionX: currentShip.startPositionX,
              startPositionY: currentShip.startPositionY,
              startPositionZ: currentShip.startPositionZ,
              targetPositionX: currentShip.targetPositionX,
              targetPositionY: currentShip.targetPositionY,
              targetPositionZ: currentShip.targetPositionZ,
              travelStartTime: currentShip.travelStartTime,
              travelDuration: currentShip.travelDuration,
            } : {}),
          }

          log.travel.info('Ship data:', {
            state: mergedShip.state,
            startPos: fmt.pos(mergedShip.startPositionX, mergedShip.startPositionY, mergedShip.startPositionZ),
            targetPos: fmt.pos(mergedShip.targetPositionX, mergedShip.targetPositionY, mergedShip.targetPositionZ),
            travelStartTime: mergedShip.travelStartTime,
            travelDuration: fmt.ms(mergedShip.travelDuration),
            source: hasWebSocketData ? 'websocket' : 'api',
          })

          updateShipInList(s, mergedShip)
        }))
        return true
      }

      // Rollback on error
      const error = await response.json()
      log.travel.error('Travel to synapse failed:', error.error || error)
      toast.error(error.error || 'Failed to travel to synapse')
      setState(produce((s) => {
        updateShipInList(s, ship)  // Revert to original state
      }))
      return false
    } catch (error) {
      log.travel.error('Failed to travel to synapse:', error)
      toast.error('Failed to travel to synapse')
      // Rollback on error
      setState(produce((s) => {
        updateShipInList(s, ship)  // Revert to original state
      }))
      return false
    }
  }

  const recallShip = async (shipId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/ships/${shipId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const { ship: updatedShip } = await response.json()
        setState(produce((s) => {
          updateShipInList(s, {
            ...updatedShip,
            state: mapServerShipState(updatedShip.state),
          })
          s.currentExplorationSynapse = null
          s.currentExplorers = []
        }))
      }
    } catch (error) {
      log.ship.error('Failed to recall ship:', error)
    }
  }

  // ============ STATE RESET ============

  /**
   * Clear all user-specific ship state (call on logout)
   * Prevents data leakage between users and cleans up stale state
   */
  const clearUserShips = () => {
    setState({
      userShips: [],
      selectedShipId: null,
      currentExplorationSynapse: null,
      currentExplorers: [],
      explorationTarget: null,
      isLoadingShips: false,
    })
  }

  return {
    // ============ REACTIVE GETTERS ============
    // Connection State
    get isConnected() { return state.isConnected },
    get ws() { return state.ws },

    // Individual Synapse Data (500k points)
    get rawSynapseData() { return state.rawSynapseData },
    get rawSynapseDataVersion() { return state.rawSynapseDataVersion },

    // Synapse State (LOD clusters)
    get synapseClusters() { return state.synapseClusters },
    get synapseClustersLod0() { return state.synapseClustersLod0 },
    get synapseClustersLod1() { return state.synapseClustersLod1 },
    get synapseClustersLod2() { return state.synapseClustersLod2 },

    // Ship State (LOD clusters + user's ships)
    get shipClusters() { return state.shipClusters },
    get userShips() { return state.userShips },
    get selectedShipId() { return state.selectedShipId },

    // Current Exploration (for selected ship)
    get currentExplorationSynapse() { return state.currentExplorationSynapse },
    get currentExplorers() { return state.currentExplorers },

    // Exploration Target (for searching ships)
    get explorationTarget() { return state.explorationTarget },

    // Recent Events
    get recentDiscoveries() { return state.recentDiscoveries },
    get recentLoot() { return state.recentLoot },

    // Loading States
    get isLoadingWorld() { return state.isLoadingWorld },
    get isLoadingShips() { return state.isLoadingShips },

    // ============ COMPUTED SELECTORS ============
    get selectedShip() {
      const ships = state.userShips
      if (!Array.isArray(ships)) return null
      return ships.find(s => s.id === state.selectedShipId) || null
    },
    get solvingShips() {
      const ships = state.userShips
      if (!Array.isArray(ships)) return []
      return ships.filter(s => s.state === 'solving')
    },
    get idleShips() {
      const ships = state.userShips
      if (!Array.isArray(ships)) return []
      return ships.filter(s => s.state === 'idle')
    },
    get currentExploration() {
      return {
        synapse: state.currentExplorationSynapse,
        explorers: state.currentExplorers,
      }
    },

    // ============ ACTIONS ============
    // Connection
    connect,
    disconnect,

    // Ship Actions
    createShip,
    selectShip,

    // Exploration Actions
    setExplorationTarget,
    setExplorationTargetByPosition,
    leaveExploration,

    // Travel/Recall
    travelToSynapse,
    recallShip,

    // API Actions
    ...api,

    // State Reset
    clearUserShips,
  }
}

export const shipStore = createRoot(createShipStore)
