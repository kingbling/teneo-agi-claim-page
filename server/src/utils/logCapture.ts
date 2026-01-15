/**
 * Log Capture Utility
 *
 * Captures console.log/warn/error and broadcasts them to admin clients.
 * Maintains a circular buffer of recent logs for admin dashboard.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
  data?: any
}

// Circular buffer for recent logs
const MAX_LOGS = 1000
const logBuffer: LogEntry[] = []
let logIdCounter = 0

// Callbacks for broadcasting logs
type LogCallback = (entry: LogEntry) => void
const logCallbacks: LogCallback[] = []

/**
 * Register a callback to receive log entries
 */
export function onLogEntry(callback: LogCallback): void {
  logCallbacks.push(callback)
}

/**
 * Add a log entry and broadcast to listeners
 */
function addLog(level: LogLevel, message: string, data?: any): void {
  const entry: LogEntry = {
    id: `log_${Date.now()}_${++logIdCounter}`,
    timestamp: Date.now(),
    level,
    message,
    data,
  }

  // Add to buffer (circular)
  logBuffer.push(entry)
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift()
  }

  // Broadcast to listeners
  for (const callback of logCallbacks) {
    try {
      callback(entry)
    } catch (e) {
      // Avoid infinite loop if callback fails
    }
  }
}

/**
 * Get recent logs with optional filtering
 */
export function getLogs(options: {
  limit?: number
  offset?: number
  level?: LogLevel
  search?: string
  since?: number
} = {}): { logs: LogEntry[]; total: number } {
  const { limit = 100, offset = 0, level, search, since } = options

  let filtered = logBuffer

  // Filter by level
  if (level) {
    filtered = filtered.filter(log => log.level === level)
  }

  // Filter by timestamp
  if (since) {
    filtered = filtered.filter(log => log.timestamp >= since)
  }

  // Filter by search term
  if (search) {
    const searchLower = search.toLowerCase()
    filtered = filtered.filter(log =>
      log.message.toLowerCase().includes(searchLower)
    )
  }

  // Most recent first
  const sorted = [...filtered].reverse()
  const total = sorted.length
  const logs = sorted.slice(offset, offset + limit)

  return { logs, total }
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logBuffer.length = 0
}

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
}

/**
 * Format arguments to string
 */
function formatArgs(args: any[]): { message: string; data?: any } {
  if (args.length === 0) return { message: '' }

  const parts: string[] = []
  let data: any = undefined

  for (const arg of args) {
    if (typeof arg === 'string') {
      parts.push(arg)
    } else if (typeof arg === 'number' || typeof arg === 'boolean') {
      parts.push(String(arg))
    } else if (arg instanceof Error) {
      parts.push(`${arg.name}: ${arg.message}`)
      data = { stack: arg.stack }
    } else {
      try {
        parts.push(JSON.stringify(arg))
      } catch {
        parts.push('[Object]')
      }
      data = arg
    }
  }

  return { message: parts.join(' '), data }
}

/**
 * Install log capture - intercepts console methods
 */
export function installLogCapture(): void {
  console.log = (...args: any[]) => {
    originalConsole.log(...args)
    const { message, data } = formatArgs(args)
    addLog('info', message, data)
  }

  console.warn = (...args: any[]) => {
    originalConsole.warn(...args)
    const { message, data } = formatArgs(args)
    addLog('warn', message, data)
  }

  console.error = (...args: any[]) => {
    originalConsole.error(...args)
    const { message, data } = formatArgs(args)
    addLog('error', message, data)
  }

  console.debug = (...args: any[]) => {
    originalConsole.debug(...args)
    const { message, data } = formatArgs(args)
    addLog('debug', message, data)
  }

  // Log that capture is active
  addLog('info', '[LogCapture] Server log capture initialized')
}

/**
 * Restore original console methods
 */
export function uninstallLogCapture(): void {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.debug = originalConsole.debug
}
