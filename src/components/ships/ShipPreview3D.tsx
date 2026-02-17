/**
 * ShipPreview3D - Standalone 3D ship preview with turntable rotation
 *
 * Renders a single ship model in an isolated Three.js canvas with
 * studio-style 3-point lighting and slow turntable rotation.
 */

import { type Component, createEffect, onCleanup } from 'solid-js'
import * as THREE from 'three'
import { ThreeCanvas } from '@/three/ThreeCanvas'
import { useThree } from '@/three/ThreeContext'
import { useFrame } from '@/three/hooks/useFrame'
import { loadShipModel } from '@/three/useShipModel'
import type { ShipType } from '@/stores/shipStore.types'

interface ShipPreviewSceneProps {
  shipType: ShipType
}

const ShipPreviewScene: Component<ShipPreviewSceneProps> = (props) => {
  const { scene, camera } = useThree()

  let modelGroup: THREE.Group | null = null
  const pivot = new THREE.Group()

  // Set up camera
  createEffect(() => {
    const cam = camera()
    if (cam) {
      cam.position.set(0, 0.3, 2.5)
      cam.lookAt(0, 0, 0)
    }
  })

  // Set up lighting and ground
  createEffect(() => {
    const sc = scene()
    if (!sc) return

    sc.add(pivot)

    // Studio 3-point lighting
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.5)
    keyLight.position.set(3, 3, 2)
    sc.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xc0d8ff, 0.8)
    fillLight.position.set(-2, 1, -1)
    sc.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0x75e6ea, 1.2)
    rimLight.position.set(0, 2, -3)
    sc.add(rimLight)

    const ambient = new THREE.AmbientLight(0xffffff, 0.3)
    sc.add(ambient)

    // Ground disc
    const groundGeo = new THREE.CircleGeometry(1.2, 48)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.4,
      roughness: 0.9,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.5
    sc.add(ground)

    onCleanup(() => {
      sc.remove(pivot)
      sc.remove(keyLight)
      sc.remove(fillLight)
      sc.remove(rimLight)
      sc.remove(ambient)
      sc.remove(ground)
      groundGeo.dispose()
      groundMat.dispose()
    })
  })

  // Load and swap model on shipType change
  createEffect(() => {
    const shipType = props.shipType
    const sc = scene()
    if (!sc) return

    // Remove previous model
    if (modelGroup) {
      pivot.remove(modelGroup)
      modelGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material?.dispose()
          }
        }
      })
      modelGroup = null
    }

    loadShipModel(shipType).then((model) => {
      modelGroup = model
      // Center the model
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center)
      pivot.add(model)
    })
  })

  // Turntable rotation
  useFrame(({ delta }) => {
    pivot.rotation.y += delta * 0.4
  })

  return null
}

interface ShipPreview3DProps {
  shipType: ShipType
  class?: string
}

export const ShipPreview3D: Component<ShipPreview3DProps> = (props) => {
  return (
    <ThreeCanvas
      class={props.class || ''}
      camera={{
        fov: 35,
        position: [0, 0.3, 2.5],
      }}
      gl={{
        antialias: true,
        alpha: true,
      }}
    >
      <ShipPreviewScene shipType={props.shipType} />
    </ThreeCanvas>
  )
}
