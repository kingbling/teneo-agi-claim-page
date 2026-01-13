import { Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { Crown, Star, Anchor, Compass, Ship } from 'lucide-solid'
import { userStore } from '@/stores/userStore'
import { USER_LEVEL_CONFIG, type UserLevel, USER_LEVEL_COLORS } from '@/types/game'
import { cn } from '@/lib/utils'

// Icons for each user level
const LEVEL_ICONS: Record<UserLevel, JSX.Element> = {
  1: <Compass class="h-4 w-4" />,
  2: <Anchor class="h-4 w-4" />,
  3: <Ship class="h-4 w-4" />,
  4: <Star class="h-4 w-4" />,
  5: <Crown class="h-4 w-4" />,
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
  class?: string
}

/**
 * UserLevelBadge - Displays user level (L1-L5) with icon and multiplier
 * Masterplan 2026: Based on cumulative USDC spent
 */
export function UserLevelBadge(props: UserLevelBadgeProps) {
  const size = () => props.size ?? 'md'
  const showLabel = () => props.showLabel ?? true
  const showMultiplier = () => props.showMultiplier ?? false

  const config = () => USER_LEVEL_CONFIG[userStore.userLevel]
  const icon = () => LEVEL_ICONS[userStore.userLevel]
  const color = () => USER_LEVEL_COLORS[userStore.userLevel]
  const gradient = () => LEVEL_GRADIENTS[userStore.userLevel]
  const border = () => LEVEL_BORDERS[userStore.userLevel]

  const sizeClasses = {
    sm: 'text-xs px-2 py-1 gap-1',
    md: 'text-sm px-3 py-1.5 gap-2',
    lg: 'text-base px-4 py-2 gap-2',
  }

  return (
    <div
      class={cn(
        'inline-flex items-center rounded-lg border font-semibold bg-gradient-to-r',
        'animate-in fade-in zoom-in-95 duration-200',
        gradient(),
        border(),
        sizeClasses[size()],
        props.class
      )}
      style={{ color: color() }}
    >
      {icon()}
      <span>L{userStore.userLevel}</span>
      <Show when={showLabel()}>
        <span class="opacity-80">{config().label}</span>
      </Show>
      <Show when={showMultiplier()}>
        <span class="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-current/20">
          {userStore.pointsPerMinMultiplier}x
        </span>
      </Show>
    </div>
  )
}

/**
 * UserLevelCard - Expanded view with progress to next level
 */
export function UserLevelCard() {
  const config = () => USER_LEVEL_CONFIG[userStore.userLevel]
  const color = () => USER_LEVEL_COLORS[userStore.userLevel]
  const gradient = () => LEVEL_GRADIENTS[userStore.userLevel]
  const border = () => LEVEL_BORDERS[userStore.userLevel]

  // Calculate progress to next level
  const isMaxLevel = () => userStore.userLevel === 5
  const nextLevel = () => (userStore.userLevel < 5 ? userStore.userLevel + 1 : 5) as UserLevel
  const nextLevelConfig = () => USER_LEVEL_CONFIG[nextLevel()]
  const progressToNext = () =>
    isMaxLevel()
      ? 100
      : ((userStore.usdcSpent - config().minUSDC) / (nextLevelConfig().minUSDC - config().minUSDC)) * 100

  return (
    <div
      class={cn(
        'rounded-xl border p-4 bg-gradient-to-br',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        gradient(),
        border()
      )}
    >
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div
            class="p-2 rounded-lg"
            style={{ "background-color": `${color()}20` }}
          >
            {LEVEL_ICONS[userStore.userLevel]}
          </div>
          <div>
            <p class="font-bold" style={{ color: color() }}>
              Level {userStore.userLevel} - {config().label}
            </p>
            <p class="text-xs text-[var(--text-muted)]">
              ${userStore.usdcSpent.toFixed(2)} USDC spent
            </p>
          </div>
        </div>
        <div
          class="px-3 py-1.5 rounded-lg text-sm font-bold"
          style={{ "background-color": `${color()}20`, color: color() }}
        >
          {userStore.pointsPerMinMultiplier}x Pts/Min
        </div>
      </div>

      {/* Progress to next level */}
      <Show when={!isMaxLevel()}>
        <div class="mb-4">
          <div class="flex justify-between text-xs mb-1">
            <span class="text-[var(--text-muted)]">Progress to L{nextLevel()}</span>
            <span style={{ color: color() }}>
              ${userStore.usdcSpent.toFixed(2)} / ${nextLevelConfig().minUSDC}
            </span>
          </div>
          <div class="h-2 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressToNext()}%`, "background-color": color() }}
            />
          </div>
        </div>
      </Show>

      {/* Benefits */}
      <div class="grid grid-cols-2 gap-2 text-center">
        <div class="p-2 rounded-lg bg-[var(--background-primary)]/50">
          <p class="text-xs text-[var(--text-muted)]">Pts/Min Boost</p>
          <p class="font-bold" style={{ color: color() }}>{userStore.pointsPerMinMultiplier}x</p>
        </div>
        <div class="p-2 rounded-lg bg-[var(--background-primary)]/50">
          <p class="text-xs text-[var(--text-muted)]">Max Ships</p>
          <p class="font-bold" style={{ color: color() }}>{userStore.maxShips}</p>
        </div>
      </div>
    </div>
  )
}
