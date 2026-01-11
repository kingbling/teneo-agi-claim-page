import { create } from 'zustand'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}

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

export interface EventMilestone {
  id: string
  target: number
  current: number
  reward: {
    type: string
    amount: number
    label: string
  }
  completed: boolean
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

  // Milestones (optional)
  milestones?: EventMilestone[]

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
  // Events
  activeEvents: LiveEvent[]
  upcomingEvents: LiveEvent[]
  pastEvents: LiveEvent[]

  // UI State
  dismissedEventIds: string[]
  expandedEventId: string | null

  // Loading
  isLoading: boolean
  error: string | null

  // Polling
  lastFetchTime: number | null
}

export interface EventActions {
  // Fetch
  fetchActiveEvents: () => Promise<void>
  fetchUpcomingEvents: () => Promise<void>
  checkEventStatus: () => Promise<void>

  // UI
  dismissEvent: (eventId: string) => void
  restoreDismissedEvent: (eventId: string) => void
  setExpandedEvent: (eventId: string | null) => void

  // Helpers
  getEventById: (eventId: string) => LiveEvent | undefined
  getActiveMultiplier: (type: EventMultiplier['type']) => number
  getTotalMultiplier: (type: EventMultiplier['type']) => number
  getTimeRemaining: (eventId: string) => number | null
  isEventDismissed: (eventId: string) => boolean
  hasActiveEvents: () => boolean
}

export type EventStore = EventState & EventActions

const initialState: EventState = {
  activeEvents: [],
  upcomingEvents: [],
  pastEvents: [],
  dismissedEventIds: [],
  expandedEventId: null,
  isLoading: false,
  error: null,
  lastFetchTime: null,
}

// API response types
interface ApiEventResponse {
  id: string
  type: string
  name: string
  description: string
  state: 'upcoming' | 'active' | 'completed'
  startTime: number
  endTime: number
  multiplier: number
  isActive: boolean
  createdAt: number
}

// Event type mappings
const EVENT_TYPE_MAP: Record<string, EventType> = {
  double_xp: 'xp_boost',
  bonus_agi: 'reward_boost',
  special_synapse: 'discovery_rush',
  community_challenge: 'community_challenge',
  sector_rush: 'discovery_rush',
  lucky_hour: 'lottery_frenzy',
}

const EVENT_COLORS: Record<string, { color: string; accentColor: string }> = {
  xp_boost: { color: '#8B5CF6', accentColor: '#A78BFA' },
  reward_boost: { color: '#10B981', accentColor: '#34D399' },
  discovery_rush: { color: '#3B82F6', accentColor: '#60A5FA' },
  lottery_frenzy: { color: '#F59E0B', accentColor: '#FBBF24' },
  community_challenge: { color: '#EC4899', accentColor: '#F472B6' },
  special: { color: '#6366F1', accentColor: '#818CF8' },
}

// Transform API event to frontend LiveEvent
function transformApiEvent(apiEvent: ApiEventResponse): LiveEvent {
  const eventType = EVENT_TYPE_MAP[apiEvent.type] || 'special'
  const colors = EVENT_COLORS[eventType] || EVENT_COLORS.special
  const durationMs = apiEvent.endTime - apiEvent.startTime
  const durationMinutes = Math.round(durationMs / (60 * 1000))

  // Create multiplier based on event type
  const multipliers: EventMultiplier[] = []
  if (apiEvent.multiplier !== 1) {
    if (apiEvent.type === 'double_xp') {
      multipliers.push({ type: 'xp', value: apiEvent.multiplier, label: `${apiEvent.multiplier}x Brain XP` })
    } else if (apiEvent.type === 'bonus_agi') {
      multipliers.push({ type: 'agi', value: apiEvent.multiplier, label: `${apiEvent.multiplier}x $AGI` })
    } else if (apiEvent.type === 'lucky_hour') {
      multipliers.push({ type: 'lottery_odds', value: apiEvent.multiplier, label: `${apiEvent.multiplier}x Lottery Odds` })
    } else {
      multipliers.push({ type: 'discovery_rate', value: apiEvent.multiplier, label: `${apiEvent.multiplier}x Discovery` })
    }
  }

  return {
    id: apiEvent.id,
    name: apiEvent.name,
    description: apiEvent.description,
    type: eventType,
    status: apiEvent.state === 'completed' ? 'ended' : apiEvent.state,
    startTime: new Date(apiEvent.startTime),
    endTime: new Date(apiEvent.endTime),
    durationMinutes,
    multipliers,
    iconUrl: null,
    bannerUrl: null,
    color: colors.color,
    accentColor: colors.accentColor,
    participantCount: 0,
    isParticipating: false,
  }
}

