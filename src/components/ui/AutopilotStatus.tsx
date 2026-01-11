import { motion } from 'framer-motion'
import { Bot, BotOff, Gauge, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Ship } from '@/stores/shipStore'
import { type SynapseType } from '@/types/game'

export interface AutopilotStatusProps {
  /** Ship to display autopilot status for */
  ship: Ship
  /** Compact mode for ship cards */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * AutopilotStatus - Displays autopilot status for a ship
 *
 * Shows whether autopilot is enabled/disabled and current settings
 * including minimum synapse type and spending rate preferences.
 */
export function AutopilotStatus({
  ship,
  compact = false,
  className,
}: AutopilotStatusProps) {
  const isEnabled = ship.autopilotEnabled
  const prefs = ship.autopilotPreferences

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors',
          isEnabled
            ? 'bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/30 text-[var(--brand-teal-1)]'
            : 'bg-[var(--background-secondary)] border-[var(--card-border)]/30 text-[var(--text-muted)]',
          className
        )}
      >
        {isEnabled ? (
          <>
            <Bot className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Auto</span>
            {prefs?.maxPointsPerMin && (
              <span className="text-xs opacity-70">
                {prefs.maxPointsPerMin}/min
              </span>
            )}
          </>
        ) : (
          <>
            <BotOff className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Manual</span>
          </>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-all',
        isEnabled
          ? 'bg-gradient-to-br from-[var(--brand-teal-1)]/10 to-[var(--background-primary)] border-[var(--brand-teal-1)]/30'
          : 'bg-[var(--background-secondary)] border-[var(--card-border)]/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'p-2 rounded-lg',
              isEnabled
                ? 'bg-[var(--brand-teal-1)]/20'
                : 'bg-[var(--background-primary)]'
            )}
          >
            {isEnabled ? (
              <Bot className="h-4 w-4 text-[var(--brand-teal-1)]" />
            ) : (
              <BotOff className="h-4 w-4 text-[var(--text-muted)]" />
            )}
          </div>
          <div>
            <p className={cn(
              'font-semibold text-sm',
              isEnabled ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
            )}>
              Autopilot
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>

        {/* Status indicator */}
        {isEnabled && (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2.5 h-2.5 rounded-full bg-[var(--brand-teal-1)]"
          />
        )}
      </div>

      {/* Settings (only when enabled and has preferences) */}
      {isEnabled && prefs && (
        <div className="space-y-2 pt-3 border-t border-[var(--card-border)]/20">
          {/* Spending Rate */}
          {prefs.maxPointsPerMin && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Gauge className="h-3.5 w-3.5" />
                <span>Max Rate</span>
              </div>
              <span className="font-medium text-[var(--text-primary)]">
                {prefs.maxPointsPerMin}/min
              </span>
            </div>
          )}

          {/* Preferred Synapse Types */}
          {prefs.preferredSynapseTypes && prefs.preferredSynapseTypes.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Zap className="h-3.5 w-3.5" />
                <span>Targets</span>
              </div>
              <div className="flex gap-1">
                {prefs.preferredSynapseTypes.slice(0, 3).map((type) => (
                  <SynapseTypePill key={type} type={type} />
                ))}
                {prefs.preferredSynapseTypes.length > 3 && (
                  <span className="text-xs text-[var(--text-muted)]">
                    +{prefs.preferredSynapseTypes.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Avoid Crowded */}
          {prefs.avoidCrowded && (
            <div className="text-xs text-[var(--text-muted)] mt-2">
              Avoiding crowded synapses
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

/**
 * AutopilotIndicator - Minimal autopilot indicator for lists
 */
export interface AutopilotIndicatorProps {
  enabled: boolean
  className?: string
}

export function AutopilotIndicator({ enabled, className }: AutopilotIndicatorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5',
        enabled ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]',
        className
      )}
    >
      {enabled ? <Bot className="h-3.5 w-3.5" /> : <BotOff className="h-3.5 w-3.5" />}
      <span className="text-xs font-medium">
        {enabled ? 'Auto' : 'Manual'}
      </span>
    </div>
  )
}

// Small synapse type pill
function SynapseTypePill({ type }: { type: SynapseType }) {
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
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium capitalize', colors[type])}>
      {type}
    </span>
  )
}
