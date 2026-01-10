import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Sparkles, Trophy, Star, Zap, Gift, Crown, Flame, Target } from 'lucide-react'

// Floating particles effect for rewards
interface ParticleProps {
  x: number
  y: number
  color: string
  delay: number
}

function Particle({ x, y, color, delay }: ParticleProps) {
  return (
    <motion.div
      className={cn('absolute w-spacing-2 h-spacing-2 rounded-full', color)}
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{
        x: x,
        y: y,
        opacity: 0,
        scale: 0,
      }}
      transition={{
        duration: 1,
        delay,
        ease: 'easeOut',
      }}
    />
  )
}

// Reward burst animation
interface RewardBurstProps {
  isActive: boolean
  variant?: 'gold' | 'teal' | 'rainbow' | 'fire'
  intensity?: 'low' | 'medium' | 'high'
  className?: string
}

const burstColors = {
  gold: ['bg-[hsl(var(--tier-legendary))]', 'bg-[hsl(var(--accent))]', 'bg-[hsl(var(--tier-legendary))]'],
  teal: ['bg-[var(--brand-teal-1)]', 'bg-[hsl(var(--accent))]', 'bg-[hsl(var(--success))]'],
  rainbow: ['bg-[hsl(var(--tier-legendary))]', 'bg-[hsl(var(--accent))]', 'bg-[hsl(var(--success))]', 'bg-[hsl(var(--primary))]', 'bg-[hsl(var(--tier-mythic))]'],
  fire: ['bg-[hsl(var(--tier-legendary))]', 'bg-[hsl(var(--tier-legendary))]', 'bg-[hsl(var(--accent))]'],
}

export function RewardBurst({ isActive, variant = 'gold', intensity = 'medium', className }: RewardBurstProps) {
  const particleCount = { low: 8, medium: 16, high: 24 }[intensity]
  const colors = burstColors[variant]

  const particles = React.useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => {
      const angle = (i / particleCount) * Math.PI * 2
      const distance = 40 + Math.random() * 40
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        color: colors[i % colors.length],
        delay: Math.random() * 0.2,
      }
    })
  }, [particleCount, colors])

  return (
    <AnimatePresence>
      {isActive && (
        <div className={cn('absolute inset-0 flex items-center justify-center pointer-events-none', className)}>
          {particles.map((particle, i) => (
            <Particle key={i} {...particle} />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}

// Animated number counter for rewards
interface AnimatedCounterProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
  onComplete?: () => void
}

export function AnimatedCounter({
  value,
  duration = 1.5,
  prefix = '',
  suffix = '',
  className,
  onComplete,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = React.useState(0)

  React.useEffect(() => {
    const startTime = performance.now()
    const startValue = displayValue

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)

      // Easing function for more satisfying animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const current = Math.floor(startValue + (value - startValue) * easeOutQuart)

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
        onComplete?.()
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return (
    <span className={cn('tabular-nums font-bold', className)}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  )
}

// Reward popup notification
interface RewardPopupProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  value?: number | string
  icon?: React.ReactNode
  variant?: 'success' | 'achievement' | 'bonus' | 'levelup' | 'rare'
}

const popupVariants = {
  success: {
    bg: 'from-[hsl(var(--success))]/20 to-[hsl(var(--success))]/20',
    border: 'border-[hsl(var(--success))]/30',
    icon: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]',
    glow: 'shadow-[hsl(var(--success))]/30',
  },
  achievement: {
    bg: 'from-[hsl(var(--tier-legendary))]/20 to-[hsl(var(--accent))]/20',
    border: 'border-[hsl(var(--tier-legendary))]/30',
    icon: 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))]',
    glow: 'shadow-[hsl(var(--tier-legendary))]/30',
  },
  bonus: {
    bg: 'from-[hsl(var(--tier-mythic))]/20 to-[hsl(var(--tier-mythic))]/20',
    border: 'border-[hsl(var(--tier-mythic))]/30',
    icon: 'bg-[hsl(var(--tier-mythic))]/20 text-[hsl(var(--tier-mythic))]',
    glow: 'shadow-[hsl(var(--tier-mythic))]/30',
  },
  levelup: {
    bg: 'from-[hsl(var(--accent))]/20 to-[hsl(var(--primary))]/20',
    border: 'border-[hsl(var(--accent))]/30',
    icon: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]',
    glow: 'shadow-[hsl(var(--accent))]/30',
  },
  rare: {
    bg: 'from-[hsl(var(--tier-mythic))]/20 via-[hsl(var(--tier-mythic))]/20 to-[hsl(var(--accent))]/20',
    border: 'border-[hsl(var(--tier-mythic))]/30',
    icon: 'bg-[hsl(var(--tier-mythic))]/20 text-[hsl(var(--tier-mythic))]',
    glow: 'shadow-[hsl(var(--tier-mythic))]/30',
  },
}

