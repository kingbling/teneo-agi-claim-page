import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'

// ============================================================================
// MASTERPLAN 2026: EVENT STORE
// Manages live events - time-limited bonuses and multipliers
// ============================================================================

export interface LiveEvent {
  id: string
  name: string
  description: string

  // Timing
  startTime: Date
  endTime: Date
  durationMinutes: number
}

export interface EventState {
  activeEvents: LiveEvent[]
  isLoading: boolean
  error: string | null
}

const initialState: EventState = {
  activeEvents: [],
  isLoading: false,
  error: null,
}

// Create the SolidJS store
function createEventStore() {
  const [state, setState] = createStore<EventState>(initialState)

  const actions = {
    hasActiveEvents: (): boolean => {
      return state.activeEvents.length > 0
    },
  }

  return { state, actions, setState }
}

// Create a singleton store instance using createRoot for proper disposal
export const eventStore = createRoot(() => createEventStore())
