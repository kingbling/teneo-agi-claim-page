import { motion } from 'framer-motion'
import { Compass, Sparkles, TrendingUp, Zap, ToggleLeft, ToggleRight, Brain } from 'lucide-react'
import { StatusBadge, StatusDot } from '@/components/ui/StatusBadge'
import type { Ship } from '@/stores/shipStore'
import { type SynapseType, formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

// State accent colors for card border
const STATE_ACCENT_COLORS: Record<string, string> = {
  idle: 'border-[hsl(var(--state-idle))]/30',
  exploring: 'border-[hsl(var(--state-solving))]/60',
  deploying: 'border-[hsl(var(--state-deploying))]/50',
  returning: 'border-[hsl(var(--state-limping))]/50',
}

// Synapse type colors
const SYNAPSE_TYPE_COLORS: Record<SynapseType, string> = {
  minor: 'text-blue-400',
  complex: 'text-purple-400',
  deep: 'text-teal-400',
  core: 'text-yellow-400',
  rare: 'text-red-400',
  legendary: 'text-pink-400',
  unique: 'text-amber-300',
}

export interface ShipCardProps {
  ship: Ship
  isSelected: boolean
  currentSynapseType?: SynapseType
  explorationProgress?: number
  onSelect: () => void
  onToggleAutopilot?: () => void
  onStartExploration?: () => void
  onFocus?: () => void
}

/**
 * ShipCard - Displays a ship with its stats and exploration status
 * Masterplan 2026: No fuel/traits, shows autopilot and exploration progress
 */
export function ShipCard({
  ship,
  isSelected,
  currentSynapseType,
  explorationProgress = 0,
  onSelect,
  onToggleAutopilot,
  onStartExploration,
  onFocus,
}: ShipCardProps) {
  const isActive = ship.state !== 'idle'
  const isExploring = ship.state === 'exploring'
  const accentColor = STATE_ACCENT_COLORS[ship.state] || STATE_ACCENT_COLORS.idle

  // Map ship state to status badge state
  const statusState = ship.state === 'exploring' ? 'solving' : ship.state

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
          isExploring ? 'bg-[hsl(var(--state-solving))]/30' : 'bg-[hsl(var(--state-deploying))]/30'
        )} />
      )}

      <div className="relative p-4">
        {/* Header: Name + State Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Status indicator with pulse */}
            <StatusDot status={statusState as any} showPulse={isActive} />
            <span className="font-bold text-xl text-[var(--text-primary)] tracking-tight">{ship.name}</span>
          </div>
          <StatusBadge status={statusState as any} size="md" />
        </div>

        {/* Exploration Progress (when exploring) */}
        {isExploring && currentSynapseType && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className={cn('h-4 w-4', SYNAPSE_TYPE_COLORS[currentSynapseType])} />
                <span className={cn('text-sm font-semibold capitalize', SYNAPSE_TYPE_COLORS[currentSynapseType])}>
                  {currentSynapseType} Synapse
                </span>
              </div>
              <span className="text-sm text-[var(--text-muted)]">
                {explorationProgress.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--background-primary)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${explorationProgress}%` }}
                transition={{ duration: 0.5 }}
                className={cn(
                  'h-full rounded-full',
                  currentSynapseType === 'minor' ? 'bg-blue-500' :
                  currentSynapseType === 'complex' ? 'bg-purple-500' :
                  currentSynapseType === 'deep' ? 'bg-teal-500' :
                  currentSynapseType === 'core' ? 'bg-yellow-500' :
                  currentSynapseType === 'rare' ? 'bg-red-500' :
                  currentSynapseType === 'legendary' ? 'bg-pink-500' :
                  'bg-amber-400'
                )}
              />
            </div>
          </div>
        )}

        {/* Spending Rate (when exploring) */}
        {isExploring && (
          <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-lg bg-[var(--background-primary)]/50 border border-[var(--card-border)]/20">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[hsl(var(--accent))]" />
              <span className="text-sm text-[var(--text-muted)]">Spending</span>
            </div>
            <span className="text-sm font-bold text-[hsl(var(--accent))]">
              {ship.currentPointsPerMin} pts/min
            </span>
          </div>
        )}

        {/* Autopilot Toggle */}
        <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-lg bg-[var(--background-primary)]/50 border border-[var(--card-border)]/20">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">Autopilot</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAutopilot?.() }}
            role="switch"
            aria-checked={ship.autopilotEnabled}
            aria-label={ship.autopilotEnabled ? 'Disable autopilot' : 'Enable autopilot'}
            className="flex items-center gap-1"
          >
            {ship.autopilotEnabled ? (
              <ToggleRight className="h-6 w-6 text-[var(--brand-teal-1)]" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-[var(--text-muted)]" />
            )}
          </button>
        </div>

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
              <span className="text-xl font-bold tabular-nums text-[hsl(var(--accent))]">{ship.spacesDiscovered}</span>
            </div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="group relative p-4 rounded-xl bg-gradient-to-br from-[var(--brand-teal-1)]/10 to-[var(--brand-teal-1)]/5 border border-[var(--brand-teal-1)]/20 hover:border-[var(--brand-teal-1)]/40 transition-all"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--brand-teal-1)]" />
                <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">AGI</span>
              </div>
              <span className="text-xl font-bold tabular-nums text-[var(--brand-teal-1)]">
                {formatPoints(ship.totalAgiEarned)}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Explore Button (when idle) */}
        {ship.state === 'idle' && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); onStartExploration?.() }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[hsl(var(--accent))]/20 border border-[var(--brand-teal-1)]/40 text-[var(--brand-teal-1)] font-bold text-sm hover:from-[var(--brand-teal-1)]/30 hover:to-[hsl(var(--accent))]/30 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--brand-teal-1)]/10"
          >
            <Brain className="h-4 w-4" />
            <span>Start Exploration</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
