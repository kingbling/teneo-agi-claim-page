import { Show, For, createSignal, createMemo } from 'solid-js'
import { Ticket, Trophy, Users, TrendingUp, Sparkles, Gift } from 'lucide-solid'
import { rewardStore } from '@/stores/rewardStore'
import { userStore } from '@/stores/userStore'
import { eventStore } from '@/stores/eventStore'
import type { LotteryResult } from '@/stores/rewardStore'
import { cn } from '@/lib/utils'
import { formatPoints } from '@/types/game'

interface LotteryStatusProps {
  compact?: boolean
  showRecentWinners?: boolean
  class?: string
}

/**
 * LotteryStatus - Displays current lottery status and user participation
 * Masterplan 2026: Shows lottery tickets, odds, and recent winners
 */
export function LotteryStatus(props: LotteryStatusProps) {
  const compact = () => props.compact ?? false
  const showRecentWinners = () => props.showRecentWinners ?? true

  const [isUsingTickets, setIsUsingTickets] = createSignal(false)
  const [ticketsToUse, setTicketsToUse] = createSignal(1)

  // Calculate odds based on contribution and event multipliers
  const calculateOdds = (): number => {
    // Base odds + bonus from lottery tickets
    const baseOdds = 5 // 5% base odds
    const ticketBonus = Math.min(ticketsToUse() * 2, 20) // +2% per ticket, max +20%
    const baseTotal = baseOdds + ticketBonus

    // Apply event multiplier for lottery_odds
    const eventMultiplier = eventStore.getTotalMultiplier('lottery_odds')

    // Cap at 95% max odds
    return Math.min(95, Math.round(baseTotal * eventMultiplier * 10) / 10)
  }

  // Check if there's an active lottery event
  const hasLotteryEvent = createMemo(() =>
    eventStore.activeEvents.some(e =>
      e.multipliers.some(m => m.type === 'lottery_odds')
    )
  )

  const handleUseLotteryTickets = async () => {
    if (userStore.lotteryTickets < ticketsToUse()) return

    setIsUsingTickets(true)
    try {
      const success = await rewardStore.useLotteryTickets(ticketsToUse())
      if (success) {
        // Tickets used successfully - odds are improved for next lottery
        console.log(`Used ${ticketsToUse()} lottery tickets`)
      }
    } finally {
      setIsUsingTickets(false)
    }
  }

  const odds = createMemo(() => calculateOdds())

  return (
    <Show when={!compact()} fallback={<CompactView odds={odds()} hasLotteryEvent={hasLotteryEvent()} class={props.class} />}>
      <FullView
        odds={odds()}
        hasLotteryEvent={hasLotteryEvent()}
        ticketsToUse={ticketsToUse()}
        setTicketsToUse={setTicketsToUse}
        isUsingTickets={isUsingTickets()}
        onUseTickets={handleUseLotteryTickets}
        showRecentWinners={showRecentWinners()}
        class={props.class}
      />
    </Show>
  )
}

interface CompactViewProps {
  odds: number
  hasLotteryEvent: boolean
  class?: string
}

function CompactView(props: CompactViewProps) {
  return (
    <div
      class={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border scale-in',
        'bg-gradient-to-r from-[var(--background-secondary)] to-[var(--background-primary)]',
        props.hasLotteryEvent ? 'border-amber-500/50' : 'border-[var(--card-border)]/30',
        props.class
      )}
    >
      <Ticket class="h-4 w-4 text-amber-400" />
      <span class="font-bold text-amber-400">{userStore.lotteryTickets}</span>
      <span class="text-xs text-[var(--text-muted)]">tickets</span>
      <div class="w-px h-4 bg-[var(--card-border)]/50" />
      <span class={cn(
        'text-xs',
        props.hasLotteryEvent ? 'text-amber-400 font-medium' : 'text-[var(--text-muted)]'
      )}>
        {props.odds}% odds{props.hasLotteryEvent && ' (boosted)'}
      </span>
    </div>
  )
}

interface FullViewProps {
  odds: number
  hasLotteryEvent: boolean
  ticketsToUse: number
  setTicketsToUse: (v: number) => void
  isUsingTickets: boolean
  onUseTickets: () => void
  showRecentWinners: boolean
  class?: string
}

