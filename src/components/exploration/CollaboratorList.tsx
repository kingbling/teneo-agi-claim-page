import { motion } from 'framer-motion'
import { Users, Ship, Gauge, Crown } from 'lucide-react'
import { formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

export interface Collaborator {
  userId: string
  username?: string
  shipId: string
  shipName: string
  pointsContributed: number
  pointsPerMin: number
  joinedAt: number
  isCurrentUser?: boolean
}

export interface CollaboratorListProps {
  /** List of collaborators */
  collaborators: Collaborator[]
  /** Total points accumulated */
  totalPoints: number
  /** Current user's ID for highlighting */
  currentUserId?: string
  /** Compact mode */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * CollaboratorList - Shows current explorers on a synapse
 *
 * Displays who is exploring, their contribution rates, and
 * relative contribution percentages.
 */
export function CollaboratorList({
  collaborators,
  totalPoints,
  currentUserId,
  compact = false,
  className,
}: CollaboratorListProps) {
  // Sort by contribution (highest first)
  const sorted = [...collaborators].sort((a, b) => b.pointsContributed - a.pointsContributed)
  const topContributor = sorted[0]

  // Calculate total points per minute
  const totalPointsPerMin = collaborators.reduce((sum, c) => sum + c.pointsPerMin, 0)

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Users className="h-4 w-4 text-[var(--text-muted)]" />
        <span className="text-sm text-[var(--text-muted)]">
          {collaborators.length} explorer{collaborators.length !== 1 ? 's' : ''}
        </span>
        <span className="text-sm font-medium text-[var(--brand-teal-1)]">
          {formatPoints(totalPointsPerMin)}/min
        </span>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 bg-[var(--background-secondary)] border-[var(--card-border)]/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {collaborators.length} Explorer{collaborators.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Combined: {formatPoints(totalPointsPerMin)}/min
            </p>
          </div>
        </div>
      </div>

      {/* Collaborator list */}
      <div className="space-y-2">
        {sorted.map((collaborator, index) => {
          const isTopContributor = collaborator === topContributor && collaborators.length > 1
          const isCurrentUser = collaborator.userId === currentUserId
          const contributionPercent = totalPoints > 0
            ? (collaborator.pointsContributed / totalPoints) * 100
            : 0

          return (
            <motion.div
              key={`${collaborator.shipId}-${collaborator.userId}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border transition-colors',
                isCurrentUser
                  ? 'bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/30'
                  : 'bg-[var(--background-primary)] border-[var(--card-border)]/20'
              )}
            >
              <div className="flex items-center gap-3">
                {/* Rank indicator */}
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  isTopContributor
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-[var(--background-secondary)] text-[var(--text-muted)]'
                )}>
                  {isTopContributor ? (
                    <Crown className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Ship info */}
                <div className="flex items-center gap-2">
                  <Ship className={cn(
                    'h-4 w-4',
                    isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'
                  )} />
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
                    )}>
                      {collaborator.shipName}
                      {isCurrentUser && (
                        <span className="ml-1 text-xs opacity-70">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {collaborator.username || `User ${collaborator.userId.slice(0, 8)}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Gauge className="h-3 w-3 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {formatPoints(collaborator.pointsPerMin)}/min
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-end text-xs text-[var(--text-muted)]">
                  <span>{contributionPercent.toFixed(1)}% contributed</span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Empty state */}
      {collaborators.length === 0 && (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No explorers yet</p>
          <p className="text-xs">Be the first to explore this synapse!</p>
        </div>
      )}
    </motion.div>
  )
}

/**
 * CollaboratorCount - Minimal count indicator
 */
export interface CollaboratorCountProps {
  count: number
  maxCount?: number
  className?: string
}

export function CollaboratorCount({ count, maxCount, className }: CollaboratorCountProps) {
  const isFull = maxCount !== undefined && count >= maxCount

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg',
      isFull
        ? 'bg-amber-500/20 text-amber-400'
        : 'bg-[var(--background-primary)] text-[var(--text-muted)]',
      className
    )}>
      <Users className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">
        {count}{maxCount !== undefined ? `/${maxCount}` : ''}
      </span>
    </div>
  )
}
