/**
 * TravelPath - Visualizes the travel path of deploying ships
 *
 * Shows a dotted line from ship's current position to its destination synapse.
 * Only visible when ship is in 'deploying' state.
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import { constrainToBrainShape } from './core/brainConstants'
import type { Ship } from '@/stores/shipStore'

interface TravelPathProps {
  ship: Ship
  isVisible: boolean
}

export const TravelPath: Component<TravelPathProps> = (props) => {
  const { scene } = useThree()

  let lineRef: THREE.Line | null = null
  let materialRef: THREE.LineDashedMaterial | null = null
  let geometryRef: THREE.BufferGeometry | null = null

  const dashOffset = { value: 0 }

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    // Create dashed line material - orange for deploying ships
    materialRef = new THREE.LineDashedMaterial({
      color: 0xff8c00,
      dashSize: 0.1,
      gapSize: 0.06,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      depthWrite: false,
    })

    // Create geometry
    geometryRef = new THREE.BufferGeometry()
    const positions = new Float32Array(6) // 2 points * 3 coordinates
    geometryRef.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Create line
    lineRef = new THREE.Line(geometryRef, materialRef)
    lineRef.frustumCulled = false
    lineRef.visible = false
    lineRef.renderOrder = 140
    sceneObj.add(lineRef)

    onCleanup(() => {
      if (lineRef && sceneObj) {
        sceneObj.remove(lineRef)
      }
      geometryRef?.dispose()
      materialRef?.dispose()
    })
  })

  // Update line when ship position changes
  createEffect(() => {
    if (!lineRef || !geometryRef) return

    const ship = props.ship
    const visible = props.isVisible && ship.state === 'deploying'

    if (!visible) {
      lineRef.visible = false
      return
    }

    // Need start and current positions for travel path
    const hasStartPos = ship.startPositionX !== undefined &&
                        ship.startPositionY !== undefined &&
                        ship.startPositionZ !== undefined

    if (!hasStartPos || !ship.travelStartTime || !ship.travelDuration) {
      lineRef.visible = false
      return
    }

    // Calculate current interpolated position
    const elapsed = Date.now() - ship.travelStartTime
    const progress = Math.min(elapsed / ship.travelDuration, 1)

    // Destination: prefer targetPosition if available, otherwise use position
    // During deploying, positionX/Y/Z is the destination synapse position
    const destRawX = ship.targetPositionX ?? ship.positionX
    const destRawY = ship.targetPositionY ?? ship.positionY
    const destRawZ = ship.targetPositionZ ?? ship.positionZ

    // Interpolate in raw space first (same as server-side interpolation)
    const interpRawX = ship.startPositionX + (destRawX - ship.startPositionX) * progress
    const interpRawY = ship.startPositionY + (destRawY - ship.startPositionY) * progress
    const interpRawZ = ship.startPositionZ + (destRawZ - ship.startPositionZ) * progress

    // Apply brain shape constraint to both endpoints
    const [interpX, interpY, interpZ] = constrainToBrainShape(interpRawX, interpRawY, interpRawZ)
    const [destX, destY, destZ] = constrainToBrainShape(destRawX, destRawY, destRawZ)

    // Validate positions
    const isValid = (v: number) => isFinite(v) && !isNaN(v)
    if (!isValid(interpX) || !isValid(interpY) || !isValid(interpZ) ||
        !isValid(destX) || !isValid(destY) || !isValid(destZ)) {
      lineRef.visible = false
      return
    }

    // Update line from current interpolated position to destination
    const positions = geometryRef.getAttribute('position') as THREE.BufferAttribute
    positions.setXYZ(0, interpX, interpY, interpZ)
    positions.setXYZ(1, destX, destY, destZ)
    positions.needsUpdate = true

    lineRef.computeLineDistances()
    lineRef.visible = true
  })

  // Animate dash offset
  useFrame(({ delta }) => {
    if (lineRef?.visible && materialRef) {
      dashOffset.value += delta * 0.5
      materialRef.dashOffset = -dashOffset.value
    }
  })

  return null
}

/**
 * TravelPathManager - Manages travel paths for all deploying ships
 */
interface TravelPathManagerProps {
  ships: Ship[]
}

export const TravelPathManager: Component<TravelPathManagerProps> = (props) => {
  return (
    <>
      {props.ships
        .filter(ship => ship.state === 'deploying')
        .map(ship => (
          <TravelPath
            ship={ship}
            isVisible={true}
          />
        ))}
    </>
  )
}
