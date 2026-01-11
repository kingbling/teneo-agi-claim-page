import { motion } from 'framer-motion'
import { Crown, Star, Anchor, Compass, Ship } from 'lucide-react'
import { useUserStore } from '@/stores/userStore'
import { USER_LEVEL_CONFIG, type UserLevel, USER_LEVEL_COLORS } from '@/types/game'
import { cn } from '@/lib/utils'

// Icons for each user level
const LEVEL_ICONS: Record<UserLevel, React.ReactNode> = {
  1: <Compass className="h-4 w-4" />,
  2: <Anchor className="h-4 w-4" />,
  3: <Ship className="h-4 w-4" />,
  4: <Star className="h-4 w-4" />,
  5: <Crown className="h-4 w-4" />,
}

// Background gradients for each level
const LEVEL_GRADIENTS: Record<UserLevel, string> = {
  1: 'from-gray-500/20 to-gray-600/20',
  2: 'from-blue-500/20 to-blue-600/20',
  3: 'from-green-500/20 to-green-600/20',
  4: 'from-amber-500/20 to-amber-600/20',
  5: 'from-purple-500/20 to-purple-600/20',
}

const LEVEL_BORDERS: Record<UserLevel, string> = {
  1: 'border-gray-500/40',
  2: 'border-blue-500/40',
  3: 'border-green-500/40',
  4: 'border-amber-500/40',
  5: 'border-purple-500/40',
}

interface UserLevelBadgeProps {
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showMultiplier?: boolean
  className?: string
}

/**
 * UserLevelBadge - Displays user level (L1-L5) with icon and multiplier
 * Masterplan 2026: Based on cumulative USDC spent
 */
export function UserLevelBadge({
  size = 'md',
  showLabel = true,
  showMultiplier = false,
  className,
}: UserLevelBadgeProps) {
  const { userLevel, rewardMultiplier } = useUserStore()

  const config = USER_LEVEL_CONFIG[userLevel]
  const icon = LEVEL_ICONS[userLevel]
  const color = USER_LEVEL_COLORS[userLevel]
  const gradient = LEVEL_GRADIENTS[userLevel]
  const border = LEVEL_BORDERS[userLevel]

  const sizeClasses = {
    sm: 'text-xs px-2 py-1 gap-1',
    md: 'text-sm px-3 py-1.5 gap-2',
    lg: 'text-base px-4 py-2 gap-2',
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center rounded-lg border font-semibold bg-gradient-to-r',
        gradient,
        border,
        sizeClasses[size],
        className
      )}
      style={{ color }}
    >
      {icon}
      <span>L{userLevel}</span>
      {showLabel && (
        <span className="opacity-80">{config.label}</span>
      )}
      {showMultiplier && (
        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-current/20">
          {rewardMultiplier}x
        </span>
      )}
    </motion.div>
  )
}

/**
 * UserLevelCard - Expanded view with progress to next level
 */
export function UserLevelCard() {
  const { userLevel, rewardMultiplier, usdcSpent, maxShips } = useUserStore()

  const config = USER_LEVEL_CONFIG[userLevel]
  const color = USER_LEVEL_COLORS[userLevel]
  const gradient = LEVEL_GRADIENTS[userLevel]
  const border = LEVEL_BORDERS[userLevel]

  // Calculate progress to next level
  const isMaxLevel = userLevel === 5
  const nextLevel = (userLevel < 5 ? userLevel + 1 : 5) as UserLevel
  const nextLevelConfig = USER_LEVEL_CONFIG[nextLevel]
  const progressToNext = isMaxLevel
    ? 100
    : ((usdcSpent - config.minUSDC) / (nextLevelConfig.minUSDC - config.minUSDC)) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 bg-gradient-to-br',
        gradient,
        border
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            {LEVEL_ICONS[userLevel]}
          </div>
          <div>
            <p className="font-bold" style={{ color }}>
              Level {userLevel} - {config.label}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              ${usdcSpent.toFixed(2)} USDC spent
            </p>
          </div>
        </div>
        <div
          className="px-3 py-1.5 rounded-lg text-sm font-bold"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {rewardMultiplier}x Rewards
        </div>
      </div>

      {/* Progress to next level */}
      {!isMaxLevel && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[var(--text-muted)]">Progress to L{nextLevel}</span>
            <span style={{ color }}>
              ${usdcSpent.toFixed(2)} / ${nextLevelConfig.minUSDC}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.5 }}
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>
      )}

      {/* Benefits */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-[var(--background-primary)]/50">
          <p className="text-xs text-[var(--text-muted)]">Multiplier</p>
          <p className="font-bold" style={{ color }}>{rewardMultiplier}x</p>
        </div>
        <div className="p-2 rounded-lg bg-[var(--background-primary)]/50">
          <p className="text-xs text-[var(--text-muted)]">ETA Boost</p>
          <p className="font-bold" style={{ color }}>
            {(config.etaBoost * 100).toFixed(0)}%
          </p>
        </div>
        <div className="p-2 rounded-lg bg-[var(--background-primary)]/50">
          <p className="text-xs text-[var(--text-muted)]">Max Ships</p>
          <p className="font-bold" style={{ color }}>{maxShips}</p>
        </div>
      </div>
    </motion.div>
  )
}
