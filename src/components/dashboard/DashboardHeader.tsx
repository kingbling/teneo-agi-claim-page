/**
 * DashboardHeader - SolidJS Version
 *
 * Header component for the discovery dashboard with user stats,
 * currency balances, and navigation controls.
 */

import { type Component, Show } from 'solid-js'
import { A } from '@solidjs/router'
import { HelpCircle, Wallet, Zap, Coins, Ship, Calendar, ShoppingBag } from 'lucide-solid'
import { useWebSocketConnection } from '@/hooks'
import { userStore, shipStore, eventStore } from '@/stores'
import { formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

export interface DashboardHeaderProps {
  onHelpClick: () => void
  onShopClick?: () => void
}

export const DashboardHeader: Component<DashboardHeaderProps> = (props) => {
  const { isConnected } = useWebSocketConnection()

  return (
    <header class="fixed left-0 right-0 top-0 z-50 h-12 border-b border-[var(--card-border)] bg-[var(--background-primary)]">
      <div class="h-full flex items-center justify-between px-4">
        {/* Logo */}
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span class="text-sm font-semibold text-[var(--text-primary)]">TENEO</span>
        </div>

        {/* Center section - User Level */}
        <div class="flex items-center gap-4">
          {/* User Level Badge - simplified for now */}
          <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-teal-500/20 to-blue-500/20 border border-teal-500/30">
            <span class="text-xs font-medium text-teal-300">
              Lv. {userStore.userLevel}
            </span>
          </div>

        </div>

        {/* Right side */}
        <div class="flex items-center gap-3">
          {/* Currency Balances */}
          <div class="flex items-center gap-2">
            {/* $AGENTIC Balance */}
            <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--background-secondary)] border border-[var(--card-border)]">
              <Coins class="w-3.5 h-3.5 text-amber-400" />
              <span class="text-xs font-medium text-[var(--text-primary)]">
                {formatPoints(userStore.agenticBalance)}
              </span>
              <span class="text-[10px] text-[var(--text-muted)]">$AGENTIC</span>
            </div>

            {/* $AGI Earned */}
            <Show when={userStore.totalAgiEarned > 0}>
              <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--background-secondary)] border border-[var(--card-border)]">
                <Zap class="w-3.5 h-3.5 text-purple-400" />
                <span class="text-xs font-medium text-[var(--text-primary)]">
                  {formatPoints(userStore.totalAgiEarned)}
                </span>
                <span class="text-[10px] text-[var(--text-muted)]">$AGI</span>
              </div>
            </Show>
          </div>

          {/* Ship Count */}
          <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--background-secondary)] border border-[var(--card-border)]">
            <Ship class="w-3.5 h-3.5 text-[var(--brand-teal-1)]" />
            <span class="text-xs font-medium text-[var(--text-primary)]">
              {shipStore.userShips.length}/{userStore.maxShips}
            </span>
          </div>

          {/* Active Event Indicator */}
          <Show when={eventStore.actions.hasActiveEvents()}>
            <A
              href="/events"
              class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 transition-colors"
              title={`${eventStore.state.activeEvents.length} active event${eventStore.state.activeEvents.length > 1 ? 's' : ''}`}
            >
              <Calendar class="w-3.5 h-3.5 text-purple-400" />
              <span class="text-xs font-medium text-purple-300">
                {eventStore.state.activeEvents.length}
              </span>
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            </A>
          </Show>

          {/* Shop */}
          <button
            onClick={props.onShopClick}
            class="w-7 h-7 rounded-lg flex items-center justify-center text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 transition-colors relative"
            title="Item Shop (S)"
          >
            <ShoppingBag class="w-4 h-4" />
            <span class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          </button>

          {/* Help */}
          <button
            onClick={props.onHelpClick}
            class="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--background-secondary)] transition-colors"
            title="Keyboard shortcuts (H)"
          >
            <HelpCircle class="w-4 h-4" />
          </button>

          {/* Wallet with connection indicator */}
          <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--card-border)]">
            <div class={cn(
              'w-1.5 h-1.5 rounded-full',
              isConnected ? 'bg-emerald-400' : 'bg-red-400'
            )} />
            <Wallet class="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span class="text-xs text-[var(--text-secondary)] font-mono">
              {userStore.userWallet ? `${userStore.userWallet.slice(0, 6)}...${userStore.userWallet.slice(-4)}` : '---'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
