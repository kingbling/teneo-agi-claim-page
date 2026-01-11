import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Brain, Sparkles, RefreshCw, Crown, Medal, Award, ChevronUp, ChevronDown } from 'lucide-react'
import {
  useRewardStore,
  selectActiveLeaderboard,
  selectLeaderboardType,
  selectIsLoadingLeaderboard,
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

function LeaderboardRow({ entry, type, index }: LeaderboardRowProps) {
  const RankIcon = RANK_ICONS[entry.rank]
  const rankColor = RANK_COLORS[entry.rank] || 'text-[var(--text-muted)]'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl',
        entry.isCurrentUser
          ? 'bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30'
          : 'bg-[var(--background-primary)]',
        entry.rank <= 3 && !entry.isCurrentUser && 'bg-gradient-to-r from-[var(--background-primary)] to-transparent'
      )}
    >
      {/* Rank */}
      <div className={cn(
        'w-8 h-8 flex items-center justify-center rounded-lg',
        entry.rank <= 3 ? 'bg-[var(--background-secondary)]' : ''
      )}>
        {RankIcon ? (
          <RankIcon className={cn('h-5 w-5', rankColor)} />
        ) : (
          <span className="text-sm font-bold text-[var(--text-muted)]">
            #{entry.rank}
          </span>
        )}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium truncate',
            entry.isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
          )}>
            {entry.userName}
            {entry.isCurrentUser && ' (You)'}
          </span>
          {entry.brainLevel && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background-secondary)] text-[var(--text-muted)]">
              Lv.{entry.brainLevel}
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="text-right">
        <span className={cn(
          'font-bold tabular-nums',
          entry.rank === 1 ? 'text-amber-400' :
          entry.isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
        )}>
          {formatLeaderboardScore(type, entry.score)}
        </span>
      </div>
    </motion.div>
  )
}

interface UserRankCardProps {
  rank: number | null
  score: number | null
  type: LeaderboardType
}

