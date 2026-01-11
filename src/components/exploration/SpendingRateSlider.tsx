import { motion } from 'framer-motion'
import { Gauge, Zap, TrendingUp, TrendingDown } from 'lucide-react'
import { SYNAPSE_CONFIG, type SynapseType, formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

export interface SpendingRateSliderProps {
  /** Current spending rate in points per minute */
  value: number
  /** Callback when spending rate changes */
  onChange: (rate: number) => void
  /** Synapse type for rate limits */
  synapseType: SynapseType
  /** User's available points balance */
  userPoints?: number
  /** Whether the slider is disabled */
  disabled?: boolean
  /** Compact mode */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * SpendingRateSlider - Control spending rate for synapse exploration
 *
 * Allows users to set their points per minute spending rate with
 * preset options and visual feedback on burn rate.
 */
export function SpendingRateSlider({
  value,
  onChange,
  synapseType,
  userPoints = 1000,
  disabled = false,
  compact = false,
  className,
}: SpendingRateSliderProps) {
  const config = SYNAPSE_CONFIG[synapseType]
  const minRate = 50 // Minimum spending rate across all synapse types
  const maxRate = config.maxPerMin

  // Calculate how long user can sustain this rate
  const minutesSustainable = userPoints / value
  const hoursSustainable = minutesSustainable / 60

  // Preset options based on synapse type
  const presets = [
    minRate,
    Math.floor((minRate + maxRate) / 4),
    Math.floor((minRate + maxRate) / 2),
    Math.floor((minRate + maxRate) * 3 / 4),
    maxRate,
  ].filter((v, i, arr) => arr.indexOf(v) === i) // Remove duplicates

  const handlePresetClick = (preset: number) => {
    if (!disabled) {
      onChange(Math.min(preset, maxRate))
    }
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Gauge className="h-4 w-4 text-[var(--text-muted)]" />
        <div className="flex gap-1.5">
          {presets.slice(0, 4).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              disabled={disabled}
              className={cn(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                value === preset
                  ? 'bg-[var(--brand-teal-1)] text-white'
                  : 'bg-[var(--background-primary)] text-[var(--text-muted)] hover:bg-[var(--background-secondary)]',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {formatPoints(preset)}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--text-muted)]">/min</span>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 bg-[var(--background-secondary)] border-[var(--card-border)]/30',
        disabled && 'opacity-60',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[var(--brand-teal-1)]/20">
            <Gauge className="h-4 w-4 text-[var(--brand-teal-1)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Spending Rate</p>
            <p className="text-xs text-[var(--text-muted)]">Points per minute</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-[var(--brand-teal-1)]">
            {formatPoints(value)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">pts/min</p>
        </div>
      </div>

      {/* Slider */}
      <div className="mb-4">
        <input
          type="range"
          min={minRate}
          max={maxRate}
          step={Math.floor((maxRate - minRate) / 20) || 1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          aria-label="Spending rate"
          aria-valuemin={minRate}
          aria-valuemax={maxRate}
          aria-valuenow={value}
          aria-valuetext={`${value} points per minute`}
          className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer',
            'bg-gradient-to-r from-blue-500 via-teal-500 to-amber-500',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
            '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab',
            '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--brand-teal-1)]',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
          <span>{formatPoints(minRate)}</span>
          <span>{formatPoints(maxRate)}</span>
        </div>
      </div>

      {/* Presets */}
      <div className="flex gap-2 mb-4">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            disabled={disabled}
            className={cn(
              'flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all border',
              value === preset
                ? 'bg-[var(--brand-teal-1)]/20 border-[var(--brand-teal-1)]/50 text-[var(--brand-teal-1)]'
                : 'bg-[var(--background-primary)] border-[var(--card-border)]/30 text-[var(--text-muted)] hover:border-[var(--card-border)]/50',
              disabled && 'cursor-not-allowed'
            )}
          >
            {formatPoints(preset)}
          </button>
        ))}
      </div>

      {/* Sustainability indicator */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
        <div className="flex items-center gap-2">
          {hoursSustainable > 24 ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : hoursSustainable > 1 ? (
            <Zap className="h-4 w-4 text-amber-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
          <span className="text-sm text-[var(--text-muted)]">Sustainability</span>
        </div>
        <span className={cn(
          'text-sm font-medium',
          hoursSustainable > 24 ? 'text-green-400' :
          hoursSustainable > 1 ? 'text-amber-400' : 'text-red-400'
        )}>
          {hoursSustainable > 24
            ? `${Math.floor(hoursSustainable / 24)}+ days`
            : hoursSustainable > 1
            ? `${Math.floor(hoursSustainable)}h ${Math.floor((hoursSustainable % 1) * 60)}m`
            : `${Math.floor(minutesSustainable)}m`}
        </span>
      </div>
    </motion.div>
  )
}
