/**
 * Logger Configuration
 */

import type { LoggerConfig, LogLevel } from './types'

const isDev = import.meta.env.DEV

// Log level priority (lower = more verbose)
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Default configuration
const defaultConfig: LoggerConfig = {
  minLevel: isDev ? 'debug' : 'warn',
  enabled: true,
  showTimestamps: false,
}

// Global mutable config
let globalConfig: LoggerConfig = { ...defaultConfig }

/**
 * Get current logger configuration
 */
export function getConfig(): LoggerConfig {
  return globalConfig
}

/**
 * Update logger configuration
 */
export function setConfig(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config }
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  globalConfig = { ...defaultConfig }
}

/**
 * Check if a log level should be output
 */
export function shouldLog(level: LogLevel): boolean {
  if (!globalConfig.enabled) return false
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[globalConfig.minLevel]
}
