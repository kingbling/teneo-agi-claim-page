/**
 * useFrame - Animation Loop Hook
 *
 * Registers a callback to be called on every animation frame.
 * Replaces React Three Fiber's useFrame hook.
 *
 * Uses a ref pattern to ensure the callback is always fresh,
 * preventing stale closure issues.
 */

import { onCleanup, createEffect } from 'solid-js'
import { useThree, type FrameCallback } from '../ThreeContext'

/**
 * Register a callback to run on every animation frame.
 *
 * Uses a ref pattern so the callback is always fresh - this prevents
 * stale closures from causing animation issues when reactive data changes.
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

  // Ref to always hold current callback - prevents stale closures
  let callbackRef = callback
  let unregister: (() => void) | null = null

  // Update ref when callback changes (SolidJS reactive tracking)
  createEffect(() => {
    callbackRef = callback
  })

  // Use createEffect to react to Three.js becoming ready
  // This handles cases where Three.js initializes after component mount
  createEffect(() => {
    const renderer = gl()
    const sceneObj = scene()
    const cam = camera()

    // Clean up previous registration if any
    if (unregister) {
      unregister()
      unregister = null
    }

    if (!renderer || !sceneObj || !cam) {
      // Three.js not ready yet - effect will re-run when it becomes ready
      return
    }

    // Wrapper always calls current ref, ensuring fresh callback each frame
    const wrapper: FrameCallback = (state) => callbackRef(state)
    unregister = registerFrameCallback(wrapper, priority)
  })

  onCleanup(() => {
    if (unregister) {
      unregister()
      unregister = null
    }
  })
}

export default useFrame
