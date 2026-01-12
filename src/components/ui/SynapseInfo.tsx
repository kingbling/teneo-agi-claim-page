import { Show, For } from 'solid-js'
import { Zap, Clock, Users, Trophy, Ticket } from 'lucide-solid'
import { cn } from '@/lib/utils'
import {
  type SynapseType,
  type SynapseDistribution,
  SYNAPSE_CONFIG,
  getSynapseTypeLabel,
  formatPoints,
  formatETA,
} from '@/types/game'
import type { Synapse } from '@/stores/shipStore'

// Synapse type colors for styling
const SYNAPSE_TYPE_COLORS: Record<SynapseType, { bg: string; text: string; border: string; glow: string }> = {
  minor: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  complex: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    glow: 'shadow-purple-500/20',
  },
  deep: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    glow: 'shadow-teal-500/20',
  },
  core: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    glow: 'shadow-yellow-500/20',
  },
  rare: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    glow: 'shadow-red-500/20',
  },
  legendary: {
    bg: 'bg-pink-500/10',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
    glow: 'shadow-pink-500/20',
  },
  unique: {
    bg: 'bg-amber-400/10',
    text: 'text-amber-300',
    border: 'border-amber-400/30',
    glow: 'shadow-amber-400/20',
  },
}

export interface SynapseInfoProps {
  /** Synapse object to display */
  synapse: Synapse
  /** Compact display mode */
  compact?: boolean
  /** Show reward info */
  showRewards?: boolean
  /** Additional CSS classes */
  class?: string
}

/**
 * SynapseInfo - Displays synapse details
 *
 * Shows synapse type with color coding, points required/accumulated,
 * current ETA, explorer count, and reward distribution type.
 */
export function SynapseInfo(props: SynapseInfoProps) {
  const typeConfig = () => SYNAPSE_CONFIG[props.synapse.synapseType]
  const colors = () => SYNAPSE_TYPE_COLORS[props.synapse.synapseType]

  // Calculate progress
  const progress = () => props.synapse.pointsRequired > 0
    ? (props.synapse.pointsAccumulated / props.synapse.pointsRequired) * 100
    : 0

  // Determine distribution type
  const distribution = () => typeConfig().distribution

  return (
    <Show
      when={!props.compact}
      fallback={
        <div
          class={cn(
            'inline-flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-200',
            colors().bg,
            colors().border,
            props.class
          )}
        >
          {/* Type Badge */}
          <SynapseTypeBadge type={props.synapse.synapseType} />

          {/* Progress */}
          <div class="flex items-center gap-2">
            <div class="w-20 h-1.5 rounded-full bg-[var(--background-primary)] overflow-hidden">
              <div
                class={cn('h-full rounded-full transition-[width] duration-500', colors().text.replace('text-', 'bg-'))}
                style={{ width: `${progress()}%` }}
              />
            </div>
            <span class="text-xs text-[var(--text-muted)]">
              {progress().toFixed(0)}%
            </span>
          </div>

          {/* ETA */}
          <Show when={props.synapse.currentEtaMinutes}>
            <span class="text-xs text-[var(--text-muted)]">
              {formatETA(props.synapse.currentEtaMinutes!)}
            </span>
          </Show>

          {/* Explorers */}
          <div class="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Users class="h-3 w-3" />
            {props.synapse.explorerCount}
          </div>

          {/* Distribution Icon */}
          <Show
            when={distribution() === 'lottery'}
            fallback={<Users class="h-3.5 w-3.5 text-emerald-400" />}
          >
            <Ticket class="h-3.5 w-3.5 text-purple-400" />
          </Show>
        </div>
      }
    >
      <div
        class={cn(
          'rounded-xl border p-4 transition-all duration-200',
          'bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
          colors().border,
          props.class
        )}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class={cn('p-2.5 rounded-xl', colors().bg)}>
              <Zap class={cn('h-5 w-5', colors().text)} />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <SynapseTypeBadge type={props.synapse.synapseType} size="lg" />
                <DistributionBadge distribution={distribution()} />
              </div>
              <p class="text-xs text-[var(--text-muted)] mt-1">
                {props.synapse.region} - {props.synapse.zone}
              </p>
            </div>
          </div>

          {/* State indicator */}
          <SynapseStateBadge state={props.synapse.state} />
        </div>

        {/* Progress Bar */}
        <div class="mb-4">
          <div class="flex justify-between text-sm mb-2">
            <span class="text-[var(--text-muted)]">Exploration Progress</span>
            <span class="font-medium text-[var(--text-primary)]">
              {formatPoints(props.synapse.pointsAccumulated)} / {formatPoints(props.synapse.pointsRequired)}
            </span>
          </div>
          <div class="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <div
              class={cn('h-full rounded-full transition-[width] duration-500', colors().text.replace('text-', 'bg-'))}
              style={{ width: `${progress()}%` }}
            />
          </div>
          <div class="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>{progress().toFixed(1)}% complete</span>
            <Show when={props.synapse.currentEtaMinutes}>
              <span>ETA: {formatETA(props.synapse.currentEtaMinutes!)}</span>
            </Show>
          </div>
        </div>

        {/* Stats Grid */}
        <div class="grid grid-cols-3 gap-2 mb-4">
          {/* Explorers */}
          <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
            <div class="flex items-center justify-center gap-1 mb-1">
              <Users class="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </div>
            <p class="font-bold text-[var(--text-primary)]">
              {props.synapse.explorerCount}
              <Show when={props.synapse.maxExplorers > 0}>
                <span class="font-normal text-[var(--text-muted)]">
                  /{props.synapse.maxExplorers}
                </span>
              </Show>
            </p>
            <p class="text-xs text-[var(--text-muted)]">Explorers</p>
          </div>

          {/* ETA */}
          <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
            <div class="flex items-center justify-center gap-1 mb-1">
              <Clock class="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </div>
            <p class="font-bold text-[var(--text-primary)]">
              {props.synapse.currentEtaMinutes ? formatETA(props.synapse.currentEtaMinutes) : '--'}
            </p>
            <p class="text-xs text-[var(--text-muted)]">ETA</p>
          </div>

          {/* Distribution */}
          <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
            <div class="flex items-center justify-center gap-1 mb-1">
              <Show
                when={distribution() === 'lottery'}
                fallback={<Users class="h-3.5 w-3.5 text-emerald-400" />}
              >
                <Ticket class="h-3.5 w-3.5 text-purple-400" />
              </Show>
            </div>
            <p class={cn(
              'font-bold capitalize',
              distribution() === 'lottery' ? 'text-purple-400' : 'text-emerald-400'
            )}>
              {distribution() === 'lottery' ? 'Lottery' : 'Fair'}
            </p>
            <p class="text-xs text-[var(--text-muted)]">Rewards</p>
          </div>
        </div>

        {/* Rewards */}
        <Show when={props.showRewards !== false}>
          <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
            <div class="flex items-center gap-2 mb-2">
              <Trophy class="h-4 w-4 text-yellow-400" />
              <span class="text-sm font-semibold text-[var(--text-primary)]">Rewards</span>
            </div>
            <div class="flex gap-4 text-sm">
              <div>
                <span class="text-[var(--text-muted)]">$AGI: </span>
                <span class="font-bold text-yellow-400">
                  {formatPoints(props.synapse.agiReward)}
                </span>
              </div>
              <div>
                <span class="text-[var(--text-muted)]">Brain XP: </span>
                <span class="font-bold text-[var(--brand-teal-1)]">
                  {formatPoints(props.synapse.brainXpReward)}
                </span>
              </div>
            </div>
          </div>
        </Show>

        {/* Distribution Info */}
        <div class={cn(
          'mt-3 p-2 rounded-lg text-xs',
          distribution() === 'lottery'
            ? 'bg-purple-500/10 border border-purple-500/20 text-purple-300'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
        )}>
          <Show
            when={distribution() === 'lottery'}
            fallback="Rewards split fairly among all explorers based on contribution."
          >
            Winner takes all! Your odds depend on contribution percentage.
          </Show>
        </div>
      </div>
    </Show>
  )
}