export function RewardPopup({
  isOpen,
  onClose,
  title,
  description,
  value,
  icon,
  variant = 'success',
}: RewardPopupProps) {
  const styles = popupVariants[variant]

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 4000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={cn(
            'fixed top-spacing-6 left-1/2 -translate-x-1/2 z-50',
            'px-spacing-6 py-spacing-5 rounded-2xl',
            'border bg-gradient-to-r backdrop-blur-xl',
            'shadow-xl',
            styles.bg,
            styles.border,
            styles.glow
          )}
        >
          <RewardBurst isActive={true} variant={variant === 'achievement' ? 'gold' : 'teal'} />

          <div className="relative flex items-center gap-spacing-4">
            {icon && (
              <div className={cn('p-spacing-3 rounded-xl', styles.icon)}>
                {icon}
              </div>
            )}

            <div className="space-y-spacing-1">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
              {description && (
                <p className="text-sm text-[var(--text-secondary)]">{description}</p>
              )}
              {value !== undefined && (
                <p className="text-xl font-bold text-[var(--brand-teal-1)]">
                  {typeof value === 'number' ? (
                    <AnimatedCounter value={value} prefix="+" suffix=" AGI" />
                  ) : (
                    value
                  )}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// XP/Progress gain animation
interface XPGainProps {
  amount: number
  isVisible: boolean
  className?: string
}

export function XPGain({ amount, isVisible, className }: XPGainProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 15 }}
          className={cn(
            'inline-flex items-center gap-spacing-1.5 px-spacing-3 py-spacing-1.5 rounded-full',
            'bg-[var(--brand-teal-1)]/20 border border-[var(--brand-teal-1)]/30',
            'text-[var(--brand-teal-1)] font-bold text-sm',
            className
          )}
        >
          <Zap className="w-spacing-4 h-spacing-4" />
          +{amount}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Streak indicator with fire animation
interface StreakIndicatorProps {
  streak: number
  isActive?: boolean
  className?: string
}

export function StreakIndicator({ streak, isActive = true, className }: StreakIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-spacing-2', className)}>
      <motion.div
        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className={cn(
          'p-spacing-2 rounded-lg',
          isActive ? 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))]' : 'bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))]'
        )}
      >
        <Flame className="w-spacing-5 h-spacing-5" />
      </motion.div>

      <div className="space-y-spacing-0.5">
        <span className="text-xs font-medium text-[var(--text-muted)]">Streak</span>
        <span className={cn(
          'block text-lg font-bold tabular-nums',
          isActive ? 'text-[hsl(var(--tier-legendary))]' : 'text-[hsl(var(--secondary))]'
        )}>
          {streak} days
        </span>
      </div>
    </div>
  )
}

// Achievement unlock animation
interface AchievementUnlockProps {
  isUnlocked: boolean
  title: string
  description?: string
  icon?: React.ReactNode
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  className?: string
}

const rarityStyles = {
  common: { border: 'border-[hsl(var(--secondary))]/30', glow: '' },
  uncommon: { border: 'border-[hsl(var(--success))]/30', glow: 'shadow-[hsl(var(--success))]/20' },
  rare: { border: 'border-[hsl(var(--primary))]/30', glow: 'shadow-[hsl(var(--primary))]/25' },
  epic: { border: 'border-[hsl(var(--tier-mythic))]/30', glow: 'shadow-[hsl(var(--tier-mythic))]/30' },
  legendary: { border: 'border-[hsl(var(--tier-legendary))]/40', glow: 'shadow-[hsl(var(--tier-legendary))]/40' },
}

