import { createEffect, onMount, Show, For, type Component } from 'solid-js'
import { Trophy, Brain, Sparkles, RefreshCw, Crown, Medal, Award, ChevronUp, ChevronDown } from 'lucide-solid'
import {
  rewardStore,
  type LeaderboardType,
  type LeaderboardEntry,
  getLeaderboardTypeLabel,
  formatLeaderboardScore,
} from '@/stores/rewardStore'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Rank icons for top 3
const RANK_ICONS: Record<number, typeof Trophy> = {
  1: Crown,
  2: Medal,
  3: Award,
}

// Rank colors
const RANK_COLORS: Record<number, string> = {
  1: 'text-amber-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  type: LeaderboardType
  index: number
}

const LeaderboardRow: Component<LeaderboardRowProps> = (props) => {
  const RankIcon = () => RANK_ICONS[props.entry.rank]
  const rankColor = () => RANK_COLORS[props.entry.rank] || 'text-[var(--text-muted)]'

  return (
    <div
      class={cn(
        'flex items-center gap-3 p-3 rounded-xl animate-slide-in-left',
        props.entry.isCurrentUser
          ? 'bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30'
          : 'bg-[var(--background-primary)]',
        props.entry.rank <= 3 && !props.entry.isCurrentUser && 'bg-gradient-to-r from-[var(--background-primary)] to-transparent'
      )}
      style={{ 'animation-delay': `${props.index * 50}ms` }}
    >
      {/* Rank */}
      <div class={cn(
        'w-8 h-8 flex items-center justify-center rounded-lg',
        props.entry.rank <= 3 ? 'bg-[var(--background-secondary)]' : ''
      )}>
        <Show
          when={RankIcon()}
          fallback={
            <span class="text-sm font-bold text-[var(--text-muted)]">
              #{props.entry.rank}
            </span>
          }
        >
          {(Icon) => <Icon class={cn('h-5 w-5', rankColor())} />}
        </Show>
      </div>

      {/* User Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class={cn(
            'font-medium truncate',
            props.entry.isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
          )}>
            {props.entry.userName}
            {props.entry.isCurrentUser && ' (You)'}
          </span>
          <Show when={props.entry.brainLevel}>
            <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--background-secondary)] text-[var(--text-muted)]">
              Lv.{props.entry.brainLevel}
            </span>
          </Show>
        </div>
      </div>

      {/* Score */}
      <div class="text-right">
        <span class={cn(
          'font-bold tabular-nums',
          props.entry.rank === 1 ? 'text-amber-400' :
          props.entry.isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
        )}>
          {formatLeaderboardScore(props.type, props.entry.score)}
        </span>
      </div>
    </div>
  )
}

interface UserRankCardProps {
  rank: number | null
  score: number | null
  type: LeaderboardType
}

const UserRankCard: Component<UserRankCardProps> = (props) => {
  return (
    <Show
      when={props.rank !== null && props.score !== null}
      fallback={
        <div class="p-4 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
          <p class="text-sm text-[var(--text-muted)]">
            Not yet ranked. Start exploring to appear on the leaderboard!
          </p>
        </div>
      }
    >
      {(() => {
        const isTopTen = () => props.rank !== null && props.rank <= 10
        const isTopHundred = () => props.rank !== null && props.rank <= 100

        return (
          <div class={cn(
            'p-4 rounded-xl border',
            isTopTen()
              ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30'
              : isTopHundred()
              ? 'bg-gradient-to-r from-[var(--brand-teal-1)]/10 to-teal-500/10 border-[var(--brand-teal-1)]/30'
              : 'bg-[var(--background-primary)] border-[var(--card-border)]/20'
          )}>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--text-muted)] mb-1">Your Rank</p>
                <div class="flex items-center gap-2">
                  <Show when={isTopTen()}>
                    <Trophy class="h-5 w-5 text-amber-400" />
                  </Show>
                  <span class={cn(
                    'text-2xl font-bold tabular-nums',
                    isTopTen() ? 'text-amber-400' : 'text-[var(--text-primary)]'
                  )}>
                    #{props.rank?.toLocaleString()}
                  </span>
                </div>
              </div>

              <div class="text-right">
                <p class="text-xs text-[var(--text-muted)] mb-1">Your Score</p>
                <span class="text-lg font-bold text-[var(--text-primary)]">
                  {props.score !== null && formatLeaderboardScore(props.type, props.score)}
                </span>
              </div>
            </div>
          </div>
        )
      })()}
    </Show>
  )
}

/**
 * LeaderboardPanel - Rankings display with tabs for different leaderboard types
 */
