/**
 * UI Store - Local UI preferences and settings
 */

import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'

interface UIState {
  showIdleShips: boolean
}

function createUIStore() {
  const [state, setState] = createStore<UIState>({
    showIdleShips: true,
  })

  return {
    get showIdleShips() { return state.showIdleShips },

    setShowIdleShips: (show: boolean) => setState('showIdleShips', show),
    toggleShowIdleShips: () => setState('showIdleShips', !state.showIdleShips),
  }
}

export const uiStore = createRoot(createUIStore)
export default uiStore
