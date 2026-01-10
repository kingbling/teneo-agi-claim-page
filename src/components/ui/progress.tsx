import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'rainbow'
  size?: 'sm' | 'default' | 'lg' | 'xl'
  showGlow?: boolean
  animated?: boolean
  showValue?: boolean
  showMilestones?: boolean
  milestones?: number[]
  label?: string
}

const variantStyles = {
  default: 'bg-gradient-to-r from-[var(--brand-teal-4)] to-[var(--brand-teal-1)]',
  success: 'bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--success))]/70',
  warning: 'bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--accent))]/70',
  danger: 'bg-gradient-to-r from-[hsl(var(--destructive))] to-[hsl(var(--destructive))]/70',
  rainbow: 'bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-[hsl(var(--success))]',
}

const glowStyles = {
  default: 'shadow-[0_0_8px_var(--brand-teal-1)]',
  success: 'shadow-[0_0_8px_hsl(var(--success)/0.6)]',
  warning: 'shadow-[0_0_8px_hsl(var(--accent)/0.6)]',
  danger: 'shadow-[0_0_8px_hsl(var(--destructive)/0.6)]',
  rainbow: 'shadow-[0_0_8px_hsl(var(--primary)/0.6)]',
}

const sizeStyles = {
  sm: 'h-2',
  default: 'h-3',
  lg: 'h-4',
  xl: 'h-5',
}

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({
  className,
  value = 0,
  indicatorClassName,
  variant = 'default',
  size = 'default',
  showGlow = false,
  animated = false,
  showValue = false,
  showMilestones = false,
  milestones = [25, 50, 75, 100],
  label,
  ...props
}, ref) => {
  const clampedValue = Math.max(0, Math.min(100, value ?? 0))

  return (
    <div className="w-full flex flex-col gap-1">
      {/* Label and value row */}
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
          )}
          {showValue && (
            <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}

      {/* Progress bar container */}
      <div className="relative">
        <ProgressPrimitive.Root
          ref={ref}
          className={cn(
            'relative w-full overflow-hidden rounded-full bg-[var(--background-tertiary)]/80',
            sizeStyles[size],
            className
          )}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              'h-full w-full flex-1 rounded-full transition-all duration-500 ease-out',
              variantStyles[variant],
              showGlow && glowStyles[variant],
              animated && 'relative overflow-hidden',
              indicatorClassName
            )}
            style={{ transform: `translateX(-${100 - clampedValue}%)` }}
          >
            {/* Animated shine effect */}
            {animated && (
              <div
                className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{ animationDuration: '2s' }}
              />
            )}
          </ProgressPrimitive.Indicator>
        </ProgressPrimitive.Root>

        {/* Milestone markers */}
        {showMilestones && milestones.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {milestones.map((milestone) => (
              <div
                key={milestone}
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-0.5 rounded-full transition-all duration-300',
                  sizeStyles[size],
                  clampedValue >= milestone
                    ? 'bg-white/60'
                    : 'bg-[var(--text-muted)]/30'
                )}
                style={{ left: `${milestone}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

// Circular progress for compact displays
interface CircularProgressProps {
  value: number
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'danger'
  showValue?: boolean
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
}

const circularSizes = {
  sm: 48,
  default: 64,
  lg: 80,
}

const circularVariantColors = {
  default: 'stroke-[var(--brand-teal-1)]',
  success: 'stroke-[hsl(var(--success))]',
  warning: 'stroke-[hsl(var(--accent))]',
  danger: 'stroke-[hsl(var(--destructive))]',
}

function CircularProgress({
  value = 0,
  size = 'default',
  variant = 'default',
  showValue = true,
  strokeWidth = 4,
  className,
  children,
}: CircularProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const dimension = circularSizes[size]
  const radius = (dimension - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clampedValue / 100) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={dimension}
        height={dimension}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          className="stroke-[var(--background-tertiary)]"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          className={cn(circularVariantColors[variant], 'transition-all duration-500 ease-out')}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showValue && (
          <span className={cn(
            'font-bold tabular-nums text-[var(--text-primary)]',
            size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm'
          )}>
            {Math.round(clampedValue)}%
          </span>
        ))}
      </div>
    </div>
  )
}

// Progress with segments for multi-step processes
interface SegmentedProgressProps {
  steps: number
  currentStep: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  labels?: string[]
}

function SegmentedProgress({
  steps,
  currentStep,
  variant = 'default',
  size = 'default',
  className,
  labels,
}: SegmentedProgressProps) {
  const segmentHeights = {
    sm: 'h-2',
    default: 'h-3',
    lg: 'h-4',
  }

  return (
    <div className={cn('w-full flex flex-col gap-1', className)}>
      <div className="flex gap-1">
        {Array.from({ length: steps }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'flex-1 rounded-full transition-all duration-300',
              segmentHeights[size],
              index < currentStep
                ? variantStyles[variant]
                : 'bg-[var(--background-tertiary)]/80'
            )}
          />
        ))}
      </div>

      {/* Labels */}
      {labels && labels.length > 0 && (
        <div className="flex justify-between">
          {labels.map((label, index) => (
            <span
              key={index}
              className={cn(
                'text-xs font-medium transition-colors',
                index < currentStep
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]'
              )}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Fuel gauge style progress for game resources
interface FuelGaugeProps {
  value: number
  maxValue?: number
  label?: string
  showValue?: boolean
  variant?: 'fuel' | 'energy' | 'health' | 'mana'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  icon?: React.ReactNode
}

const fuelVariantStyles = {
  fuel: {
    gradient: 'from-[hsl(var(--accent))] via-[hsl(var(--accent))]/70 to-[hsl(var(--accent))]/50',
    glow: 'shadow-[0_0_8px_hsl(var(--accent)/0.5)]',
    bg: 'bg-[hsl(var(--accent))]/10',
    text: 'text-[hsl(var(--accent))]',
  },
  energy: {
    gradient: 'from-[hsl(var(--primary))] via-[hsl(var(--primary))]/70 to-[hsl(var(--primary))]/50',
    glow: 'shadow-[0_0_8px_hsl(var(--primary)/0.5)]',
    bg: 'bg-[hsl(var(--primary))]/10',
    text: 'text-[hsl(var(--primary))]',
  },
  health: {
    gradient: 'from-[hsl(var(--destructive))] via-[hsl(var(--destructive))]/70 to-[hsl(var(--destructive))]/50',
    glow: 'shadow-[0_0_8px_hsl(var(--destructive)/0.5)]',
    bg: 'bg-[hsl(var(--destructive))]/10',
    text: 'text-[hsl(var(--destructive))]',
  },
  mana: {
    gradient: 'from-[hsl(var(--secondary))] via-[hsl(var(--secondary))]/70 to-[hsl(var(--secondary))]/50',
    glow: 'shadow-[0_0_8px_hsl(var(--secondary)/0.5)]',
    bg: 'bg-[hsl(var(--secondary))]/10',
    text: 'text-[hsl(var(--secondary))]',
  },
}

const fuelSizeStyles = {
  sm: { height: 'h-3', padding: 'p-0.5', text: 'text-xs' },
  default: { height: 'h-4', padding: 'p-0.5', text: 'text-sm' },
  lg: { height: 'h-5', padding: 'p-1', text: 'text-base' },
}

function FuelGauge({
  value,
  maxValue = 100,
  label,
  showValue = true,
  variant = 'fuel',
  size = 'default',
  className,
  icon,
}: FuelGaugeProps) {
  const percentage = Math.max(0, Math.min(100, (value / maxValue) * 100))
  const styles = fuelVariantStyles[variant]
  const sizeStyle = fuelSizeStyles[size]
  const isLow = percentage < 25
  const isCritical = percentage < 10

  return (
    <div className={cn('w-full flex flex-col gap-1', className)}>
      {/* Header */}
      {(label || showValue || icon) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {icon && (
              <div className={cn('rounded-lg px-1 py-0.5', styles.bg, styles.text)}>
                {icon}
              </div>
            )}
            {label && (
              <span className={cn('font-medium text-[var(--text-secondary)]', sizeStyle.text)}>
                {label}
              </span>
            )}
          </div>
          {showValue && (
            <span className={cn(
              'font-bold tabular-nums',
              sizeStyle.text,
              isCritical ? 'text-[hsl(var(--destructive))] animate-pulse' : isLow ? 'text-[hsl(var(--accent))]' : styles.text
            )}>
              {Math.round(value)}/{maxValue}
            </span>
          )}
        </div>
      )}

      {/* Gauge bar */}
      <div className={cn(
        'relative w-full rounded-full overflow-hidden',
        sizeStyle.height,
        styles.bg,
        sizeStyle.padding
      )}>
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out',
            styles.gradient,
            percentage > 50 && styles.glow,
            isCritical && 'animate-pulse'
          )}
          style={{ width: `${percentage}%` }}
        >
          {/* Animated shine */}
          <div
            className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{ animationDuration: '3s' }}
          />
        </div>

        {/* Segment markers */}
        <div className="absolute inset-0 flex pointer-events-none">
          {[25, 50, 75].map((mark) => (
            <div
              key={mark}
              className="absolute top-0 bottom-0 w-px bg-black/20"
              style={{ left: `${mark}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export { Progress, CircularProgress, SegmentedProgress, FuelGauge }
