/**
 * ArrivalPulseManager - Manages arrival pulse effects for all ships
 *
 * Tracks ship state transitions and triggers arrival pulse effects when ships
 * transition from 'deploying' to 'solving' state.
 */

import { createSignal, createEffect, For, type Component } from 'solid-js'
import * as THREE from 'three'
import { ArrivalPulse } from './ArrivalPulse'
import { constrainToBrainShape } from './core/brainConstants'
import type { Ship } from '@/stores/shipStore'

interface ArrivalPulseManagerProps {
  ships: Ship[]
}

interface ActivePulse {
  id: string
  shipId: string
  position: THREE.Vector3
  startTime: number
}

export const ArrivalPulseManager: Component<ArrivalPulseManagerProps> = (props) => {
  const [activePulses, setActivePulses] = createSignal<ActivePulse[]>([])

  // Track ship states to detect transitions
  const previousStates = new Map<string, string>()

  const PULSE_DURATION = 1200 // ms to keep the pulse visible

  createEffect(() => {
    const ships = props.ships
    const now = Date.now()
    const newPulses: ActivePulse[] = []
    const activePulseIds = new Set<string>()

    // Check each ship for state transitions
    for (const ship of ships) {
      const prevState = previousStates.get(ship.id)
      const currentState = ship.state

      // Detect transition from deploying to solving (ship arrived)
      if (prevState === 'deploying' && currentState === 'solving') {
        const pulseId = `${ship.id}-${now}`
        activePulseIds.add(pulseId)
        // Use same coordinate transformation as synapses for visual consistency
        const [x, y, z] = constrainToBrainShape(
          ship.positionX,
          ship.positionY,
          ship.positionZ
        )
        newPulses.push({
          id: pulseId,
          shipId: ship.id,
          position: new THREE.Vector3(x, y, z),
          startTime: now,
        })
      }

      // Update previous state
      previousStates.set(ship.id, currentState)
    }

    // Add new pulses to existing ones
    if (newPulses.length > 0) {
      setActivePulses(prev => [...prev, ...newPulses])
    }

    // Clean up expired pulses
    setActivePulses(prev => {
      return prev.filter(pulse => {
        const age = now - pulse.startTime
        return age < PULSE_DURATION
      })
    })
  })

  // Clean up states for ships that no longer exist
  createEffect(() => {
    const shipIds = new Set(props.ships.map(s => s.id))
    for (const [shipId] of previousStates) {
      if (!shipIds.has(shipId)) {
        previousStates.delete(shipId)
      }
    }
  })

  return (
    <For each={activePulses()}>
      {(pulse) => {
        const age = Date.now() - pulse.startTime
        const isActive = age < PULSE_DURATION

        return (
          <ArrivalPulse
            key={pulse.id}
            shipId={pulse.shipId}
            position={pulse.position}
            isActive={isActive}
            color={0x00ffff}
            duration={1.2}
          />
        )
      }}
    </For>
  )
}
