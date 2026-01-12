import { createSignal, Show, For } from 'solid-js'
import { Bot, BotOff, Gauge, Target, Sparkles, AlertTriangle, Check, X } from 'lucide-solid'
import { shipStore, type Ship, type AutopilotPreferences } from '@/stores/shipStore'
import { SYNAPSE_CONFIG, type SynapseType, SYNAPSE_TYPE_ORDER } from '@/types/game'
import { cn } from '@/lib/utils'

export interface AutopilotSettingsProps {
  /** Ship to configure autopilot for */
  ship: Ship
  /** Close callback */
  onClose?: () => void
  /** Compact inline mode */
  inline?: boolean
  /** Additional CSS classes */
  class?: string
}

const SYNAPSE_COLORS: Record<SynapseType, { bg: string; border: string; text: string }> = {
  minor: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400' },
  complex: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400' },
  deep: { bg: 'bg-teal-500/20', border: 'border-teal-500/40', text: 'text-teal-400' },
  core: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400' },
  rare: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400' },
  legendary: { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-400' },
  unique: { bg: 'bg-amber-400/20', border: 'border-amber-500/40', text: 'text-amber-300' },
}

const SPENDING_PRESETS = [50, 100, 200, 500, 1000]

/**
 * AutopilotSettings - Configure autopilot behavior for a ship
 *
 * Allows users to:
 * - Enable/disable autopilot
 * - Set maximum spending rate
 * - Choose preferred synapse types
 * - Toggle crowded synapse avoidance
 */
export function AutopilotSettings(props: AutopilotSettingsProps) {
  // Local state for form
  const [enabled, setEnabled] = createSignal(props.ship.autopilotEnabled)
  const [maxPointsPerMin, setMaxPointsPerMin] = createSignal(
    props.ship.autopilotPreferences?.maxPointsPerMin ?? 100
  )
  const [preferredTypes, setPreferredTypes] = createSignal<SynapseType[]>(
    props.ship.autopilotPreferences?.preferredSynapseTypes ?? ['minor', 'complex']
  )
  const [avoidCrowded, setAvoidCrowded] = createSignal(
    props.ship.autopilotPreferences?.avoidCrowded ?? true
  )
  const [isSaving, setIsSaving] = createSignal(false)

  const handleToggleType = (type: SynapseType) => {
    setPreferredTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Toggle autopilot if changed
      if (enabled() !== props.ship.autopilotEnabled) {
        await shipStore.toggleAutopilot(props.ship.id, enabled())
      }

      // Update preferences
      const prefs: AutopilotPreferences = {
        maxPointsPerMin: maxPointsPerMin(),
        preferredSynapseTypes: preferredTypes(),
        avoidCrowded: avoidCrowded(),
      }
      await shipStore.setAutopilotPreferences(props.ship.id, prefs)

      props.onClose?.()
    } catch (error) {
      console.error('Failed to save autopilot settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const content = (
    <div class="space-y-5">
      {/* Enable/Disable Toggle */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class={cn(
              'p-2.5 rounded-xl transition-colors',
              enabled()
                ? 'bg-[var(--brand-teal-1)]/20'
                : 'bg-[var(--background-primary)]'
            )}
          >
            <Show when={enabled()} fallback={<BotOff class="h-5 w-5 text-[var(--text-muted)]" />}>
              <Bot class="h-5 w-5 text-[var(--brand-teal-1)]" />
            </Show>
          </div>
          <div>
            <p class="font-semibold text-[var(--text-primary)]">Autopilot</p>
            <p class="text-xs text-[var(--text-muted)]">
              {enabled() ? 'Auto-find next synapse when done' : 'Manual control'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEnabled(!enabled())}
          role="switch"
          aria-checked={enabled()}
          aria-label="Toggle autopilot"
          class={cn(
            'relative w-12 h-6 rounded-full transition-colors',
            enabled() ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--background-primary)]'
          )}
        >
          <div
            class="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: enabled() ? 'translateX(24px)' : 'translateX(2px)' }}
          />
        </button>
      </div>

      {/* Settings (only shown when enabled) */}
      <Show when={enabled()}>
        <div
          class="space-y-4 pt-4 border-t border-[var(--card-border)]/20 transition-all duration-300"
        >
          {/* Max Spending Rate */}
          <div>
            <div class="flex items-center gap-2 mb-2">
              <Gauge class="h-4 w-4 text-[var(--text-muted)]" />
              <span class="text-sm font-medium text-[var(--text-primary)]">
                Max Spending Rate
              </span>
              <span class="ml-auto text-sm font-semibold text-[var(--brand-teal-1)]">
                {maxPointsPerMin()}/min
              </span>
            </div>
            <div class="flex gap-2">
              <For each={SPENDING_PRESETS}>
                {(preset) => (
                  <button
                    onClick={() => setMaxPointsPerMin(preset)}
                    class={cn(
                      'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors border',
                      maxPointsPerMin() === preset
                        ? 'bg-[var(--brand-teal-1)]/20 border-[var(--brand-teal-1)]/50 text-[var(--brand-teal-1)]'
                        : 'bg-[var(--background-primary)] border-[var(--card-border)]/30 text-[var(--text-muted)] hover:border-[var(--card-border)]/50'
                    )}
                  >
                    {preset}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Preferred Synapse Types */}
          <div>
            <div class="flex items-center gap-2 mb-2">
              <Target class="h-4 w-4 text-[var(--text-muted)]" />
              <span class="text-sm font-medium text-[var(--text-primary)]">
                Target Synapse Types
              </span>
            </div>
            <div class="grid grid-cols-4 gap-2">
              <For each={SYNAPSE_TYPE_ORDER as SynapseType[]}>
                {(type) => {
                  const config = SYNAPSE_CONFIG[type]
                  const colors = SYNAPSE_COLORS[type]
                  const isSelected = () => preferredTypes().includes(type)

                  return (
                    <button
                      onClick={() => handleToggleType(type)}
                      class={cn(
                        'py-2 px-2 rounded-lg text-xs font-medium transition-all border capitalize',
                        isSelected()
                          ? `${colors.bg} ${colors.border} ${colors.text}`
                          : 'bg-[var(--background-primary)] border-[var(--card-border)]/30 text-[var(--text-muted)] hover:border-[var(--card-border)]/50'
                      )}
                    >
                      {type}
                      <div class="text-[10px] opacity-70 mt-0.5">
                        {config.distribution === 'lottery' ? 'Lottery' : 'Share'}
                      </div>
                    </button>
                  )
                }}
              </For>
            </div>
            <Show when={preferredTypes().length === 0}>
              <p class="text-xs text-amber-400 mt-2 flex items-center gap-1">
                <AlertTriangle class="h-3 w-3" />
                Select at least one synapse type
              </p>
            </Show>
          </div>

          {/* Avoid Crowded Toggle */}
          <div class="flex items-center justify-between p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
            <div class="flex items-center gap-2">
              <Sparkles class="h-4 w-4 text-[var(--text-muted)]" />
              <div>
                <p class="text-sm font-medium text-[var(--text-primary)]">
                  Avoid Crowded Synapses
                </p>
                <p class="text-xs text-[var(--text-muted)]">
                  Skip synapses with many explorers
                </p>
              </div>
            </div>
            <button
              onClick={() => setAvoidCrowded(!avoidCrowded())}
              role="switch"
              aria-checked={avoidCrowded()}
              aria-label="Avoid crowded synapses"
              class={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                avoidCrowded() ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--background-secondary)]'
              )}
            >
              <div
                class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: avoidCrowded() ? 'translateX(20px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
        </div>
      </Show>

      {/* Actions */}
      <div class="flex gap-2 pt-2">
        <Show when={props.onClose}>
          <button
            onClick={props.onClose}
            class="flex-1 py-2.5 px-4 rounded-lg border border-[var(--card-border)]/30 text-[var(--text-muted)] hover:bg-[var(--background-primary)] transition-colors flex items-center justify-center gap-2"
          >
            <X class="h-4 w-4" />
            Cancel
          </button>
        </Show>
        <button
          onClick={handleSave}
          disabled={isSaving() || (enabled() && preferredTypes().length === 0)}
          class={cn(
            'flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
            enabled() && preferredTypes().length === 0
              ? 'bg-[var(--background-secondary)] text-[var(--text-muted)] cursor-not-allowed'
              : 'bg-[var(--brand-teal-1)] text-white hover:bg-[var(--brand-teal-1)]/90'
          )}
        >
          <Show
            when={!isSaving()}
            fallback={
              <div
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              />
            }
          >
            <Check class="h-4 w-4" />
            Save Settings
          </Show>
        </button>
      </div>
    </div>
  )

  if (props.inline) {
    return (
      <div class={cn('space-y-4', props.class)}>
        {content}
      </div>
    )
  }

  return (
    <div
      class={cn(
        'rounded-xl border p-5 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30',
        props.class
      )}
    >
      <h3 class="text-lg font-bold text-[var(--text-primary)] mb-4">
        Autopilot Settings
      </h3>
      {content}
    </div>
  )
}

