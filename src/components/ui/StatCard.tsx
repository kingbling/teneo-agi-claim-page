import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Color variants for stat cards
 */
export type StatCardColor = 'primary' | 'success' | 'warning' | 'destructive' | 'accent' | 'neutral'

/**
 * Stat card variant configurations
 */
const STAT_CARD_COLORS: Record<StatCardColor, { bg: string; text: string; border: string; icon: string; glow?: string }> = {
  primary: {
    bg: 'bg-[var(--brand-teal-1)]/10',
    text: 'text-[var(--brand-teal-1)]',
    border: 'border-[var(--brand-teal-1)]/20',
    icon: 'text-[var(--brand-teal-1)]',
    glow: 'hover:shadow-[var(--brand-teal-1)]/20',
  },
  success: {
    bg: 'bg-[hsl(var(--success))]/10',
    text: 'text-[hsl(var(--success))]',
    border: 'border-[hsl(var(--success))]/30',
    icon: 'text-[hsl(var(--success))]',
    glow: 'hover:shadow-[hsl(var(--success))]/20',
  },
  warning: {
    bg: 'bg-[var(--brand-red-4)]/10',
    text: 'text-[var(--brand-red-4)]',
    border: 'border-[var(--brand-red-4)]/20',
    icon: 'text-[var(--brand-red-4)]',
    glow: 'hover:shadow-[var(--brand-red-4)]/20',
  },
  destructive: {
    bg: 'bg-[hsl(var(--destructive))]/10',
    text: 'text-[hsl(var(--destructive))]',
    border: 'border-[hsl(var(--destructive))]/30',
    icon: 'text-[hsl(var(--destructive))]',
    glow: 'hover:shadow-[hsl(var(--destructive))]/20',
  },
  accent: {
    bg: 'bg-[hsl(var(--accent))]/10',
    text: 'text-[hsl(var(--accent))]',
    border: 'border-[hsl(var(--accent))]/20',
    icon: 'text-[hsl(var(--accent))]',
    glow: 'hover:shadow-[hsl(var(--accent))]/20',
  },
  neutral: {
    bg: 'bg-muted/50',
    text: 'text-foreground',
    border: 'border-border/50',
    icon: 'text-muted-foreground',
  },
}

export interface StatCardProps {
  /** Label text displayed above the value */
  label: string
  /** Main value to display */
  value: string | number
  /** Optional icon component */
  icon?: React.ReactNode
  /** Color variant for the card */
  color?: StatCardColor
  /** Optional trend information */
  trend?: { value: number; label: string }
  /** Whether to show a glow effect on hover */
  glow?: boolean
  /** Optional sub-label displayed below the value */
  subLabel?: string
  /** Whether the stat should show a pulse animation (for active states) */
  pulse?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * StatCard - A flexible stat card component for displaying metrics
 *
 * Used throughout the app for displaying metrics like:
 * - Agent counts and states
 * - Discovery progress
 * - Loot/rewards
 * - Resource levels
 */
export function StatCard({
  label,
  value,
  icon,
  color = 'neutral',
  trend,
  glow = false,
  subLabel,
  pulse = false,
  className,
}: StatCardProps) {
  const colors = STAT_CARD_COLORS[color]

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        'group relative rounded-2xl p-6 border transition-all duration-200 cursor-default',
        colors.bg,
        colors.border,
        glow && colors.glow,
        className
      )}
    >
      {/* Hover glow overlay */}
      {glow && (
        <div className={cn(
          'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity',
          colors.bg
        )} />
      )}

      <div className="relative flex items-center gap-4">
        {/* Icon with optional pulse background */}
        {icon && (
          <div className="relative flex-shrink-0">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              colors.bg
            )}>
              {pulse && (
                <motion.div
                  className={cn('absolute inset-0 w-10 h-10 rounded-full', colors.text.replace('text-', 'bg-'))}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <div className={cn('relative z-10', colors.icon)}>
                {icon}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm text-muted-foreground uppercase tracking-wide mb-2 font-semibold">
            {label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-2xl font-bold tabular-nums', colors.text)}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {trend && (
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                trend.value > 0 ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' : 'bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]'
              )}>
                {trend.value > 0 ? '+' : ''}{trend.value}
              </span>
            )}
          </div>
          {subLabel && (
            <span className="text-xs text-muted-foreground mt-1">
              {subLabel}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/**
 * CompactStatCard - A smaller variant for tight spaces
 */
export interface CompactStatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  color?: StatCardColor
  className?: string
}

export function CompactStatCard({
  label,
  value,
  icon,
  color = 'neutral',
  className,
}: CompactStatCardProps) {
  const colors = STAT_CARD_COLORS[color]

  return (
    <div className={cn(
      'flex items-center justify-between p-4 rounded-xl border',
      colors.bg,
      colors.border,
      className
    )}>
      <div className="flex items-center gap-3">
        {icon && <div className={cn(colors.icon)}>{icon}</div>}
        <span className="text-sm text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span className={cn('text-lg font-bold tabular-nums', colors.text)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  )
}