function FullView(props: FullViewProps) {
  return (
    <div
      class={cn(
        'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30 fade-in-up',
        props.class
      )}
    >
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-amber-500/20">
            <Ticket class="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <p class="font-bold text-lg text-[var(--text-primary)]">Lottery Status</p>
            <p class="text-sm text-[var(--text-muted)]">Boost your winning chances</p>
          </div>
        </div>
        <div class="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400">
          {userStore.lotteryTickets} Tickets
        </div>
      </div>

      {/* Tickets & Odds */}
      <div class="grid grid-cols-2 gap-3 mb-4">
        {/* Tickets Available */}
        <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
          <div class="flex items-center gap-2 mb-1">
            <Ticket class="h-4 w-4 text-amber-400" />
            <span class="text-sm text-[var(--text-muted)]">Available</span>
          </div>
          <p class="text-2xl font-bold text-[var(--text-primary)]">{userStore.lotteryTickets}</p>
        </div>

        {/* Current Odds */}
        <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
          <div class="flex items-center gap-2 mb-1">
            <TrendingUp class="h-4 w-4 text-green-400" />
            <span class="text-sm text-[var(--text-muted)]">Win Odds</span>
          </div>
          <p class="text-2xl font-bold text-green-400">{props.odds}%</p>
        </div>
      </div>

      {/* Use Tickets */}
      <Show when={userStore.lotteryTickets > 0}>
        <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 mb-4">
          <p class="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-amber-400" />
            Use Lottery Tickets
          </p>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 flex-1">
              <button
                onClick={() => props.setTicketsToUse(Math.max(1, props.ticketsToUse - 1))}
                class="p-1.5 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--card-border)]/30 text-[var(--text-primary)] transition-colors"
                disabled={props.ticketsToUse <= 1}
              >
                -
              </button>
              <span class="flex-1 text-center font-bold text-[var(--text-primary)]">
                {props.ticketsToUse}
              </span>
              <button
                onClick={() => props.setTicketsToUse(Math.min(userStore.lotteryTickets, props.ticketsToUse + 1))}
                class="p-1.5 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--card-border)]/30 text-[var(--text-primary)] transition-colors"
                disabled={props.ticketsToUse >= userStore.lotteryTickets}
              >
                +
              </button>
            </div>
            <button
              onClick={props.onUseTickets}
              disabled={props.isUsingTickets || userStore.lotteryTickets < props.ticketsToUse}
              class={cn(
                'px-4 py-2 rounded-lg font-medium transition-all',
                'bg-gradient-to-r from-amber-500 to-amber-600',
                'hover:from-amber-600 hover:to-amber-700 hover:scale-102 active:scale-98',
                'text-white shadow-lg shadow-amber-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {props.isUsingTickets ? 'Using...' : 'Use Tickets'}
            </button>
          </div>
          <p class="text-xs text-[var(--text-muted)] mt-2">
            +{props.ticketsToUse * 2}% bonus odds for next lottery draw
          </p>
        </div>
      </Show>

      {/* Recent Winners */}
      <Show when={props.showRecentWinners && rewardStore.lotteryResults.length > 0}>
        <div>
          <p class="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Trophy class="h-4 w-4 text-yellow-400" />
            Recent Winners
          </p>
          <div class="space-y-2 max-h-[200px] overflow-y-auto">
            <For each={rewardStore.lotteryResults.slice(0, 5)}>
              {(result) => <LotteryWinnerCard result={result} />}
            </For>
          </div>
        </div>
      </Show>

      {/* No Winners Yet */}
      <Show when={props.showRecentWinners && rewardStore.lotteryResults.length === 0}>
        <div class="text-center py-4">
          <Gift class="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
          <p class="text-sm text-[var(--text-muted)]">No lottery results yet</p>
          <p class="text-xs text-[var(--text-muted)]">Complete synapses to trigger lotteries</p>
        </div>
      </Show>
    </div>
  )
}

interface LotteryWinnerCardProps {
  result: LotteryResult
}

function LotteryWinnerCard(props: LotteryWinnerCardProps) {
  const timeAgo = () => getTimeAgo(props.result.timestamp)

  return (
    <div
      class={cn(
        'p-3 rounded-lg border transition-colors slide-in-left',
        props.result.userWon
          ? 'bg-yellow-500/10 border-yellow-500/30'
          : 'bg-[var(--background-primary)] border-[var(--card-border)]/20'
      )}
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Show
            when={props.result.userWon}
            fallback={<Users class="h-4 w-4 text-[var(--text-muted)]" />}
          >
            <Trophy class="h-4 w-4 text-yellow-400" />
          </Show>
          <div>
            <p class={cn(
              'text-sm font-medium',
              props.result.userWon ? 'text-yellow-400' : 'text-[var(--text-primary)]'
            )}>
              {props.result.userWon ? 'You won!' : props.result.winnerName}
            </p>
            <p class="text-xs text-[var(--text-muted)]">
              {props.result.synapseType} synapse
            </p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-bold text-[var(--brand-teal-1)]">
            +{formatPoints(props.result.agiReward)} AGI
          </p>
          <p class="text-xs text-[var(--text-muted)]">{timeAgo()}</p>
        </div>
      </div>

      {/* Contribution bar */}
      <div class="mt-2">
        <div class="flex justify-between text-xs text-[var(--text-muted)] mb-1">
          <span>Contribution</span>
          <span>{props.result.winnerContribution.toFixed(1)}%</span>
        </div>
        <div class="h-1 rounded-full bg-[var(--background-secondary)] overflow-hidden">
          <div
            class="h-full rounded-full bg-[var(--brand-teal-1)] transition-[width] duration-500"
            style={{ width: `${props.result.winnerContribution}%` }}
          />
        </div>
      </div>

      {/* Consolation tickets */}
      <Show when={!props.result.userWon && props.result.userConsolationTickets > 0}>
        <div class="mt-2 flex items-center gap-1 text-xs text-amber-400">
          <Ticket class="h-3 w-3" />
          <span>+{props.result.userConsolationTickets} consolation tickets</span>
        </div>
      </Show>
    </div>
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
  return (
    <div class="flex items-center gap-2">
      <Ticket class="h-4 w-4 text-amber-400" />
      <span class="text-sm font-bold text-amber-400">{userStore.lotteryTickets}</span>
    </div>
  )
}
