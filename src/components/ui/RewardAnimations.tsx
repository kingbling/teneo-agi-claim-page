import { createSignal, createMemo, onCleanup, Show, For, type JSX } from 'solid-js'
import { cn } from '@/lib/utils'
import { Sparkles, Trophy, Star, Zap, Gift, Crown, Flame, Target } from 'lucide-solid'

// Floating particles effect for rewards
interface ParticleProps {
  x: number
  y: number
  color: string
  delay: number
}

function Particle(props: ParticleProps) {
  return (
    <div
      class={cn('absolute w-spacing-2 h-spacing-2 rounded-full particle-animate', props.color)}
      style={{
        '--particle-x': `${props.x}px`,
        '--particle-y': `${props.y}px`,
        'animation-delay': `${props.delay}s`,
      }}
    />
  )
}

// Reward burst animation
interface RewardBurstProps {
  isActive: boolean
  variant?: 'gold' | 'teal' | 'rainbow' | 'fire'
  intensity?: 'low' | 'medium' | 'high'
  class?: string
}

const burstColors = {
  gold: ['bg-[hsl(var(--tier-legendary))]', 'bg-[hsl(var(--accent))]', 'bg-[hsl(var(--tier-legendary))]'],
  teal: ['bg-[var(--brand-teal-1)]', 'bg-[hsl(var(--accent))]', 'bg-[hsl(var(--success))]'],
  rainbow: ['bg-[hsl(var(--tier-legendary))]', 'bg-[hsl(var(--accent))]', 'bg-[hsl(var(--success))]', 'bg-[hsl(var(--primary))]', 'bg-[hsl(var(--tier-mythic))]'],
  fire: ['bg-[hsl(var(--tier-legendary))]', 'bg-[hsl(var(--tier-legendary))]', 'bg-[hsl(var(--accent))]'],
}

export function RewardBurst(props: RewardBurstProps) {
  const variant = () => props.variant ?? 'gold'
  const intensity = () => props.intensity ?? 'medium'

  const particleCount = createMemo(() => ({ low: 8, medium: 16, high: 24 }[intensity()]))
  const colors = createMemo(() => burstColors[variant()])

  const particles = createMemo(() => {
    const count = particleCount()
    const colorArray = colors()
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2
      const distance = 40 + Math.random() * 40
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        color: colorArray[i % colorArray.length],
        delay: Math.random() * 0.2,
      }
    })
  })

  return (
    <Show when={props.isActive}>
      <div class={cn('absolute inset-0 flex items-center justify-center pointer-events-none', props.class)}>
        <For each={particles()}>
          {(particle, i) => <Particle {...particle} />}
        </For>
      </div>
    </Show>
  )
}

// Animated number counter for rewards
interface AnimatedCounterProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  class?: string
  onComplete?: () => void
}

