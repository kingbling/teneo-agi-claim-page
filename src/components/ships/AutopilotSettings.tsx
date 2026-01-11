import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, BotOff, Gauge, Target, Sparkles, AlertTriangle, Check, X } from 'lucide-react'
import { useShipStore, type Ship, type AutopilotPreferences } from '@/stores/shipStore'
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
  className?: string
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
export function AutopilotSettings({
  ship,
  onClose,
  inline = false,
  className,
}: AutopilotSettingsProps) {
  const { toggleAutopilot, setAutopilotPreferences } = useShipStore()

  // Local state for form
  const [enabled, setEnabled] = useState(ship.autopilotEnabled)
  const [maxPointsPerMin, setMaxPointsPerMin] = useState(
    ship.autopilotPreferences?.maxPointsPerMin ?? 100
  )
  const [preferredTypes, setPreferredTypes] = useState<SynapseType[]>(
    ship.autopilotPreferences?.preferredSynapseTypes ?? ['minor', 'complex']
  )
  const [avoidCrowded, setAvoidCrowded] = useState(
    ship.autopilotPreferences?.avoidCrowded ?? true
  )
  const [isSaving, setIsSaving] = useState(false)

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
      if (enabled !== ship.autopilotEnabled) {
        await toggleAutopilot(ship.id, enabled)
      }

      // Update preferences
      const prefs: AutopilotPreferences = {
        maxPointsPerMin,
        preferredSynapseTypes: preferredTypes,
        avoidCrowded,
      }
      await setAutopilotPreferences(ship.id, prefs)

      onClose?.()
    } catch (error) {
      console.error('Failed to save autopilot settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const content = (
    <div className="space-y-5">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2.5 rounded-xl transition-colors',
              enabled
                ? 'bg-[var(--brand-teal-1)]/20'
                : 'bg-[var(--background-primary)]'
            )}
          >
            {enabled ? (
              <Bot className="h-5 w-5 text-[var(--brand-teal-1)]" />
            ) : (
              <BotOff className="h-5 w-5 text-[var(--text-muted)]" />
            )}
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Autopilot</p>
            <p className="text-xs text-[var(--text-muted)]">
              {enabled ? 'Auto-find next synapse when done' : 'Manual control'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle autopilot"
          className={cn(
            'relative w-12 h-6 rounded-full transition-colors',
            enabled ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--background-primary)]'
          )}
        >
          <motion.div
            animate={{ x: enabled ? 24 : 2 }}
            className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
          />
        </button>
      </div>

      {/* Settings (only shown when enabled) */}
      {enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 pt-4 border-t border-[var(--card-border)]/20"
        >
          {/* Max Spending Rate */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Max Spending Rate
              </span>
              <span className="ml-auto text-sm font-semibold text-[var(--brand-teal-1)]">
                {maxPointsPerMin}/min
              </span>
            </div>
            <div className="flex gap-2">
              {SPENDING_PRESETS.map(preset => (
                <button
                  key={preset}
                  onClick={() => setMaxPointsPerMin(preset)}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors border',
                    maxPointsPerMin === preset
                      ? 'bg-[var(--brand-teal-1)]/20 border-[var(--brand-teal-1)]/50 text-[var(--brand-teal-1)]'
                      : 'bg-[var(--background-primary)] border-[var(--card-border)]/30 text-[var(--text-muted)] hover:border-[var(--card-border)]/50'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Synapse Types */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Target Synapse Types
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SYNAPSE_TYPE_ORDER.map((type: SynapseType) => {
                const config = SYNAPSE_CONFIG[type]
                const colors = SYNAPSE_COLORS[type]
                const isSelected = preferredTypes.includes(type)

                return (
                  <button
                    key={type}
                    onClick={() => handleToggleType(type)}
                    className={cn(
                      'py-2 px-2 rounded-lg text-xs font-medium transition-all border capitalize',
                      isSelected
                        ? `${colors.bg} ${colors.border} ${colors.text}`
                        : 'bg-[var(--background-primary)] border-[var(--card-border)]/30 text-[var(--text-muted)] hover:border-[var(--card-border)]/50'
                    )}
                  >
                    {type}
                    <div className="text-[10px] opacity-70 mt-0.5">
                      {config.distribution === 'lottery' ? 'Lottery' : 'Share'}
                    </div>
                  </button>
                )
              })}
            </div>
            {preferredTypes.length === 0 && (
              <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Select at least one synapse type
              </p>
            )}
          </div>

          {/* Avoid Crowded Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Avoid Crowded Synapses
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Skip synapses with many explorers
                </p>
              </div>
            </div>
            <button
              onClick={() => setAvoidCrowded(!avoidCrowded)}
              role="switch"
              aria-checked={avoidCrowded}
              aria-label="Avoid crowded synapses"
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                avoidCrowded ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--background-secondary)]'
              )}
            >
              <motion.div
                animate={{ x: avoidCrowded ? 20 : 2 }}
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg border border-[var(--card-border)]/30 text-[var(--text-muted)] hover:bg-[var(--background-primary)] transition-colors flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || (enabled && preferredTypes.length === 0)}
          className={cn(
            'flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
            enabled && preferredTypes.length === 0
              ? 'bg-[var(--background-secondary)] text-[var(--text-muted)] cursor-not-allowed'
              : 'bg-[var(--brand-teal-1)] text-white hover:bg-[var(--brand-teal-1)]/90'
          )}
        >
          {isSaving ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  )

  if (inline) {
    return (
      <div className={cn('space-y-4', className)}>
        {content}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-5 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30',
        className
      )}
    >
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
        Autopilot Settings
      </h3>
      {content}
    </motion.div>
  )
}

/**
 * AutopilotQuickToggle - Minimal toggle for ship cards
 */
export interface AutopilotQuickToggleProps {
  ship: Ship
  className?: string
}

export function AutopilotQuickToggle({ ship, className }: AutopilotQuickToggleProps) {
  const { toggleAutopilot } = useShipStore()
  const [isToggling, setIsToggling] = useState(false)

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await toggleAutopilot(ship.id, !ship.autopilotEnabled)
    } catch (error) {
      console.error('Failed to toggle autopilot:', error)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      role="switch"
      aria-checked={ship.autopilotEnabled}
      aria-label={ship.autopilotEnabled ? 'Disable autopilot' : 'Enable autopilot'}
      className={cn(
        'p-1.5 rounded-lg transition-colors border',
        ship.autopilotEnabled
          ? 'bg-[var(--brand-teal-1)]/20 border-[var(--brand-teal-1)]/40 text-[var(--brand-teal-1)]'
          : 'bg-[var(--background-primary)] border-[var(--card-border)]/30 text-[var(--text-muted)] hover:border-[var(--card-border)]/50',
        isToggling && 'opacity-50',
        className
      )}
      title={ship.autopilotEnabled ? 'Disable autopilot' : 'Enable autopilot'}
    >
      {isToggling ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full"
        />
      ) : ship.autopilotEnabled ? (
        <Bot className="h-4 w-4" />
      ) : (
        <BotOff className="h-4 w-4" />
      )}
    </button>
  )
}
