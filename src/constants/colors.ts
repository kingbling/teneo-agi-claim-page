/**
 * Centralized color definitions for the application
 *
 * This consolidates color definitions that were duplicated across:
 * - src/types/game.ts (RGB normalized 0-1)
 * - src/components/ui/SynapseInfo.tsx (Tailwind classes)
 * - src/components/dashboard/SynapseListPanel.tsx (Tailwind classes)
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

export const SYNAPSE_COLORS: Record<SynapseType, SynapseColorConfig> = {
  minor: {
    rgb: { r: 0.5, g: 0.7, b: 1.0 },
    tw: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  },
  complex: {
    rgb: { r: 0.7, g: 0.5, b: 1.0 },
    tw: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
  },
  deep: {
    rgb: { r: 0.4, g: 1.0, b: 0.7 },
    tw: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30', glow: 'shadow-teal-500/20' },
  },
  core: {
    rgb: { r: 1.0, g: 0.85, b: 0.1 },
    tw: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20' },
  },
  rare: {
    rgb: { r: 1.0, g: 0.4, b: 0.5 },
    tw: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
  },
  legendary: {
    rgb: { r: 1.0, g: 0.5, b: 1.0 },
    tw: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', glow: 'shadow-pink-500/20' },
  },
  unique: {
    rgb: { r: 1.0, g: 1.0, b: 0.3 },
    tw: { bg: 'bg-amber-400/20', text: 'text-amber-300', border: 'border-amber-400/30', glow: 'shadow-amber-400/20' },
  },
}

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
  const config = SYNAPSE_COLORS[type || 'minor'] || SYNAPSE_COLORS.minor
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

// Synapse types in order (least rare to most rare)
export const SYNAPSE_TYPE_ORDER: SynapseType[] = [
  'minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique'
]

// Shop item colors
export const ITEM_COLORS: Record<string, { accent: string; bg: string }> = {
  speed_boost: { accent: '#75e6ea', bg: 'rgba(117, 230, 234, 0.1)' },
  luck_charm: { accent: '#41cba4', bg: 'rgba(65, 203, 164, 0.1)' },
  xp_amplifier: { accent: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  radar: { accent: '#397bff', bg: 'rgba(57, 123, 255, 0.1)' },
  cloak: { accent: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
}