export const LeaderboardPanel: Component = () => {
  const activeLeaderboard = () => rewardStore.activeLeaderboard
  const activeType = () => rewardStore.leaderboardType
  const isLoading = () => rewardStore.isLoadingLeaderboard

  // Fetch leaderboard on mount
  onMount(() => {
    rewardStore.fetchLeaderboard(activeType())
  })

  const handleTabChange = (value: string) => {
    rewardStore.setActiveLeaderboardType(value as LeaderboardType)
  }

  const handleRefresh = () => {
    rewardStore.fetchLeaderboard(activeType())
  }

  return (
    <div class="bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]/30 overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div class="p-4 border-b border-[var(--card-border)]/20">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-amber-500/20">
              <Trophy class="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 class="font-bold text-[var(--text-primary)]">Leaderboard</h3>
              <p class="text-xs text-[var(--text-muted)]">
                {getLeaderboardTypeLabel(activeType())}
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading()}
            class={cn(
              'p-2 rounded-lg transition-colors',
              'bg-[var(--background-primary)] hover:bg-[var(--background-primary)]/80',
              isLoading() && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshCw class={cn('h-4 w-4 text-[var(--text-muted)]', isLoading() && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeType()} onValueChange={handleTabChange}>
        <TabsList class="w-full px-4 pt-4 bg-transparent">
          <TabsTrigger value="weekly_agi" class="flex-1 text-xs">
            <Sparkles class="h-3.5 w-3.5 mr-1.5" />
            Weekly AGI
          </TabsTrigger>
          <TabsTrigger value="total_discoveries" class="flex-1 text-xs">
            <Brain class="h-3.5 w-3.5 mr-1.5" />
            Discoveries
          </TabsTrigger>
          <TabsTrigger value="brain_level" class="flex-1 text-xs">
            <Trophy class="h-3.5 w-3.5 mr-1.5" />
            Brain Level
          </TabsTrigger>
        </TabsList>

        <div class="p-4">
          {/* User's Rank Card */}
          <Show when={activeLeaderboard()}>
            {(leaderboard) => (
              <div class="mb-4">
                <UserRankCard
                  rank={leaderboard().userRank}
                  score={leaderboard().userScore}
                  type={activeType()}
                />
              </div>
            )}
          </Show>

          {/* Loading State */}
          <Show when={isLoading()}>
            <div class="space-y-2">
              <For each={[...Array(5)]}>
                {(_, i) => (
                  <div class="h-14 rounded-xl bg-[var(--background-primary)] animate-pulse" />
                )}
              </For>
            </div>
          </Show>

          {/* Leaderboard Entries */}
          <Show when={!isLoading() && activeLeaderboard()}>
            {(leaderboard) => (
              <div class="space-y-2">
                <For each={leaderboard().entries.slice(0, 10)}>
                  {(entry, index) => (
                    <LeaderboardRow
                      entry={entry}
                      type={activeType()}
                      index={index()}
                    />
                  )}
                </For>

                <Show when={leaderboard().entries.length === 0}>
                  <div class="text-center py-8">
                    <Trophy class="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
                    <p class="text-[var(--text-muted)]">No rankings yet</p>
                    <p class="text-xs text-[var(--text-muted)] mt-1">
                      Be the first to explore and claim your spot!
                    </p>
                  </div>
                </Show>
              </div>
            )}
          </Show>

          {/* Last Updated */}
          <Show when={activeLeaderboard()}>
            {(leaderboard) => (
              <p class="text-xs text-[var(--text-muted)] text-center mt-4">
                Updated {new Date(leaderboard().lastUpdated).toLocaleTimeString()}
              </p>
            )}
          </Show>
        </div>
      </Tabs>
    </div>
  )
}

/**
 * LeaderboardMini - Compact leaderboard for sidebar
 */
interface LeaderboardMiniProps {
  class?: string
  maxEntries?: number
}

export const LeaderboardMini: Component<LeaderboardMiniProps> = (props) => {
  const activeLeaderboard = () => rewardStore.activeLeaderboard
  const activeType = () => rewardStore.leaderboardType

  onMount(() => {
    rewardStore.fetchLeaderboard(activeType())
  })

  const maxEntries = () => props.maxEntries ?? 3

  return (
    <Show when={activeLeaderboard() && activeLeaderboard()!.entries.length > 0}>
      {(leaderboard) => (
        <div class={cn(
          'p-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20',
          props.class
        )}>
          <div class="flex items-center gap-2 mb-3">
            <Trophy class="h-4 w-4 text-amber-400" />
            <span class="text-sm font-medium text-[var(--text-primary)]">Top Explorers</span>
          </div>

          <div class="space-y-2">
            <For each={leaderboard().entries.slice(0, maxEntries())}>
              {(entry, index) => (
                <div
                  class={cn(
                    'flex items-center justify-between py-1',
                    entry.isCurrentUser && 'text-[var(--brand-teal-1)]'
                  )}
                >
                  <div class="flex items-center gap-2">
                    <span class={cn(
                      'text-xs font-bold w-5',
                      index() === 0 ? 'text-amber-400' : 'text-[var(--text-muted)]'
                    )}>
                      #{entry.rank}
                    </span>
                    <span class="text-sm truncate max-w-[100px]">
                      {entry.userName}
                    </span>
                  </div>
                  <span class="text-sm font-medium tabular-nums">
                    {formatLeaderboardScore(activeType(), entry.score)}
                  </span>
                </div>
              )}
            </For>
          </div>

          <Show when={leaderboard().userRank && leaderboard().userRank! > maxEntries()}>
            <div class="mt-2 pt-2 border-t border-[var(--card-border)]/20">
              <div class="flex items-center justify-between text-[var(--brand-teal-1)]">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold w-5">#{leaderboard().userRank}</span>
                  <span class="text-sm">You</span>
                </div>
                <span class="text-sm font-medium tabular-nums">
                  {leaderboard().userScore !== null && formatLeaderboardScore(activeType(), leaderboard().userScore!)}
                </span>
              </div>
            </div>
          </Show>
        </div>
      )}
    </Show>
  )
}

/**
 * RankChange - Shows rank movement indicator
 */
interface RankChangeProps {
  change: number
  class?: string
}

export const RankChange: Component<RankChangeProps> = (props) => {
  return (
    <Show
      when={props.change !== 0}
      fallback={<span class={cn('text-xs text-[var(--text-muted)]', props.class)}>-</span>}
    >
      {(() => {
        const isPositive = () => props.change > 0

        return (
          <div class={cn(
            'flex items-center gap-0.5 text-xs',
            isPositive() ? 'text-green-400' : 'text-red-400',
            props.class
          )}>
            <Show when={isPositive()} fallback={<ChevronDown class="h-3 w-3" />}>
              <ChevronUp class="h-3 w-3" />
            </Show>
            <span class="font-medium">{Math.abs(props.change)}</span>
          </div>
        )
      })()}
    </Show>
  )
}
