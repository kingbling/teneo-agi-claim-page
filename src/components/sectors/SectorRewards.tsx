import { Show, For, type JSX } from 'solid-js'
import { Gift, Sparkles, Trophy, Coins, Brain, Star, Lock } from 'lucide-solid'
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
  class?: string
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
export function SectorRewards(props: SectorRewardsProps) {
  const compact = () => props.compact ?? false
  const isCompleted = () => props.isCompleted ?? false

  // Count claimed rewards
  const claimedRewards = () => props.rewards.filter(r => r.claimed)

  return (
    <Show
      when={!compact()}
      fallback={
        <div class={cn('flex items-center gap-2', props.class)}>
          <Gift class="h-4 w-4 text-amber-400" />
          <span class="text-sm text-[var(--text-muted)]">
            {props.rewards.length} reward{props.rewards.length !== 1 ? 's' : ''}
          </span>
          <Show when={claimedRewards().length > 0}>
            <span class="text-xs text-green-400">
              ({claimedRewards().length} claimed)
            </span>
          </Show>
        </div>
      }
    >
      <div
        class={cn(
          'rounded-xl border p-4 bg-gradient-to-br from-amber-500/10 to-[var(--background-primary)]',
          'border-amber-500/20 transition-all duration-300',
          props.class
        )}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-amber-500/20">
              <Gift class="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p class="text-sm font-semibold text-[var(--text-primary)]">
                Sector Rewards
              </p>
              <p class="text-xs text-[var(--text-muted)]">
                {claimedRewards().length}/{props.rewards.length} claimed
              </p>
            </div>
          </div>
          <Show when={isCompleted()}>
            <div class="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/20 text-green-400">
              <Trophy class="h-3.5 w-3.5" />
              <span class="text-xs font-medium">Completed</span>
            </div>
          </Show>
        </div>

        {/* Rewards grid */}
        <div class="grid grid-cols-2 gap-3">
          <For each={props.rewards}>
            {(reward, index) => {
              const Icon = REWARD_ICONS[reward.type]
              const isLocked = () => !isCompleted() && props.progressPercent < ((index() + 1) / props.rewards.length) * 100
              const rarityClass = () => reward.rarity ? RARITY_COLORS[reward.rarity] : ''

              return (
                <div
                  class={cn(
                    'relative p-3 rounded-lg border transition-all duration-200',
                    reward.claimed
                      ? 'bg-green-500/10 border-green-500/30'
                      : isLocked()
                      ? 'bg-[var(--background-primary)] border-[var(--card-border)]/20 opacity-50'
                      : 'bg-[var(--background-secondary)] border-[var(--card-border)]/30 hover:border-amber-500/30',
                    rarityClass() && !reward.claimed && !isLocked() && rarityClass()
                  )}
                >
                  {/* Lock overlay */}
                  <Show when={isLocked()}>
                    <div class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                      <Lock class="h-5 w-5 text-[var(--text-muted)]" />
                    </div>
                  </Show>

                  {/* Claimed checkmark */}
                  <Show when={reward.claimed}>
                    <div class="absolute top-1.5 right-1.5">
                      <div class="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                        <Trophy class="h-2.5 w-2.5 text-white" />
                      </div>
                    </div>
                  </Show>

                  {/* Content */}
                  <div class="flex items-start gap-2">
                    <div class={cn(
                      'p-1.5 rounded-lg',
                      reward.claimed
                        ? 'bg-green-500/20'
                        : isLocked()
                        ? 'bg-[var(--background-secondary)]'
                        : 'bg-amber-500/20'
                    )}>
                      <Icon class={cn(
                        'h-4 w-4',
                        reward.claimed
                          ? 'text-green-400'
                          : isLocked()
                          ? 'text-[var(--text-muted)]'
                          : 'text-amber-400'
                      )} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class={cn(
                        'text-sm font-medium truncate',
                        reward.claimed
                          ? 'text-green-400'
                          : isLocked()
                          ? 'text-[var(--text-muted)]'
                          : 'text-[var(--text-primary)]'
                      )}>
                        {reward.label}
                      </p>
                      <p class="text-xs text-[var(--text-muted)]">
                        {reward.type === 'agi' || reward.type === 'brainXp'
                          ? formatPoints(reward.value)
                          : reward.description || `x${reward.value}`}
                      </p>
                    </div>
                  </div>

                  {/* Claim button */}
                  <Show when={!reward.claimed && !isLocked() && isCompleted() && props.onClaim}>
                    <button
                      onClick={() => props.onClaim?.(reward.id)}
                      class="mt-2 w-full py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors"
                    >
                      Claim
                    </button>
                  </Show>

                  {/* Rarity badge */}
                  <Show when={reward.rarity && reward.rarity !== 'common'}>
                    <div class="absolute bottom-1.5 right-1.5">
                      <span class={cn(
                        'text-[10px] font-medium capitalize px-1.5 py-0.5 rounded',
                        RARITY_COLORS[reward.rarity!]
                      )}>
                        {reward.rarity}
                      </span>
                    </div>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>

        {/* Empty state */}
        <Show when={props.rewards.length === 0}>
          <div class="text-center py-6 text-[var(--text-muted)]">
            <Gift class="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p class="text-sm">No rewards available</p>
          </div>
        </Show>
      </div>
    </Show>
  )
}

/**
 * RewardSummary - Minimal reward count
 */
export interface RewardSummaryProps {
  totalAgi: number
  totalBrainXp: number
  itemCount: number
  class?: string
}

export function RewardSummary(props: RewardSummaryProps) {
  return (
    <div class={cn('flex items-center gap-3', props.class)}>
      <Show when={props.totalAgi > 0}>
        <div class="flex items-center gap-1 text-amber-400">
          <Coins class="h-3.5 w-3.5" />
          <span class="text-xs font-medium">{formatPoints(props.totalAgi)} AGI</span>
        </div>
      </Show>
      <Show when={props.totalBrainXp > 0}>
        <div class="flex items-center gap-1 text-purple-400">
          <Brain class="h-3.5 w-3.5" />
          <span class="text-xs font-medium">{formatPoints(props.totalBrainXp)} XP</span>
        </div>
      </Show>
      <Show when={props.itemCount > 0}>
        <div class="flex items-center gap-1 text-[var(--text-muted)]">
          <Gift class="h-3.5 w-3.5" />
          <span class="text-xs font-medium">{props.itemCount} items</span>
        </div>
      </Show>
    </div>
  )
}
