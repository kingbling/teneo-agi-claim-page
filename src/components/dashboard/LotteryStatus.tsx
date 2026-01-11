import { motion, AnimatePresence } from 'framer-motion'
import { Ticket, Trophy, Users, TrendingUp, Sparkles, Gift } from 'lucide-react'
import { useRewardStore } from '@/stores/rewardStore'
import { useUserStore } from '@/stores/userStore'
import { useEventStore } from '@/stores/eventStore'
import type { LotteryResult } from '@/stores/rewardStore'
import { cn } from '@/lib/utils'
import { formatPoints } from '@/types/game'
import { useState } from 'react'

interface LotteryStatusProps {
  compact?: boolean
  showRecentWinners?: boolean
  className?: string
}

/**
 * LotteryStatus - Displays current lottery status and user participation
 * Masterplan 2026: Shows lottery tickets, odds, and recent winners
 */
export function LotteryStatus({
  compact = false,
  showRecentWinners = true,
  className,
}: LotteryStatusProps) {
  const { lotteryTickets } = useUserStore()
  const {
    lotteryResults,
    useLotteryTickets,
  } = useRewardStore()
  const { getTotalMultiplier, activeEvents } = useEventStore()

  const [isUsingTickets, setIsUsingTickets] = useState(false)
  const [ticketsToUse, setTicketsToUse] = useState(1)

  // Calculate odds based on contribution and event multipliers
  const calculateOdds = (): number => {
    // Base odds + bonus from lottery tickets
    const baseOdds = 5 // 5% base odds
    const ticketBonus = Math.min(ticketsToUse * 2, 20) // +2% per ticket, max +20%
    const baseTotal = baseOdds + ticketBonus

    // Apply event multiplier for lottery_odds
    const eventMultiplier = getTotalMultiplier('lottery_odds')

    // Cap at 95% max odds
    return Math.min(95, Math.round(baseTotal * eventMultiplier * 10) / 10)
  }

  // Check if there's an active lottery event
  const hasLotteryEvent = activeEvents.some(e =>
    e.multipliers.some(m => m.type === 'lottery_odds')
  )

  const handleUseLotteryTickets = async () => {
    if (lotteryTickets < ticketsToUse) return

    setIsUsingTickets(true)
    try {
      const success = await useLotteryTickets(ticketsToUse)
      if (success) {
        // Tickets used successfully - odds are improved for next lottery
        console.log(`Used ${ticketsToUse} lottery tickets`)
      }
    } finally {
      setIsUsingTickets(false)
    }
  }

  const odds = calculateOdds()

  if (compact) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
          'bg-gradient-to-r from-[var(--background-secondary)] to-[var(--background-primary)]',
          hasLotteryEvent ? 'border-amber-500/50' : 'border-[var(--card-border)]/30',
          className
        )}
      >
        <Ticket className="h-4 w-4 text-amber-400" />
        <span className="font-bold text-amber-400">{lotteryTickets}</span>
        <span className="text-xs text-[var(--text-muted)]">tickets</span>
        <div className="w-px h-4 bg-[var(--card-border)]/50" />
        <span className={cn(
          'text-xs',
          hasLotteryEvent ? 'text-amber-400 font-medium' : 'text-[var(--text-muted)]'
        )}>
          {odds}% odds{hasLotteryEvent && ' 🔥'}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20">
            <Ticket className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-lg text-[var(--text-primary)]">Lottery Status</p>
            <p className="text-sm text-[var(--text-muted)]">Boost your winning chances</p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400">
          {lotteryTickets} Tickets
        </div>
      </div>

      {/* Tickets & Odds */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Tickets Available */}
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-[var(--text-muted)]">Available</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{lotteryTickets}</p>
        </div>

        {/* Current Odds */}
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-sm text-[var(--text-muted)]">Win Odds</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{odds}%</p>
        </div>
      </div>

      {/* Use Tickets */}
      {lotteryTickets > 0 && (
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 mb-4">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Use Lottery Tickets
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setTicketsToUse(Math.max(1, ticketsToUse - 1))}
                className="p-1.5 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--card-border)]/30 text-[var(--text-primary)] transition-colors"
                disabled={ticketsToUse <= 1}
              >
                -
              </button>
              <span className="flex-1 text-center font-bold text-[var(--text-primary)]">
                {ticketsToUse}
              </span>
              <button
                onClick={() => setTicketsToUse(Math.min(lotteryTickets, ticketsToUse + 1))}
                className="p-1.5 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--card-border)]/30 text-[var(--text-primary)] transition-colors"
                disabled={ticketsToUse >= lotteryTickets}
              >
                +
              </button>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleUseLotteryTickets}
              disabled={isUsingTickets || lotteryTickets < ticketsToUse}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-all',
                'bg-gradient-to-r from-amber-500 to-amber-600',
                'hover:from-amber-600 hover:to-amber-700',
                'text-white shadow-lg shadow-amber-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isUsingTickets ? 'Using...' : 'Use Tickets'}
            </motion.button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            +{ticketsToUse * 2}% bonus odds for next lottery draw
          </p>
        </div>
      )}

      {/* Recent Winners */}
      {showRecentWinners && lotteryResults.length > 0 && (
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            Recent Winners
          </p>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {lotteryResults.slice(0, 5).map((result) => (
                <LotteryWinnerCard key={result.id} result={result} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* No Winners Yet */}
      {showRecentWinners && lotteryResults.length === 0 && (
        <div className="text-center py-4">
          <Gift className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-muted)]">No lottery results yet</p>
          <p className="text-xs text-[var(--text-muted)]">Complete synapses to trigger lotteries</p>
        </div>
      )}
    </motion.div>
  )
}

