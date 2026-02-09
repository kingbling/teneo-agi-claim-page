/**
 * useBrainTime - SolidJS Version
 *
 * Unified time management for brain visualization.
 */

import { createSignal, onMount, onCleanup } from 'solid-js'

/**
 * useBrainTime - Provides time values for brain visualization
 *
 * @returns Object with:
 *   - scaledTime: Cumulative time
 *   - deltaTime: Frame delta
 *   - timeScale: Always 1.0
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
      setScaledTime((prev) => prev + delta)

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
    timeScale: () => 1.0,
    realTime,
  }
}
