import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Zap,
  Gift,
  Rocket,
  Ticket,
  Users,
  Star,
  Trophy,
  Target,
  Calendar,
  CheckCircle2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  useEventStore,
  type LiveEvent,
  type EventType,
  type EventMultiplier,
  type EventMilestone,
  formatMultiplier,
  getEventTypeLabel,
} from '@/stores/eventStore'
import { cn } from '@/lib/utils'

interface EventDetailsModalProps {
  event: LiveEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * EventDetailsModal - Full event information modal
 * Shows multipliers, bonuses, schedule, and community goals
 */
export function EventDetailsModal({
  event,
  open,
  onOpenChange,
}: EventDetailsModalProps) {
  const { getTimeRemaining } = useEventStore()
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  // Update countdown timer
  useEffect(() => {
    if (!event || !open) return

    const updateTimer = () => {
      const remaining = getTimeRemaining(event.id)
      setTimeRemaining(remaining || 0)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [event, open, getTimeRemaining])

  if (!event) return null

  const Icon = getEventIcon(event.type)
  const isUpcoming = event.status === 'upcoming'
  const isActive = event.status === 'active'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {/* Header with gradient background */}
        <div
          className="absolute inset-0 rounded-2xl opacity-10 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${event.color}40 0%, transparent 50%, ${event.accentColor}20 100%)`,
          }}
        />

        <DialogHeader className="relative">
          <div className="flex items-center gap-4 mb-2">
            <div
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${event.color}20` }}
            >
              <Icon className="h-8 w-8" style={{ color: event.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl">{event.name}</DialogTitle>
                <EventStatusBadge status={event.status} color={event.color} />
              </div>
              <DialogDescription className="mt-1">
                {getEventTypeLabel(event.type)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 relative">
          {/* Description */}
          <p className="text-[var(--text-secondary)] leading-relaxed">
            {event.description}
          </p>

          {/* Countdown Timer */}
          <div className="flex items-center justify-center p-4 rounded-xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]/30">
            <CountdownDisplay
              timeRemaining={timeRemaining}
              isUpcoming={isUpcoming}
              color={event.color}
            />
          </div>

          {/* Multipliers & Bonuses */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5" style={{ color: event.color }} />
              <h3 className="font-bold text-[var(--text-primary)]">
                Active Bonuses
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {event.multipliers.map((multiplier, index) => (
                <MultiplierCard
                  key={index}
                  multiplier={multiplier}
                  color={event.color}
                  isActive={isActive}
                />
              ))}
            </div>
          </div>

          {/* Community Goal */}
          {event.communityGoal && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5" style={{ color: event.color }} />
                <h3 className="font-bold text-[var(--text-primary)]">
                  Community Goal
                </h3>
              </div>
              <CommunityGoalCard
                goal={event.communityGoal}
                color={event.color}
              />
            </div>
          )}

          {/* Milestones */}
          {event.milestones && event.milestones.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5" style={{ color: event.color }} />
                <h3 className="font-bold text-[var(--text-primary)]">
                  Milestones
                </h3>
              </div>
              <div className="space-y-2">
                {event.milestones.map((milestone, index) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    index={index}
                    color={event.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="p-4 rounded-xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]/30">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
              <h3 className="font-bold text-[var(--text-primary)]">
                Event Schedule
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--text-muted)] mb-1">Starts</p>
                <p className="font-medium text-[var(--text-primary)]">
                  {new Date(event.startTime).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] mb-1">Ends</p>
                <p className="font-medium text-[var(--text-primary)]">
                  {new Date(event.endTime).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Participants */}
          {event.participantCount > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--background-primary)]/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-muted)]">
                  Participants
                </span>
              </div>
              <span className="font-bold text-[var(--text-primary)]">
                {event.participantCount.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============ EVENT STATUS BADGE ============

interface EventStatusBadgeProps {
  status: 'active' | 'upcoming' | 'ended'
  color: string
}

function EventStatusBadge({ status, color }: EventStatusBadgeProps) {
  const labels = {
    active: 'LIVE',
    upcoming: 'Upcoming',
    ended: 'Ended',
  }

  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-bold',
        status === 'active' && 'animate-pulse'
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {labels[status]}
    </span>
  )
}

// ============ COUNTDOWN DISPLAY ============

interface CountdownDisplayProps {
  timeRemaining: number
  isUpcoming: boolean
  color: string
}

function CountdownDisplay({ timeRemaining, isUpcoming, color }: CountdownDisplayProps) {
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)

  return (
    <div className="text-center">
      <p className="text-sm text-[var(--text-muted)] mb-2">
        {isUpcoming ? 'Starts in' : 'Ends in'}
      </p>
      <div className="flex items-center justify-center gap-3">
        {days > 0 && (
          <TimeUnit value={days} label="Days" color={color} />
        )}
        <TimeUnit value={hours} label="Hours" color={color} />
        <TimeUnit value={minutes} label="Min" color={color} />
        <TimeUnit value={seconds} label="Sec" color={color} />
      </div>
    </div>
  )
}

interface TimeUnitProps {
  value: number
  label: string
  color: string
}

function TimeUnit({ value, label, color }: TimeUnitProps) {
  return (
    <div className="flex flex-col items-center">
      <motion.span
        key={value}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-3xl font-bold tabular-nums"
        style={{ color }}
      >
        {value.toString().padStart(2, '0')}
      </motion.span>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </div>
  )
}

// ============ MULTIPLIER CARD ============

interface MultiplierCardProps {
  multiplier: EventMultiplier
  color: string
  isActive: boolean
}

function MultiplierCard({ multiplier, color, isActive }: MultiplierCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        'p-4 rounded-xl border transition-all',
        'bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        isActive
          ? 'border-transparent shadow-md'
          : 'border-[var(--card-border)]/30 opacity-60'
      )}
      style={{
        borderColor: isActive ? `${color}40` : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-5 w-5" style={{ color }} />
        <span
          className="text-2xl font-bold"
          style={{ color }}
        >
          {formatMultiplier(multiplier.value)}
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        {multiplier.label}
      </p>
      {isActive && (
        <span
          className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          Active Now
        </span>
      )}
    </motion.div>
  )
}

// ============ COMMUNITY GOAL CARD ============

interface CommunityGoalCardProps {
  goal: {
    target: number
    current: number
    reward: {
      type: string
      amount: number
      label: string
    }
  }
  color: string
}

function CommunityGoalCard({ goal, color }: CommunityGoalCardProps) {
  const progress = (goal.current / goal.target) * 100

  return (
    <div
      className="p-4 rounded-xl border"
      style={{ borderColor: `${color}30` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[var(--text-muted)]">Community Progress</span>
        <span className="font-bold text-[var(--text-primary)]">
          {goal.current.toLocaleString()} / {goal.target.toLocaleString()}
        </span>
      </div>

      <Progress
        value={progress}
        size="lg"
        variant="default"
        showGlow
        animated
      />

      <div className="flex items-center justify-between mt-4 p-3 rounded-lg bg-[var(--background-primary)]/50">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5" style={{ color }} />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Reward
          </span>
        </div>
        <span className="font-bold" style={{ color }}>
          {goal.reward.label}
        </span>
      </div>
    </div>
  )
}

// ============ MILESTONE CARD ============

interface MilestoneCardProps {
  milestone: EventMilestone
  index: number
  color: string
}

function MilestoneCard({ milestone, index, color }: MilestoneCardProps) {
  const progress = (milestone.current / milestone.target) * 100

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border',
        milestone.completed
          ? 'bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/30'
          : 'bg-[var(--background-primary)]/50 border-[var(--card-border)]/20'
      )}
    >
      {/* Status indicator */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          milestone.completed
            ? 'bg-[hsl(var(--success))]/20'
            : 'bg-[var(--background-tertiary)]'
        )}
      >
        {milestone.completed ? (
          <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
        ) : (
          <span className="text-sm font-bold text-[var(--text-muted)]">
            {index + 1}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {milestone.target.toLocaleString()} Goal
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: milestone.completed ? 'hsl(var(--success))' : color }}
          >
            {milestone.reward.label}
          </span>
        </div>
        {!milestone.completed && (
          <Progress value={progress} size="sm" />
        )}
      </div>
    </motion.div>
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
