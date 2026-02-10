/**
 * SolvingSynapseHighlight - Highlights the synapse currently being solved
 *
 * Renders a pulsing ring effect around the synapse position to make it
 * clearly visible in the brain visualization.
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { Synapse } from '@/stores/shipStore'

interface SolvingSynapseHighlightProps {
  synapse: Synapse | null
  color?: number
}

export const SolvingSynapseHighlight: Component<SolvingSynapseHighlightProps> = (props) => {
  const { scene } = useThree()

  let group: THREE.Group | null = null
  let ringMesh: THREE.Mesh | null = null
  let glowMesh: THREE.Mesh | null = null
  let pulseTime = 0

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    group = new THREE.Group()

    // Create pulsing ring
    const ringGeometry = new THREE.RingGeometry(0.015, 0.02, 32)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: props.color ?? 0x00ffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    ringMesh = new THREE.Mesh(ringGeometry, ringMaterial)
    ringMesh.renderOrder = 150
    group.add(ringMesh)

    // Create outer glow ring
    const glowGeometry = new THREE.RingGeometry(0.02, 0.035, 32)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: props.color ?? 0x00ffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)
    glowMesh.renderOrder = 149
    group.add(glowMesh)

    group.visible = false
    sceneObj.add(group)

    onCleanup(() => {
      if (group && sceneObj) {
        sceneObj.remove(group)
      }
      ringGeometry.dispose()
      ringMaterial.dispose()
      glowGeometry.dispose()
      glowMaterial.dispose()
    })
  })

  // Update position when synapse changes
  createEffect(() => {
    if (!group) return

    const synapse = props.synapse
    if (!synapse) {
      group.visible = false
      return
    }

    group.position.set(synapse.positionX, synapse.positionY, synapse.positionZ)
    group.visible = true
  })

  // Animate the highlight
  useFrame(({ delta, camera }) => {
    if (!group?.visible || !ringMesh || !glowMesh) return

    pulseTime += delta * 2

    // Pulse the inner ring opacity
    const ringMat = ringMesh.material as THREE.MeshBasicMaterial
    ringMat.opacity = 0.6 + Math.sin(pulseTime * 3) * 0.3

    // Pulse the outer glow scale and opacity
    const glowScale = 1.0 + Math.sin(pulseTime * 2) * 0.3
    glowMesh.scale.setScalar(glowScale)
    const glowMat = glowMesh.material as THREE.MeshBasicMaterial
    glowMat.opacity = 0.2 + Math.sin(pulseTime * 2.5) * 0.15

    // Billboard effect - face the camera
    group.quaternion.copy(camera.quaternion)
  })

  return null
}

export default SolvingSynapseHighlight
