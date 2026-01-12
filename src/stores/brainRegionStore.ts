import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import { FUNCTIONAL_BRAIN_REGIONS, type BrainRegion } from '@/constants/brainRegions'

interface BrainRegionState {
  // Currently selected region index (-1 = none)
  selectedRegionIndex: number
  // Highlight intensity for animation (0-1)
  highlightIntensity: number
}

function createBrainRegionStore() {
  const [state, setState] = createStore<BrainRegionState>({
    selectedRegionIndex: -1,
    highlightIntensity: 0,
  })

  // Actions
  const selectRegion = (index: number) => {
    if (index >= -1 && index < FUNCTIONAL_BRAIN_REGIONS.length) {
      setState({ selectedRegionIndex: index, highlightIntensity: 1.0 })
    }
  }

  const clearSelection = () => {
    setState({ selectedRegionIndex: -1, highlightIntensity: 0 })
  }

  const setHighlightIntensity = (intensity: number) => {
    setState({ highlightIntensity: Math.max(0, Math.min(1, intensity)) })
  }

  return {
    // Reactive getters
    get selectedRegionIndex() {
      return state.selectedRegionIndex
    },
    get highlightIntensity() {
      return state.highlightIntensity
    },
    get selectedRegion(): BrainRegion | null {
      if (state.selectedRegionIndex >= 0 && state.selectedRegionIndex < FUNCTIONAL_BRAIN_REGIONS.length) {
        return FUNCTIONAL_BRAIN_REGIONS[state.selectedRegionIndex]
      }
      return null
    },
    // Actions
    selectRegion,
    clearSelection,
    setHighlightIntensity,
  }
}

export const brainRegionStore = createRoot(createBrainRegionStore)
