import { motion } from 'framer-motion'
import { Rocket, Fuel, Zap } from 'lucide-react'
import type { Agent } from '@/types/agent'
import { cn } from '@/lib/utils'

interface AgentListItemProps {
  agent: Agent
  isSelected: boolean
  isDeploying: boolean
  userPoints: number
  onSelect: () => void
  onDeploy: () => void
  onRefuel: (amount: number) => void
}

const STATE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  idle: { label: 'Idle', color: 'text-zinc-400', bg: 'bg-zinc-400' },
  wandering: { label: 'Exploring', color: 'text-emerald-400', bg: 'bg-emerald-400' },
  solving: { label: 'Solving', color: 'text-amber-400', bg: 'bg-amber-400' },
  deploying: { label: 'Deploying', color: 'text-sky-400', bg: 'bg-sky-400' },
  limping_home: { label: 'Returning', color: 'text-orange-400', bg: 'bg-orange-400' },
  exhausted: { label: 'Exhausted', color: 'text-red-400', bg: 'bg-red-400' },
}

export function AgentListItem({
  agent,
  isSelected,
  isDeploying,
  userPoints,
  onSelect,
  onDeploy,
  onRefuel,
}: AgentListItemProps) {
  const stateStyle = STATE_STYLES[agent.state] || STATE_STYLES.idle
  const fuelPercent = (agent.pointsBalance / 1000) * 100
  const needsFuel = agent.pointsBalance < 100
  const canDeploy = agent.state === 'idle' && agent.pointsBalance > 0
  const canRefuel = userPoints >= 100

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-3 rounded-lg border transition-colors cursor-pointer',
        isSelected
          ? 'border-[var(--brand-teal-1)] bg-[var(--brand-teal-1)]/5'
          : 'border-[var(--card-border)] bg-[var(--background-primary)]/50 hover:border-[var(--card-border-hover)]'
      )}
      onClick={onSelect}
    >
      {/* Header: Name + Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-[var(--text-primary)] truncate">
          {agent.name}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full', stateStyle.bg, agent.state === 'solving' && 'animate-pulse')} />
          <span className={cn('text-xs', stateStyle.color)}>{stateStyle.label}</span>
        </div>
      </div>

      {/* Fuel Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-[var(--text-muted)]">Fuel</span>
          <span className={cn(
            'tabular-nums',
            needsFuel ? 'text-red-400' : 'text-[var(--text-secondary)]'
          )}>
            {agent.pointsBalance}/{1000}
          </span>
        </div>
        <div className="h-1 bg-[var(--background-primary)] rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              needsFuel ? 'bg-red-400' : 'bg-[var(--brand-teal-1)]'
            )}
            style={{ width: `${Math.min(100, fuelPercent)}%` }}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-2">
        <span>{agent.spacesDiscovered} found</span>
        <span className="text-[var(--brand-teal-1)]">{agent.totalLoot} AGI</span>
      </div>

      {/* Actions */}
      {(canDeploy || needsFuel) && (
        <div className="flex gap-2">
          {canDeploy && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeploy(); }}
              disabled={isDeploying}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded bg-[var(--brand-teal-1)] text-white hover:bg-[var(--brand-teal-1)]/90 disabled:opacity-50 transition-colors"
            >
              {isDeploying ? (
                <Zap className="w-3 h-3 animate-spin" />
              ) : (
                <Rocket className="w-3 h-3" />
              )}
              {isDeploying ? 'Deploying' : 'Deploy'}
            </button>
          )}
          {needsFuel && canRefuel && (
            <button
              onClick={(e) => { e.stopPropagation(); onRefuel(500); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--background-primary)] transition-colors"
            >
              <Fuel className="w-3 h-3" />
              Refuel
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
