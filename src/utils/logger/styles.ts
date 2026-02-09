/**
 * Logger Style Presets
 */

import type { LogStyle } from './types'

// CSS style presets for different log types
export const STYLE_PRESETS = {
  success: {
    background: '#22c55e',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
  },
  error: {
    background: '#ef4444',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
  },
  info: {
    background: '#3b82f6',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  warning: {
    background: '#f97316',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  optimistic: {
    background: '#06b6d4',
    color: 'black',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  critical: {
    background: '#ef4444',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  debug: {
    background: '#6b7280',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '3px',
  },
} as const satisfies Record<string, LogStyle>

// Namespace-specific colors for visual distinction
export const NAMESPACE_COLORS: Record<string, string> = {
  ws: '#8b5cf6',      // Purple for WebSocket
  ship: '#14b8a6',    // Teal for ships
  auth: '#f59e0b',    // Amber for auth
  user: '#ec4899',    // Pink for user
  event: '#6366f1',   // Indigo for events
  config: '#64748b',  // Slate for config
  agent: '#06b6d4',   // Cyan for agents
  deploy: '#84cc16',  // Lime for deployment
  travel: '#22d3ee',  // Light cyan for travel
  brain: '#a855f7',   // Purple for brain/3D
  three: '#f43f5e',   // Rose for Three.js
}

/**
 * Convert LogStyle to CSS string for console styling
 */
export function styleToCSS(style: LogStyle): string {
  const parts: string[] = []
  if (style.background) parts.push(`background: ${style.background}`)
  if (style.color) parts.push(`color: ${style.color}`)
  if (style.fontSize) parts.push(`font-size: ${style.fontSize}`)
  if (style.fontWeight) parts.push(`font-weight: ${style.fontWeight}`)
  if (style.padding) parts.push(`padding: ${style.padding}`)
  if (style.borderRadius) parts.push(`border-radius: ${style.borderRadius}`)
  return parts.join('; ')
}

/**
 * Get namespace badge style
 */
export function getNamespaceStyle(namespace: string): string {
  const baseNamespace = namespace.split(':')[0]
  const color = NAMESPACE_COLORS[baseNamespace] || '#6b7280'
  return `background: ${color}; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;`
}
