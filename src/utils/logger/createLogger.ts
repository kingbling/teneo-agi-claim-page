/**
 * Logger Factory
 */

import type { Logger, LogLevel } from './types'
import { shouldLog, getConfig } from './config'
import { STYLE_PRESETS, styleToCSS, getNamespaceStyle } from './styles'
import { createThrottledLogger } from './throttle'

/**
 * Create a namespaced logger instance
 */
export function createLogger(namespace: string): Logger {
  const namespaceStyle = getNamespaceStyle(namespace)

  const logWithLevel = (level: LogLevel, style?: string) => {
    return (...args: unknown[]): void => {
      if (!shouldLog(level)) return

      const config = getConfig()
      const prefix = config.showTimestamps
        ? `[${new Date().toISOString()}] [${namespace}]`
        : `[${namespace}]`

      if (style) {
        // Styled output with CSS
        console.log(`%c${prefix}`, style, ...args)
      } else {
        // Standard output with namespace badge
        console.log(`%c${prefix}`, namespaceStyle, ...args)
      }
    }
  }

  const logWithStyle = (baseLevel: LogLevel, styleName: keyof typeof STYLE_PRESETS) => {
    return (...args: unknown[]): void => {
      if (!shouldLog(baseLevel)) return

      const config = getConfig()
      const prefix = config.showTimestamps
        ? `[${new Date().toISOString()}] [${namespace}]`
        : `[${namespace}]`

      const style = styleToCSS(STYLE_PRESETS[styleName])
      console.log(`%c${prefix}`, style, ...args)
    }
  }

  const logger: Logger = {
    debug: (...args: unknown[]): void => {
      if (!shouldLog('debug')) return
      const config = getConfig()
      const prefix = config.showTimestamps
        ? `[${new Date().toISOString()}] [${namespace}]`
        : `[${namespace}]`
      console.log(`%c${prefix}`, styleToCSS(STYLE_PRESETS.debug), ...args)
    },
    info: logWithLevel('info'),
    warn: (...args: unknown[]): void => {
      if (!shouldLog('warn')) return
      const config = getConfig()
      const prefix = config.showTimestamps
        ? `[${new Date().toISOString()}] [${namespace}]`
        : `[${namespace}]`
      console.warn(`%c${prefix}`, styleToCSS(STYLE_PRESETS.warning), ...args)
    },
    error: (...args: unknown[]): void => {
      if (!shouldLog('error')) return
      const config = getConfig()
      const prefix = config.showTimestamps
        ? `[${new Date().toISOString()}] [${namespace}]`
        : `[${namespace}]`
      console.error(`%c${prefix}`, styleToCSS(STYLE_PRESETS.error), ...args)
    },
    success: logWithStyle('info', 'success'),
    critical: logWithStyle('error', 'critical'),
    child: (subNamespace: string) => createLogger(`${namespace}:${subNamespace}`),
    throttle: (intervalMs: number) => createThrottledLogger(logger, intervalMs),
  }

  return logger
}