export function AchievementUnlock({
  isUnlocked,
  title,
  description,
  icon,
  rarity = 'common',
  className,
}: AchievementUnlockProps) {
  const styles = rarityStyles[rarity]

  return (
    <motion.div
      initial={isUnlocked ? { opacity: 0, scale: 0.8, y: 20 } : false}
      animate={isUnlocked ? { opacity: 1, scale: 1, y: 0 } : {}}
      transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      className={cn(
        'relative p-spacing-5 rounded-2xl border bg-[var(--background-secondary)]',
        styles.border,
        isUnlocked && 'shadow-lg',
        isUnlocked && styles.glow,
        className
      )}
    >
      <RewardBurst isActive={isUnlocked} variant="gold" intensity="low" />

      <div className="relative flex items-center gap-spacing-4">
        <motion.div
          animate={isUnlocked ? { rotate: [0, -10, 10, 0] } : {}}
          transition={{ delay: 0.2, duration: 0.5 }}
          className={cn(
            'p-spacing-3 rounded-xl',
            isUnlocked ? 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))]' : 'bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))]'
          )}
        >
          {icon || <Trophy className="w-spacing-6 h-spacing-6" />}
        </motion.div>

        <div className="flex-1">
          <h4 className={cn(
            'font-bold',
            isUnlocked ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
          )}>
            {title}
          </h4>
          {description && (
            <p className="text-sm text-[var(--text-tertiary)] mt-spacing-1">{description}</p>
          )}
        </div>

        {isUnlocked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
          >
            <Sparkles className="w-spacing-5 h-spacing-5 text-[hsl(var(--tier-legendary))]" />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// Milestone reached animation
interface MilestoneReachedProps {
  milestone: number
  label?: string
  isReached: boolean
  className?: string
}

export function MilestoneReached({ milestone, label, isReached, className }: MilestoneReachedProps) {
  return (
    <AnimatePresence>
      {isReached && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', damping: 12 }}
          className={cn(
            'flex items-center gap-spacing-3 px-spacing-5 py-spacing-4 rounded-2xl',
            'bg-gradient-to-r from-[hsl(var(--tier-legendary))]/20 to-[hsl(var(--accent))]/20',
            'border border-[hsl(var(--tier-legendary))]/30 shadow-lg shadow-[hsl(var(--tier-legendary))]/20',
            className
          )}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="p-spacing-2.5 rounded-xl bg-[hsl(var(--tier-legendary))]/20"
          >
            <Star className="w-spacing-6 h-spacing-6 text-[hsl(var(--tier-legendary))]" />
          </motion.div>

          <div>
            <p className="text-xs font-medium text-[hsl(var(--tier-legendary))]/80 uppercase tracking-wider">
              {label || 'Milestone Reached'}
            </p>
            <p className="text-2xl font-bold text-[hsl(var(--tier-legendary))] tabular-nums">
              {milestone.toLocaleString()}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Daily reward claim animation
interface DailyRewardProps {
  day: number
  reward: string | number
  isClaimed: boolean
  isToday: boolean
  onClick?: () => void
}

export function DailyReward({ day, reward, isClaimed, isToday, onClick }: DailyRewardProps) {
  return (
    <motion.button
      whileHover={!isClaimed && isToday ? { scale: 1.05 } : {}}
      whileTap={!isClaimed && isToday ? { scale: 0.95 } : {}}
      onClick={!isClaimed && isToday ? onClick : undefined}
      disabled={isClaimed || !isToday}
      className={cn(
        'relative flex flex-col items-center gap-spacing-2 p-spacing-4 rounded-xl border transition-all',
        isClaimed
          ? 'bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30'
          : isToday
          ? 'bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/40 cursor-pointer hover:shadow-lg hover:shadow-[var(--brand-teal-1)]/20'
          : 'bg-[var(--background-tertiary)] border-[var(--card-border)] opacity-50'
      )}
    >
      <span className="text-xs font-medium text-[var(--text-muted)]">Day {day}</span>

      <div className={cn(
        'p-spacing-2 rounded-lg',
        isClaimed ? 'bg-[hsl(var(--success))]/20' : isToday ? 'bg-[var(--brand-teal-1)]/20' : 'bg-[var(--background-secondary)]'
      )}>
        {isClaimed ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring' }}
          >
            <Target className="w-spacing-5 h-spacing-5 text-[hsl(var(--success))]" />
          </motion.div>
        ) : (
          <Gift className={cn(
            'w-spacing-5 h-spacing-5',
            isToday ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'
          )} />
        )}
      </div>

      <span className={cn(
        'text-sm font-bold tabular-nums',
        isClaimed ? 'text-[hsl(var(--success))]' : isToday ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'
      )}>
        {typeof reward === 'number' ? `+${reward}` : reward}
      </span>

      {isToday && !isClaimed && (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute -top-spacing-1 -right-spacing-1 w-spacing-3 h-spacing-3 rounded-full bg-[var(--brand-teal-1)]"
        />
      )}
    </motion.button>
  )
}

// Reward icons for quick use
export const RewardIcons = {
  Trophy: () => <Trophy className="w-spacing-6 h-spacing-6" />,
  Star: () => <Star className="w-spacing-6 h-spacing-6" />,
  Sparkles: () => <Sparkles className="w-spacing-6 h-spacing-6" />,
  Crown: () => <Crown className="w-spacing-6 h-spacing-6" />,
  Zap: () => <Zap className="w-spacing-6 h-spacing-6" />,
  Gift: () => <Gift className="w-spacing-6 h-spacing-6" />,
  Flame: () => <Flame className="w-spacing-6 h-spacing-6" />,
  Target: () => <Target className="w-spacing-6 h-spacing-6" />,
}
