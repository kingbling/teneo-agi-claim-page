import { create } from 'zustand'
import { FUNCTIONAL_BRAIN_REGIONS, type BrainRegion } from '@/constants/brainRegions'

interface BrainRegionStore {
  // Currently selected region index (-1 = none)
  selectedRegionIndex: number

  // Highlight intensity for animation (0-1)
  highlightIntensity: number

  // Actions
  selectRegion: (index: number) => void
  clearSelection: () => void
  setHighlightIntensity: (intensity: number) => void

  // Computed
  getSelectedRegion: () => BrainRegion | null
}

export const useBrainRegionStore = create<BrainRegionStore>((set, get) => ({
  selectedRegionIndex: -1,
  highlightIntensity: 0,

  selectRegion: (index: number) => {
    if (index >= -1 && index < FUNCTIONAL_BRAIN_REGIONS.length) {
      set({ selectedRegionIndex: index, highlightIntensity: 1.0 })
    }
  },

  clearSelection: () => {
    set({ selectedRegionIndex: -1, highlightIntensity: 0 })
  },

  setHighlightIntensity: (intensity: number) => {
    set({ highlightIntensity: Math.max(0, Math.min(1, intensity)) })
  },

  getSelectedRegion: () => {
    const { selectedRegionIndex } = get()
    if (selectedRegionIndex >= 0 && selectedRegionIndex < FUNCTIONAL_BRAIN_REGIONS.length) {
      return FUNCTIONAL_BRAIN_REGIONS[selectedRegionIndex]
    }
    return null
  },
}))
