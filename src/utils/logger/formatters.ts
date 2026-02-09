/**
 * Formatting Helpers for Logs
 */

/**
 * Shorten a UUID to first 8 characters
 */
export function shortId(id: string | null | undefined): string {
  if (!id) return 'null'
  return id.slice(0, 8)
}

/**
 * Format a 3D position as "(x, y, z)"
 */
export function pos(x: number | undefined, y: number | undefined, z: number | undefined, precision = 2): string {
  const fx = x?.toFixed(precision) ?? '?'
  const fy = y?.toFixed(precision) ?? '?'
  const fz = z?.toFixed(precision) ?? '?'
  return `(${fx}, ${fy}, ${fz})`
}

/**
 * Format radians as degrees with degree symbol
 */
export function deg(radians: number | undefined, precision = 1): string {
  if (radians === undefined) return '?°'
  const degrees = radians * 180 / Math.PI
  return `${degrees.toFixed(precision)}°`
}

/**
 * Format a decimal as percentage
 */
export function percent(value: number | undefined, precision = 0): string {
  if (value === undefined) return '?%'
  return `${(value * 100).toFixed(precision)}%`
}

/**
 * Format milliseconds as human-readable time
 */
export function ms(milliseconds: number | undefined): string {
  if (milliseconds === undefined) return '?ms'
  if (milliseconds < 1000) return `${milliseconds.toFixed(0)}ms`
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`
  return `${(milliseconds / 60000).toFixed(1)}m`
}

/**
 * Format a number with commas for thousands
 */
export function num(value: number | undefined, precision?: number): string {
  if (value === undefined) return '?'
  const formatted = precision !== undefined ? value.toFixed(precision) : value.toString()
  return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Format bytes as human-readable size
 */
export function bytes(value: number | undefined): string {
  if (value === undefined) return '?B'
  if (value < 1024) return `${value}B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)}MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string | undefined, maxLength = 50): string {
  if (!str) return ''
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Format ship state for display
 */
export function shipState(state: string | undefined): string {
  if (!state) return 'unknown'
  return state.replace(/_/g, ' ')
}

/**
 * Format an object for inline display (single line JSON)
 */
export function inline(obj: unknown): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

// Export all formatters as a single object for convenience
export const fmt = {
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
}
