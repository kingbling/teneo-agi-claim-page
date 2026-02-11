import { produce, type SetStoreFunction } from 'solid-js/store'
import { userStore } from './userStore'
import { log, fmt } from '@/utils/logger'
import type {
  Ship,
  Synapse,
  SynapseCluster,
  ExplorerInfo,
  ShipStoreState,
} from './shipStore.types'
import {
  API_URL,
  mapServerShipState,
  mapServerSynapseState,
  mapServerClusterToClient,
  safeUserShips,
} from './shipStore.types'

// ============================================================================
// SHIP STORE — API ACTIONS (HTTP FETCH OPERATIONS)
// ============================================================================

export function createApiActions(
  state: ShipStoreState,
  setState: SetStoreFunction<ShipStoreState>,
) {
  const fetchUserShips = async () => {
    const userId = userStore.userId
    if (!userId) return

    setState({ isLoadingShips: true })
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/ships`)
      if (!response.ok) throw new Error('Failed to fetch ships')

      const data = await response.json()
      // Ensure ships is always an array (API might return { ships: [...] } or [...])
      const rawShips = Array.isArray(data) ? data : (Array.isArray(data?.ships) ? data.ships : [])
      // Map server states to client states and preserve local animation data
      setState(produce((s) => {
        // Build a map of existing ships to preserve animation data
        const existingShipsMap = new Map(safeUserShips(s).map(ship => [ship.id, ship]))

        s.userShips = rawShips.map((serverShip: Ship) => {
          const localShip = existingShipsMap.get(serverShip.id)
          const mappedState = mapServerShipState(serverShip.state)

          // Preserve animation data if ship is still traveling
          const localIsTraveling = localShip?.state === 'traveling' &&
            localShip.travelStartTime &&
            localShip.travelDuration &&
            Date.now() < localShip.travelStartTime + localShip.travelDuration

          return {
            ...serverShip,
            state: mappedState,
            // Preserve animation data for actively traveling ships
            ...(localIsTraveling ? {
              startPositionX: localShip.startPositionX,
              startPositionY: localShip.startPositionY,
              startPositionZ: localShip.startPositionZ,
              targetPositionX: localShip.targetPositionX,
              targetPositionY: localShip.targetPositionY,
              targetPositionZ: localShip.targetPositionZ,
              travelStartTime: localShip.travelStartTime,
              travelDuration: localShip.travelDuration,
              rotationY: localShip.rotationY,
            } : {}),
          }
        })
        s.isLoadingShips = false
      }))

      // Update ship count in userStore
      setState((s) => {
        userStore.setCurrentShipCount(safeUserShips(s).length)
      })
    } catch (error) {
      log.ship.error('Failed to fetch user ships:', error)
      setState({ isLoadingShips: false })
    }
  }

  const fetchWorldState = async () => {
    setState({ isLoadingWorld: true })
    try {
      const response = await fetch(`${API_URL}/api/world`)
      if (!response.ok) throw new Error('Failed to fetch world state')

      const world = await response.json()
      log.ship.debug('fetchWorldState - Received world data, cluster count:', world.synapseClusters?.length)

      // Map server clusters to client format and separate by LOD level
      // Server sends 'synapseClusters' with SpaceCluster properties (spaceCount, beingSolvedCount)
      // Client expects SynapseCluster properties (synapseCount, beingExploredCount)
      const rawClusters = world.synapseClusters || []
      const mappedClusters = rawClusters.map(mapServerClusterToClient)

      const synapseClustersLod0 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 0)
      const synapseClustersLod1 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 1)
      const synapseClustersLod2 = mappedClusters.filter((c: SynapseCluster) => c.lodLevel === 2)

      log.ship.debug('fetchWorldState - LOD0 clusters:', synapseClustersLod0.length)

      // Server sends agentClusters (was shipClusters)
      const agentClusters = world.agentClusters || []

      setState({
        synapseClusters: mappedClusters,
        synapseClustersLod0,
        synapseClustersLod1,
        synapseClustersLod2,
        shipClusters: agentClusters,
        isLoadingWorld: false,
      })
    } catch (error) {
      log.ship.error('Failed to fetch world state:', error)
      setState({ isLoadingWorld: false })
    }
  }

  /**
   * Fetch all 500k synapses in compact binary format
   * Binary format (16 bytes per synapse):
   * - float32 positionX (4 bytes)
   * - float32 positionY (4 bytes)
   * - float32 positionZ (4 bytes)
   * - uint8   state (1 byte)
   * - uint8   synapseType (1 byte)
   * - uint16  reserved (2 bytes)
   */
  const fetchBulkSynapses = async (): Promise<boolean> => {
    try {
      log.ship.info('Fetching bulk synapses...')
      const response = await fetch(`${API_URL}/api/synapses/bulk`)
      if (!response.ok) throw new Error('Failed to fetch bulk synapses')

      const buffer = await response.arrayBuffer()
      const view = new DataView(buffer)

      // Read header: version (1 byte) + count (4 bytes)
      const version = view.getUint8(0)
      const count = view.getUint32(1, true) // little-endian

      log.ship.success(`Loaded ${fmt.num(count)} raw synapses (v${version})`)

      // Allocate typed arrays
      const positions = new Float32Array(count * 3)
      const states = new Uint8Array(count)
      const types = new Uint8Array(count)

      const HEADER = 5
      const RECORD = 16

      // Parse binary data
      for (let i = 0; i < count; i++) {
        const off = HEADER + i * RECORD
        positions[i * 3] = view.getFloat32(off, true)
        positions[i * 3 + 1] = view.getFloat32(off + 4, true)
        positions[i * 3 + 2] = view.getFloat32(off + 8, true)
        states[i] = view.getUint8(off + 12)
        types[i] = view.getUint8(off + 13)
      }

      setState({
        rawSynapseData: { count, positions, states, types, version },
        rawSynapseDataVersion: v => v + 1,
      })

      return true
    } catch (error) {
      log.ship.error('Failed to fetch bulk synapses:', error)
      return false
    }
  }

  const fetchSynapseDetails = async (synapseId: string): Promise<Synapse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}`)
      if (!response.ok) return null

      const data = await response.json()
      const synapse = data.synapse  // API returns { synapse: {...} }
      if (!synapse) return null

      // Map server state to client state
      if (synapse.state) {
        synapse.state = mapServerSynapseState(synapse.state)
      }
      setState({ currentExplorationSynapse: synapse })
      return synapse
    } catch (error) {
      log.ship.error('Failed to fetch synapse details:', error)
      return null
    }
  }

  const fetchSynapseByPosition = async (x: number, y: number, z: number): Promise<Synapse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/near?x=${x}&y=${y}&z=${z}`)
      if (!response.ok) return null

      const data = await response.json()
      const synapse = data.synapse
      // Map server state to client state
      if (synapse?.state) {
        synapse.state = mapServerSynapseState(synapse.state)
      }
      setState({ currentExplorationSynapse: synapse })
      return synapse
    } catch (error) {
      log.ship.error('Failed to fetch synapse by position:', error)
      return null
    }
  }

  const fetchSynapseExplorers = async (synapseId: string): Promise<ExplorerInfo[]> => {
    try {
      const response = await fetch(`${API_URL}/api/synapses/${synapseId}`)
      if (!response.ok) return []

      const data = await response.json()
      const explorers = data.synapse?.explorers || []
      setState({ currentExplorers: explorers })
      return explorers
    } catch (error) {
      log.ship.error('Failed to fetch synapse explorers:', error)
      return []
    }
  }

  return {
    fetchUserShips,
    fetchWorldState,
    fetchBulkSynapses,
    fetchSynapseDetails,
    fetchSynapseByPosition,
    fetchSynapseExplorers,
  }
}
