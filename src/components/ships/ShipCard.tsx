import { Show, createMemo } from 'solid-js'
import { Compass, Sparkles, TrendingUp, Zap, ToggleLeft, ToggleRight, Brain } from 'lucide-solid'
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

// Synapse type progress bar colors
const SYNAPSE_PROGRESS_COLORS: Record<SynapseType, string> = {
  minor: 'bg-blue-500',
  complex: 'bg-purple-500',
  deep: 'bg-teal-500',
  core: 'bg-yellow-500',
  rare: 'bg-red-500',
  legendary: 'bg-pink-500',
  unique: 'bg-amber-400',
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
export function ShipCard(props: ShipCardProps) {
  const isActive = createMemo(() => props.ship.state !== 'idle')
  const isExploring = createMemo(() => props.ship.state === 'exploring')
  const accentColor = createMemo(() => STATE_ACCENT_COLORS[props.ship.state] || STATE_ACCENT_COLORS.idle)

  // Map ship state to status badge state
  const statusState = createMemo(() => props.ship.state === 'exploring' ? 'solving' : props.ship.state)

  const explorationProgress = createMemo(() => props.explorationProgress ?? 0)

  return (
    <div
      onClick={props.onSelect}
      onDblClick={() => props.onFocus?.()}
      class={cn(
        'relative rounded-2xl border-2 cursor-pointer transition-all duration-300',
        props.isSelected
          ? 'border-[var(--brand-teal-1)] bg-gradient-to-br from-[var(--brand-teal-1)]/10 to-[var(--brand-teal-1)]/5 shadow-lg shadow-[var(--brand-teal-1)]/20'
          : `${accentColor()} bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]/50 hover:from-[var(--background-secondary)]/90 hover:to-[var(--background-primary)]/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20`
      )}
    >
      {/* Active state glow effect */}
      <Show when={isActive()}>
        <div class={cn(
          'absolute -inset-0.5 rounded-2xl opacity-30 blur-sm',
          isExploring() ? 'bg-[hsl(var(--state-solving))]/30' : 'bg-[hsl(var(--state-deploying))]/30'
        )} />
      </Show>

      <div class="relative p-4">
        {/* Header: Name + State Badge */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            {/* Status indicator with pulse */}
            <StatusDot status={statusState() as any} showPulse={isActive()} />
            <span class="font-bold text-xl text-[var(--text-primary)] tracking-tight">{props.ship.name}</span>
          </div>
          <StatusBadge status={statusState() as any} size="md" />
        </div>

        {/* Exploration Progress (when exploring) */}
        <Show when={isExploring() && props.currentSynapseType}>
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <Brain class={cn('h-4 w-4', SYNAPSE_TYPE_COLORS[props.currentSynapseType!])} />
                <span class={cn('text-sm font-semibold capitalize', SYNAPSE_TYPE_COLORS[props.currentSynapseType!])}>
                  {props.currentSynapseType} Synapse
                </span>
              </div>
              <span class="text-sm text-[var(--text-muted)]">
                {explorationProgress().toFixed(1)}%
              </span>
            </div>
            <div class="h-2 rounded-full bg-[var(--background-primary)] overflow-hidden">
              <div
                class={cn(
                  'h-full rounded-full transition-all duration-500',
                  SYNAPSE_PROGRESS_COLORS[props.currentSynapseType!]
                )}
                style={{ width: `${explorationProgress()}%` }}
              />
            </div>
          </div>
        </Show>

        {/* Spending Rate (when exploring) */}
        <Show when={isExploring()}>
          <div class="flex items-center justify-between mb-4 px-3 py-2 rounded-lg bg-[var(--background-primary)]/50 border border-[var(--card-border)]/20">
            <div class="flex items-center gap-2">
              <Zap class="h-4 w-4 text-[hsl(var(--accent))]" />
              <span class="text-sm text-[var(--text-muted)]">Spending</span>
            </div>
            <span class="text-sm font-bold text-[hsl(var(--accent))]">
              {props.ship.currentPointsPerMin} pts/min
            </span>
          </div>
        </Show>

        {/* Autopilot Toggle */}
        <div class="flex items-center justify-between mb-4 px-3 py-2 rounded-lg bg-[var(--background-primary)]/50 border border-[var(--card-border)]/20">
          <div class="flex items-center gap-2">
            <Compass class="h-4 w-4 text-[var(--text-muted)]" />
            <span class="text-sm text-[var(--text-muted)]">Autopilot</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); props.onToggleAutopilot?.() }}
            role="switch"
            aria-checked={props.ship.autopilotEnabled}
            aria-label={props.ship.autopilotEnabled ? 'Disable autopilot' : 'Enable autopilot'}
            class="flex items-center gap-1"
          >
            <Show
              when={props.ship.autopilotEnabled}
              fallback={<ToggleLeft class="h-6 w-6 text-[var(--text-muted)]" />}
            >
              <ToggleRight class="h-6 w-6 text-[var(--brand-teal-1)]" />
            </Show>
          </button>
        </div>

        {/* Stats Grid */}
        <div class="grid grid-cols-2 gap-3">
          <div
            class="group relative p-4 rounded-xl bg-gradient-to-br from-[hsl(var(--accent))]/10 to-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/20 hover:border-[hsl(var(--accent))]/40 hover:scale-[1.02] transition-all"
          >
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <Sparkles class="h-4 w-4 text-[hsl(var(--accent))]" />
                <span class="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">Found</span>
              </div>
              <span class="text-xl font-bold tabular-nums text-[hsl(var(--accent))]">{props.ship.spacesDiscovered}</span>
            </div>
          </div>
          <div
            class="group relative p-4 rounded-xl bg-gradient-to-br from-[var(--brand-teal-1)]/10 to-[var(--brand-teal-1)]/5 border border-[var(--brand-teal-1)]/20 hover:border-[var(--brand-teal-1)]/40 hover:scale-[1.02] transition-all"
          >
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <TrendingUp class="h-4 w-4 text-[var(--brand-teal-1)]" />
                <span class="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">AGI</span>
              </div>
              <span class="text-xl font-bold tabular-nums text-[var(--brand-teal-1)]">
                {formatPoints(props.ship.totalAgiEarned)}
              </span>
            </div>
          </div>
        </div>

        {/* Explore Button (when idle) */}
        <Show when={props.ship.state === 'idle'}>
          <button
            onClick={(e) => { e.stopPropagation(); props.onStartExploration?.() }}
            class="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[hsl(var(--accent))]/20 border border-[var(--brand-teal-1)]/40 text-[var(--brand-teal-1)] font-bold text-sm hover:from-[var(--brand-teal-1)]/30 hover:to-[hsl(var(--accent))]/30 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--brand-teal-1)]/10 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Brain class="h-4 w-4" />
            <span>Start Exploration</span>
          </button>
        </Show>
      </div>
    </div>
  )
}
