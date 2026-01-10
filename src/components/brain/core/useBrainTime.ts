import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAgentStore } from '@/stores/agentStore'
import { TRANCE_CONFIG } from './brainConstants'

/**
 * useBrainTime - Unified time management for brain visualization
 *
 * Provides time values that respect trance mode slowdown.
 * Replaces duplicated time scaling logic across 8+ components.
 *
 * @returns Object with:
 *   - scaledTime: Cumulative time adjusted for trance mode
 *   - deltaTime: Frame delta adjusted for trance mode
 *   - timeScale: Current time multiplier (0.05 in trance, 1.0 normal)
 *   - isTranceActive: Boolean for trance state
 *   - realTime: Actual elapsed time (not scaled)
 */
export function useBrainTime() {
  const userAgents = useAgentStore((state) => state.userAgents)

  // Check if any agent has active trance
  const isTranceActive = userAgents.some((a) => a.tranceActive)
  const timeScale = isTranceActive ? TRANCE_CONFIG.timeScale : TRANCE_CONFIG.normalScale

  // Refs to track time across frames
  const scaledTimeRef = useRef(0)
  const lastRealTimeRef = useRef(0)
  const deltaMsRef = useRef(0)

  useFrame(({ clock }) => {
    const realTime = clock.getElapsedTime()
    const deltaReal = realTime - lastRealTimeRef.current
    lastRealTimeRef.current = realTime

    // Apply time scaling
    const deltaScaled = deltaReal * timeScale
    scaledTimeRef.current += deltaScaled
    deltaMsRef.current = deltaScaled
  })

  return {
    scaledTime: scaledTimeRef.current,
    deltaTime: deltaMsRef.current,
    timeScale,
    isTranceActive,
    realTime: lastRealTimeRef.current,
  }
}

/**
 * Simplified hook for components that only need scaled time
 * (lighter weight - no delta tracking)
 */
export function useScaledTime() {
  const userAgents = useAgentStore((state) => state.userAgents)
  const isTranceActive = userAgents.some((a) => a.tranceActive)
  const timeScale = isTranceActive ? TRANCE_CONFIG.timeScale : TRANCE_CONFIG.normalScale

  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  useFrame(({ clock }) => {
    const realTime = clock.getElapsedTime()
    const delta = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += delta * timeScale
  })

  return scaledTimeRef.current
}
