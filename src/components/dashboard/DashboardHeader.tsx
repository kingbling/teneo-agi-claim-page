import { HelpCircle, Wallet, Zap, Coins, Ship, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWebSocketConnection } from '@/hooks'
import { useUserStore, useShipStore, useEventStore } from '@/stores'
import { UserLevelBadge, BrainLevelMini } from '@/components/progression'
import { formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

export interface DashboardHeaderProps {
  onHelpClick: () => void
}

export function DashboardHeader({ onHelpClick }: DashboardHeaderProps) {
  const { isConnected } = useWebSocketConnection()

  // User store data
  const userWallet = useUserStore(state => state.userWallet)
  const agenticBalance = useUserStore(state => state.agenticBalance)
  const totalAgiEarned = useUserStore(state => state.totalAgiEarned)

  // Ship store data
  const userShips = useShipStore(state => state.userShips)
  const maxShips = useUserStore(state => state.maxShips)

  // Event store data
  const hasActiveEvents = useEventStore(state => state.hasActiveEvents())
  const activeEvents = useEventStore(state => state.activeEvents)

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-12 border-b border-[var(--card-border)] bg-[var(--background-primary)]">
      <div className="h-full flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">TENEO</span>
        </div>

        {/* Center section - User Level + Brain Level */}
        <div className="flex items-center gap-4">
          {/* User Level Badge */}
          <UserLevelBadge size="sm" showLabel={false} showMultiplier />

          {/* Brain Level Progress */}
          <BrainLevelMini />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Currency Balances */}
          <div className="flex items-center gap-2">
            {/* $AGENTIC Balance */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--background-secondary)] border border-[var(--card-border)]">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {formatPoints(agenticBalance)}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">$AGENTIC</span>
            </div>

            {/* $AGI Earned */}
            {totalAgiEarned > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--background-secondary)] border border-[var(--card-border)]">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {formatPoints(totalAgiEarned)}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">$AGI</span>
              </div>
            )}
          </div>

          {/* Ship Count */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--background-secondary)] border border-[var(--card-border)]">
            <Ship className="w-3.5 h-3.5 text-[var(--brand-teal-1)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {userShips.length}/{maxShips}
            </span>
          </div>

          {/* Active Event Indicator */}
          {hasActiveEvents && (
            <Link
              to="/events"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 transition-colors"
              title={`${activeEvents.length} active event${activeEvents.length > 1 ? 's' : ''}`}
            >
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-purple-300">
                {activeEvents.length}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            </Link>
          )}

          {/* Help */}
          <button
            onClick={onHelpClick}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--background-secondary)] transition-colors"
            title="Keyboard shortcuts (H)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Wallet with connection indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--card-border)]">
            <div className={cn(
              'w-1.5 h-1.5 rounded-full',
              isConnected ? 'bg-emerald-400' : 'bg-red-400'
            )} />
            <Wallet className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              {userWallet ? `${userWallet.slice(0, 6)}...${userWallet.slice(-4)}` : '---'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
