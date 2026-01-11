import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Zap, Ticket, Trophy, Image, ArrowUp, X } from 'lucide-react'
import { useRewardStore, selectRecentRewards, type RewardType, getRewardTypeLabel } from '@/stores/rewardStore'
import { formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

// Reward type styling configuration
const REWARD_STYLES: Record<RewardType, {
  icon: typeof Coins
  bg: string
  border: string
  text: string
  glow: string
}> = {
  agi: {
    icon: Coins,
    bg: 'from-yellow-500/20 to-amber-500/20',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/20',
  },
  xp: {
    icon: Zap,
    bg: 'from-teal-500/20 to-cyan-500/20',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    glow: 'shadow-teal-500/20',
  },
  lottery_ticket: {
    icon: Ticket,
    bg: 'from-purple-500/20 to-violet-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/20',
  },
  lottery_win: {
    icon: Trophy,
    bg: 'from-amber-500/20 to-yellow-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/30',
  },
  nft: {
    icon: Image,
    bg: 'from-pink-500/20 to-rose-500/20',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    glow: 'shadow-pink-500/20',
  },
  level_up: {
    icon: ArrowUp,
    bg: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-500/30',
    text: 'text-green-400',
    glow: 'shadow-green-500/20',
  },
}

interface RewardNotificationItemProps {
  id: string
  type: RewardType
  amount: number
  source: string
  onDismiss: (id: string) => void
  index: number
}

function RewardNotificationItem({
  id,
  type,
  amount,
  source,
  onDismiss,
  index,
}: RewardNotificationItemProps) {
  const styles = REWARD_STYLES[type] || REWARD_STYLES.agi
  const Icon = styles.icon

  // Format amount based on type
  const formattedAmount = type === 'nft' ? '+1' : `+${formatPoints(amount)}`
  const suffix = type === 'xp' ? ' XP' : type === 'lottery_ticket' ? ' Tickets' : type === 'agi' || type === 'lottery_win' ? ' AGI' : ''

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
        delay: index * 0.1,
      }}
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 rounded-xl',
        'border bg-gradient-to-r backdrop-blur-xl',
        'shadow-lg',
        styles.bg,
        styles.border,
        styles.glow
      )}
    >
      {/* Animated background pulse for lottery wins */}
      {type === 'lottery_win' && (
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-xl bg-amber-500/20"
        />
      )}

      {/* Icon */}
      <motion.div
        initial={{ rotate: -10 }}
        animate={{ rotate: [0, -10, 10, 0] }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className={cn('p-2 rounded-lg bg-[var(--background-secondary)]', styles.text)}
      >
        <Icon className="h-5 w-5" />
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <motion.span
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10, delay: 0.3 }}
            className={cn('text-lg font-bold tabular-nums', styles.text)}
          >
            {formattedAmount}{suffix}
          </motion.span>
          <span className="text-xs text-[var(--text-muted)]">
            {getRewardTypeLabel(type)}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] truncate">
          {source}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(id)}
        className="p-1 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
      >
        <X className="h-4 w-4 text-[var(--text-muted)]" />
      </button>
    </motion.div>
  )
}

/**
 * RewardNotification - Stacked notification popups for rewards
 * Shows animated notifications when user earns AGI, XP, or lottery tickets
 */
export function RewardNotification() {
  const recentRewards = useRewardStore(selectRecentRewards)
  const dismissReward = useRewardStore((state) => state.dismissReward)
  const showNotifications = useRewardStore((state) => state.showNotifications)

  const handleDismiss = useCallback((id: string) => {
    dismissReward(id)
  }, [dismissReward])

  if (!showNotifications || recentRewards.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {recentRewards.map((reward, index) => (
          <div key={reward.id} className="pointer-events-auto">
            <RewardNotificationItem
              id={reward.id}
              type={reward.type}
              amount={reward.amount}
              source={reward.source}
              onDismiss={handleDismiss}
              index={index}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * RewardNotificationMini - Compact inline notification for use within components
 */
interface RewardNotificationMiniProps {
  type: RewardType
  amount: number
  className?: string
}

export function RewardNotificationMini({ type, amount, className }: RewardNotificationMiniProps) {
  const styles = REWARD_STYLES[type] || REWARD_STYLES.agi
  const Icon = styles.icon

  const formattedAmount = type === 'nft' ? '+1' : `+${formatPoints(amount)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', damping: 15 }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'border bg-gradient-to-r',
        styles.bg,
        styles.border,
        className
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', styles.text)} />
      <span className={cn('text-sm font-bold tabular-nums', styles.text)}>
        {formattedAmount}
      </span>
    </motion.div>
  )
}

/**
 * RewardToast - Simple toast notification for quick feedback
 */
interface RewardToastProps {
  type: RewardType
  amount: number
  source?: string
  isVisible: boolean
  onClose?: () => void
}

export function RewardToast({ type, amount, source, isVisible, onClose }: RewardToastProps) {
  const styles = REWARD_STYLES[type] || REWARD_STYLES.agi
  const Icon = styles.icon

  const formattedAmount = type === 'nft' ? '+1' : `+${formatPoints(amount)}`
  const suffix = type === 'xp' ? ' XP' : type === 'lottery_ticket' ? ' Tickets' : type === 'agi' || type === 'lottery_win' ? ' AGI' : ''

  useEffect(() => {
    if (isVisible && onClose) {
      const timer = setTimeout(onClose, 4000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={cn(
            'fixed top-6 left-1/2 -translate-x-1/2 z-50',
            'px-6 py-4 rounded-2xl',
            'border bg-gradient-to-r backdrop-blur-xl',
            'shadow-xl',
            styles.bg,
            styles.border,
            styles.glow
          )}
        >
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
              className={cn('p-3 rounded-xl bg-[var(--background-secondary)]', styles.text)}
            >
              <Icon className="h-6 w-6" />
            </motion.div>

            <div>
              <p className={cn('text-xl font-bold tabular-nums', styles.text)}>
                {formattedAmount}{suffix}
              </p>
              {source && (
                <p className="text-sm text-[var(--text-secondary)]">{source}</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
