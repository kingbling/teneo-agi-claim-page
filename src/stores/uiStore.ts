/**
 * UI Store - Local UI preferences and settings
 */

import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'

interface UIState {
  showIdleShips: boolean
  shipNavigatorExpanded: boolean
}

function createUIStore() {
  const [state, setState] = createStore<UIState>({
    showIdleShips: true,
    shipNavigatorExpanded: true,
  })

  return {
    get showIdleShips() { return state.showIdleShips },
    get shipNavigatorExpanded() { return state.shipNavigatorExpanded },

    setShowIdleShips: (show: boolean) => setState('showIdleShips', show),
    setShipNavigatorExpanded: (expanded: boolean) => setState('shipNavigatorExpanded', expanded),
    toggleShowIdleShips: () => setState('showIdleShips', !state.showIdleShips),
    toggleShipNavigator: () => setState('shipNavigatorExpanded', !state.shipNavigatorExpanded),
  }
}

export const uiStore = createRoot(createUIStore)
export default uiStore
