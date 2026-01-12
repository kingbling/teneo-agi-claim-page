import { Show } from 'solid-js'
import { Star, TrendingUp, Sparkles, ChevronRight } from 'lucide-solid'
import { cn } from '@/lib/utils'
import { userStore } from '@/stores/userStore'
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
  class?: string
}

/**
 * LevelProgress - Displays user level progress
 *
 * Shows current level (L1-L5), USDC spent progress to next level,
 * and reward multiplier for current level.
 */
export function LevelProgress(props: LevelProgressProps) {
  const config = () => getUserLevelConfig(userStore.userLevel)
  const nextLevel = () => userStore.userLevel < 5 ? (userStore.userLevel + 1) as UserLevel : null
  const nextConfig = () => {
    const nl = nextLevel()
    return nl ? getUserLevelConfig(nl) : null
  }

  // Calculate progress to next level
  const currentThreshold = () => config().minUSDC
  const nextThreshold = () => nextConfig()?.minUSDC ?? config().minUSDC
  const progressRange = () => nextThreshold() - currentThreshold()
  const currentProgress = () => userStore.usdcSpent - currentThreshold()
  const progressPercentage = () => progressRange() > 0
    ? Math.min(100, (currentProgress() / progressRange()) * 100)
    : 100

  const color = () => USER_LEVEL_COLORS[userStore.userLevel]
  const isMaxLevel = () => userStore.userLevel === 5

  return (
    <Show
      when={!props.compact}
      fallback={
        <div
          class={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200',
            'bg-gradient-to-r from-[var(--background-secondary)] to-[var(--background-primary)]',
            'border-[var(--card-border)]/30',
            props.class
          )}
        >
          <Star class="h-4 w-4" style={{ color: color() }} />
          <span class="font-bold" style={{ color: color() }}>
            L{userStore.userLevel}
          </span>
          <span class="text-xs text-[var(--text-muted)]">
            {config().label}
          </span>
          <Show when={!isMaxLevel()}>
            <div class="w-16 h-1.5 rounded-full bg-[var(--background-primary)] overflow-hidden">
              <div
                class="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${progressPercentage()}%`, "background-color": color() }}
              />
            </div>
          </Show>
          <Show when={props.showMultiplier !== false}>
            <span class="text-xs font-medium" style={{ color: color() }}>
              {userStore.rewardMultiplier}x
            </span>
          </Show>
        </div>
      }
    >
      <div
        class={cn(
          'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)] transition-all duration-200',
          'border-[var(--card-border)]/30',
          props.class
        )}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div
              class="p-2.5 rounded-xl"
              style={{ "background-color": `${color()}20` }}
            >
              <Star class="h-5 w-5" style={{ color: color() }} />
            </div>
            <div>
              <p class="font-bold text-lg" style={{ color: color() }}>
                Level {userStore.userLevel}
              </p>
              <p class="text-sm text-[var(--text-muted)]">{config().label}</p>
            </div>
          </div>

          {/* Multiplier Badge */}
          <Show when={props.showMultiplier !== false}>
            <div
              class="px-3 py-1.5 rounded-lg text-sm font-bold"
              style={{ "background-color": `${color()}20`, color: color() }}
            >
              {userStore.rewardMultiplier}x Rewards
            </div>
          </Show>
        </div>

        {/* Progress to Next Level */}
        <Show when={!isMaxLevel() && nextConfig()}>
          <div class="mb-4">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-[var(--text-muted)]">Progress to L{nextLevel()}</span>
              <span class="font-medium text-[var(--text-primary)]">
                ${userStore.usdcSpent.toFixed(2)} / ${nextThreshold()}
              </span>
            </div>
            <div class="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
              <div
                class="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${progressPercentage()}%`, "background-color": color() }}
              />
            </div>
            <p class="text-xs text-[var(--text-muted)] mt-1.5">
              ${(nextThreshold() - userStore.usdcSpent).toFixed(2)} more to reach {nextConfig()!.label}
            </p>
          </div>
        </Show>

        {/* Max Level Message */}
        <Show when={isMaxLevel()}>
          <div class="flex items-center gap-2 p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 mb-4">
            <Sparkles class="h-4 w-4 text-yellow-400" />
            <span class="text-sm font-medium text-[var(--text-primary)]">
              Maximum level achieved!
            </span>
          </div>
        </Show>

        {/* Level Benefits */}
        <div class="space-y-2">
          <p class="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Level Benefits
          </p>
          <div class="grid grid-cols-3 gap-2">
            <LevelBenefit
              label="Multiplier"
              value={`${config().multiplier}x`}
              color={color()}
            />
            <LevelBenefit
              label="ETA Boost"
              value={`${(config().etaBoost * 100).toFixed(0)}%`}
              color={color()}
            />
            <LevelBenefit
              label="Max Ships"
              value={config().maxShips.toString()}
              color={color()}
            />
          </div>
        </div>

        {/* Next Level Preview */}
        <Show when={!isMaxLevel() && nextConfig()}>
          <div class="mt-4 pt-4 border-t border-[var(--card-border)]/20">
            <div class="flex items-center gap-2 text-sm">
              <ChevronRight class="h-4 w-4 text-[var(--text-muted)]" />
              <span class="text-[var(--text-muted)]">Next:</span>
              <span class="font-medium" style={{ color: nextLevel() ? USER_LEVEL_COLORS[nextLevel()!] : undefined }}>
                L{nextLevel()} {nextConfig()!.label}
              </span>
              <span class="text-[var(--text-muted)]">-</span>
              <span class="text-[var(--text-primary)]">
                {nextConfig()!.multiplier}x rewards, {nextConfig()!.maxShips} ships
              </span>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )
}

// Level benefit mini-card
function LevelBenefit(props: {
  label: string
  value: string
  color: string
}) {
  return (
    <div class="p-2 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
      <p class="text-xs text-[var(--text-muted)] mb-0.5">{props.label}</p>
      <p class="font-bold text-sm" style={{ color: props.color }}>
        {props.value}
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
  class?: string
}

export function LevelBadge(props: LevelBadgeProps) {
  const displayLevel = () => props.level ?? userStore.userLevel
  const config = () => getUserLevelConfig(displayLevel())
  const color = () => USER_LEVEL_COLORS[displayLevel()]

  return (
    <span
      class={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold border',
        props.class
      )}
      style={{
        "background-color": `${color()}20`,
        "border-color": `${color()}40`,
        color: color(),
      }}
    >
      <Star class="h-3 w-3" />
      L{displayLevel()}
      <Show when={props.showLabel}>
        <span class="font-medium">{config().label}</span>
      </Show>
    </span>
  )
}

/**
 * MultiplierBadge - Shows reward multiplier
 */
export interface MultiplierBadgeProps {
  multiplier?: number
  class?: string
}

export function MultiplierBadge(props: MultiplierBadgeProps) {
  const displayMultiplier = () => props.multiplier ?? userStore.rewardMultiplier

  return (
    <span
      class={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold',
        'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        props.class
      )}
    >
      <TrendingUp class="h-3 w-3" />
      {displayMultiplier()}x
    </span>
  )
}
