/**
 * Throttled Logger for Animation Loops
 */

import type { Logger } from './types'

/**
 * Create a throttled version of a logger
 * Useful for animation loops where logging every frame would spam the console
 */
export function createThrottledLogger(
  baseLogger: Logger,
  intervalMs: number
): Logger {
  let lastLogTime = 0

  const shouldLog = (): boolean => {
    const now = Date.now()
    if (now - lastLogTime >= intervalMs) {
      lastLogTime = now
      return true
    }
    return false
  }

  const throttledMethod = (method: (...args: unknown[]) => void) => {
    return (...args: unknown[]) => {
      if (shouldLog()) {
        method(...args)
      }
    }
  }

  return {
    debug: throttledMethod(baseLogger.debug),
    info: throttledMethod(baseLogger.info),
    warn: throttledMethod(baseLogger.warn),
    error: throttledMethod(baseLogger.error),
    success: throttledMethod(baseLogger.success),
    critical: throttledMethod(baseLogger.critical),
    child: (subNamespace: string) => createThrottledLogger(baseLogger.child(subNamespace), intervalMs),
    throttle: (newIntervalMs: number) => createThrottledLogger(baseLogger, newIntervalMs),
  }
}

/**
 * Create a frame-rate based throttle (e.g., log once per 60 frames at 60fps = once per second)
 */
export function createFrameThrottledLogger(
  baseLogger: Logger,
  everyNFrames: number
): Logger {
  let frameCount = 0

  const shouldLog = (): boolean => {
    frameCount++
    if (frameCount >= everyNFrames) {
      frameCount = 0
      return true
    }
    return false
  }

  const throttledMethod = (method: (...args: unknown[]) => void) => {
    return (...args: unknown[]) => {
      if (shouldLog()) {
        method(...args)
      }
    }
  }

  return {
    debug: throttledMethod(baseLogger.debug),
    info: throttledMethod(baseLogger.info),
    warn: throttledMethod(baseLogger.warn),
    error: throttledMethod(baseLogger.error),
    success: throttledMethod(baseLogger.success),
    critical: throttledMethod(baseLogger.critical),
    child: (subNamespace: string) => createFrameThrottledLogger(baseLogger.child(subNamespace), everyNFrames),
    throttle: (newEveryNFrames: number) => createFrameThrottledLogger(baseLogger, newEveryNFrames),
  }
}
