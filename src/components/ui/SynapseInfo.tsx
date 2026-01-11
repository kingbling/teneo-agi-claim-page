import { motion } from 'framer-motion'
import { Zap, Clock, Users, Trophy, Ticket } from 'lucide-react'
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
  className?: string
}

/**
 * SynapseInfo - Displays synapse details
 *
 * Shows synapse type with color coding, points required/accumulated,
 * current ETA, explorer count, and reward distribution type.
 */
export function SynapseInfo({
  synapse,
  compact = false,
  showRewards = true,
  className,
}: SynapseInfoProps) {
  const typeConfig = SYNAPSE_CONFIG[synapse.synapseType]
  const colors = SYNAPSE_TYPE_COLORS[synapse.synapseType]

  // Calculate progress
  const progress = synapse.pointsRequired > 0
    ? (synapse.pointsAccumulated / synapse.pointsRequired) * 100
    : 0

  // Determine distribution type
  const distribution = typeConfig.distribution

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'inline-flex items-center gap-3 px-3 py-2 rounded-lg border',
          colors.bg,
          colors.border,
          className
        )}
      >
        {/* Type Badge */}
        <SynapseTypeBadge type={synapse.synapseType} />

        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn('h-full rounded-full', colors.text.replace('text-', 'bg-'))}
            />
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {progress.toFixed(0)}%
          </span>
        </div>

        {/* ETA */}
        {synapse.currentEtaMinutes && (
          <span className="text-xs text-[var(--text-muted)]">
            {formatETA(synapse.currentEtaMinutes)}
          </span>
        )}

        {/* Explorers */}
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <Users className="h-3 w-3" />
          {synapse.explorerCount}
        </div>

        {/* Distribution Icon */}
        {distribution === 'lottery' ? (
          <Ticket className="h-3.5 w-3.5 text-purple-400" />
        ) : (
          <Users className="h-3.5 w-3.5 text-emerald-400" />
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4',
        'bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        colors.border,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl', colors.bg)}>
            <Zap className={cn('h-5 w-5', colors.text)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <SynapseTypeBadge type={synapse.synapseType} size="lg" />
              <DistributionBadge distribution={distribution} />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {synapse.region} - {synapse.zone}
            </p>
          </div>
        </div>

        {/* State indicator */}
        <SynapseStateBadge state={synapse.state} />
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--text-muted)]">Exploration Progress</span>
          <span className="font-medium text-[var(--text-primary)]">
            {formatPoints(synapse.pointsAccumulated)} / {formatPoints(synapse.pointsRequired)}
          </span>
        </div>
        <div className="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className={cn('h-full rounded-full', colors.text.replace('text-', 'bg-'))}
          />
        </div>
        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
          <span>{progress.toFixed(1)}% complete</span>
          {synapse.currentEtaMinutes && (
            <span>ETA: {formatETA(synapse.currentEtaMinutes)}</span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Explorers */}
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </div>
          <p className="font-bold text-[var(--text-primary)]">
            {synapse.explorerCount}
            {synapse.maxExplorers > 0 && (
              <span className="font-normal text-[var(--text-muted)]">
                /{synapse.maxExplorers}
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Explorers</p>
        </div>

        {/* ETA */}
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </div>
          <p className="font-bold text-[var(--text-primary)]">
            {synapse.currentEtaMinutes ? formatETA(synapse.currentEtaMinutes) : '--'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">ETA</p>
        </div>

        {/* Distribution */}
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            {distribution === 'lottery' ? (
              <Ticket className="h-3.5 w-3.5 text-purple-400" />
            ) : (
              <Users className="h-3.5 w-3.5 text-emerald-400" />
            )}
          </div>
          <p className={cn(
            'font-bold capitalize',
            distribution === 'lottery' ? 'text-purple-400' : 'text-emerald-400'
          )}>
            {distribution === 'lottery' ? 'Lottery' : 'Fair'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Rewards</p>
        </div>
      </div>

      {/* Rewards */}
      {showRewards && (
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Rewards</span>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">$AGI: </span>
              <span className="font-bold text-yellow-400">
                {formatPoints(synapse.agiReward)}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Brain XP: </span>
              <span className="font-bold text-[var(--brand-teal-1)]">
                {formatPoints(synapse.brainXpReward)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Distribution Info */}
      <div className={cn(
        'mt-3 p-2 rounded-lg text-xs',
        distribution === 'lottery'
          ? 'bg-purple-500/10 border border-purple-500/20 text-purple-300'
          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
      )}>
        {distribution === 'lottery' ? (
          'Winner takes all! Your odds depend on contribution percentage.'
        ) : (
          'Rewards split fairly among all explorers based on contribution.'
        )}
      </div>
    </motion.div>
  )
}

/**
 * SynapseTypeBadge - Displays synapse type with color
 */
export interface SynapseTypeBadgeProps {
  type: SynapseType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SynapseTypeBadge({
  type,
  size = 'md',
  className,
}: SynapseTypeBadgeProps) {
  const colors = SYNAPSE_TYPE_COLORS[type]

  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs rounded',
    md: 'px-2 py-0.5 text-xs rounded-md',
    lg: 'px-2.5 py-1 text-sm rounded-lg',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold capitalize border',
        colors.bg,
        colors.text,
        colors.border,
        sizes[size],
        className
      )}
    >
      <Zap className={cn(size === 'sm' ? 'h-2.5 w-2.5' : size === 'md' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {getSynapseTypeLabel(type)}
    </span>
  )
}

/**
 * DistributionBadge - Shows fair_share or lottery distribution
 */
export interface DistributionBadgeProps {
  distribution: SynapseDistribution
  className?: string
}

export function DistributionBadge({ distribution, className }: DistributionBadgeProps) {
  const isLottery = distribution === 'lottery'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
        isLottery
          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        className
      )}
    >
      {isLottery ? (
        <>
          <Ticket className="h-3 w-3" />
          Lottery
        </>
      ) : (
        <>
          <Users className="h-3 w-3" />
          Fair Share
        </>
      )}
    </span>
  )
}

/**
 * SynapseStateBadge - Shows synapse state
 */
export interface SynapseStateBadgeProps {
  state: 'undiscovered' | 'being_explored' | 'completed'
  className?: string
}

export function SynapseStateBadge({ state, className }: SynapseStateBadgeProps) {
  const configs: Record<typeof state, { label: string; bg: string; text: string; border: string }> = {
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

  const config = configs[state]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {state === 'being_explored' && (
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      {config.label}
    </span>
  )
}