function UserRankCard({ rank, score, type }: UserRankCardProps) {
  if (rank === null || score === null) {
    return (
      <div className="p-4 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          Not yet ranked. Start exploring to appear on the leaderboard!
        </p>
      </div>
    )
  }

  const isTopTen = rank <= 10
  const isTopHundred = rank <= 100

  return (
    <div className={cn(
      'p-4 rounded-xl border',
      isTopTen
        ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30'
        : isTopHundred
        ? 'bg-gradient-to-r from-[var(--brand-teal-1)]/10 to-teal-500/10 border-[var(--brand-teal-1)]/30'
        : 'bg-[var(--background-primary)] border-[var(--card-border)]/20'
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1">Your Rank</p>
          <div className="flex items-center gap-2">
            {isTopTen && <Trophy className="h-5 w-5 text-amber-400" />}
            <span className={cn(
              'text-2xl font-bold tabular-nums',
              isTopTen ? 'text-amber-400' : 'text-[var(--text-primary)]'
            )}>
              #{rank.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-[var(--text-muted)] mb-1">Your Score</p>
          <span className="text-lg font-bold text-[var(--text-primary)]">
            {formatLeaderboardScore(type, score)}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * LeaderboardPanel - Rankings display with tabs for different leaderboard types
 */
export function LeaderboardPanel() {
  const activeLeaderboard = useRewardStore(selectActiveLeaderboard)
  const activeType = useRewardStore(selectLeaderboardType)
  const isLoading = useRewardStore(selectIsLoadingLeaderboard)
  const fetchLeaderboard = useRewardStore((state) => state.fetchLeaderboard)
  const setActiveLeaderboardType = useRewardStore((state) => state.setActiveLeaderboardType)

  // Fetch leaderboard on mount
  useEffect(() => {
    fetchLeaderboard(activeType)
  }, [])

  const handleTabChange = useCallback((value: string) => {
    setActiveLeaderboardType(value as LeaderboardType)
  }, [setActiveLeaderboardType])

  const handleRefresh = useCallback(() => {
    fetchLeaderboard(activeType)
  }, [fetchLeaderboard, activeType])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]/30 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--card-border)]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Trophy className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">Leaderboard</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {getLeaderboardTypeLabel(activeType)}
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'bg-[var(--background-primary)] hover:bg-[var(--background-primary)]/80',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('h-4 w-4 text-[var(--text-muted)]', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeType} onValueChange={handleTabChange}>
        <TabsList className="w-full px-4 pt-4 bg-transparent">
          <TabsTrigger value="weekly_agi" className="flex-1 text-xs">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Weekly AGI
          </TabsTrigger>
          <TabsTrigger value="total_discoveries" className="flex-1 text-xs">
            <Brain className="h-3.5 w-3.5 mr-1.5" />
            Discoveries
          </TabsTrigger>
          <TabsTrigger value="brain_level" className="flex-1 text-xs">
            <Trophy className="h-3.5 w-3.5 mr-1.5" />
            Brain Level
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          {/* User's Rank Card */}
          {activeLeaderboard && (
            <div className="mb-4">
              <UserRankCard
                rank={activeLeaderboard.userRank}
                score={activeLeaderboard.userScore}
                type={activeType}
              />
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-[var(--background-primary)] animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Leaderboard Entries */}
          {!isLoading && activeLeaderboard && (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {activeLeaderboard.entries.slice(0, 10).map((entry, index) => (
                  <LeaderboardRow
                    key={entry.userId}
                    entry={entry}
                    type={activeType}
                    index={index}
                  />
                ))}
              </AnimatePresence>

              {activeLeaderboard.entries.length === 0 && (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
                  <p className="text-[var(--text-muted)]">No rankings yet</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Be the first to explore and claim your spot!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Last Updated */}
          {activeLeaderboard && (
            <p className="text-xs text-[var(--text-muted)] text-center mt-4">
              Updated {new Date(activeLeaderboard.lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </div>
      </Tabs>
    </motion.div>
  )
}

/**
 * LeaderboardMini - Compact leaderboard for sidebar
 */
interface LeaderboardMiniProps {
  className?: string
  maxEntries?: number
}

export function LeaderboardMini({ className, maxEntries = 3 }: LeaderboardMiniProps) {
  const activeLeaderboard = useRewardStore(selectActiveLeaderboard)
  const activeType = useRewardStore(selectLeaderboardType)
  const fetchLeaderboard = useRewardStore((state) => state.fetchLeaderboard)

  useEffect(() => {
    fetchLeaderboard(activeType)
  }, [])

  if (!activeLeaderboard || activeLeaderboard.entries.length === 0) {
    return null
  }

  return (
    <div className={cn(
      'p-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20',
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-medium text-[var(--text-primary)]">Top Explorers</span>
      </div>

      <div className="space-y-2">
        {activeLeaderboard.entries.slice(0, maxEntries).map((entry, index) => (
          <div
            key={entry.userId}
            className={cn(
              'flex items-center justify-between py-1',
              entry.isCurrentUser && 'text-[var(--brand-teal-1)]'
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xs font-bold w-5',
                index === 0 ? 'text-amber-400' : 'text-[var(--text-muted)]'
              )}>
                #{entry.rank}
              </span>
              <span className="text-sm truncate max-w-[100px]">
                {entry.userName}
              </span>
            </div>
            <span className="text-sm font-medium tabular-nums">
              {formatLeaderboardScore(activeType, entry.score)}
            </span>
          </div>
        ))}
      </div>

      {activeLeaderboard.userRank && activeLeaderboard.userRank > maxEntries && (
        <div className="mt-2 pt-2 border-t border-[var(--card-border)]/20">
          <div className="flex items-center justify-between text-[var(--brand-teal-1)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold w-5">#{activeLeaderboard.userRank}</span>
              <span className="text-sm">You</span>
            </div>
            <span className="text-sm font-medium tabular-nums">
              {activeLeaderboard.userScore !== null && formatLeaderboardScore(activeType, activeLeaderboard.userScore)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * RankChange - Shows rank movement indicator
 */
interface RankChangeProps {
  change: number
  className?: string
}

export function RankChange({ change, className }: RankChangeProps) {
  if (change === 0) {
    return <span className={cn('text-xs text-[var(--text-muted)]', className)}>-</span>
  }

  const isPositive = change > 0

  return (
    <div className={cn(
      'flex items-center gap-0.5 text-xs',
      isPositive ? 'text-green-400' : 'text-red-400',
      className
    )}>
      {isPositive ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )}
      <span className="font-medium">{Math.abs(change)}</span>
    </div>
  )
}
