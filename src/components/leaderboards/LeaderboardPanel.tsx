/**
 * LeaderboardPanel - Main leaderboard container with type selector
 */

import { useState, useEffect, useCallback } from 'react'
import { LeaderboardList, type LeaderboardEntryData } from './LeaderboardList'

const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set')
}

type LeaderboardType = 'weekly_agi' | 'total_discoveries' | 'brain_level'

interface LeaderboardConfig {
  type: LeaderboardType
  label: string
  icon: string
  description: string
}

const LEADERBOARD_CONFIGS: LeaderboardConfig[] = [
  {
    type: 'weekly_agi',
    label: 'Weekly AGI',
    icon: '$',
    description: 'Top earners this week',
  },
  {
    type: 'total_discoveries',
    label: 'Discoveries',
    icon: '*',
    description: 'All-time synapse discoveries',
  },
  {
    type: 'brain_level',
    label: 'Brain Level',
    icon: 'L',
    description: 'Highest brain levels',
  },
]

interface LeaderboardPanelProps {
  userId?: string | null
  className?: string
  initialType?: LeaderboardType
  showTypeSelector?: boolean
  limit?: number
}

export function LeaderboardPanel({
  userId,
  className = '',
  initialType = 'weekly_agi',
  showTypeSelector = true,
  limit = 10,
}: LeaderboardPanelProps) {
  const [activeType, setActiveType] = useState<LeaderboardType>(initialType)
  const [entries, setEntries] = useState<LeaderboardEntryData[]>([])
  const [userPosition, setUserPosition] = useState<LeaderboardEntryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalParticipants, setTotalParticipants] = useState(0)

  const fetchLeaderboard = useCallback(async (type: LeaderboardType) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(userId && { userId }),
      })

      const response = await fetch(`${API_URL}/api/leaderboards/${type}?${params}`)
      if (!response.ok) throw new Error('Failed to fetch leaderboard')

      const data = await response.json()

      setEntries(data.entries || [])
      setUserPosition(data.userPosition || null)
      setTotalParticipants(data.totalParticipants || 0)
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err)
      setError('Failed to load leaderboard')
      setEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [limit, userId])

  useEffect(() => {
    fetchLeaderboard(activeType)
  }, [activeType, fetchLeaderboard])

  const activeConfig = LEADERBOARD_CONFIGS.find(c => c.type === activeType)!

  return (
    <div className={`bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Leaderboard</h3>
            <p className="text-xs text-gray-400">{activeConfig.description}</p>
          </div>
          {totalParticipants > 0 && (
            <div className="text-xs text-gray-500">
              {totalParticipants.toLocaleString()} participants
            </div>
          )}
        </div>

        {/* Type Selector */}
        {showTypeSelector && (
          <div className="flex gap-1 mt-3">
            {LEADERBOARD_CONFIGS.map((config) => (
              <button
                key={config.type}
                onClick={() => setActiveType(config.type)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeType === config.type
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                }`}
              >
                <span className="mr-1 opacity-60">{config.icon}</span>
                {config.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {error ? (
          <div className="text-center py-4 text-red-400 text-sm">
            {error}
            <button
              onClick={() => fetchLeaderboard(activeType)}
              className="block mx-auto mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Retry
            </button>
          </div>
        ) : (
          <LeaderboardList
            entries={entries}
            currentUserId={userId}
            userPosition={userPosition}
            isLoading={isLoading}
            emptyMessage="Be the first to claim the top spot!"
          />
        )}
      </div>

      {/* Footer */}
      {!isLoading && entries.length > 0 && (
        <div className="px-4 py-2 border-t border-white/10">
          <button
            onClick={() => fetchLeaderboard(activeType)}
            className="w-full text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  )
}