export const useEventStore = create<EventStore>((set, get) => ({
  ...initialState,

  // ============ FETCH ============

  fetchActiveEvents: async () => {
    set({ isLoading: true, error: null })

    try {
      const response = await fetch(`${API_URL}/api/events/active`)
      if (!response.ok) throw new Error('Failed to fetch active events')
      const data = await response.json()

      // Transform API events to frontend format
      const activeEvents = (data.active || []).map(transformApiEvent)
      const upcomingEvents = (data.upcoming || []).map(transformApiEvent)

      set({
        activeEvents,
        upcomingEvents,
        isLoading: false,
        lastFetchTime: Date.now(),
      })
    } catch (error) {
      console.error('Failed to fetch active events:', error)
      set({
        isLoading: false,
        error: 'Failed to load events',
        activeEvents: [],
        upcomingEvents: [],
      })
    }
  },

  fetchUpcomingEvents: async () => {
    try {
      const response = await fetch(`${API_URL}/api/events?state=upcoming&limit=10`)
      if (!response.ok) throw new Error('Failed to fetch upcoming events')
      const data = await response.json()

      // Transform API events to frontend format
      const upcomingEvents = (data.events || []).map(transformApiEvent)

      set({ upcomingEvents })
    } catch (error) {
      console.error('Failed to fetch upcoming events:', error)
    }
  },

  checkEventStatus: async () => {
    const { activeEvents, upcomingEvents } = get()
    const now = Date.now()

    // Check if any active events have ended
    const stillActive = activeEvents.filter(event => {
      return new Date(event.endTime).getTime() > now
    })

    const nowEnded = activeEvents.filter(event => {
      return new Date(event.endTime).getTime() <= now
    })

    // Check if any upcoming events have started
    const nowActive = upcomingEvents.filter(event => {
      const startTime = new Date(event.startTime).getTime()
      const endTime = new Date(event.endTime).getTime()
      return startTime <= now && endTime > now
    })

    const stillUpcoming = upcomingEvents.filter(event => {
      return new Date(event.startTime).getTime() > now
    })

    // Update state if there are changes
    if (nowEnded.length > 0 || nowActive.length > 0) {
      set({
        activeEvents: [...stillActive, ...nowActive.map(e => ({ ...e, status: 'active' as EventStatus }))],
        upcomingEvents: stillUpcoming,
        pastEvents: [...get().pastEvents, ...nowEnded.map(e => ({ ...e, status: 'ended' as EventStatus }))],
      })
    }
  },

  // ============ UI ============

  dismissEvent: (eventId: string) => {
    set((state) => ({
      dismissedEventIds: [...state.dismissedEventIds, eventId],
    }))
  },

  restoreDismissedEvent: (eventId: string) => {
    set((state) => ({
      dismissedEventIds: state.dismissedEventIds.filter(id => id !== eventId),
    }))
  },

  setExpandedEvent: (eventId: string | null) => {
    set({ expandedEventId: eventId })
  },

  // ============ HELPERS ============

  getEventById: (eventId: string) => {
    const { activeEvents, upcomingEvents, pastEvents } = get()
    return [...activeEvents, ...upcomingEvents, ...pastEvents].find(e => e.id === eventId)
  },

  getActiveMultiplier: (type: EventMultiplier['type']): number => {
    const { activeEvents } = get()
    for (const event of activeEvents) {
      const multiplier = event.multipliers.find(m => m.type === type)
      if (multiplier) {
        return multiplier.value
      }
    }
    return 1.0
  },

  getTotalMultiplier: (type: EventMultiplier['type']): number => {
    const { activeEvents } = get()
    let total = 1.0

    for (const event of activeEvents) {
      const multiplier = event.multipliers.find(m => m.type === type)
      if (multiplier) {
        // Multiplicative stacking
        total *= multiplier.value
      }
    }

    return total
  },

  getTimeRemaining: (eventId: string): number | null => {
    const event = get().getEventById(eventId)
    if (!event) return null

    const now = Date.now()

    if (event.status === 'upcoming') {
      // Time until start
      return Math.max(0, new Date(event.startTime).getTime() - now)
    }

    if (event.status === 'active') {
      // Time until end
      return Math.max(0, new Date(event.endTime).getTime() - now)
    }

    return 0 // Ended
  },

  isEventDismissed: (eventId: string): boolean => {
    return get().dismissedEventIds.includes(eventId)
  },

  hasActiveEvents: (): boolean => {
    const { activeEvents, dismissedEventIds } = get()
    return activeEvents.some(event => !dismissedEventIds.includes(event.id))
  },
}))

// ============ SELECTORS ============

export const selectActiveEvents = (state: EventStore) => state.activeEvents
export const selectUpcomingEvents = (state: EventStore) => state.upcomingEvents
export const selectPastEvents = (state: EventStore) => state.pastEvents
export const selectIsLoadingEvents = (state: EventStore) => state.isLoading
export const selectDismissedEventIds = (state: EventStore) => state.dismissedEventIds
export const selectExpandedEventId = (state: EventStore) => state.expandedEventId
export const selectHasActiveEvents = (state: EventStore) => state.hasActiveEvents()

// ============ HELPER FUNCTIONS ============

export function getEventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    xp_boost: 'XP Boost',
    reward_boost: 'Reward Boost',
    discovery_rush: 'Discovery Rush',
    lottery_frenzy: 'Lottery Frenzy',
    community_challenge: 'Community Challenge',
    special: 'Special Event',
  }
  return labels[type]
}

export function getEventTypeIcon(type: EventType): string {
  const icons: Record<EventType, string> = {
    xp_boost: 'Zap',
    reward_boost: 'Gift',
    discovery_rush: 'Rocket',
    lottery_frenzy: 'Ticket',
    community_challenge: 'Users',
    special: 'Star',
  }
  return icons[type]
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Ended'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h`
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return `${seconds}s`
}

export function formatMultiplier(value: number): string {
  if (value >= 2) {
    return `${value}x`
  }
  const percent = Math.round((value - 1) * 100)
  return percent > 0 ? `+${percent}%` : `${percent}%`
}
