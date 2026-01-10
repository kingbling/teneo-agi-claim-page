import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAgentStore } from '@/stores/agentStore'

/**
 * useTranceTime - Manages scaled time for trance slowdown effect
 *
 * Server-authoritative trance state affects all time-based animations
 * with a 20x slowdown factor (configurable per agent's trance trait level).
 *
 * @returns {Object} - { scaledTime: number, timeScale: number }
 *
 * @example
 * ```tsx
 * const { scaledTime, timeScale } = useTranceTime()
 * // Use scaledTime for animation timing
 * ```
 */
export function useTranceTime() {
  const userAgents = useAgentStore((state) => state.userAgents)

  // 20x slowdown when any agent has trance active
  const timeScale = userAgents.some(a => a.tranceActive) ? 0.05 : 1.0

  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  useFrame(({ clock }) => {
    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
  })

  return {
    scaledTime: scaledTimeRef.current,
    timeScale
  }
}
