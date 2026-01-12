import { Show } from 'solid-js'
import { Ticket, Users, TrendingUp, Sparkles } from 'lucide-solid'
import { cn } from '@/lib/utils'

export interface LotteryOddsProps {
  /** Synapse ID */
  synapseId: string
  /** User's contribution to the synapse */
  userContribution: number
  /** Total contribution from all explorers */
  totalContribution: number
  /** Total number of participants */
  participantCount?: number
  /** Compact display mode */
  compact?: boolean
  /** Additional CSS classes */
  class?: string
}

/**
 * LotteryOdds - Displays lottery odds for a synapse
 *
 * Shows the user's contribution percentage, estimated win probability,
 * and total participant count with a visual probability bar.
 */
export function LotteryOdds(props: LotteryOddsProps) {
  // Calculate contribution percentage
  const contributionPercentage = () => props.totalContribution > 0
    ? (props.userContribution / props.totalContribution) * 100
    : 0

  // Estimated win probability (contribution-weighted)
  const winProbability = () => contributionPercentage()

  // Format percentages
  const formattedContribution = () => contributionPercentage().toFixed(1)
  const formattedProbability = () => winProbability().toFixed(1)

  // Determine odds color based on probability
  const getOddsColor = (prob: number) => {
    if (prob >= 50) return 'text-emerald-400'
    if (prob >= 25) return 'text-yellow-400'
    if (prob >= 10) return 'text-orange-400'
    return 'text-red-400'
  }

  const oddsColor = () => getOddsColor(winProbability())

  return (
    <Show
      when={!props.compact}
      fallback={
        <div
          class={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200',
            'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
            'border-purple-500/30',
            props.class
          )}
        >
          <Ticket class="h-3.5 w-3.5 text-purple-400" />
          <span class={cn('text-sm font-bold', oddsColor())}>
            {formattedProbability()}%
          </span>
          <Show when={(props.participantCount ?? 0) > 0}>
            <span class="text-xs text-[var(--text-muted)]">
              ({props.participantCount} {props.participantCount === 1 ? 'player' : 'players'})
            </span>
          </Show>
        </div>
      }
    >
      <div
        class={cn(
          'rounded-xl border p-4 transition-all duration-200',
          'bg-gradient-to-br from-purple-500/10 via-[var(--background-secondary)] to-pink-500/10',
          'border-purple-500/30',
          props.class
        )}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-purple-500/20">
              <Ticket class="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p class="font-semibold text-sm text-purple-400">Lottery Odds</p>
              <p class="text-xs text-[var(--text-muted)]">Contribution-weighted</p>
            </div>
          </div>

          {/* Sparkle animation for high odds */}
          <Show when={winProbability() >= 25}>
            <div class="animate-[wiggle_2s_ease-in-out_infinite]">
              <Sparkles class="h-4 w-4 text-yellow-400" />
            </div>
          </Show>
        </div>

        {/* Probability Bar */}
        <div class="mb-4">
          <div class="flex justify-between text-sm mb-2">
            <span class="text-[var(--text-muted)]">Win Probability</span>
            <span class={cn('font-bold', oddsColor())}>
              {formattedProbability()}%
            </span>
          </div>
          <div class="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(winProbability(), 100)}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div class="grid grid-cols-2 gap-3">
          {/* Your Contribution */}
          <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
            <div class="flex items-center gap-2 mb-1">
              <TrendingUp class="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <span class="text-xs text-[var(--text-muted)]">Your Share</span>
            </div>
            <p class="font-bold text-[var(--text-primary)]">
              {formattedContribution()}%
            </p>
            <p class="text-xs text-[var(--text-muted)]">
              {props.userContribution.toLocaleString()} pts
            </p>
          </div>

          {/* Participants */}
          <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
            <div class="flex items-center gap-2 mb-1">
              <Users class="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <span class="text-xs text-[var(--text-muted)]">Participants</span>
            </div>
            <p class="font-bold text-[var(--text-primary)]">
              {props.participantCount ?? 0}
            </p>
            <p class="text-xs text-[var(--text-muted)]">
              {props.totalContribution.toLocaleString()} total pts
            </p>
          </div>
        </div>

        {/* Tips */}
        <div class="mt-3 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <p class="text-xs text-purple-300">
            Higher contribution = better odds. Keep exploring to improve your chances!
          </p>
        </div>
      </div>
    </Show>
  )
}

/**
 * LotteryOddsBadge - Minimal lottery odds badge
 */
export interface LotteryOddsBadgeProps {
  winProbability: number
  class?: string
}

export function LotteryOddsBadge(props: LotteryOddsBadgeProps) {
  const getOddsColor = (prob: number) => {
    if (prob >= 50) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (prob >= 25) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    if (prob >= 10) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    return 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  return (
    <span
      class={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border',
        getOddsColor(props.winProbability),
        props.class
      )}
    >
      <Ticket class="h-3 w-3" />
      {props.winProbability.toFixed(1)}%
    </span>
  )
}