interface LotteryWinnerCardProps {
  result: LotteryResult
}

function LotteryWinnerCard({ result }: LotteryWinnerCardProps) {
  const timeAgo = getTimeAgo(result.timestamp)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        'p-3 rounded-lg border transition-colors',
        result.userWon
          ? 'bg-yellow-500/10 border-yellow-500/30'
          : 'bg-[var(--background-primary)] border-[var(--card-border)]/20'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {result.userWon ? (
            <Trophy className="h-4 w-4 text-yellow-400" />
          ) : (
            <Users className="h-4 w-4 text-[var(--text-muted)]" />
          )}
          <div>
            <p className={cn(
              'text-sm font-medium',
              result.userWon ? 'text-yellow-400' : 'text-[var(--text-primary)]'
            )}>
              {result.userWon ? 'You won!' : result.winnerName}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {result.synapseType} synapse
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-[var(--brand-teal-1)]">
            +{formatPoints(result.agiReward)} AGI
          </p>
          <p className="text-xs text-[var(--text-muted)]">{timeAgo}</p>
        </div>
      </div>

      {/* Contribution bar */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
          <span>Contribution</span>
          <span>{result.winnerContribution.toFixed(1)}%</span>
        </div>
        <div className="h-1 rounded-full bg-[var(--background-secondary)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--brand-teal-1)]"
            style={{ width: `${result.winnerContribution}%` }}
          />
        </div>
      </div>

      {/* Consolation tickets */}
      {!result.userWon && result.userConsolationTickets > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
          <Ticket className="h-3 w-3" />
          <span>+{result.userConsolationTickets} consolation tickets</span>
        </div>
      )}
    </motion.div>
  )
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * LotteryStatusMini - Minimal version for headers
 */
export function LotteryStatusMini() {
  const { lotteryTickets } = useUserStore()

  return (
    <div className="flex items-center gap-2">
      <Ticket className="h-4 w-4 text-amber-400" />
      <span className="text-sm font-bold text-amber-400">{lotteryTickets}</span>
    </div>
  )
}
