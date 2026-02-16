/**
 * Centralized color definitions for the application
 *
 * Synapse type colors are now derived from the database via configStore.
 * Fallback colors are provided for the seeded types.
 */

import type { SynapseType } from '@/types/game'
import type { ShipStatus } from '@/stores/shipStore'

// RGB color interface (normalized 0-1 for Three.js)
export interface RGBColor {
  r: number
  g: number
  b: number
}

// Synapse type colors - full configuration
export interface SynapseColorConfig {
  rgb: RGBColor
  tw: {
    bg: string
    text: string
    border: string
    glow: string
  }
}

// Fallback Tailwind color classes keyed by hue bucket
// Used when synapse types come from DB (we can't generate Tailwind classes dynamically)
const TW_COLOR_BUCKETS = [
  { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
  { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30', glow: 'shadow-teal-500/20' },
  { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20' },
  { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
  { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', glow: 'shadow-pink-500/20' },
  { bg: 'bg-amber-400/20', text: 'text-amber-300', border: 'border-amber-400/30', glow: 'shadow-amber-400/20' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20' },
]

// Default fallback config for unknown types
const DEFAULT_COLOR_CONFIG: SynapseColorConfig = {
  rgb: { r: 0.5, g: 0.7, b: 1.0 },
  tw: TW_COLOR_BUCKETS[0],
}

// Build synapse color config from RGB values (from DB) + assign Tailwind bucket
function buildColorConfig(r: number, g: number, b: number, index: number): SynapseColorConfig {
  return {
    rgb: { r, g, b },
    tw: TW_COLOR_BUCKETS[index % TW_COLOR_BUCKETS.length],
  }
}

// Dynamic color map — populated from configStore synapse types
let _synapseColors: Record<string, SynapseColorConfig> = {}

/**
 * Initialize synapse colors from DB-provided synapse types.
 * Call this after configStore loads synapse types.
 */
export function initSynapseColors(types: Array<{ name: string; colorR: number; colorG: number; colorB: number }>): void {
  const colors: Record<string, SynapseColorConfig> = {}
  types.forEach((t, i) => {
    colors[t.name] = buildColorConfig(t.colorR, t.colorG, t.colorB, i)
  })
  _synapseColors = colors
}

/**
 * Get the synapse color record. Dynamic after initSynapseColors is called.
 */
export const SYNAPSE_COLORS: Record<SynapseType, SynapseColorConfig> = new Proxy(
  {} as Record<SynapseType, SynapseColorConfig>,
  {
    get(_target, prop: string) {
      return _synapseColors[prop] || DEFAULT_COLOR_CONFIG
    },
    ownKeys() {
      return Object.keys(_synapseColors)
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      if (prop in _synapseColors) {
        return { configurable: true, enumerable: true, value: _synapseColors[prop] }
      }
      return undefined
    },
    has(_target, prop: string) {
      return prop in _synapseColors
    },
  }
)

// Helper to get RGB color as CSS rgba string
export function rgbToRgba(color: RGBColor, alpha: number = 1): string {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`
}

// Helper to get RGB color as CSS rgb string
export function rgbToRgb(color: RGBColor): string {
  return `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`
}

// Helper to get synapse color as CSS string
export function getSynapseRgbColor(type: SynapseType | undefined): string {
  const config = SYNAPSE_COLORS[type || 'minor'] || DEFAULT_COLOR_CONFIG
  return rgbToRgb(config.rgb)
}

// Ship status colors - full configuration
export interface ShipStatusColorConfig {
  iconClass: string
  badgeClass: string
  barClass: string
  textClass: string
  label: string
  icon: string
  description: string
}

export const SHIP_STATUS_COLORS: Record<ShipStatus, ShipStatusColorConfig> = {
  idle: {
    iconClass: 'text-gray-400',
    badgeClass: 'bg-gray-500/20 text-gray-400',
    barClass: 'bg-gray-500',
    textClass: 'text-gray-400',
    label: 'Idle',
    icon: '○',
    description: 'Ready to deploy',
  },
  traveling: {
    iconClass: 'text-yellow-400',
    badgeClass: 'bg-yellow-500/20 text-yellow-400',
    barClass: 'bg-yellow-500',
    textClass: 'text-yellow-400',
    label: 'Traveling',
    icon: '→',
    description: 'Traveling to synapse',
  },
  solving: {
    iconClass: 'text-teal-400',
    badgeClass: 'bg-teal-500/20 text-teal-400',
    barClass: 'bg-teal-500',
    textClass: 'text-teal-400',
    label: 'Solving',
    icon: '⟳',
    description: 'Solving synapse',
  },
  returning: {
    iconClass: 'text-purple-400',
    badgeClass: 'bg-purple-500/20 text-purple-400',
    barClass: 'bg-purple-500',
    textClass: 'text-purple-400',
    label: 'Returning',
    icon: '←',
    description: 'Returning home',
  },
}

// Status order for display
export const SHIP_STATUS_ORDER: ShipStatus[] = ['idle', 'traveling', 'solving', 'returning']
