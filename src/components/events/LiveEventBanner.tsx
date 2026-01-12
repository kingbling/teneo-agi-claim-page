import { createSignal, createEffect, onCleanup, onMount, Show, For, type Component } from 'solid-js'
import {
  X,
  Zap,
  Gift,
  Rocket,
  Ticket,
  Users,
  Star,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-solid'
import {
  eventStore,
  type LiveEvent,
  type EventType,
  formatTimeRemaining,
  formatMultiplier,
} from '@/stores/eventStore'
import { cn } from '@/lib/utils'

interface LiveEventBannerProps {
  onViewDetails?: (event: LiveEvent) => void
  maxVisible?: number
  compact?: boolean
  dismissible?: boolean
  autoRotate?: boolean
  rotateInterval?: number
  class?: string
}

/**
 * LiveEventBanner - Displays active events with countdown
 * Shows multipliers, time remaining, and can be dismissed
 */
export const LiveEventBanner: Component<LiveEventBannerProps> = (props) => {
  const maxVisible = () => props.maxVisible ?? 1
  const compact = () => props.compact ?? false
  const dismissible = () => props.dismissible ?? true
  const autoRotate = () => props.autoRotate ?? true
  const rotateInterval = () => props.rotateInterval ?? 5000

  const [currentIndex, setCurrentIndex] = createSignal(0)
  const [timeRemaining, setTimeRemaining] = createSignal<Record<string, number>>({})

  // Fetch events on mount
  onMount(() => {
    if (eventStore.activeEvents.length === 0) {
      eventStore.fetchActiveEvents()
    }
  })

  // Filter out dismissed events
  const visibleEvents = () => eventStore.activeEvents.filter(event => !eventStore.isEventDismissed(event.id))

  // Update countdown timer
  createEffect(() => {
    const events = visibleEvents()
    const updateTimers = () => {
      const times: Record<string, number> = {}
      events.forEach(event => {
        const remaining = eventStore.getTimeRemaining(event.id)
        if (remaining !== null) {
          times[event.id] = remaining
        }
      })
      setTimeRemaining(times)
    }

    updateTimers()
    const interval = setInterval(updateTimers, 1000)
    onCleanup(() => clearInterval(interval))
  })

  // Auto-rotate through events
  createEffect(() => {
    const events = visibleEvents()
    if (!autoRotate() || events.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % events.length)
    }, rotateInterval())

    onCleanup(() => clearInterval(interval))
  })

  // Reset index if current is out of bounds
  createEffect(() => {
    const events = visibleEvents()
    if (currentIndex() >= events.length) {
      setCurrentIndex(0)
    }
  })

  const handleDismiss = (eventId: string) => {
    eventStore.dismissEvent(eventId)
  }

  const displayEvents = () => {
    const events = visibleEvents()
    return maxVisible() === 1
      ? [events[currentIndex()]]
      : events.slice(0, maxVisible())
  }

  return (
    <Show when={visibleEvents().length > 0}>
      <Show
        when={!compact()}
        fallback={
          <div class={cn('flex flex-wrap gap-2', props.class)}>
            <For each={displayEvents()}>
              {(event) => (
                <CompactEventBadge
                  event={event}
                  timeRemaining={timeRemaining()[event.id] || 0}
                  onDismiss={dismissible() ? () => handleDismiss(event.id) : undefined}
                  onClick={() => props.onViewDetails?.(event)}
                />
              )}
            </For>
          </div>
        }
      >
        <div class={cn('space-y-2', props.class)}>
          <For each={displayEvents()}>
            {(event) => (
              <EventBannerCard
                event={event}
                timeRemaining={timeRemaining()[event.id] || 0}
                onDismiss={dismissible() ? () => handleDismiss(event.id) : undefined}
                onClick={() => props.onViewDetails?.(event)}
              />
            )}
          </For>

          {/* Pagination dots */}
          <Show when={visibleEvents().length > 1 && maxVisible() === 1}>
            <div class="flex items-center justify-center gap-1.5 pt-1">
              <For each={visibleEvents()}>
                {(event, index) => (
                  <button
                    onClick={() => setCurrentIndex(index())}
                    class={cn(
                      'w-2 h-2 rounded-full transition-all',
                      index() === currentIndex()
                        ? 'bg-[var(--text-primary)] scale-110'
                        : 'bg-[var(--text-muted)] hover:bg-[var(--text-secondary)]'
                    )}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </Show>
  )
}

// ============ EVENT BANNER CARD ============

interface EventBannerCardProps {
  event: LiveEvent
  timeRemaining: number
  onDismiss?: () => void
  onClick?: () => void
}

const EventBannerCard: Component<EventBannerCardProps> = (props) => {
  const Icon = () => getEventIcon(props.event.type)

  return (
    <div
      class={cn(
        'relative overflow-hidden rounded-xl border p-4',
        'bg-gradient-to-r from-[var(--background-secondary)] via-[var(--background-secondary)] to-transparent',
        'border-[var(--card-border)] hover:border-[var(--card-border-hover)]',
        'cursor-pointer transition-all hover:shadow-lg',
        'animate-slide-in-down'
      )}
      style={{
        'border-color': `${props.event.color}40`,
        'box-shadow': `0 0 20px ${props.event.color}10`,
      }}
      onClick={props.onClick}
    >
      {/* Animated gradient background */}
      <div
        class="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(135deg, ${props.event.color}20 0%, transparent 50%, ${props.event.accentColor}10 100%)`,
        }}
      />

      {/* Animated sparkles */}
      <div
        class="absolute top-2 right-16 opacity-30 animate-spin-slow"
      >
        <Sparkles class="h-4 w-4" style={{ color: props.event.color }} />
      </div>

      <div class="relative flex items-center gap-4">
        {/* Icon */}
        <div
          class="flex-shrink-0 p-3 rounded-xl"
          style={{ 'background-color': `${props.event.color}20` }}
        >
          <Icon class="h-6 w-6" style={{ color: props.event.color }} />
        </div>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h4 class="font-bold text-[var(--text-primary)] truncate">
              {props.event.name}
            </h4>
            <span
              class="px-2 py-0.5 rounded-full text-xs font-medium animate-pulse"
              style={{ 'background-color': `${props.event.color}20`, color: props.event.color }}
            >
              LIVE
            </span>
          </div>
          <p class="text-sm text-[var(--text-muted)] line-clamp-1">
            {props.event.description}
          </p>
        </div>

        {/* Multipliers */}
        <div class="flex flex-col items-end gap-1">
          <For each={props.event.multipliers.slice(0, 2)}>
            {(multiplier, index) => (
              <div
                class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold"
                style={{ 'background-color': `${props.event.color}20`, color: props.event.color }}
              >
                <Zap class="h-3 w-3" />
                {multiplier.label}
              </div>
            )}
          </For>
        </div>

        {/* Time remaining */}
        <div class="flex flex-col items-center">
          <div class="flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
            <Clock class="h-4 w-4 text-[var(--text-muted)]" />
            {formatTimeRemaining(props.timeRemaining)}
          </div>
          <span class="text-xs text-[var(--text-muted)]">remaining</span>
        </div>

        {/* View details arrow */}
        <ChevronRight class="h-5 w-5 text-[var(--text-muted)]" />
      </div>

      {/* Dismiss button */}
      <Show when={props.onDismiss}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            props.onDismiss?.()
          }}
          class={cn(
            'absolute top-2 right-2 p-1.5 rounded-lg',
            'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            'hover:bg-[var(--background-tertiary)] transition-colors'
          )}
        >
          <X class="h-4 w-4" />
        </button>
      </Show>
    </div>
  )
}

