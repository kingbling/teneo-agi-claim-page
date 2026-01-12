import { Show, For } from 'solid-js'
import { Gauge, Zap, TrendingUp, TrendingDown } from 'lucide-solid'
import { SYNAPSE_CONFIG, type SynapseType, formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

export interface SpendingRateSliderProps {
  /** Current spending rate in points per minute */
  value: number
  /** Callback when spending rate changes */
  onInput: (rate: number) => void
  /** Synapse type for rate limits */
  synapseType: SynapseType
  /** User's available points balance */
  userPoints?: number
  /** Whether the slider is disabled */
  disabled?: boolean
  /** Compact mode */
  compact?: boolean
  /** Additional CSS classes */
  class?: string
}

/**
 * SpendingRateSlider - Control spending rate for synapse exploration
 *
 * Allows users to set their points per minute spending rate with
 * preset options and visual feedback on burn rate.
 */
export function SpendingRateSlider(props: SpendingRateSliderProps) {
  const config = () => SYNAPSE_CONFIG[props.synapseType]
  const minRate = 50 // Minimum spending rate across all synapse types
  const maxRate = () => config().maxPerMin
  const userPoints = () => props.userPoints ?? 1000
  const disabled = () => props.disabled ?? false
  const compact = () => props.compact ?? false

  // Calculate how long user can sustain this rate
  const minutesSustainable = () => userPoints() / props.value
  const hoursSustainable = () => minutesSustainable() / 60

  // Preset options based on synapse type
  const presets = () => {
    const max = maxRate()
    return [
      minRate,
      Math.floor((minRate + max) / 4),
      Math.floor((minRate + max) / 2),
      Math.floor((minRate + max) * 3 / 4),
      max,
    ].filter((v, i, arr) => arr.indexOf(v) === i) // Remove duplicates
  }

  const handlePresetClick = (preset: number) => {
    if (!disabled()) {
      props.onInput(Math.min(preset, maxRate()))
    }
  }

  return (
    <Show
      when={!compact()}
      fallback={
        <div class={cn('flex items-center gap-3', props.class)}>
          <Gauge class="h-4 w-4 text-[var(--text-muted)]" />
          <div class="flex gap-1.5">
            <For each={presets().slice(0, 4)}>
              {(preset) => (
                <button
                  onClick={() => handlePresetClick(preset)}
                  disabled={disabled()}
                  class={cn(
                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                    props.value === preset
                      ? 'bg-[var(--brand-teal-1)] text-white'
                      : 'bg-[var(--background-primary)] text-[var(--text-muted)] hover:bg-[var(--background-secondary)]',
                    disabled() && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {formatPoints(preset)}
                </button>
              )}
            </For>
          </div>
          <span class="text-xs text-[var(--text-muted)]">/min</span>
        </div>
      }
    >
      <div
        class={cn(
          'rounded-xl border p-4 bg-[var(--background-secondary)] border-[var(--card-border)]/30 transition-all duration-300',
          disabled() && 'opacity-60',
          props.class
        )}
        style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-[var(--brand-teal-1)]/20">
              <Gauge class="h-4 w-4 text-[var(--brand-teal-1)]" />
            </div>
            <div>
              <p class="text-sm font-semibold text-[var(--text-primary)]">Spending Rate</p>
              <p class="text-xs text-[var(--text-muted)]">Points per minute</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-[var(--brand-teal-1)]">
              {formatPoints(props.value)}
            </p>
            <p class="text-xs text-[var(--text-muted)]">pts/min</p>
          </div>
        </div>

        {/* Slider */}
        <div class="mb-4">
          <input
            type="range"
            min={minRate}
            max={maxRate()}
            step={Math.floor((maxRate() - minRate) / 20) || 1}
            value={props.value}
            onInput={(e) => props.onInput(Number(e.currentTarget.value))}
            disabled={disabled()}
            aria-label="Spending rate"
            aria-valuemin={minRate}
            aria-valuemax={maxRate()}
            aria-valuenow={props.value}
            aria-valuetext={`${props.value} points per minute`}
            class={cn(
              'w-full h-2 rounded-lg appearance-none cursor-pointer',
              'bg-gradient-to-r from-blue-500 via-teal-500 to-amber-500',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
              '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
              '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab',
              '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--brand-teal-1)]',
              disabled() && 'cursor-not-allowed opacity-50'
            )}
          />
          <div class="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>{formatPoints(minRate)}</span>
            <span>{formatPoints(maxRate())}</span>
          </div>
        </div>

        {/* Presets */}
        <div class="flex gap-2 mb-4">
          <For each={presets()}>
            {(preset) => (
              <button
                onClick={() => handlePresetClick(preset)}
                disabled={disabled()}
                class={cn(
                  'flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all border',
                  props.value === preset
                    ? 'bg-[var(--brand-teal-1)]/20 border-[var(--brand-teal-1)]/50 text-[var(--brand-teal-1)]'
                    : 'bg-[var(--background-primary)] border-[var(--card-border)]/30 text-[var(--text-muted)] hover:border-[var(--card-border)]/50',
                  disabled() && 'cursor-not-allowed'
                )}
              >
                {formatPoints(preset)}
              </button>
            )}
          </For>
        </div>

        {/* Sustainability indicator */}
        <div class="flex items-center justify-between p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
          <div class="flex items-center gap-2">
            <Show
              when={hoursSustainable() > 24}
              fallback={
                <Show
                  when={hoursSustainable() > 1}
                  fallback={<TrendingDown class="h-4 w-4 text-red-400" />}
                >
                  <Zap class="h-4 w-4 text-amber-400" />
                </Show>
              }
            >
              <TrendingUp class="h-4 w-4 text-green-400" />
            </Show>
            <span class="text-sm text-[var(--text-muted)]">Sustainability</span>
          </div>
          <span class={cn(
            'text-sm font-medium',
            hoursSustainable() > 24 ? 'text-green-400' :
            hoursSustainable() > 1 ? 'text-amber-400' : 'text-red-400'
          )}>
            {hoursSustainable() > 24
              ? `${Math.floor(hoursSustainable() / 24)}+ days`
              : hoursSustainable() > 1
              ? `${Math.floor(hoursSustainable())}h ${Math.floor((hoursSustainable() % 1) * 60)}m`
              : `${Math.floor(minutesSustainable())}m`}
          </span>
        </div>
      </div>
    </Show>
  )
}
