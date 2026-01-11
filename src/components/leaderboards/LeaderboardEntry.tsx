/**
 * LeaderboardEntry - Individual row in the leaderboard
 */

interface LeaderboardEntryProps {
  rank: number
  username: string
  value: string
  isCurrentUser?: boolean
  avatarUrl?: string
  change?: number
}

export function LeaderboardEntry({
  rank,
  username,
  value,
  isCurrentUser = false,
  change,
}: LeaderboardEntryProps) {
  // Rank styling
  const getRankStyle = () => {
    if (rank === 1) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
    if (rank === 2) return 'bg-gray-400/20 text-gray-300 border-gray-400/50'
    if (rank === 3) return 'bg-amber-600/20 text-amber-500 border-amber-600/50'
    return 'bg-white/5 text-gray-400 border-white/10'
  }

  const getRankEmoji = () => {
    if (rank === 1) return '1st'
    if (rank === 2) return '2nd'
    if (rank === 3) return '3rd'
    return `${rank}th`
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isCurrentUser
          ? 'bg-blue-500/20 border border-blue-500/50'
          : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {/* Rank Badge */}
      <div
        className={`w-10 h-10 flex items-center justify-center rounded-lg text-xs font-bold border ${getRankStyle()}`}
      >
        {getRankEmoji()}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-medium truncate ${
              isCurrentUser ? 'text-blue-300' : 'text-white'
            }`}
          >
            {username}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded">
              YOU
            </span>
          )}
        </div>
        {change !== undefined && change !== 0 && (
          <div
            className={`text-xs ${
              change > 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {change > 0 ? `+${change}` : change}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-right">
        <div className={`font-mono font-bold ${isCurrentUser ? 'text-blue-300' : 'text-white'}`}>
          {value}
        </div>
      </div>
    </div>
  )
}