// ============ COMPACT EVENT BADGE ============

interface CompactEventBadgeProps {
  event: LiveEvent
  timeRemaining: number
  onDismiss?: () => void
  onClick?: () => void
}

const CompactEventBadge: Component<CompactEventBadgeProps> = (props) => {
  const Icon = () => getEventIcon(props.event.type)
  const mainMultiplier = () => props.event.multipliers[0]

  return (
    <button
      onClick={props.onClick}
      class={cn(
        'relative inline-flex items-center gap-2 px-3 py-2 rounded-xl border',
        'bg-[var(--background-secondary)] transition-all',
        'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
        'animate-fade-in'
      )}
      style={{
        'border-color': `${props.event.color}40`,
      }}
    >
      {/* Icon */}
      <Icon class="h-4 w-4" style={{ color: props.event.color }} />

      {/* Name */}
      <span class="text-sm font-medium text-[var(--text-primary)]">
        {props.event.name}
      </span>

      {/* Multiplier */}
      <Show when={mainMultiplier()}>
        {(multiplier) => (
          <span
            class="px-1.5 py-0.5 rounded text-xs font-bold"
            style={{ 'background-color': `${props.event.color}20`, color: props.event.color }}
          >
            {formatMultiplier(multiplier().value)}
          </span>
        )}
      </Show>

      {/* Time */}
      <span class="text-xs text-[var(--text-muted)]">
        {formatTimeRemaining(props.timeRemaining)}
      </span>

      {/* Dismiss */}
      <Show when={props.onDismiss}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            props.onDismiss?.()
          }}
          class="ml-1 p-0.5 rounded hover:bg-[var(--background-tertiary)]"
        >
          <X class="h-3 w-3 text-[var(--text-muted)]" />
        </button>
      </Show>

      {/* Live indicator */}
      <span
        class="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse"
        style={{ 'background-color': props.event.color }}
      />
    </button>
  )
}

