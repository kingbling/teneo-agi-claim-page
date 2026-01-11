/**
 * LeaderboardList - Displays a list of leaderboard entries
 */

import { LeaderboardEntry } from './LeaderboardEntry'

export interface LeaderboardEntryData {
  rank: number
  userId: string
  username: string
  value: number
  valueLabel: string
  change?: number
}

interface LeaderboardListProps {
  entries: LeaderboardEntryData[]
  currentUserId?: string | null
  userPosition?: LeaderboardEntryData | null
  isLoading?: boolean
  emptyMessage?: string
}

export function LeaderboardList({
  entries,
  currentUserId,
  userPosition,
  isLoading = false,
  emptyMessage = 'No entries yet',
}: LeaderboardListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 bg-white/5 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  // Check if current user is in the visible list
  const userInList = currentUserId
    ? entries.some(e => e.userId === currentUserId)
    : false

  return (
    <div className="space-y-1.5">
      {/* Main entries */}
      {entries.map((entry) => (
        <LeaderboardEntry
          key={entry.userId}
          rank={entry.rank}
          username={entry.username}
          value={entry.valueLabel}
          isCurrentUser={entry.userId === currentUserId}
          change={entry.change}
        />
      ))}

      {/* User position (if not in visible list) */}
      {userPosition && !userInList && (
        <>
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500">Your Position</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <LeaderboardEntry
            rank={userPosition.rank}
            username={userPosition.username}
            value={userPosition.valueLabel}
            isCurrentUser
            change={userPosition.change}
          />
        </>
      )}
    </div>
  )
}
