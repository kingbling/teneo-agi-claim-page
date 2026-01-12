/**
 * useFrame - Animation Loop Hook
 *
 * Registers a callback to be called on every animation frame.
 * Replaces React Three Fiber's useFrame hook.
 */

import { onMount, onCleanup } from 'solid-js'
import { useThree, type FrameCallback } from '../ThreeContext'

/**
 * Register a callback to run on every animation frame.
 *
 * @param callback - Function called each frame with delta time, elapsed time, and Three.js objects
 * @param priority - Lower priority runs first (default: 0)
 *
 * @example
 * useFrame(({ delta, elapsed, camera }) => {
 *   mesh.rotation.x += delta
 *   camera.position.y = Math.sin(elapsed) * 0.5
 * })
 */
export function useFrame(callback: FrameCallback, priority: number = 0) {
  const { registerFrameCallback, gl, scene, camera } = useThree()

  onMount(() => {
    // Only register if Three.js is initialized
    const renderer = gl()
    const sceneObj = scene()
    const cam = camera()

    if (!renderer || !sceneObj || !cam) {
      console.warn('useFrame: Three.js not yet initialized')
      return
    }

    const unregister = registerFrameCallback(callback, priority)
    onCleanup(unregister)
  })
}

export default useFrame
