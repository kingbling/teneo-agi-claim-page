import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Fuel } from 'lucide-react'
import { FUEL_PERCENT_THRESHOLDS } from '@/constants'

export interface FuelBarProps {
  /** Current fuel amount */
  current: number
  /** Maximum fuel capacity */
  max: number
  /** Optional label override */
  label?: string
  /** Whether to show status text */
  showStatus?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

/**
 * Get fuel status based on percentage
 */
function getFuelStatus(percent: number): { label: string; color: string; bg: string } {
  if (percent < FUEL_PERCENT_THRESHOLDS.CRITICAL) {
    return {
      label: '⚠ Critical',
      color: 'text-[hsl(var(--destructive))]',
      bg: 'bg-[hsl(var(--destructive))]/10',
    }
  }
  if (percent < FUEL_PERCENT_THRESHOLDS.LOW) {
    return {
      label: 'Low',
      color: 'text-[var(--brand-red-4)]',
      bg: 'bg-[var(--brand-red-4)]/10',
    }
  }
  return {
    label: '✓ Good',
    color: 'text-[hsl(var(--success))]',
    bg: 'bg-[hsl(var(--success))]/10',
  }
}

/**
 * Get gradient class based on percentage
 */
function getFuelGradient(percent: number): string {
  if (percent < FUEL_PERCENT_THRESHOLDS.CRITICAL) {
    return 'bg-gradient-to-r from-[hsl(var(--destructive))] to-[hsl(var(--destructive))]/80'
  }
  if (percent < FUEL_PERCENT_THRESHOLDS.LOW) {
    return 'bg-gradient-to-r from-[var(--brand-red-2)] to-[var(--brand-red-4)]'
  }
  return 'bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)]'
}

/**
 * Get container color class based on percentage
 */
function getContainerColor(percent: number): string {
  if (percent < FUEL_PERCENT_THRESHOLDS.CRITICAL) {
    return 'bg-[hsl(var(--destructive))]/10 border-[hsl(var(--destructive))]/30'
  }
  if (percent < FUEL_PERCENT_THRESHOLDS.LOW) {
    return 'bg-[var(--brand-red-4)]/10 border-[var(--brand-red-4)]/20'
  }
  return 'bg-[var(--background-primary)]/60 border-[var(--card-border)]/50'
}

const SIZES = {
  sm: {
    container: 'p-3',
    iconSize: 'h-4 w-4',
    barHeight: 'h-3',
    valueText: 'text-base',
    labelText: 'text-sm',
    gap: 'gap-3',
  },
  md: {
    container: 'p-4',
    iconSize: 'h-5 w-5',
    barHeight: 'h-4',
    valueText: 'text-xl',
    labelText: 'text-base',
    gap: 'gap-4',
  },
  lg: {
    container: 'p-6',
    iconSize: 'h-6 w-6',
    barHeight: 'h-5',
    valueText: 'text-2xl',
    labelText: 'text-lg',
    gap: 'gap-4',
  },
}

/**
 * FuelBar - Animated fuel/progress bar with status indicators
 *
 * Used for displaying:
 * - Agent fuel levels
 * - Resource amounts
 * - Any quantity with a max capacity
 */
export function FuelBar({
  current,
  max,
  label = 'Fuel',
  showStatus = true,
  size = 'md',
  className,
}: FuelBarProps) {
  const percent = Math.min(100, Math.max(0, (current / max) * 100))
  const status = getFuelStatus(percent)
  const gradient = getFuelGradient(percent)
  const containerColor = getContainerColor(percent)
  const sizeConfig = SIZES[size]

  return (
    <div className={cn('rounded-xl border', containerColor, sizeConfig.container, className)}>
      {/* Header: Icon + Label + Value */}
      <div className={cn('flex justify-between items-center mb-4', sizeConfig.gap)}>
        <span className={cn('flex items-center gap-4 text-[var(--text-secondary)]', sizeConfig.gap)}>
          <div className={cn(
            'rounded-xl flex items-center justify-center flex-shrink-0',
            percent < FUEL_PERCENT_THRESHOLDS.CRITICAL ? 'bg-[hsl(var(--destructive))]/20' :
            percent < FUEL_PERCENT_THRESHOLDS.LOW ? 'bg-[var(--brand-red-4)]/20' :
            'bg-[var(--brand-teal-1)]/20',
            size === 'sm' ? 'p-2' : size === 'md' ? 'p-3' : 'p-4'
          )}>
            <Fuel className={cn(
              percent < FUEL_PERCENT_THRESHOLDS.CRITICAL ? 'text-[hsl(var(--destructive))]' :
              percent < FUEL_PERCENT_THRESHOLDS.LOW ? 'text-[var(--brand-red-4)]' :
              'text-[var(--brand-teal-1)]',
              sizeConfig.iconSize
            )} />
          </div>
          <span className={cn('font-semibold', sizeConfig.labelText)}>{label}</span>
        </span>
        <span className={cn('font-bold tabular-nums', status.color, sizeConfig.valueText)}>
          {Math.round(current)} <span className="font-normal opacity-70">/ {max}</span>
        </span>
      </div>

      {/* Progress Bar */}
      <div className={cn(
        'rounded-full bg-[var(--background-primary)] overflow-hidden shadow-inner',
        sizeConfig.barHeight
      )}>
        <motion.div
          className={cn('h-full rounded-full relative', gradient)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </motion.div>
      </div>

      {/* Status Label */}
      {showStatus && (
        <div className={cn('flex justify-between items-center mt-4', sizeConfig.labelText)}>
          <span className={cn('font-semibold p-2 rounded-lg', status.color, status.bg)}>
            {status.label}
          </span>
          <span className="text-[var(--text-muted)] font-medium">{Math.round(percent)}% capacity</span>
        </div>
      )}
    </div>
  )
}

/**
 * CompactFuelBar - A smaller variant for tight spaces
 */
export interface CompactFuelBarProps {
  current: number
  max: number
  showLabel?: boolean
  className?: string
}

export function CompactFuelBar({ current, max, showLabel = true, className }: CompactFuelBarProps) {
  const percent = Math.min(100, Math.max(0, (current / max) * 100))
  const status = getFuelStatus(percent)
  const gradient = getFuelGradient(percent)

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {showLabel && (
        <span className="text-sm text-[var(--text-muted)]">Fuel</span>
      )}
      <div className="flex-1 h-2 rounded-full bg-[var(--background-primary)] overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', gradient)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className={cn('text-sm font-bold tabular-nums', status.color)}>
        {Math.round(current)}
      </span>
    </div>
  )
}
