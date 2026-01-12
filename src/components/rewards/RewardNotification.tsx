import { createEffect, onCleanup, Show, For, type Component } from 'solid-js'
import { Coins, Zap, Ticket, Trophy, Image, ArrowUp, X } from 'lucide-solid'
import { rewardStore, type RewardType, getRewardTypeLabel } from '@/stores/rewardStore'
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

const RewardNotificationItem: Component<RewardNotificationItemProps> = (props) => {
  const styles = () => REWARD_STYLES[props.type] || REWARD_STYLES.agi
  const Icon = () => styles().icon

  // Format amount based on type
  const formattedAmount = () => props.type === 'nft' ? '+1' : `+${formatPoints(props.amount)}`
  const suffix = () => props.type === 'xp' ? ' XP' : props.type === 'lottery_ticket' ? ' Tickets' : props.type === 'agi' || props.type === 'lottery_win' ? ' AGI' : ''

  return (
    <div
      class={cn(
        'relative flex items-center gap-3 px-4 py-3 rounded-xl',
        'border bg-gradient-to-r backdrop-blur-xl',
        'shadow-lg',
        'animate-slide-in-right',
        styles().bg,
        styles().border,
        styles().glow
      )}
      style={{
        'animation-delay': `${props.index * 100}ms`,
      }}
    >
      {/* Animated background pulse for lottery wins */}
      <Show when={props.type === 'lottery_win'}>
        <div class="absolute inset-0 rounded-xl bg-amber-500/20 animate-pulse" />
      </Show>

      {/* Icon */}
      <div class={cn('p-2 rounded-lg bg-[var(--background-secondary)]', styles().text)}>
        <Icon class="h-5 w-5" />
      </div>

      {/* Content */}
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2">
          <span class={cn('text-lg font-bold tabular-nums', styles().text)}>
            {formattedAmount()}{suffix()}
          </span>
          <span class="text-xs text-[var(--text-muted)]">
            {getRewardTypeLabel(props.type)}
          </span>
        </div>
        <p class="text-xs text-[var(--text-secondary)] truncate">
          {props.source}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => props.onDismiss(props.id)}
        class="p-1 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
      >
        <X class="h-4 w-4 text-[var(--text-muted)]" />
      </button>
    </div>
  )
}

/**
 * RewardNotification - Stacked notification popups for rewards
 * Shows animated notifications when user earns AGI, XP, or lottery tickets
 */
export const RewardNotification: Component = () => {
  const recentRewards = () => rewardStore.recentRewards
  const showNotifications = () => rewardStore.showNotifications

  const handleDismiss = (id: string) => {
    rewardStore.dismissReward(id)
  }

  return (
    <Show when={showNotifications() && recentRewards().length > 0}>
      <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <For each={recentRewards()}>
          {(reward, index) => (
            <div class="pointer-events-auto">
              <RewardNotificationItem
                id={reward.id}
                type={reward.type}
                amount={reward.amount}
                source={reward.source}
                onDismiss={handleDismiss}
                index={index()}
              />
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}

/**
 * RewardNotificationMini - Compact inline notification for use within components
 */
interface RewardNotificationMiniProps {
  type: RewardType
  amount: number
  class?: string
}

export const RewardNotificationMini: Component<RewardNotificationMiniProps> = (props) => {
  const styles = () => REWARD_STYLES[props.type] || REWARD_STYLES.agi
  const Icon = () => styles().icon

  const formattedAmount = () => props.type === 'nft' ? '+1' : `+${formatPoints(props.amount)}`

  return (
    <div
      class={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'border bg-gradient-to-r',
        'animate-fade-in-up',
        styles().bg,
        styles().border,
        props.class
      )}
    >
      <Icon class={cn('h-3.5 w-3.5', styles().text)} />
      <span class={cn('text-sm font-bold tabular-nums', styles().text)}>
        {formattedAmount()}
      </span>
    </div>
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

export const RewardToast: Component<RewardToastProps> = (props) => {
  const styles = () => REWARD_STYLES[props.type] || REWARD_STYLES.agi
  const Icon = () => styles().icon

  const formattedAmount = () => props.type === 'nft' ? '+1' : `+${formatPoints(props.amount)}`
  const suffix = () => props.type === 'xp' ? ' XP' : props.type === 'lottery_ticket' ? ' Tickets' : props.type === 'agi' || props.type === 'lottery_win' ? ' AGI' : ''

  createEffect(() => {
    if (props.isVisible && props.onClose) {
      const timer = setTimeout(props.onClose, 4000)
      onCleanup(() => clearTimeout(timer))
    }
  })

  return (
    <Show when={props.isVisible}>
      <div
        class={cn(
          'fixed top-6 left-1/2 -translate-x-1/2 z-50',
          'px-6 py-4 rounded-2xl',
          'border bg-gradient-to-r backdrop-blur-xl',
          'shadow-xl',
          'animate-fade-in-down',
          styles().bg,
          styles().border,
          styles().glow
        )}
      >
        <div class="flex items-center gap-4">
          <div class={cn('p-3 rounded-xl bg-[var(--background-secondary)]', styles().text)}>
            <Icon class="h-6 w-6" />
          </div>

          <div>
            <p class={cn('text-xl font-bold tabular-nums', styles().text)}>
              {formattedAmount()}{suffix()}
            </p>
            <Show when={props.source}>
              <p class="text-sm text-[var(--text-secondary)]">{props.source}</p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
