/**
 * Ship-related constants
 *
 * Centralizes ship type definitions and perks configuration.
 */

import type { ShipType } from '@/stores/shipStore'
import { Zap, Shield, Radar } from 'lucide-solid'

// Ship type perk definitions
export const SHIP_TYPE_PERKS: Record<ShipType, {
  className: string
  description: string
  perks: { icon: typeof Zap; label: string }[]
}> = {
  neuron: {
    className: 'Agile Interceptor',
    description: 'Fast and maneuverable with twin engines',
    perks: [
      { icon: Zap, label: '+15% travel speed' },
      { icon: Shield, label: 'Twin engine thrust' },
    ],
  },
  synapse: {
    className: 'Heavy Explorer',
    description: 'Robust hull with quad engines and sensor pods',
    perks: [
      { icon: Shield, label: 'More cargo capacity' },
      { icon: Radar, label: 'Quad engines + sensors' },
    ],
  },
  dendrite: {
    className: 'Sleek Scout',
    description: 'Long-range needle design with minimal signature',
    perks: [
      { icon: Radar, label: 'Extended sensor range' },
      { icon: Zap, label: 'Minimal signature' },
    ],
  },
}
