import { HelpCircle, Wallet } from 'lucide-react'
import { useWebSocketConnection } from '@/hooks'
import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/lib/utils'

export interface DashboardHeaderProps {
  onHelpClick: () => void
}

export function DashboardHeader({ onHelpClick }: DashboardHeaderProps) {
  const { isConnected } = useWebSocketConnection()
  const userWallet = useAgentStore(state => state.userWallet)

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

        {/* Right side */}
        <div className="flex items-center gap-3">
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
