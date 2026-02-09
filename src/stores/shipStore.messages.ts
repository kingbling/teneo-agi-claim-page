import { produce, type SetStoreFunction } from 'solid-js/store'
import { userStore } from './userStore'
import { toast } from '@/components/ui/Toast'
import { log, fmt } from '@/utils/logger'
import type {
  Ship,
  ShipStoreState,
  ServerMessage,
  SynapseCluster,
  TravelPositionBatch,
} from './shipStore.types'
import {
  mapServerShipState,
  mapServerClusterToClient,
  safeUserShips,
} from './shipStore.types'

// ============================================================================
// SHIP STORE — SERVER MESSAGE HANDLERS
// ============================================================================

type FetchSynapseDetailsFn = (synapseId: string) => Promise<unknown>
type FetchSynapseExplorersFn = (synapseId: string) => Promise<unknown>

export function createMessageHandler(
  state: ShipStoreState,
  setState: SetStoreFunction<ShipStoreState>,
  fetchSynapseDetails: FetchSynapseDetailsFn,
  fetchSynapseExplorers: FetchSynapseExplorersFn,
) {
  return function handleServerMessage(message: ServerMessage) {
    switch (message.type) {
      case 'state:sync': {
        const world = message.data
        log.ws.info('state:sync - Received world, cluster count:', world.synapseClusters?.length)

        // Map server clusters to client format and separate by LOD level
        const rawClusters = world.synapseClusters || []
        const mappedClusters = rawClusters.map(mapServerClusterToClient)

        const synapseClustersLod0 = mappedClusters.filter(c => c.lodLevel === 0)
        const synapseClustersLod1 = mappedClusters.filter(c => c.lodLevel === 1)
        const synapseClustersLod2 = mappedClusters.filter(c => c.lodLevel === 2)

        // Server sends agentClusters (was shipClusters)
        const agentClusters = world.agentClusters || []

        setState({
          synapseClusters: mappedClusters,
          synapseClustersLod0,
          synapseClustersLod1,
          synapseClustersLod2,
          shipClusters: agentClusters,
        })
        break
      }

      case 'ships:sync': {
        // Ship state updates from server - MERGES with local state (not a full replacement)
        // Server sends partial updates (single ship or subset), client merges them
        const { ships, timestamp } = message.data
        log.ws.info('ships:sync - Received', ships?.length, 'ships, timestamp:', timestamp)
        log.ws.debug('ships:sync data:', ships?.map((s: Ship) => ({
          id: fmt.shortId(s.id),
          state: s.state,
          pos: fmt.pos(s.positionX, s.positionY, s.positionZ),
          rotationY: fmt.deg(s.rotationY),
        })))
        if (!Array.isArray(ships)) break

        setState(produce((s) => {
          // Build a map of existing ships for O(1) lookup
          const existingShipsMap = new Map(safeUserShips(s).map(ship => [ship.id, ship]))

          // Merge incoming ships with existing ships
          for (const serverShip of ships) {
            const localShip = existingShipsMap.get(serverShip.id)

            // Keep local state if it was modified more recently than the server's timestamp
            // This prevents flickering when user action is followed by stale WebSocket sync
            if (localShip?._lastLocalUpdate && localShip._lastLocalUpdate > timestamp) {
              log.ws.debug('ships:sync - Skipping stale update for ship', fmt.shortId(serverShip.id))
              continue // Skip this update, keep local state
            }

            // === BULLETPROOF ANIMATION DATA PRESERVATION ===
            // Check if local ship has animation data AND travel is still in progress
            // This is independent of state - we preserve animation data based on timing, not state
            const hasLocalAnimationData = localShip?.travelStartTime != null &&
              localShip?.travelDuration != null &&
              localShip.travelDuration > 0
            const travelStillInProgress = hasLocalAnimationData &&
              Date.now() < (localShip!.travelStartTime! + localShip!.travelDuration!)

            // Map server state to client state (server: traveling/solving → client: deploying/solving)
            const mappedState = mapServerShipState(serverShip.state)
            const serverIsTraveling = serverShip.state === 'traveling'

            // Override state if travel is still in progress locally
            const finalState = travelStillInProgress ? 'deploying' as const : mappedState

            // Check if ship is solving (we need to preserve its targetPosition for synapse location)
            const shouldPreserveTargetPosition = (finalState === 'solving' || localShip?.state === 'solving') &&
              localShip?.targetPositionX !== undefined

            // Log animation data preservation
            if (travelStillInProgress) {
              log.ws.success('ships:sync - PRESERVING animation data!', fmt.shortId(serverShip.id), {
                localState: localShip?.state,
                serverState: serverShip.state,
                finalState,
                travelTimeRemaining: fmt.ms((localShip!.travelStartTime! + localShip!.travelDuration!) - Date.now()),
              })
            }

            // Determine position source
            const serverHasPosition = serverShip.positionX !== undefined &&
              serverShip.positionY !== undefined &&
              serverShip.positionZ !== undefined

            // Build merged ship
            const mergedShip: Ship = {
              ...serverShip,
              state: finalState,
              // Preserve local position if server doesn't send one
              positionX: serverHasPosition ? serverShip.positionX : localShip?.positionX,
              positionY: serverHasPosition ? serverShip.positionY : localShip?.positionY,
              positionZ: serverHasPosition ? serverShip.positionZ : localShip?.positionZ,
              // Preserve rotationY from local ship since server doesn't send it in ShipDTO
              rotationY: localShip?.rotationY ?? serverShip.rotationY,
              // ALWAYS preserve animation data if travel is still in progress
              ...(travelStillInProgress ? {
                startPositionX: localShip!.startPositionX,
                startPositionY: localShip!.startPositionY,
                startPositionZ: localShip!.startPositionZ,
                targetPositionX: localShip!.targetPositionX,
                targetPositionY: localShip!.targetPositionY,
                targetPositionZ: localShip!.targetPositionZ,
                travelStartTime: localShip!.travelStartTime,
                travelDuration: localShip!.travelDuration,
                currentSynapseId: localShip!.currentSynapseId,
                _lastLocalUpdate: localShip!._lastLocalUpdate,
              } : shouldPreserveTargetPosition && localShip ? {
                // Preserve target position for solving ships (synapse location)
                targetPositionX: localShip.targetPositionX,
                targetPositionY: localShip.targetPositionY,
                targetPositionZ: localShip.targetPositionZ,
                currentSynapseId: localShip.currentSynapseId,
              } : serverIsTraveling ? {
                // Server is traveling but local doesn't have data yet - use server data
                startPositionX: serverShip.startPositionX,
                startPositionY: serverShip.startPositionY,
                startPositionZ: serverShip.startPositionZ,
                targetPositionX: serverShip.targetPositionX,
                targetPositionY: serverShip.targetPositionY,
                targetPositionZ: serverShip.targetPositionZ,
                travelStartTime: serverShip.travelStartTime,
                travelDuration: serverShip.travelDuration,
                currentSynapseId: serverShip.currentSynapseId,
              } : {}),
            }

            // Add or update ship in the map
            existingShipsMap.set(serverShip.id, mergedShip)
          }

          // Convert map back to array
          s.userShips = Array.from(existingShipsMap.values())
          s.isLoadingShips = false
        }))

        // Update ship count in userStore with the actual count after merge
        setState((s) => {
          userStore.setCurrentShipCount(safeUserShips(s).length)
        })

        // For solving ships without targetPosition, fetch synapse details to get position
        // This handles fresh page load where ships are solving but we don't have synapse position yet
        for (const serverShip of ships) {
          const mappedState = mapServerShipState(serverShip.state)
          const synapseId = serverShip.currentSynapseId || (serverShip as Ship & { targetSpaceId?: string }).targetSpaceId
          if (mappedState === 'solving' && synapseId) {
            const localShip = state.userShips?.find(s => s.id === serverShip.id)
            // If ship is solving but has no targetPosition, fetch synapse to get it
            if (!localShip?.targetPositionX) {
              log.ws.info(`ships:sync - Solving ship ${fmt.shortId(serverShip.id)} needs synapse position, fetching...`)
              fetchSynapseDetails(synapseId).then(synapse => {
                if (synapse) {
                  setState(produce((s) => {
                    const shipIndex = safeUserShips(s).findIndex(ship => ship.id === serverShip.id)
                    if (shipIndex >= 0) {
                      s.userShips[shipIndex] = {
                        ...s.userShips[shipIndex],
                        targetPositionX: (synapse as { positionX: number }).positionX,
                        targetPositionY: (synapse as { positionY: number }).positionY,
                        targetPositionZ: (synapse as { positionZ: number }).positionZ,
                        currentSynapseId: (synapse as { id: string }).id,
                      }
                    }
                  }))
                }
              })
            }
          }
        }
        break
      }

      case 'travel:started': {
        // Handle travel:started event - update ship with travel interpolation data
        const event = message.data
        log.travel.critical('travel:started RECEIVED!')
        log.travel.debug('Full event data:', event)

        const travelDuration = event.travelDuration
        const travelStartTime = event.travelStartTime

        // Calculate distance for logging
        const dx = event.targetPositionX - event.startPositionX
        const dy = (event.targetPositionY ?? 0) - (event.startPositionY ?? 0)
        const dz = (event.targetPositionZ ?? 0) - (event.startPositionZ ?? 0)
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        log.travel.info('travel:started key values:', {
          shipId: fmt.shortId(event.shipId),
          startPos: fmt.pos(event.startPositionX, event.startPositionY, event.startPositionZ),
          targetPos: fmt.pos(event.targetPositionX, event.targetPositionY, event.targetPositionZ),
          travelStartTime,
          travelDuration: fmt.ms(travelDuration),
          distance: distance.toFixed(3),
        })
        const now = Date.now()

        // Calculate initial rotation (yaw) toward target - same formula as engine
        const initialRotationY = Math.atan2(dx, -dz)  // Ship model faces -Z

        log.travel.debug('travel:started initial rotation:', fmt.deg(initialRotationY))

        setState(produce((s) => {
          // Use map pattern to ensure proper reactivity (like agents:update handler)
          s.userShips = safeUserShips(s).map(ship => {
            if (ship.id !== event.shipId) return ship
            log.travel.info('travel:started - Updating ship to deploying:', fmt.shortId(ship.id))
            return {
              ...ship,
              state: 'deploying' as const,
              startPositionX: event.startPositionX,
              startPositionY: event.startPositionY,
              startPositionZ: event.startPositionZ,
              targetPositionX: event.targetPositionX,
              targetPositionY: event.targetPositionY,
              targetPositionZ: event.targetPositionZ,
              travelStartTime,
              travelDuration,
              currentSynapseId: event.targetSynapseId,
              rotationY: initialRotationY,
              _lastLocalUpdate: now,
            }
          })
        }))
        break
      }

      case 'travel:position': {
        // Handle travel:position event - streamed position/rotation updates during travel
        const batch = message.data as TravelPositionBatch
        if (!batch.ships?.length) break

        log.travel.debug('travel:position - Received', batch.ships.length, 'updates')
        log.travel.debug('travel:position updates:', batch.ships.map(u => ({
          shipId: fmt.shortId(u.shipId),
          pos: fmt.pos(u.positionX, u.positionY, u.positionZ),
          rotationY: fmt.deg(u.rotationY),
          progress: fmt.percent(u.progress),
        })))

        setState(produce((s) => {
          for (const update of batch.ships) {
            const index = safeUserShips(s).findIndex(ship => ship.id === update.shipId)
            if (index >= 0) {
              const beforeRotation = s.userShips[index].rotationY
              const beforeState = s.userShips[index].state
              // Update position, rotation, and ENSURE state is 'deploying'
              // This fixes the issue where ships:sync resets state to idle
              // while the ship is still traveling (receiving position updates)
              s.userShips[index] = {
                ...s.userShips[index],
                positionX: update.positionX,
                positionY: update.positionY,
                positionZ: update.positionZ,
                rotationY: update.rotationY,
                // If we're receiving position updates, the ship is definitely traveling
                state: 'deploying' as const,
                // Preserve timestamp to prevent ships:sync from overwriting
                _lastLocalUpdate: Date.now(),
              }
              const afterRotation = s.userShips[index].rotationY
              if (beforeState !== 'deploying') {
                log.travel.success(`travel:position - Fixed state: ${beforeState} → deploying`)
              }
              log.travel.debug(`travel:position - Ship ${fmt.shortId(update.shipId)} rotation:`,
                fmt.deg(beforeRotation), '→', fmt.deg(afterRotation))
            }
          }
        }))
        log.travel.debug('travel:position - After update, userShips count:', safeUserShips(state).length)
        break
      }

      case 'auth:success': {
        log.ws.success('Authenticated as user:', message.data.userId)
        break
      }

      case 'auth:error': {
        log.ws.error('Auth failed:', message.data.message)
        toast.error('Session expired. Please reconnect your wallet.')
        // Clear ship state on auth failure to prevent stale data
        setState({
          userShips: [],
          selectedShipId: null,
          isLoadingShips: false,
        })
        break
      }

      case 'synapse:completed': {
        const event = message.data
        setState(produce((s) => {
          s.recentDiscoveries = [event, ...s.recentDiscoveries].slice(0, 50)
        }))
        break
      }

      case 'loot:distributed': {
        const event = message.data
        setState(produce((s) => {
          s.recentLoot = [event, ...s.recentLoot].slice(0, 50)
        }))

        // Update user's AGI (Masterplan 2026: Brain XP removed)
        const userId = userStore.userId
        if (event.userId === userId) {
          userStore.addAgi(event.agiAmount)
          if (event.lotteryTicketsAwarded > 0) {
            userStore.addLotteryTickets(event.lotteryTicketsAwarded)
          }
        }
        break
      }

      case 'ships:update': {
        // Partial ship updates with timestamp reconciliation
        const { ships: updatedShips, timestamp } = message.data
        if (!Array.isArray(updatedShips)) break

        setState(produce((s) => {
          s.userShips = safeUserShips(s).map((ship) => {
            const updated = updatedShips.find(u => u.id === ship.id)
            if (!updated) return ship

            // If we have a local update more recent than this server update, keep local state
            if (ship._lastLocalUpdate && timestamp && ship._lastLocalUpdate > timestamp) {
              return ship
            }

            // Merge the update, map server state to client state, preserve local timestamp and rotationY
            return {
              ...updated,
              state: mapServerShipState(updated.state),
              rotationY: ship.rotationY ?? updated.rotationY,
              _lastLocalUpdate: ship._lastLocalUpdate,
            }
          })
        }))
        break
      }

      case 'agents:update': {
        // Agent updates from simulation engine - includes state changes on arrival
        const agents = message.data
        log.ws.debug('agents:update - Received:', agents)
        if (!Array.isArray(agents)) break

        // Only process if we have ships
        if (safeUserShips(state).length === 0) {
          log.ws.debug('agents:update - No user ships, skipping')
          break
        }

        // Track ships that just arrived (deploying → solving) for synapse fetch
        const newlyArrived: { shipId: string; synapseId: string }[] = []

        setState(produce((s) => {
          s.userShips = safeUserShips(s).map((ship) => {
            const agent = agents.find((a: Record<string, unknown>) => a.id === ship.id)
            if (!agent) return ship

            const newState = agent.state ? mapServerShipState(agent.state as string) : ship.state
            const synapseId = (agent.targetSpaceId ?? agent.currentSpaceId ?? ship.currentSynapseId) as string
            log.ws.debug(`agents:update - Ship ${fmt.shortId(ship.id)} state: ${ship.state} → ${newState} (server: ${agent.state})`)

            // Detect arrival: was deploying, now solving, has synapse ID
            if (ship.state === 'deploying' && newState === 'solving' && synapseId) {
              log.ws.info(`agents:update - Ship ${fmt.shortId(ship.id)} ARRIVED at synapse ${fmt.shortId(synapseId)}`)
              newlyArrived.push({ shipId: ship.id, synapseId })
            }

            // Preserve current position if server doesn't send one (prevents ships from disappearing)
            // Also preserve targetPosition if ship was traveling (for smooth arrival animation)
            const hasValidServerPosition = agent.positionX !== undefined &&
              agent.positionX !== null &&
              agent.positionY !== undefined &&
              agent.positionY !== null &&
              agent.positionZ !== undefined &&
              agent.positionZ !== null

            // When ship arrives at destination, use targetPosition as current position
            const arrivalPosition = ship.state === 'deploying' && newState === 'solving'
              ? {
                  positionX: ship.targetPositionX ?? ship.positionX,
                  positionY: ship.targetPositionY ?? ship.positionY,
                  positionZ: ship.targetPositionZ ?? ship.positionZ,
                }
              : {}

            // SAFEGUARD: Always preserve targetPosition for solving ships, even if server doesn't send it
            // This is the synapse location and must be preserved
            const shouldKeepTargetPosition = (newState === 'solving' || ship.state === 'solving')
              && ship.targetPositionX !== undefined

            return {
              ...ship,
              // Use server position if valid, otherwise preserve current position
              // On arrival, use targetPosition to ensure ship stays at synapse
              positionX: hasValidServerPosition ? agent.positionX as number : arrivalPosition.positionX ?? ship.positionX,
              positionY: hasValidServerPosition ? agent.positionY as number : arrivalPosition.positionY ?? ship.positionY,
              positionZ: hasValidServerPosition ? agent.positionZ as number : arrivalPosition.positionZ ?? ship.positionZ,
              // Update state if provided (arrival transitions: traveling->solving, etc.)
              state: newState,
              // Update synapse ID if provided
              currentSynapseId: synapseId,
              // Clear travel data on arrival (when state changes from traveling)
              // NOTE: Keep targetPosition for solving ships - it represents the synapse location
              ...(agent.state === 'solving' ? {
                travelStartTime: null,
                travelDuration: null,
                startPositionX: undefined,
                startPositionY: undefined,
                startPositionZ: undefined,
              } : {}),
              // EXPLICITLY preserve targetPosition for solving ships
              ...(shouldKeepTargetPosition ? {
                targetPositionX: ship.targetPositionX,
                targetPositionY: ship.targetPositionY,
                targetPositionZ: ship.targetPositionZ,
              } : {}),
            }
          })
        }))

        // Fetch synapse details for arrived ships (outside produce to avoid nested state updates)
        for (const { shipId, synapseId } of newlyArrived) {
          // Fetch if this ship is selected OR if we don't have any synapse loaded
          const selectedId = state.selectedShipId
          if (selectedId === shipId || !state.currentExplorationSynapse) {
            log.ws.info(`agents:update - Fetching synapse details for arrived ship ${fmt.shortId(shipId)}`)
            fetchSynapseDetails(synapseId)
            fetchSynapseExplorers(synapseId)
          }
        }
        break
      }

      case 'exploration:progress': {
        const { synapseId, pointsAccumulated, eta, currentETAMinutes, etaMinutes: serverEtaMinutes } = message.data
        // Support multiple field names: etaMinutes (server), eta (legacy), currentETAMinutes (alternative)
        const etaMinutes = serverEtaMinutes ?? eta ?? currentETAMinutes
        log.ws.debug(`exploration:progress - synapse ${fmt.shortId(synapseId)}, points: ${pointsAccumulated}, eta: ${etaMinutes}`)

        // Update if we have matching synapse loaded
        if (state.currentExplorationSynapse?.id === synapseId) {
          setState('currentExplorationSynapse', {
            ...state.currentExplorationSynapse,
            pointsAccumulated,
            currentEtaMinutes: etaMinutes,
          })
        } else {
          // Check if any of our ships is solving this synapse - if so, fetch details
          const solvingShip = state.userShips?.find(
            s => s.state === 'solving' && s.currentSynapseId === synapseId
          )
          if (solvingShip && !state.currentExplorationSynapse) {
            log.ws.info(`exploration:progress - Ship ${fmt.shortId(solvingShip.id)} solving synapse ${fmt.shortId(synapseId)}, fetching details`)
            fetchSynapseDetails(synapseId)
          }
        }
        break
      }

      case 'cluster:update': {
        // Immediate cluster state update (exploration start/stop) - faster than waiting for state:sync
        const { clusters } = message.data as { clusters: SynapseCluster[]; timestamp: number }
        if (!Array.isArray(clusters) || clusters.length === 0) break

        const mappedClusters = clusters.map(mapServerClusterToClient)
        log.ws.debug('cluster:update - Received', mappedClusters.length, 'updated clusters')

        // Merge updated clusters into existing state
        setState(produce((s) => {
          for (const updated of mappedClusters) {
            // Update in the main list
            const mainIdx = s.synapseClusters.findIndex(c => c.id === updated.id)
            if (mainIdx >= 0) {
              s.synapseClusters[mainIdx] = updated
            }
            // Update in the LOD-specific lists
            const lodList = updated.lodLevel === 0 ? s.synapseClustersLod0
              : updated.lodLevel === 1 ? s.synapseClustersLod1
              : s.synapseClustersLod2
            const lodIdx = lodList.findIndex(c => c.id === updated.id)
            if (lodIdx >= 0) {
              lodList[lodIdx] = updated
            }
          }
        }))
        break
      }

      case 'synapses:delta': {
        // Compact delta updates for individual synapse state changes
        const { c: changes } = message.data
        if (!state.rawSynapseData || !changes?.length) break

        // Update states in place
        for (const { i, s } of changes) {
          if (i < state.rawSynapseData.states.length) {
            state.rawSynapseData.states[i] = s
          }
        }

        // Increment version to trigger reactivity
        setState('rawSynapseDataVersion', v => v + 1)
        break
      }

      case 'error': {
        log.ws.error('Server error:', message.data.message)
        break
      }
    }
  }
}
