import { Show, For } from 'solid-js'
import { Bot, BotOff, Gauge, Zap } from 'lucide-solid'
import { cn } from '@/lib/utils'
import { type Ship } from '@/stores/shipStore'
import { type SynapseType } from '@/types/game'

export interface AutopilotStatusProps {
  /** Ship to display autopilot status for */
  ship: Ship
  /** Compact mode for ship cards */
  compact?: boolean
  /** Additional CSS classes */
  class?: string
}

/**
 * AutopilotStatus - Displays autopilot status for a ship
 *
 * Shows whether autopilot is enabled/disabled and current settings
 * including minimum synapse type and spending rate preferences.
 */
export function AutopilotStatus(props: AutopilotStatusProps) {
  const isEnabled = () => props.ship.autopilotEnabled
  const prefs = () => props.ship.autopilotPreferences

  return (
    <Show
      when={!props.compact}
      fallback={
        <div
          class={cn(
            'inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors duration-200',
            isEnabled()
              ? 'bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/30 text-[var(--brand-teal-1)]'
              : 'bg-[var(--background-secondary)] border-[var(--card-border)]/30 text-[var(--text-muted)]',
            props.class
          )}
        >
          <Show
            when={isEnabled()}
            fallback={
              <>
                <BotOff class="h-3.5 w-3.5" />
                <span class="text-xs font-medium">Manual</span>
              </>
            }
          >
            <Bot class="h-3.5 w-3.5" />
            <span class="text-xs font-medium">Auto</span>
            <Show when={prefs()?.maxPointsPerMin}>
              <span class="text-xs opacity-70">
                {prefs()!.maxPointsPerMin}/min
              </span>
            </Show>
          </Show>
        </div>
      }
    >
      <div
        class={cn(
          'rounded-xl border p-4 transition-all duration-200',
          isEnabled()
            ? 'bg-gradient-to-br from-[var(--brand-teal-1)]/10 to-[var(--background-primary)] border-[var(--brand-teal-1)]/30'
            : 'bg-[var(--background-secondary)] border-[var(--card-border)]/30',
          props.class
        )}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div
              class={cn(
                'p-2 rounded-lg',
                isEnabled()
                  ? 'bg-[var(--brand-teal-1)]/20'
                  : 'bg-[var(--background-primary)]'
              )}
            >
              <Show
                when={isEnabled()}
                fallback={<BotOff class="h-4 w-4 text-[var(--text-muted)]" />}
              >
                <Bot class="h-4 w-4 text-[var(--brand-teal-1)]" />
              </Show>
            </div>
            <div>
              <p class={cn(
                'font-semibold text-sm',
                isEnabled() ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
              )}>
                Autopilot
              </p>
              <p class="text-xs text-[var(--text-muted)]">
                {isEnabled() ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          {/* Status indicator */}
          <Show when={isEnabled()}>
            <span class="w-2.5 h-2.5 rounded-full bg-[var(--brand-teal-1)] animate-pulse" />
          </Show>
        </div>

        {/* Settings (only when enabled and has preferences) */}
        <Show when={isEnabled() && prefs()}>
          <div class="space-y-2 pt-3 border-t border-[var(--card-border)]/20">
            {/* Spending Rate */}
            <Show when={prefs()?.maxPointsPerMin}>
              <div class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-2 text-[var(--text-muted)]">
                  <Gauge class="h-3.5 w-3.5" />
                  <span>Max Rate</span>
                </div>
                <span class="font-medium text-[var(--text-primary)]">
                  {prefs()!.maxPointsPerMin}/min
                </span>
              </div>
            </Show>

            {/* Preferred Synapse Types */}
            <Show when={prefs()?.preferredSynapseTypes && prefs()!.preferredSynapseTypes!.length > 0}>
              <div class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-2 text-[var(--text-muted)]">
                  <Zap class="h-3.5 w-3.5" />
                  <span>Targets</span>
                </div>
                <div class="flex gap-1">
                  <For each={prefs()!.preferredSynapseTypes!.slice(0, 3)}>
                    {(type) => <SynapseTypePill type={type} />}
                  </For>
                  <Show when={prefs()!.preferredSynapseTypes!.length > 3}>
                    <span class="text-xs text-[var(--text-muted)]">
                      +{prefs()!.preferredSynapseTypes!.length - 3}
                    </span>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Avoid Crowded */}
            <Show when={prefs()?.avoidCrowded}>
              <div class="text-xs text-[var(--text-muted)] mt-2">
                Avoiding crowded synapses
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  )
}

/**
 * AutopilotIndicator - Minimal autopilot indicator for lists
 */
export interface AutopilotIndicatorProps {
  enabled: boolean
  class?: string
}

export function AutopilotIndicator(props: AutopilotIndicatorProps) {
  return (
    <div
      class={cn(
        'inline-flex items-center gap-1.5',
        props.enabled ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]',
        props.class
      )}
    >
      <Show
        when={props.enabled}
        fallback={<BotOff class="h-3.5 w-3.5" />}
      >
        <Bot class="h-3.5 w-3.5" />
      </Show>
      <span class="text-xs font-medium">
        {props.enabled ? 'Auto' : 'Manual'}
      </span>
    </div>
  )
}

// Small synapse type pill
function SynapseTypePill(props: { type: SynapseType }) {
  const colors: Record<SynapseType, string> = {
    minor: 'bg-blue-500/20 text-blue-400',
    complex: 'bg-purple-500/20 text-purple-400',
    deep: 'bg-teal-500/20 text-teal-400',
    core: 'bg-yellow-500/20 text-yellow-400',
    rare: 'bg-red-500/20 text-red-400',
    legendary: 'bg-pink-500/20 text-pink-400',
    unique: 'bg-amber-400/20 text-amber-300',
  }

  return (
    <span class={cn('px-1.5 py-0.5 rounded text-xs font-medium capitalize', colors[props.type])}>
      {props.type}
    </span>
  )
}
