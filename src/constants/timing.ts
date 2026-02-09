/**
 * Centralized timing constants for the application
 */

export const TIMING = {
  /** Initial WebSocket reconnect delay in ms */
  RECONNECT_INITIAL: 3000,

  /** Maximum WebSocket reconnect delay in ms */
  RECONNECT_MAX: 30000,

  /** Default travel duration for optimistic animation (server will override) */
  DEFAULT_TRAVEL_DURATION: 3000,

  /** Buffer time added to travel duration to account for network latency */
  TRAVEL_BUFFER: 2000,

  /** Interval for updating LOD based on camera distance */
  LOD_UPDATE_INTERVAL: 500,

  /** Default toast notification duration */
  TOAST_DURATION: 3000,

  /** Position change threshold for camera updates (prevents spam) */
  POSITION_THRESHOLD: 0.01,

  /** Camera animation duration for ship zoom */
  SHIP_ZOOM_DURATION: 1000,

  /** Camera animation duration for region transitions */
  REGION_TRANSITION_DURATION: 1200,
} as const

export type TimingKey = keyof typeof TIMING
