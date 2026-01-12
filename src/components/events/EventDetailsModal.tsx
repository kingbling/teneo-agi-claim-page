import { createSignal, createEffect, onCleanup, Show, For, type Component } from 'solid-js'
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
} from 'lucide-solid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  eventStore,
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
export const EventDetailsModal: Component<EventDetailsModalProps> = (props) => {
  const [timeRemaining, setTimeRemaining] = createSignal<number>(0)

  // Update countdown timer
  createEffect(() => {
    const event = props.event
    if (!event || !props.open) return

    const updateTimer = () => {
      const remaining = eventStore.getTimeRemaining(event.id)
      setTimeRemaining(remaining || 0)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    onCleanup(() => clearInterval(interval))
  })

  return (
    <Show when={props.event}>
      {(event) => {
        const Icon = () => getEventIcon(event().type)
        const isUpcoming = () => event().status === 'upcoming'
        const isActive = () => event().status === 'active'

        return (
          <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent class="max-w-xl">
              {/* Header with gradient background */}
              <div
                class="absolute inset-0 rounded-2xl opacity-10 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${event().color}40 0%, transparent 50%, ${event().accentColor}20 100%)`,
                }}
              />

              <DialogHeader class="relative">
                <div class="flex items-center gap-4 mb-2">
                  <div
                    class="p-3 rounded-xl"
                    style={{ 'background-color': `${event().color}20` }}
                  >
                    <Icon class="h-8 w-8" style={{ color: event().color }} />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <DialogTitle class="text-xl">{event().name}</DialogTitle>
                      <EventStatusBadge status={event().status} color={event().color} />
                    </div>
                    <DialogDescription class="mt-1">
                      {getEventTypeLabel(event().type)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div class="space-y-6 relative">
                {/* Description */}
                <p class="text-[var(--text-secondary)] leading-relaxed">
                  {event().description}
                </p>

                {/* Countdown Timer */}
                <div class="flex items-center justify-center p-4 rounded-xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]/30">
                  <CountdownDisplay
                    timeRemaining={timeRemaining()}
                    isUpcoming={isUpcoming()}
                    color={event().color}
                  />
                </div>

                {/* Multipliers & Bonuses */}
                <div>
                  <div class="flex items-center gap-2 mb-3">
                    <Zap class="h-5 w-5" style={{ color: event().color }} />
                    <h3 class="font-bold text-[var(--text-primary)]">
                      Active Bonuses
                    </h3>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <For each={event().multipliers}>
                      {(multiplier, index) => (
                        <MultiplierCard
                          multiplier={multiplier}
                          color={event().color}
                          isActive={isActive()}
                        />
                      )}
                    </For>
                  </div>
                </div>

                {/* Community Goal */}
                <Show when={event().communityGoal}>
                  {(goal) => (
                    <div>
                      <div class="flex items-center gap-2 mb-3">
                        <Users class="h-5 w-5" style={{ color: event().color }} />
                        <h3 class="font-bold text-[var(--text-primary)]">
                          Community Goal
                        </h3>
                      </div>
                      <CommunityGoalCard
                        goal={goal()}
                        color={event().color}
                      />
                    </div>
                  )}
                </Show>

                {/* Milestones */}
                <Show when={event().milestones && event().milestones!.length > 0}>
                  <div>
                    <div class="flex items-center gap-2 mb-3">
                      <Target class="h-5 w-5" style={{ color: event().color }} />
                      <h3 class="font-bold text-[var(--text-primary)]">
                        Milestones
                      </h3>
                    </div>
                    <div class="space-y-2">
                      <For each={event().milestones}>
                        {(milestone, index) => (
                          <MilestoneCard
                            milestone={milestone}
                            index={index()}
                            color={event().color}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Schedule */}
                <div class="p-4 rounded-xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]/30">
                  <div class="flex items-center gap-2 mb-3">
                    <Calendar class="h-5 w-5 text-[var(--text-muted)]" />
                    <h3 class="font-bold text-[var(--text-primary)]">
                      Event Schedule
                    </h3>
                  </div>
                  <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p class="text-[var(--text-muted)] mb-1">Starts</p>
                      <p class="font-medium text-[var(--text-primary)]">
                        {new Date(event().startTime).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div>
                      <p class="text-[var(--text-muted)] mb-1">Ends</p>
                      <p class="font-medium text-[var(--text-primary)]">
                        {new Date(event().endTime).toLocaleDateString(undefined, {
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
                <Show when={event().participantCount > 0}>
                  <div class="flex items-center justify-between p-3 rounded-lg bg-[var(--background-primary)]/50">
                    <div class="flex items-center gap-2">
                      <Users class="h-4 w-4 text-[var(--text-muted)]" />
                      <span class="text-sm text-[var(--text-muted)]">
                        Participants
                      </span>
                    </div>
                    <span class="font-bold text-[var(--text-primary)]">
                      {event().participantCount.toLocaleString()}
                    </span>
                  </div>
                </Show>
              </div>
            </DialogContent>
          </Dialog>
        )
      }}
    </Show>
  )
}

// ============ EVENT STATUS BADGE ============

interface EventStatusBadgeProps {
  status: 'active' | 'upcoming' | 'ended'
  color: string
}

const EventStatusBadge: Component<EventStatusBadgeProps> = (props) => {
  const labels = {
    active: 'LIVE',
    upcoming: 'Upcoming',
    ended: 'Ended',
  }

  return (
    <span
      class={cn(
        'px-2 py-0.5 rounded-full text-xs font-bold',
        props.status === 'active' && 'animate-pulse'
      )}
      style={{
        'background-color': `${props.color}20`,
        color: props.color,
      }}
    >
      {labels[props.status]}
    </span>
  )
}

// ============ COUNTDOWN DISPLAY ============

interface CountdownDisplayProps {
  timeRemaining: number
  isUpcoming: boolean
  color: string
}

const CountdownDisplay: Component<CountdownDisplayProps> = (props) => {
  const days = () => Math.floor(props.timeRemaining / (1000 * 60 * 60 * 24))
  const hours = () => Math.floor((props.timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = () => Math.floor((props.timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = () => Math.floor((props.timeRemaining % (1000 * 60)) / 1000)

  return (
    <div class="text-center">
      <p class="text-sm text-[var(--text-muted)] mb-2">
        {props.isUpcoming ? 'Starts in' : 'Ends in'}
      </p>
      <div class="flex items-center justify-center gap-3">
        <Show when={days() > 0}>
          <TimeUnit value={days()} label="Days" color={props.color} />
        </Show>
        <TimeUnit value={hours()} label="Hours" color={props.color} />
        <TimeUnit value={minutes()} label="Min" color={props.color} />
        <TimeUnit value={seconds()} label="Sec" color={props.color} />
      </div>
    </div>
  )
}

interface TimeUnitProps {
  value: number
  label: string
  color: string
}

const TimeUnit: Component<TimeUnitProps> = (props) => {
  return (
    <div class="flex flex-col items-center">
      <span
        class="text-3xl font-bold tabular-nums animate-fade-in"
        style={{ color: props.color }}
      >
        {props.value.toString().padStart(2, '0')}
      </span>
      <span class="text-xs text-[var(--text-muted)]">{props.label}</span>
    </div>
  )
}

// ============ MULTIPLIER CARD ============

interface MultiplierCardProps {
  multiplier: EventMultiplier
  color: string
  isActive: boolean
}

const MultiplierCard: Component<MultiplierCardProps> = (props) => {
  return (
    <div
      class={cn(
        'p-4 rounded-xl border transition-all',
        'bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'hover:scale-[1.02]',
        props.isActive
          ? 'border-transparent shadow-md'
          : 'border-[var(--card-border)]/30 opacity-60'
      )}
      style={{
        'border-color': props.isActive ? `${props.color}40` : undefined,
      }}
    >
      <div class="flex items-center gap-2 mb-2">
        <Zap class="h-5 w-5" style={{ color: props.color }} />
        <span
          class="text-2xl font-bold"
          style={{ color: props.color }}
        >
          {formatMultiplier(props.multiplier.value)}
        </span>
      </div>
      <p class="text-sm text-[var(--text-secondary)]">
        {props.multiplier.label}
      </p>
      <Show when={props.isActive}>
        <span
          class="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium"
          style={{ 'background-color': `${props.color}20`, color: props.color }}
        >
          Active Now
        </span>
      </Show>
    </div>
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

const CommunityGoalCard: Component<CommunityGoalCardProps> = (props) => {
  const progress = () => (props.goal.current / props.goal.target) * 100

  return (
    <div
      class="p-4 rounded-xl border"
      style={{ 'border-color': `${props.color}30` }}
    >
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm text-[var(--text-muted)]">Community Progress</span>
        <span class="font-bold text-[var(--text-primary)]">
          {props.goal.current.toLocaleString()} / {props.goal.target.toLocaleString()}
        </span>
      </div>

      <Progress
        value={progress()}
        size="lg"
        variant="default"
        showGlow
        animated
      />

      <div class="flex items-center justify-between mt-4 p-3 rounded-lg bg-[var(--background-primary)]/50">
        <div class="flex items-center gap-2">
          <Trophy class="h-5 w-5" style={{ color: props.color }} />
          <span class="text-sm font-medium text-[var(--text-primary)]">
            Reward
          </span>
        </div>
        <span class="font-bold" style={{ color: props.color }}>
          {props.goal.reward.label}
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

const MilestoneCard: Component<MilestoneCardProps> = (props) => {
  const progress = () => (props.milestone.current / props.milestone.target) * 100

  return (
    <div
      class={cn(
        'flex items-center gap-4 p-3 rounded-lg border animate-slide-in-left',
        props.milestone.completed
          ? 'bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/30'
          : 'bg-[var(--background-primary)]/50 border-[var(--card-border)]/20'
      )}
      style={{ 'animation-delay': `${props.index * 50}ms` }}
    >
      {/* Status indicator */}
      <div
        class={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          props.milestone.completed
            ? 'bg-[hsl(var(--success))]/20'
            : 'bg-[var(--background-tertiary)]'
        )}
      >
        <Show
          when={props.milestone.completed}
          fallback={
            <span class="text-sm font-bold text-[var(--text-muted)]">
              {props.index + 1}
            </span>
          }
        >
          <CheckCircle2 class="h-5 w-5 text-[hsl(var(--success))]" />
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-medium text-[var(--text-primary)]">
            {props.milestone.target.toLocaleString()} Goal
          </span>
          <span
            class="text-sm font-medium"
            style={{ color: props.milestone.completed ? 'hsl(var(--success))' : props.color }}
          >
            {props.milestone.reward.label}
          </span>
        </div>
        <Show when={!props.milestone.completed}>
          <Progress value={progress()} size="sm" />
        </Show>
      </div>
    </div>
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