/**
 * AutopilotQuickToggle - Minimal toggle for ship cards
 */
export interface AutopilotQuickToggleProps {
  ship: Ship
  class?: string
}

export function AutopilotQuickToggle(props: AutopilotQuickToggleProps) {
  const [isToggling, setIsToggling] = createSignal(false)

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await shipStore.toggleAutopilot(props.ship.id, !props.ship.autopilotEnabled)
    } catch (error) {
      console.error('Failed to toggle autopilot:', error)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling()}
      role="switch"
      aria-checked={props.ship.autopilotEnabled}
      aria-label={props.ship.autopilotEnabled ? 'Disable autopilot' : 'Enable autopilot'}
      class={cn(
        'p-1.5 rounded-lg transition-colors border',
        props.ship.autopilotEnabled
          ? 'bg-[var(--brand-teal-1)]/20 border-[var(--brand-teal-1)]/40 text-[var(--brand-teal-1)]'
          : 'bg-[var(--background-primary)] border-[var(--card-border)]/30 text-[var(--text-muted)] hover:border-[var(--card-border)]/50',
        isToggling() && 'opacity-50',
        props.class
      )}
      title={props.ship.autopilotEnabled ? 'Disable autopilot' : 'Enable autopilot'}
    >
      <Show
        when={!isToggling()}
        fallback={
          <div
            class="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"
          />
        }
      >
        <Show
          when={props.ship.autopilotEnabled}
          fallback={<BotOff class="h-4 w-4" />}
        >
          <Bot class="h-4 w-4" />
        </Show>
      </Show>
    </button>
  )
}