// ============ MINIMAL BANNER (Header) ============

interface MinimalEventBannerProps {
  onClick?: (event: LiveEvent) => void
  class?: string
}

/**
 * MinimalEventBanner - Tiny indicator for headers showing active event count
 */
export const MinimalEventBanner: Component<MinimalEventBannerProps> = (props) => {
  onMount(() => {
    if (eventStore.activeEvents.length === 0) {
      eventStore.fetchActiveEvents()
    }
  })

  const visibleEvents = () => eventStore.activeEvents.filter(e => !eventStore.isEventDismissed(e.id))
  const primaryEvent = () => visibleEvents()[0]

  return (
    <Show when={visibleEvents().length > 0}>
      {(() => {
        const event = primaryEvent()
        if (!event) return null
        const Icon = getEventIcon(event.type)

        return (
          <button
            onClick={() => props.onClick?.(event)}
            class={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'bg-[var(--background-secondary)] border border-[var(--card-border)]',
              'hover:border-[var(--card-border-hover)] transition-all',
              'hover:scale-[1.05] active:scale-[0.95]',
              'animate-fade-in',
              props.class
            )}
            style={{ 'border-color': `${event.color}40` }}
          >
            <span class="relative flex h-2 w-2">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ 'background-color': event.color }}
              />
              <span
                class="relative inline-flex rounded-full h-2 w-2"
                style={{ 'background-color': event.color }}
              />
            </span>

            <Icon class="h-4 w-4" style={{ color: event.color }} />

            <span class="text-sm font-medium text-[var(--text-primary)]">
              {visibleEvents().length} Active Event{visibleEvents().length > 1 ? 's' : ''}
            </span>
          </button>
        )
      })()}
    </Show>
  )
}

// ============ HELPERS ============

function getEventIcon(type: EventType): typeof Zap {
  const icons: Record<EventType, typeof Zap> = {
    xp_boost: Zap,
    reward_boost: Gift,
    discovery_rush: Rocket,
    lottery_frenzy: Ticket,
    community_challenge: Users,
    special: Star,
  }
  return icons[type] || Star
}
