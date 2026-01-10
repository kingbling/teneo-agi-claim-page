import { motion } from 'framer-motion'
import { Wrench, Fuel, Sparkles, TrendingUp } from 'lucide-react'
import { StatusBadge, StatusDot } from '@/components/ui/StatusBadge'
import { FuelBar } from '@/components/ui/FuelBar'
import type { Agent, TraitType } from '@/types/agent'
import { cn } from '@/lib/utils'

// Trait colors for new trait system
const TRAIT_COLORS: Record<TraitType, string> = {
  explorer: 'bg-[hsl(var(--tier-trait))]/20 text-[hsl(var(--tier-trait))] border-[hsl(var(--tier-trait))]/30',
  solver: 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))] border-[hsl(var(--tier-legendary))]/30',
  swift: 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30',
  efficient: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  pioneer: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30',
  networker: 'bg-[hsl(var(--tier-team))]/20 text-[hsl(var(--tier-team))] border-[hsl(var(--tier-team))]/30',
  beacon: 'bg-[hsl(var(--tier-mythic))]/20 text-[hsl(var(--tier-mythic))] border-[hsl(var(--tier-mythic))]/30',
  lucky: 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))] border-[hsl(var(--tier-legendary))]/30',
  collaborative: 'bg-[hsl(var(--tier-team))]/20 text-[hsl(var(--tier-team))] border-[hsl(var(--tier-team))]/30',
  trance: 'bg-[hsl(var(--tier-trait))]/20 text-[hsl(var(--tier-trait))] border-[hsl(var(--tier-trait))]/30',
  staker: 'bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/30',
}

// State accent colors for card border
const STATE_ACCENT_COLORS: Record<string, string> = {
  idle: 'border-[hsl(var(--state-idle))]/30',
  solving: 'border-[hsl(var(--state-solving))]/60',
  deploying: 'border-[hsl(var(--state-deploying))]/50',
  wandering: 'border-[hsl(var(--state-wandering))]/50',
  searching: 'border-[hsl(var(--state-exploring))]/50',
  limping_home: 'border-[hsl(var(--state-limping))]/50',
  exhausted: 'border-[hsl(var(--state-exhausted))]/60',
}

export interface AgentCardProps {
  agent: Agent
  isSelected: boolean
  userPoints: number
  isDeploying: boolean
  fleetAvgEfficiency: number
  regionRecommendation: { region: string; undiscovered: number; agents: number } | null
  onSelect: () => void
  onRefuel: (amount: number) => void
  onDeployRandom?: () => void
  onDeployToRegion?: (region: string) => void
  onRepair: () => void
  onFocus?: () => void
}

/**
 * AgentCard - Displays an agent with its stats, fuel, traits, and actions
 */
export function AgentCard({
  agent,
  isSelected,
  userPoints,
  onSelect,
  onRefuel,
  onRepair,
  onFocus,
}: AgentCardProps) {
  const fuelPercent = Math.min(100, (agent.pointsBalance / 1000) * 100)
  const isActive = agent.state !== 'idle' && agent.state !== 'exhausted'

  const accentColor = STATE_ACCENT_COLORS[agent.state]

  return (
    <motion.div
      onClick={onSelect}
      onDoubleClick={() => onFocus?.()}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl border-2 cursor-pointer transition-all duration-300',
        isSelected
          ? 'border-[var(--brand-teal-1)] bg-gradient-to-br from-[var(--brand-teal-1)]/10 to-[var(--brand-teal-1)]/5 shadow-lg shadow-[var(--brand-teal-1)]/20'
          : `${accentColor} bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]/50 hover:from-[var(--background-secondary)]/90 hover:to-[var(--background-primary)]/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20`
      )}
    >
      {/* Active state glow effect */}
      {isActive && (
        <div className={cn(
          'absolute -inset-0.5 rounded-2xl opacity-30 blur-sm',
          isActive ? `bg-[hsl(var(--state-${agent.state === 'wandering' ? 'exploring' : agent.state}))]/30` : 'bg-gray-500/30'
        )} />
      )}

      <div className="relative p-4">
        {/* Header: Name + State Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Status indicator with pulse */}
            <StatusDot status={agent.state === 'wandering' ? 'active' : agent.state as any} showPulse={isActive} />
            <span className="font-bold text-xl text-[var(--text-primary)] tracking-tight">{agent.name}</span>
          </div>
          <StatusBadge status={agent.state === 'wandering' ? 'active' : agent.state as any} size="md" />
        </div>

        {/* Fuel Bar */}
        <div className="mb-4">
          <FuelBar
            current={agent.pointsBalance}
            max={1000}
            label="Fuel Tank"
            showStatus={true}
            size="md"
          />
        </div>

        {/* Traits */}
        {agent.traits.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {agent.traits.slice(0, 3).map((trait, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className={cn('text-sm px-3 py-1.5 rounded-lg border font-semibold capitalize shadow-sm', TRAIT_COLORS[trait.type])}
              >
                {trait.type}
              </motion.span>
            ))}
            {agent.traits.length > 3 && (
              <span className="text-sm px-3 py-1.5 rounded-lg bg-[var(--background-primary)] text-[var(--text-muted)] font-medium border border-[var(--card-border)]/30">
                +{agent.traits.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="group relative p-4 rounded-xl bg-gradient-to-br from-[hsl(var(--accent))]/10 to-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/20 hover:border-[hsl(var(--accent))]/40 transition-all"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
                <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">Found</span>
              </div>
              <span className="text-xl font-bold tabular-nums text-[hsl(var(--accent))]">{agent.spacesDiscovered}</span>
            </div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="group relative p-4 rounded-xl bg-gradient-to-br from-[var(--brand-teal-1)]/10 to-[var(--brand-teal-1)]/5 border border-[var(--brand-teal-1)]/20 hover:border-[var(--brand-teal-1)]/40 transition-all"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--brand-teal-1)]" />
                <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">Loot</span>
              </div>
              <span className="text-xl font-bold tabular-nums text-[var(--brand-teal-1)]">{agent.totalLoot}</span>
            </div>
          </motion.div>
        </div>

        {/* Repair Button */}
        {agent.needsRepair && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); onRepair() }}
            disabled={userPoints < Math.ceil((agent.creationCost ?? 100) * 0.5)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-[hsl(var(--destructive))]/20 to-[hsl(var(--destructive))]/30 border border-[hsl(var(--destructive))]/40 text-[hsl(var(--destructive))] font-bold text-sm hover:from-[hsl(var(--destructive))]/30 hover:to-[hsl(var(--destructive))]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-[hsl(var(--destructive))]/10"
          >
            <Wrench className="h-4 w-4" />
            <span>Repair Agent</span>
            <span className="px-2 py-1 rounded bg-[hsl(var(--destructive))]/20 text-xs">
              {Math.ceil((agent.creationCost ?? 100) * 0.5)} pts
            </span>
          </motion.button>
        )}

        {/* Low Fuel Warning */}
        {fuelPercent < 20 && !agent.needsRepair && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); onRefuel(100) }}
            disabled={userPoints < 100}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--brand-red-4)]/20 to-[hsl(var(--accent))]/20 border border-[var(--brand-red-4)]/40 text-[var(--brand-red-4)] font-bold text-sm hover:from-[var(--brand-red-4)]/30 hover:to-[hsl(var(--accent))]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-[var(--brand-red-4)]/10"
          >
            <Fuel className="h-4 w-4" />
            <span>Refuel Now</span>
            <span className="px-2 py-1 rounded bg-[var(--brand-red-4)]/20 text-xs">+100 pts</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