export function AnimatedCounter(props: AnimatedCounterProps) {
  const duration = () => props.duration ?? 1.5
  const [displayValue, setDisplayValue] = createSignal(0)

  const startAnimation = () => {
    const startTime = performance.now()
    const startValue = displayValue()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / (duration() * 1000), 1)

      // Easing function for more satisfying animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const current = Math.floor(startValue + (props.value - startValue) * easeOutQuart)

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(props.value)
        props.onComplete?.()
      }
    }

    requestAnimationFrame(animate)
  }

  // Watch for value changes
  createMemo(() => {
    props.value // track dependency
    startAnimation()
  })

  return (
    <span class={cn('tabular-nums font-bold', props.class)}>
      {props.prefix ?? ''}{displayValue().toLocaleString()}{props.suffix ?? ''}
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
  icon?: JSX.Element
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

export function RewardPopup(props: RewardPopupProps) {
  const variant = () => props.variant ?? 'success'
  const styles = () => popupVariants[variant()]

  // Auto-close timer
  createMemo(() => {
    if (props.isOpen) {
      const timer = setTimeout(props.onClose, 4000)
      onCleanup(() => clearTimeout(timer))
    }
  })

  return (
    <Show when={props.isOpen}>
      <div
        class={cn(
          'fixed top-spacing-6 left-1/2 -translate-x-1/2 z-50',
          'px-spacing-6 py-spacing-5 rounded-2xl',
          'border bg-gradient-to-r backdrop-blur-xl',
          'shadow-xl',
          'popup-enter',
          styles().bg,
          styles().border,
          styles().glow
        )}
      >
        <RewardBurst isActive={true} variant={variant() === 'achievement' ? 'gold' : 'teal'} />

        <div class="relative flex items-center gap-spacing-4">
          <Show when={props.icon}>
            <div class={cn('p-spacing-3 rounded-xl', styles().icon)}>
              {props.icon}
            </div>
          </Show>

          <div class="space-y-spacing-1">
            <h3 class="text-lg font-bold text-[var(--text-primary)]">{props.title}</h3>
            <Show when={props.description}>
              <p class="text-sm text-[var(--text-secondary)]">{props.description}</p>
            </Show>
            <Show when={props.value !== undefined}>
              <p class="text-xl font-bold text-[var(--brand-teal-1)]">
                {typeof props.value === 'number' ? (
                  <AnimatedCounter value={props.value} prefix="+" suffix=" AGI" />
                ) : (
                  props.value
                )}
              </p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}

// XP/Progress gain animation
interface XPGainProps {
  amount: number
  isVisible: boolean
  class?: string
}

export function XPGain(props: XPGainProps) {
  return (
    <Show when={props.isVisible}>
      <div
        class={cn(
          'inline-flex items-center gap-spacing-1.5 px-spacing-3 py-spacing-1.5 rounded-full',
          'bg-[var(--brand-teal-1)]/20 border border-[var(--brand-teal-1)]/30',
          'text-[var(--brand-teal-1)] font-bold text-sm',
          'xp-gain-enter',
          props.class
        )}
      >
        <Zap class="w-spacing-4 h-spacing-4" />
        +{props.amount}
      </div>
    </Show>
  )
}

// Streak indicator with fire animation
interface StreakIndicatorProps {
  streak: number
  isActive?: boolean
  class?: string
}

export function StreakIndicator(props: StreakIndicatorProps) {
  const isActive = () => props.isActive ?? true

  return (
    <div class={cn('flex items-center gap-spacing-2', props.class)}>
      <div
        class={cn(
          'p-spacing-2 rounded-lg',
          isActive() ? 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))] streak-pulse' : 'bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))]'
        )}
      >
        <Flame class="w-spacing-5 h-spacing-5" />
      </div>

      <div class="space-y-spacing-0.5">
        <span class="text-xs font-medium text-[var(--text-muted)]">Streak</span>
        <span class={cn(
          'block text-lg font-bold tabular-nums',
          isActive() ? 'text-[hsl(var(--tier-legendary))]' : 'text-[hsl(var(--secondary))]'
        )}>
          {props.streak} days
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
  icon?: JSX.Element
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  class?: string
}

const rarityStyles = {
  common: { border: 'border-[hsl(var(--secondary))]/30', glow: '' },
  uncommon: { border: 'border-[hsl(var(--success))]/30', glow: 'shadow-[hsl(var(--success))]/20' },
  rare: { border: 'border-[hsl(var(--primary))]/30', glow: 'shadow-[hsl(var(--primary))]/25' },
  epic: { border: 'border-[hsl(var(--tier-mythic))]/30', glow: 'shadow-[hsl(var(--tier-mythic))]/30' },
  legendary: { border: 'border-[hsl(var(--tier-legendary))]/40', glow: 'shadow-[hsl(var(--tier-legendary))]/40' },
}

export function AchievementUnlock(props: AchievementUnlockProps) {
  const rarity = () => props.rarity ?? 'common'
  const styles = () => rarityStyles[rarity()]

  return (
    <div
      class={cn(
        'relative p-spacing-5 rounded-2xl border bg-[var(--background-secondary)]',
        'transition-all duration-300',
        styles().border,
        props.isUnlocked && 'shadow-lg achievement-enter',
        props.isUnlocked && styles().glow,
        props.class
      )}
    >
      <RewardBurst isActive={props.isUnlocked} variant="gold" intensity="low" />

      <div class="relative flex items-center gap-spacing-4">
        <div
          class={cn(
            'p-spacing-3 rounded-xl transition-all duration-300',
            props.isUnlocked ? 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))] achievement-icon-shake' : 'bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))]'
          )}
        >
          {props.icon ?? <Trophy class="w-spacing-6 h-spacing-6" />}
        </div>

        <div class="flex-1">
          <h4 class={cn(
            'font-bold transition-colors duration-300',
            props.isUnlocked ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
          )}>
            {props.title}
          </h4>
          <Show when={props.description}>
            <p class="text-sm text-[var(--text-tertiary)] mt-spacing-1">{props.description}</p>
          </Show>
        </div>

        <Show when={props.isUnlocked}>
          <div class="achievement-sparkle-enter">
            <Sparkles class="w-spacing-5 h-spacing-5 text-[hsl(var(--tier-legendary))]" />
          </div>
        </Show>
      </div>
    </div>
  )
}

