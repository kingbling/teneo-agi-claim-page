import { motion } from 'framer-motion'
import { Ticket, Users, TrendingUp, Sparkles } from 'lucide-react'
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
  className?: string
}

/**
 * LotteryOdds - Displays lottery odds for a synapse
 *
 * Shows the user's contribution percentage, estimated win probability,
 * and total participant count with a visual probability bar.
 */
export function LotteryOdds({
  synapseId: _synapseId,
  userContribution,
  totalContribution,
  participantCount = 0,
  compact = false,
  className,
}: LotteryOddsProps) {
  // Calculate contribution percentage
  const contributionPercentage = totalContribution > 0
    ? (userContribution / totalContribution) * 100
    : 0

  // Estimated win probability (contribution-weighted)
  const winProbability = contributionPercentage

  // Format percentages
  const formattedContribution = contributionPercentage.toFixed(1)
  const formattedProbability = winProbability.toFixed(1)

  // Determine odds color based on probability
  const getOddsColor = (prob: number) => {
    if (prob >= 50) return 'text-emerald-400'
    if (prob >= 25) return 'text-yellow-400'
    if (prob >= 10) return 'text-orange-400'
    return 'text-red-400'
  }

  const oddsColor = getOddsColor(winProbability)

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
          'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
          'border-purple-500/30',
          className
        )}
      >
        <Ticket className="h-3.5 w-3.5 text-purple-400" />
        <span className={cn('text-sm font-bold', oddsColor)}>
          {formattedProbability}%
        </span>
        {participantCount > 0 && (
          <span className="text-xs text-[var(--text-muted)]">
            ({participantCount} {participantCount === 1 ? 'player' : 'players'})
          </span>
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
        'bg-gradient-to-br from-purple-500/10 via-[var(--background-secondary)] to-pink-500/10',
        'border-purple-500/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Ticket className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <p className="font-semibold text-sm text-purple-400">Lottery Odds</p>
            <p className="text-xs text-[var(--text-muted)]">Contribution-weighted</p>
          </div>
        </div>

        {/* Sparkle animation for high odds */}
        {winProbability >= 25 && (
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-4 w-4 text-yellow-400" />
          </motion.div>
        )}
      </div>

      {/* Probability Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--text-muted)]">Win Probability</span>
          <span className={cn('font-bold', oddsColor)}>
            {formattedProbability}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(winProbability, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              'bg-gradient-to-r from-purple-500 to-pink-500'
            )}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Your Contribution */}
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">Your Share</span>
          </div>
          <p className="font-bold text-[var(--text-primary)]">
            {formattedContribution}%
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {userContribution.toLocaleString()} pts
          </p>
        </div>

        {/* Participants */}
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">Participants</span>
          </div>
          <p className="font-bold text-[var(--text-primary)]">
            {participantCount}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {totalContribution.toLocaleString()} total pts
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-3 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <p className="text-xs text-purple-300">
          Higher contribution = better odds. Keep exploring to improve your chances!
        </p>
      </div>
    </motion.div>
  )
}

/**
 * LotteryOddsBadge - Minimal lottery odds badge
 */
export interface LotteryOddsBadgeProps {
  winProbability: number
  className?: string
}

export function LotteryOddsBadge({ winProbability, className }: LotteryOddsBadgeProps) {
  const getOddsColor = (prob: number) => {
    if (prob >= 50) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (prob >= 25) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    if (prob >= 10) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    return 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border',
        getOddsColor(winProbability),
        className
      )}
    >
      <Ticket className="h-3 w-3" />
      {winProbability.toFixed(1)}%
    </span>
  )
}
