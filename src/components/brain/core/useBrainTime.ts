/**
 * useBrainTime - SolidJS Version (Stub)
 *
 * Unified time management for brain visualization.
 * Trance mode has been deprecated - always uses normal time scale.
 */

import { createSignal, onMount, onCleanup } from 'solid-js'
import { TRANCE_CONFIG } from './brainConstants'

/**
 * useBrainTime - Provides time values for brain visualization
 *
 * @returns Object with:
 *   - scaledTime: Cumulative time (always at normal scale since trance is deprecated)
 *   - deltaTime: Frame delta
 *   - timeScale: Always 1.0 (trance mode deprecated)
 *   - realTime: Actual elapsed time
 */
export function useBrainTime() {
  const [scaledTime, setScaledTime] = createSignal(0)
  const [deltaTime, setDeltaTime] = createSignal(0)
  const [realTime, setRealTime] = createSignal(0)

  let lastTime = performance.now()
  let animationId: number

  onMount(() => {
    const update = () => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      setDeltaTime(delta)
      setRealTime((prev) => prev + delta)
      setScaledTime((prev) => prev + delta * TRANCE_CONFIG.normalScale)

      animationId = requestAnimationFrame(update)
    }

    animationId = requestAnimationFrame(update)

    onCleanup(() => {
      cancelAnimationFrame(animationId)
    })
  })

  return {
    scaledTime,
    deltaTime,
    timeScale: () => TRANCE_CONFIG.normalScale,
    isTranceActive: () => false, // Trance mode deprecated
    realTime,
  }
}
