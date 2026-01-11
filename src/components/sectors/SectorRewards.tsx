import { motion } from 'framer-motion'
import { Gift, Sparkles, Trophy, Coins, Brain, Star, Lock } from 'lucide-react'
import { formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

export interface SectorReward {
  id: string
  type: 'agi' | 'brainXp' | 'item' | 'nft' | 'badge' | 'lotteryTickets'
  label: string
  description?: string
  value: number
  imageUrl?: string
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  claimed?: boolean
}

export interface SectorRewardsProps {
  /** List of available rewards */
  rewards: SectorReward[]
  /** Current progress percentage (0-100) */
  progressPercent: number
  /** Whether sector is completed */
  isCompleted?: boolean
  /** Callback when reward is claimed */
  onClaim?: (rewardId: string) => void
  /** Compact mode */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

const REWARD_ICONS: Record<SectorReward['type'], typeof Gift> = {
  agi: Coins,
  brainXp: Brain,
  item: Gift,
  nft: Star,
  badge: Trophy,
  lotteryTickets: Sparkles,
}

const RARITY_COLORS: Record<NonNullable<SectorReward['rarity']>, string> = {
  common: 'text-gray-400 bg-gray-500/20 border-gray-500/40',
  uncommon: 'text-green-400 bg-green-500/20 border-green-500/40',
  rare: 'text-blue-400 bg-blue-500/20 border-blue-500/40',
  epic: 'text-purple-400 bg-purple-500/20 border-purple-500/40',
  legendary: 'text-amber-400 bg-amber-500/20 border-amber-500/40',
}

/**
 * SectorRewards - Display sector reward pool and claimable rewards
 */
export function SectorRewards({
  rewards,
  progressPercent,
  isCompleted = false,
  onClaim,
  compact = false,
  className,
}: SectorRewardsProps) {
  // Count claimed rewards
  const claimedRewards = rewards.filter(r => r.claimed)

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Gift className="h-4 w-4 text-amber-400" />
        <span className="text-sm text-[var(--text-muted)]">
          {rewards.length} reward{rewards.length !== 1 ? 's' : ''}
        </span>
        {claimedRewards.length > 0 && (
          <span className="text-xs text-green-400">
            ({claimedRewards.length} claimed)
          </span>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 bg-gradient-to-br from-amber-500/10 to-[var(--background-primary)]',
        'border-amber-500/20',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/20">
            <Gift className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Sector Rewards
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {claimedRewards.length}/{rewards.length} claimed
            </p>
          </div>
        </div>
        {isCompleted && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/20 text-green-400">
            <Trophy className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Completed</span>
          </div>
        )}
      </div>

      {/* Rewards grid */}
      <div className="grid grid-cols-2 gap-3">
        {rewards.map((reward, index) => {
          const Icon = REWARD_ICONS[reward.type]
          const isLocked = !isCompleted && progressPercent < ((index + 1) / rewards.length) * 100
          const rarityClass = reward.rarity ? RARITY_COLORS[reward.rarity] : ''

          return (
            <motion.div
              key={reward.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'relative p-3 rounded-lg border transition-all',
                reward.claimed
                  ? 'bg-green-500/10 border-green-500/30'
                  : isLocked
                  ? 'bg-[var(--background-primary)] border-[var(--card-border)]/20 opacity-50'
                  : 'bg-[var(--background-secondary)] border-[var(--card-border)]/30 hover:border-amber-500/30',
                rarityClass && !reward.claimed && !isLocked && rarityClass
              )}
            >
              {/* Lock overlay */}
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                  <Lock className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
              )}

              {/* Claimed checkmark */}
              {reward.claimed && (
                <div className="absolute top-1.5 right-1.5">
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <Trophy className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex items-start gap-2">
                <div className={cn(
                  'p-1.5 rounded-lg',
                  reward.claimed
                    ? 'bg-green-500/20'
                    : isLocked
                    ? 'bg-[var(--background-secondary)]'
                    : 'bg-amber-500/20'
                )}>
                  <Icon className={cn(
                    'h-4 w-4',
                    reward.claimed
                      ? 'text-green-400'
                      : isLocked
                      ? 'text-[var(--text-muted)]'
                      : 'text-amber-400'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    reward.claimed
                      ? 'text-green-400'
                      : isLocked
                      ? 'text-[var(--text-muted)]'
                      : 'text-[var(--text-primary)]'
                  )}>
                    {reward.label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {reward.type === 'agi' || reward.type === 'brainXp'
                      ? formatPoints(reward.value)
                      : reward.description || `x${reward.value}`}
                  </p>
                </div>
              </div>

              {/* Claim button */}
              {!reward.claimed && !isLocked && isCompleted && onClaim && (
                <button
                  onClick={() => onClaim(reward.id)}
                  className="mt-2 w-full py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors"
                >
                  Claim
                </button>
              )}

              {/* Rarity badge */}
              {reward.rarity && reward.rarity !== 'common' && (
                <div className="absolute bottom-1.5 right-1.5">
                  <span className={cn(
                    'text-[10px] font-medium capitalize px-1.5 py-0.5 rounded',
                    RARITY_COLORS[reward.rarity]
                  )}>
                    {reward.rarity}
                  </span>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Empty state */}
      {rewards.length === 0 && (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No rewards available</p>
        </div>
      )}
    </motion.div>
  )
}

/**
 * RewardSummary - Minimal reward count
 */
export interface RewardSummaryProps {
  totalAgi: number
  totalBrainXp: number
  itemCount: number
  className?: string
}

export function RewardSummary({ totalAgi, totalBrainXp, itemCount, className }: RewardSummaryProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {totalAgi > 0 && (
        <div className="flex items-center gap-1 text-amber-400">
          <Coins className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{formatPoints(totalAgi)} AGI</span>
        </div>
      )}
      {totalBrainXp > 0 && (
        <div className="flex items-center gap-1 text-purple-400">
          <Brain className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{formatPoints(totalBrainXp)} XP</span>
        </div>
      )}
      {itemCount > 0 && (
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          <Gift className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{itemCount} items</span>
        </div>
      )}
    </div>
  )
}
