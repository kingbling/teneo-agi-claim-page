import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
import {
  useEventStore,
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
  className?: string
}

/**
 * LiveEventBanner - Displays active events with countdown
 * Shows multipliers, time remaining, and can be dismissed
 */
export function LiveEventBanner({
  onViewDetails,
  maxVisible = 1,
  compact = false,
  dismissible = true,
  autoRotate = true,
  rotateInterval = 5000,
  className,
}: LiveEventBannerProps) {
  const {
    activeEvents,
    fetchActiveEvents,
    dismissEvent,
    isEventDismissed,
    getTimeRemaining,
  } = useEventStore()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({})

  // Fetch events on mount
  useEffect(() => {
    if (activeEvents.length === 0) {
      fetchActiveEvents()
    }
  }, [activeEvents.length, fetchActiveEvents])

  // Filter out dismissed events
  const visibleEvents = activeEvents.filter(event => !isEventDismissed(event.id))

  // Update countdown timer
  useEffect(() => {
    const updateTimers = () => {
      const times: Record<string, number> = {}
      visibleEvents.forEach(event => {
        const remaining = getTimeRemaining(event.id)
        if (remaining !== null) {
          times[event.id] = remaining
        }
      })
      setTimeRemaining(times)
    }

    updateTimers()
    const interval = setInterval(updateTimers, 1000)
    return () => clearInterval(interval)
  }, [visibleEvents, getTimeRemaining])

  // Auto-rotate through events
  useEffect(() => {
    if (!autoRotate || visibleEvents.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % visibleEvents.length)
    }, rotateInterval)

    return () => clearInterval(interval)
  }, [autoRotate, rotateInterval, visibleEvents.length])

  // Reset index if current is out of bounds
  useEffect(() => {
    if (currentIndex >= visibleEvents.length) {
      setCurrentIndex(0)
    }
  }, [currentIndex, visibleEvents.length])

  const handleDismiss = useCallback((eventId: string) => {
    dismissEvent(eventId)
  }, [dismissEvent])

  if (visibleEvents.length === 0) {
    return null
  }

  const displayEvents = maxVisible === 1
    ? [visibleEvents[currentIndex]]
    : visibleEvents.slice(0, maxVisible)

  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {displayEvents.map(event => (
          <CompactEventBadge
            key={event.id}
            event={event}
            timeRemaining={timeRemaining[event.id] || 0}
            onDismiss={dismissible ? () => handleDismiss(event.id) : undefined}
            onClick={() => onViewDetails?.(event)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <AnimatePresence mode="popLayout">
        {displayEvents.map(event => (
          <EventBannerCard
            key={event.id}
            event={event}
            timeRemaining={timeRemaining[event.id] || 0}
            onDismiss={dismissible ? () => handleDismiss(event.id) : undefined}
            onClick={() => onViewDetails?.(event)}
          />
        ))}
      </AnimatePresence>

      {/* Pagination dots */}
      {visibleEvents.length > 1 && maxVisible === 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {visibleEvents.map((event, index) => (
            <button
              key={event.id}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentIndex
                  ? 'bg-[var(--text-primary)] scale-110'
                  : 'bg-[var(--text-muted)] hover:bg-[var(--text-secondary)]'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============ EVENT BANNER CARD ============

interface EventBannerCardProps {
  event: LiveEvent
  timeRemaining: number
  onDismiss?: () => void
  onClick?: () => void
}

function EventBannerCard({ event, timeRemaining, onDismiss, onClick }: EventBannerCardProps) {
  const Icon = getEventIcon(event.type)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'relative overflow-hidden rounded-xl border p-4',
        'bg-gradient-to-r from-[var(--background-secondary)] via-[var(--background-secondary)] to-transparent',
        'border-[var(--card-border)] hover:border-[var(--card-border-hover)]',
        'cursor-pointer transition-all hover:shadow-lg'
      )}
      style={{
        borderColor: `${event.color}40`,
        boxShadow: `0 0 20px ${event.color}10`,
      }}
      onClick={onClick}
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(135deg, ${event.color}20 0%, transparent 50%, ${event.accentColor}10 100%)`,
        }}
      />

      {/* Animated sparkles */}
      <motion.div
        className="absolute top-2 right-16 opacity-30"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <Sparkles className="h-4 w-4" style={{ color: event.color }} />
      </motion.div>

      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <div
          className="flex-shrink-0 p-3 rounded-xl"
          style={{ backgroundColor: `${event.color}20` }}
        >
          <Icon className="h-6 w-6" style={{ color: event.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-[var(--text-primary)] truncate">
              {event.name}
            </h4>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium animate-pulse"
              style={{ backgroundColor: `${event.color}20`, color: event.color }}
            >
              LIVE
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] line-clamp-1">
            {event.description}
          </p>
        </div>

        {/* Multipliers */}
        <div className="flex flex-col items-end gap-1">
          {event.multipliers.slice(0, 2).map((multiplier, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold"
              style={{ backgroundColor: `${event.color}20`, color: event.color }}
            >
              <Zap className="h-3 w-3" />
              {multiplier.label}
            </div>
          ))}
        </div>

        {/* Time remaining */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
            <Clock className="h-4 w-4 text-[var(--text-muted)]" />
            {formatTimeRemaining(timeRemaining)}
          </div>
          <span className="text-xs text-[var(--text-muted)]">remaining</span>
        </div>

        {/* View details arrow */}
        <ChevronRight className="h-5 w-5 text-[var(--text-muted)]" />
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-lg',
            'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            'hover:bg-[var(--background-tertiary)] transition-colors'
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  )
}

// ============ COMPACT EVENT BADGE ============

interface CompactEventBadgeProps {
  event: LiveEvent
  timeRemaining: number
  onDismiss?: () => void
  onClick?: () => void
}

function CompactEventBadge({ event, timeRemaining, onDismiss, onClick }: CompactEventBadgeProps) {
  const Icon = getEventIcon(event.type)
  const mainMultiplier = event.multipliers[0]

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-2 px-3 py-2 rounded-xl border',
        'bg-[var(--background-secondary)] transition-all',
        'hover:shadow-md'
      )}
      style={{
        borderColor: `${event.color}40`,
      }}
    >
      {/* Icon */}
      <Icon className="h-4 w-4" style={{ color: event.color }} />

      {/* Name */}
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {event.name}
      </span>

      {/* Multiplier */}
      {mainMultiplier && (
        <span
          className="px-1.5 py-0.5 rounded text-xs font-bold"
          style={{ backgroundColor: `${event.color}20`, color: event.color }}
        >
          {formatMultiplier(mainMultiplier.value)}
        </span>
      )}

      {/* Time */}
      <span className="text-xs text-[var(--text-muted)]">
        {formatTimeRemaining(timeRemaining)}
      </span>

      {/* Dismiss */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="ml-1 p-0.5 rounded hover:bg-[var(--background-tertiary)]"
        >
          <X className="h-3 w-3 text-[var(--text-muted)]" />
        </button>
      )}

      {/* Live indicator */}
      <span
        className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse"
        style={{ backgroundColor: event.color }}
      />
    </motion.button>
  )
}

// ============ MINIMAL BANNER (Header) ============

interface MinimalEventBannerProps {
  onClick?: (event: LiveEvent) => void
  className?: string
}

/**
 * MinimalEventBanner - Tiny indicator for headers showing active event count
 */
export function MinimalEventBanner({ onClick, className }: MinimalEventBannerProps) {
  const { activeEvents, isEventDismissed, fetchActiveEvents } = useEventStore()

  useEffect(() => {
    if (activeEvents.length === 0) {
      fetchActiveEvents()
    }
  }, [activeEvents.length, fetchActiveEvents])

  const visibleEvents = activeEvents.filter(e => !isEventDismissed(e.id))

  if (visibleEvents.length === 0) {
    return null
  }

  const primaryEvent = visibleEvents[0]
  const Icon = getEventIcon(primaryEvent.type)

  return (
    <motion.button
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onClick?.(primaryEvent)}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'bg-[var(--background-secondary)] border border-[var(--card-border)]',
        'hover:border-[var(--card-border-hover)] transition-all',
        className
      )}
      style={{ borderColor: `${primaryEvent.color}40` }}
    >
      <span
        className="relative flex h-2 w-2"
      >
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: primaryEvent.color }}
        />
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: primaryEvent.color }}
        />
      </span>

      <Icon className="h-4 w-4" style={{ color: primaryEvent.color }} />

      <span className="text-sm font-medium text-[var(--text-primary)]">
        {visibleEvents.length} Active Event{visibleEvents.length > 1 ? 's' : ''}
      </span>
    </motion.button>
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
