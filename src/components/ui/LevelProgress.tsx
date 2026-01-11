import { motion } from 'framer-motion'
import { Star, TrendingUp, Sparkles, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/stores/userStore'
import {
  type UserLevel,
  USER_LEVEL_COLORS,
  getUserLevelConfig,
} from '@/types/game'

export interface LevelProgressProps {
  /** Compact horizontal mode */
  compact?: boolean
  /** Show reward multiplier */
  showMultiplier?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * LevelProgress - Displays user level progress
 *
 * Shows current level (L1-L5), USDC spent progress to next level,
 * and reward multiplier for current level.
 */
export function LevelProgress({
  compact = false,
  showMultiplier = true,
  className,
}: LevelProgressProps) {
  const { userLevel, usdcSpent, rewardMultiplier } = useUserStore()

  const config = getUserLevelConfig(userLevel)
  const nextLevel = userLevel < 5 ? (userLevel + 1) as UserLevel : null
  const nextConfig = nextLevel ? getUserLevelConfig(nextLevel) : null

  // Calculate progress to next level
  const currentThreshold = config.minUSDC
  const nextThreshold = nextConfig?.minUSDC ?? config.minUSDC
  const progressRange = nextThreshold - currentThreshold
  const currentProgress = usdcSpent - currentThreshold
  const progressPercentage = progressRange > 0
    ? Math.min(100, (currentProgress / progressRange) * 100)
    : 100

  const color = USER_LEVEL_COLORS[userLevel]
  const isMaxLevel = userLevel === 5

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
          'bg-gradient-to-r from-[var(--background-secondary)] to-[var(--background-primary)]',
          'border-[var(--card-border)]/30',
          className
        )}
      >
        <Star className="h-4 w-4" style={{ color }} />
        <span className="font-bold" style={{ color }}>
          L{userLevel}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {config.label}
        </span>
        {!isMaxLevel && (
          <div className="w-16 h-1.5 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        )}
        {showMultiplier && (
          <span className="text-xs font-medium" style={{ color }}>
            {rewardMultiplier}x
          </span>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ backgroundColor: `${color}20` }}
          >
            <Star className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color }}>
              Level {userLevel}
            </p>
            <p className="text-sm text-[var(--text-muted)]">{config.label}</p>
          </div>
        </div>

        {/* Multiplier Badge */}
        {showMultiplier && (
          <div
            className="px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {rewardMultiplier}x Rewards
          </div>
        )}
      </div>

      {/* Progress to Next Level */}
      {!isMaxLevel && nextConfig && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--text-muted)]">Progress to L{nextLevel}</span>
            <span className="font-medium text-[var(--text-primary)]">
              ${usdcSpent.toFixed(2)} / ${nextThreshold}
            </span>
          </div>
          <div className="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            ${(nextThreshold - usdcSpent).toFixed(2)} more to reach {nextConfig.label}
          </p>
        </div>
      )}

      {/* Max Level Message */}
      {isMaxLevel && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 mb-4">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Maximum level achieved!
          </span>
        </div>
      )}

      {/* Level Benefits */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          Level Benefits
        </p>
        <div className="grid grid-cols-3 gap-2">
          <LevelBenefit
            label="Multiplier"
            value={`${config.multiplier}x`}
            color={color}
          />
          <LevelBenefit
            label="ETA Boost"
            value={`${(config.etaBoost * 100).toFixed(0)}%`}
            color={color}
          />
          <LevelBenefit
            label="Max Ships"
            value={config.maxShips.toString()}
            color={color}
          />
        </div>
      </div>

      {/* Next Level Preview */}
      {!isMaxLevel && nextConfig && (
        <div className="mt-4 pt-4 border-t border-[var(--card-border)]/20">
          <div className="flex items-center gap-2 text-sm">
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Next:</span>
            <span className="font-medium" style={{ color: nextLevel ? USER_LEVEL_COLORS[nextLevel] : undefined }}>
              L{nextLevel} {nextConfig.label}
            </span>
            <span className="text-[var(--text-muted)]">-</span>
            <span className="text-[var(--text-primary)]">
              {nextConfig.multiplier}x rewards, {nextConfig.maxShips} ships
            </span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Level benefit mini-card
function LevelBenefit({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="p-2 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
      <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
      <p className="font-bold text-sm" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

/**
 * LevelBadge - Minimal level badge
 */
export interface LevelBadgeProps {
  level?: UserLevel
  showLabel?: boolean
  className?: string
}

export function LevelBadge({
  level,
  showLabel = false,
  className,
}: LevelBadgeProps) {
  const { userLevel } = useUserStore()
  const displayLevel = level ?? userLevel
  const config = getUserLevelConfig(displayLevel)
  const color = USER_LEVEL_COLORS[displayLevel]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold border',
        className
      )}
      style={{
        backgroundColor: `${color}20`,
        borderColor: `${color}40`,
        color,
      }}
    >
      <Star className="h-3 w-3" />
      L{displayLevel}
      {showLabel && <span className="font-medium">{config.label}</span>}
    </span>
  )
}

/**
 * MultiplierBadge - Shows reward multiplier
 */
export interface MultiplierBadgeProps {
  multiplier?: number
  className?: string
}

export function MultiplierBadge({ multiplier, className }: MultiplierBadgeProps) {
  const { rewardMultiplier } = useUserStore()
  const displayMultiplier = multiplier ?? rewardMultiplier

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold',
        'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        className
      )}
    >
      <TrendingUp className="h-3 w-3" />
      {displayMultiplier}x
    </span>
  )
}