// Milestone reached animation
interface MilestoneReachedProps {
  milestone: number
  label?: string
  isReached: boolean
  class?: string
}

export function MilestoneReached(props: MilestoneReachedProps) {
  return (
    <Show when={props.isReached}>
      <div
        class={cn(
          'flex items-center gap-spacing-3 px-spacing-5 py-spacing-4 rounded-2xl',
          'bg-gradient-to-r from-[hsl(var(--tier-legendary))]/20 to-[hsl(var(--accent))]/20',
          'border border-[hsl(var(--tier-legendary))]/30 shadow-lg shadow-[hsl(var(--tier-legendary))]/20',
          'milestone-enter',
          props.class
        )}
      >
        <div class="p-spacing-2.5 rounded-xl bg-[hsl(var(--tier-legendary))]/20 milestone-star-spin">
          <Star class="w-spacing-6 h-spacing-6 text-[hsl(var(--tier-legendary))]" />
        </div>

        <div>
          <p class="text-xs font-medium text-[hsl(var(--tier-legendary))]/80 uppercase tracking-wider">
            {props.label ?? 'Milestone Reached'}
          </p>
          <p class="text-2xl font-bold text-[hsl(var(--tier-legendary))] tabular-nums">
            {props.milestone.toLocaleString()}
          </p>
        </div>
      </div>
    </Show>
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

export function DailyReward(props: DailyRewardProps) {
  return (
    <button
      onClick={!props.isClaimed && props.isToday ? props.onClick : undefined}
      disabled={props.isClaimed || !props.isToday}
      class={cn(
        'relative flex flex-col items-center gap-spacing-2 p-spacing-4 rounded-xl border transition-all',
        props.isClaimed
          ? 'bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30'
          : props.isToday
          ? 'bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/40 cursor-pointer hover:shadow-lg hover:shadow-[var(--brand-teal-1)]/20 hover:scale-105 active:scale-95'
          : 'bg-[var(--background-tertiary)] border-[var(--card-border)] opacity-50'
      )}
    >
      <span class="text-xs font-medium text-[var(--text-muted)]">Day {props.day}</span>

      <div class={cn(
        'p-spacing-2 rounded-lg',
        props.isClaimed ? 'bg-[hsl(var(--success))]/20' : props.isToday ? 'bg-[var(--brand-teal-1)]/20' : 'bg-[var(--background-secondary)]'
      )}>
        <Show
          when={props.isClaimed}
          fallback={
            <Gift class={cn(
              'w-spacing-5 h-spacing-5',
              props.isToday ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'
            )} />
          }
        >
          <div class="claimed-icon-enter">
            <Target class="w-spacing-5 h-spacing-5 text-[hsl(var(--success))]" />
          </div>
        </Show>
      </div>

      <span class={cn(
        'text-sm font-bold tabular-nums',
        props.isClaimed ? 'text-[hsl(var(--success))]' : props.isToday ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'
      )}>
        {typeof props.reward === 'number' ? `+${props.reward}` : props.reward}
      </span>

      <Show when={props.isToday && !props.isClaimed}>
        <div class="absolute -top-spacing-1 -right-spacing-1 w-spacing-3 h-spacing-3 rounded-full bg-[var(--brand-teal-1)] today-pulse" />
      </Show>
    </button>
  )
}

// Reward icons for quick use
export const RewardIcons = {
  Trophy: () => <Trophy class="w-spacing-6 h-spacing-6" />,
  Star: () => <Star class="w-spacing-6 h-spacing-6" />,
  Sparkles: () => <Sparkles class="w-spacing-6 h-spacing-6" />,
  Crown: () => <Crown class="w-spacing-6 h-spacing-6" />,
  Zap: () => <Zap class="w-spacing-6 h-spacing-6" />,
  Gift: () => <Gift class="w-spacing-6 h-spacing-6" />,
  Flame: () => <Flame class="w-spacing-6 h-spacing-6" />,
  Target: () => <Target class="w-spacing-6 h-spacing-6" />,
}