/**
 * SynapseTypeBadge - Displays synapse type with color
 */
export interface SynapseTypeBadgeProps {
  type: SynapseType
  size?: 'sm' | 'md' | 'lg'
  class?: string
}

export function SynapseTypeBadge(props: SynapseTypeBadgeProps) {
  const colors = () => SYNAPSE_TYPE_COLORS[props.type]
  const size = () => props.size ?? 'md'

  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs rounded',
    md: 'px-2 py-0.5 text-xs rounded-md',
    lg: 'px-2.5 py-1 text-sm rounded-lg',
  }

  return (
    <span
      class={cn(
        'inline-flex items-center gap-1 font-semibold capitalize border',
        colors().bg,
        colors().text,
        colors().border,
        sizes[size()],
        props.class
      )}
    >
      <Zap class={cn(size() === 'sm' ? 'h-2.5 w-2.5' : size() === 'md' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {getSynapseTypeLabel(props.type)}
    </span>
  )
}

/**
 * DistributionBadge - Shows fair_share or lottery distribution
 */
export interface DistributionBadgeProps {
  distribution: SynapseDistribution
  class?: string
}

export function DistributionBadge(props: DistributionBadgeProps) {
  const isLottery = () => props.distribution === 'lottery'

  return (
    <span
      class={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
        isLottery()
          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        props.class
      )}
    >
      <Show
        when={isLottery()}
        fallback={
          <>
            <Users class="h-3 w-3" />
            Fair Share
          </>
        }
      >
        <Ticket class="h-3 w-3" />
        Lottery
      </Show>
    </span>
  )
}

/**
 * SynapseStateBadge - Shows synapse state
 */
export interface SynapseStateBadgeProps {
  state: 'undiscovered' | 'being_explored' | 'completed'
  class?: string
}

export function SynapseStateBadge(props: SynapseStateBadgeProps) {
  const configs: Record<typeof props.state, { label: string; bg: string; text: string; border: string }> = {
    undiscovered: {
      label: 'Undiscovered',
      bg: 'bg-gray-500/10',
      text: 'text-gray-400',
      border: 'border-gray-500/30',
    },
    being_explored: {
      label: 'Exploring',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
    },
    completed: {
      label: 'Completed',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
  }

  const config = () => configs[props.state]

  return (
    <span
      class={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        config().bg,
        config().text,
        config().border,
        props.class
      )}
    >
      <Show when={props.state === 'being_explored'}>
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse" />
      </Show>
      {config().label}
    </span>
  )
}
