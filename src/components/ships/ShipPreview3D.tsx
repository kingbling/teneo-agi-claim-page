/**
 * ShipPreview3D - Standalone 3D ship preview for the ship switcher
 *
 * Creates an isolated Three.js canvas showing a rotating ship model
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { loadShipModel, ENGINE_COLORS } from '@/three/useShipModel'
import type { ShipType, ShipStatus } from '@/stores/shipStore'
import { log } from '@/utils/logger'

interface ShipPreview3DProps {
  shipType: ShipType
  state: ShipStatus
  class?: string
}

export const ShipPreview3D: Component<ShipPreview3DProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let shipModel: THREE.Group | null = null
  let animationId: number | null = null

  onMount(async () => {
    if (!canvasRef) return

    // Create scene
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0f)

    // Create camera
    camera = new THREE.PerspectiveCamera(45, canvasRef.clientWidth / canvasRef.clientHeight, 0.1, 100)
    camera.position.set(0, 0.3, 2)
    camera.lookAt(0, 0, 0)

    // Create renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef,
      antialias: true,
      alpha: false,
    })
    renderer.setSize(canvasRef.clientWidth, canvasRef.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffffff, 1)
    mainLight.position.set(5, 5, 5)
    scene.add(mainLight)

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    fillLight.position.set(-5, 0, -5)
    scene.add(fillLight)

    // Add rim light for visual pop
    const rimLight = new THREE.PointLight(ENGINE_COLORS[props.state], 0.8, 10)
    rimLight.position.set(0, 0, -2)
    scene.add(rimLight)

    // Load and add ship model
    try {
      shipModel = await loadShipModel()
      shipModel.scale.setScalar(0.6)
      shipModel.position.set(0, -0.2, 0)
      scene.add(shipModel)
    } catch (error) {
      log.three.error('ShipPreview3D failed to create ship:', error)
    }

    // Handle resize
    const handleResize = () => {
      if (!canvasRef || !camera || !renderer) return
      const width = canvasRef.clientWidth
      const height = canvasRef.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(canvasRef)

    // Animation loop
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      if (shipModel) {
        // Slow rotation for preview
        shipModel.rotation.y += 0.005
      }

      if (renderer && scene && camera) {
        renderer.render(scene, camera)
      }
    }

    animate()

    onCleanup(() => {
      resizeObserver.disconnect()
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
      }
      if (renderer) {
        renderer.dispose()
      }
      if (shipModel) {
        shipModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose())
            } else if (child.material instanceof THREE.Material) {
              child.material.dispose()
            }
          }
        })
      }
    })
  })

  // Update rim light color when state changes
  createEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child instanceof THREE.PointLight) {
          child.color.setHex(ENGINE_COLORS[props.state])
        }
      })
    }
  })

  return (
    <canvas
      ref={canvasRef}
      class={`w-full h-full ${props.class || ''}`}
    />
  )
}

export default ShipPreview3D
