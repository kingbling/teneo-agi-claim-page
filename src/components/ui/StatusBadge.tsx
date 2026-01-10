import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Agent/game states that can be displayed
 */
export type StatusType =
  | 'idle'
  | 'active'
  | 'solving'
  | 'deploying'
  | 'wandering'
  | 'searching'
  | 'limping_home'
  | 'exhausted'
  | 'returning'

/**
 * Status badge variants with consistent styling
 */
const STATUS_CONFIGS: Record<StatusType, { label: string; color: string; bg: string; glow: string }> = {
  idle: { label: 'Idle', color: 'text-[hsl(var(--state-idle))]', bg: 'bg-[hsl(var(--state-idle))]/10', glow: '' },
  active: { label: 'Active', color: 'text-[hsl(var(--primary))]', bg: 'bg-[hsl(var(--primary))]/10', glow: 'shadow-[hsl(var(--primary))]/30' },
  solving: { label: 'Solving', color: 'text-[hsl(var(--state-solving))]', bg: 'bg-[hsl(var(--state-solving))]/10', glow: 'shadow-[hsl(var(--state-solving))]/30' },
  deploying: { label: 'Deploying', color: 'text-[hsl(var(--state-deploying))]', bg: 'bg-[hsl(var(--state-deploying))]/10', glow: 'shadow-[hsl(var(--state-deploying))]/30' },
  wandering: { label: 'Wandering', color: 'text-[hsl(var(--state-wandering))]', bg: 'bg-[hsl(var(--state-wandering))]/10', glow: 'shadow-[hsl(var(--state-wandering))]/30' },
  searching: { label: 'Searching', color: 'text-[hsl(var(--state-exploring))]', bg: 'bg-[hsl(var(--state-exploring))]/10', glow: 'shadow-[hsl(var(--state-exploring))]/30' },
  limping_home: { label: 'Limping Home', color: 'text-[hsl(var(--state-limping))]', bg: 'bg-[hsl(var(--state-limping))]/10', glow: 'shadow-[hsl(var(--state-limping))]/30' },
  exhausted: { label: 'Exhausted', color: 'text-[hsl(var(--state-exhausted))]', bg: 'bg-[hsl(var(--state-exhausted))]/10', glow: 'shadow-[hsl(var(--state-exhausted))]/30' },
  returning: { label: 'Returning', color: 'text-[hsl(var(--state-returning))]', bg: 'bg-[hsl(var(--state-returning))]/10', glow: 'shadow-[hsl(var(--state-returning))]/30' },
}

export interface StatusBadgeProps {
  /** The status type to display */
  status: StatusType
  /** Optional custom label (overrides default) */
  label?: string
  /** Whether to show a pulse animation for active states */
  showPulse?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

/**
 * StatusBadge - Consistent status badges with pulse effects
 *
 * Used for displaying agent states, connection status, and other
 * status indicators throughout the application.
 */
export function StatusBadge({
  status,
  label,
  showPulse = false,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIGS[status]

  const sizes = {
    sm: 'text-xs px-2 py-0.5 rounded-md',
    md: 'text-sm px-3 py-1 rounded-full',
    lg: 'text-base px-4 py-1.5 rounded-full',
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-2 font-semibold border border-current/20 shadow-sm transition-all',
      config.bg,
      config.color,
      config.glow,
      sizes[size],
      className
    )}>
      {/* Pulse dot for active states */}
      {showPulse && (
        <span className="relative flex items-center justify-center">
          <span className={cn('w-2 h-2 rounded-full', config.color.replace('text-', 'bg-'))} />
          <motion.span
            className={cn('absolute w-2 h-2 rounded-full', config.color.replace('text-', 'bg-'))}
            animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      )}
      <span>{label || config.label}</span>
    </span>
  )
}

/**
 * StatusDot - A minimal status indicator with just a colored dot
 */
export interface StatusDotProps {
  status: StatusType
  showPulse?: boolean
  className?: string
}

export function StatusDot({ status, showPulse = false, className }: StatusDotProps) {
  const config = STATUS_CONFIGS[status]
  const bgClass = config.color.replace('text-', 'bg-')

  return (
    <span className={cn('relative flex items-center justify-center', className)}>
      <span className={cn('w-2 h-2 rounded-full', bgClass)} />
      {showPulse && (
        <motion.span
          className={cn('absolute w-2 h-2 rounded-full', bgClass)}
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </span>
  )
}

/**
 * StatusIndicator - A status indicator with label and optional dot
 */
export interface StatusIndicatorProps {
  status: StatusType
  label?: string
  showDot?: boolean
  showPulse?: boolean
  className?: string
}

export function StatusIndicator({
  status,
  label,
  showDot = true,
  showPulse = false,
  className,
}: StatusIndicatorProps) {
  const config = STATUS_CONFIGS[status]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showDot && <StatusDot status={status} showPulse={showPulse} />}
      <span className={cn('text-sm font-medium', config.color)}>
        {label || config.label}
      </span>
    </div>
  )
}
