/**
 * Structured Logging Library
 *
 * Usage:
 * ```ts
 * import { log, fmt, createLogger } from '@/utils/logger'
 *
 * // Pre-configured loggers
 * log.ws.info('Connected')                    // [WebSocket] Connected
 * log.ship.error('Failed', error)             // [ShipStore] Failed
 *
 * // Styled output
 * log.ws.success('Data preserved!')           // Green background
 * log.deploy.critical('Starting...')          // Red + large font
 *
 * // Sub-namespaces
 * const wsSync = log.ws.child('ships:sync')
 * wsSync.info('Received', count)              // [WebSocket:ships:sync] Received 5
 *
 * // Formatting helpers
 * log.ship.info({
 *   id: fmt.shortId(ship.id),                 // "abc12345"
 *   pos: fmt.pos(x, y, z),                    // "(1.23, 4.56, 7.89)"
 *   rotation: fmt.deg(radians),               // "45.0°"
 *   progress: fmt.percent(0.75),              // "75%"
 * })
 *
 * // Throttled logging (animation loops)
 * const throttled = log.agent.throttle(1000)  // Log at most once per second
 * useFrame(() => throttled.info('Frame:', n))
 * ```
 */

// Re-export types
export type { Logger, LogLevel, LogStyle, LoggerConfig, LoggerOptions } from './types'

// Re-export configuration functions
export { getConfig, setConfig, resetConfig } from './config'

// Re-export formatters
export { fmt } from './formatters'
export {
  shortId,
  pos,
  deg,
  percent,
  ms,
  num,
  bytes,
  truncate,
  shipState,
  inline,
} from './formatters'

// Re-export factory
export { createLogger } from './createLogger'

// Re-export throttle utilities
export { createThrottledLogger, createFrameThrottledLogger } from './throttle'

// Pre-configured loggers for common namespaces
import { createLogger } from './createLogger'

export const log = {
  /** WebSocket connection and messages */
  ws: createLogger('WebSocket'),
  /** Ship store operations */
  ship: createLogger('ShipStore'),
  /** Authentication */
  auth: createLogger('Auth'),
  /** User store operations */
  user: createLogger('UserStore'),
  /** Configuration */
  config: createLogger('ConfigStore'),
  /** Agent/ship visualization */
  agent: createLogger('Agent'),
  /** Ship deployment */
  deploy: createLogger('Deploy'),
  /** Travel/navigation */
  travel: createLogger('Travel'),
  /** Brain/3D visualization */
  brain: createLogger('Brain'),
  /** Three.js operations */
  three: createLogger('Three'),
  /** Dashboard UI */
  dashboard: createLogger('Dashboard'),
}
