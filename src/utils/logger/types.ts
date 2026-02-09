/**
 * Logger Type Definitions
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogStyle {
  background?: string
  color?: string
  fontSize?: string
  fontWeight?: string
  padding?: string
  borderRadius?: string
}

export interface LoggerConfig {
  /** Minimum log level to output (debug < info < warn < error) */
  minLevel: LogLevel
  /** Enable/disable all logging */
  enabled: boolean
  /** Show timestamps in logs */
  showTimestamps: boolean
}

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  success: (...args: unknown[]) => void
  critical: (...args: unknown[]) => void
  child: (subNamespace: string) => Logger
  throttle: (intervalMs: number) => Logger
}

export interface LoggerOptions {
  /** Namespace prefix for log messages */
  namespace: string
  /** Custom styles for this logger */
  style?: LogStyle
}
