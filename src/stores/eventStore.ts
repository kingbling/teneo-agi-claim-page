import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'

// ============================================================================
// MASTERPLAN 2026: EVENT STORE
// Manages live events - time-limited bonuses and multipliers
// ============================================================================

export type EventType = 'xp_boost' | 'reward_boost' | 'discovery_rush' | 'lottery_frenzy' | 'community_challenge' | 'special'

export type EventStatus = 'active' | 'upcoming' | 'ended'

export interface EventMultiplier {
  type: 'xp' | 'agi' | 'teneo' | 'lottery_odds' | 'discovery_rate' | 'points_rate'
  value: number
  label: string
}

export interface LiveEvent {
  id: string
  name: string
  description: string
  type: EventType
  status: EventStatus

  // Timing
  startTime: Date
  endTime: Date
  durationMinutes: number

  // Bonuses
  multipliers: EventMultiplier[]

  // Community Goals (optional)
  communityGoal?: {
    target: number
    current: number
    reward: {
      type: string
      amount: number
      label: string
    }
  }

  // Visual
  iconUrl: string | null
  bannerUrl: string | null
  color: string
  accentColor: string

  // Participation
  participantCount: number
  isParticipating: boolean
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
