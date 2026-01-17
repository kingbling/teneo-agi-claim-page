/**
 * TargetBeam - Visualizes the connection between a searching ship and its target synapse
 *
 * Shows a dashed animated beam connecting the ship to the selected synapse.
 * Provides clear visual feedback when a user clicks a synapse while having a searching ship selected.
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'

interface TargetBeamProps {
  shipPosition: THREE.Vector3 | null
  targetPosition: THREE.Vector3 | null
  isActive: boolean
  color?: number // RGB color as hex (default: cyan)
}

export const TargetBeam: Component<TargetBeamProps> = (props) => {
  const { scene } = useThree()

  let lineRef: THREE.Line | null = null
  let materialRef: THREE.LineDashedMaterial | null = null
  let geometryRef: THREE.BufferGeometry | null = null

  const dashOffset = { value: 0 }

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    // Create dashed line material
    materialRef = new THREE.LineDashedMaterial({
      color: props.color ?? 0x00ffff,
      dashSize: 0.15,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.7,
      depthTest: false, // Always visible through other objects
      depthWrite: false,
    })

    // Create geometry (will be updated in effect)
    geometryRef = new THREE.BufferGeometry()
    const positions = new Float32Array(6) // 2 points * 3 coordinates
    geometryRef.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Create line
    lineRef = new THREE.Line(geometryRef, materialRef)
    lineRef.frustumCulled = false
    lineRef.visible = false
    lineRef.renderOrder = 150 // Render above most other elements
    sceneObj.add(lineRef)

    onCleanup(() => {
      if (lineRef && sceneObj) {
        sceneObj.remove(lineRef)
      }
      geometryRef?.dispose()
      materialRef?.dispose()
    })
  })

  // Update line geometry when positions change
  createEffect(() => {
    if (!lineRef || !geometryRef) return

    const shipPos = props.shipPosition
    const targetPos = props.targetPosition
    const active = props.isActive

    if (!active || !shipPos || !targetPos) {
      lineRef.visible = false
      return
    }

    // Validate positions
    const isValidPos = (v: THREE.Vector3) =>
      isFinite(v.x) && isFinite(v.y) && isFinite(v.z) &&
      !isNaN(v.x) && !isNaN(v.y) && !isNaN(v.z)

    if (!isValidPos(shipPos) || !isValidPos(targetPos)) {
      lineRef.visible = false
      return
    }

    // Update positions
    const positions = geometryRef.getAttribute('position') as THREE.BufferAttribute
    positions.setXYZ(0, shipPos.x, shipPos.y, shipPos.z)
    positions.setXYZ(1, targetPos.x, targetPos.y, targetPos.z)
    positions.needsUpdate = true

    // Compute line distances for dash rendering
    lineRef.computeLineDistances()
    lineRef.visible = true
  })

  // Animate dash offset
  useFrame(({ delta }) => {
    if (lineRef?.visible && materialRef) {
      dashOffset.value += delta * 0.4
      materialRef.dashOffset = -dashOffset.value // Negative for flowing toward target
    }
  })

  // Update color if prop changes
  createEffect(() => {
    if (materialRef && props.color !== undefined) {
      materialRef.color.setHex(props.color)
    }
  })

  return null
}
