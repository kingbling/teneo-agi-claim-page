/**
 * UI Store - Local UI preferences and settings
 *
 * Persists to localStorage for cross-session persistence.
 */

import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'

const STORAGE_KEY = 'teneo-ui-settings'

interface UIState {
  showIdleShips: boolean
  shipNavigatorExpanded: boolean
}

const defaultState: UIState = {
  showIdleShips: false,
  shipNavigatorExpanded: true,
}

function loadFromStorage(): Partial<UIState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveToStorage(state: UIState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

function createUIStore() {
  const [state, setState] = createStore<UIState>({
    ...defaultState,
    ...loadFromStorage(),
  })

  const setShowIdleShips = (show: boolean) => {
    setState('showIdleShips', show)
    saveToStorage(state)
  }

  const setShipNavigatorExpanded = (expanded: boolean) => {
    setState('shipNavigatorExpanded', expanded)
    saveToStorage(state)
  }

  const toggleShowIdleShips = () => {
    setShowIdleShips(!state.showIdleShips)
  }

  const toggleShipNavigator = () => {
    setShipNavigatorExpanded(!state.shipNavigatorExpanded)
  }

  return {
    // State accessors
    get showIdleShips() { return state.showIdleShips },
    get shipNavigatorExpanded() { return state.shipNavigatorExpanded },

    // Actions
    setShowIdleShips,
    setShipNavigatorExpanded,
    toggleShowIdleShips,
    toggleShipNavigator,
  }
}

export const uiStore = createRoot(createUIStore)
export default uiStore
