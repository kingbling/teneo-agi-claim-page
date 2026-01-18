import { type JSX, splitProps, Show, For } from 'solid-js'
import { Progress as ProgressPrimitive } from '@kobalte/core/progress'
import { cn } from '@/lib/utils'

interface ProgressProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value?: number
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

function Progress(props: ProgressProps) {
  const [local, others] = splitProps(props, [
    'class',
    'value',
    'indicatorClassName',
    'variant',
    'size',
    'showGlow',
    'animated',
    'showValue',
    'showMilestones',
    'milestones',
    'label',
  ])

  const value = () => local.value ?? 0
  const variant = () => local.variant ?? 'default'
  const size = () => local.size ?? 'default'
  const milestones = () => local.milestones ?? [25, 50, 75, 100]
  const clampedValue = () => Math.max(0, Math.min(100, value()))

  return (
    <div class="w-full flex flex-col gap-1">
      {/* Label and value row */}
      <Show when={local.label || local.showValue}>
        <div class="flex items-center justify-between">
          <Show when={local.label}>
            <span class="text-sm font-medium text-[var(--text-secondary)]">{local.label}</span>
          </Show>
          <Show when={local.showValue}>
            <span class="text-sm font-bold tabular-nums text-[var(--text-primary)]">
              {Math.round(clampedValue())}%
            </span>
          </Show>
        </div>
      </Show>

      {/* Progress bar container */}
      <div class="relative">
        <ProgressPrimitive
          value={clampedValue()}
          minValue={0}
          maxValue={100}
          class={cn(
            'relative w-full overflow-hidden rounded-full bg-[var(--background-tertiary)]/80',
            sizeStyles[size()],
            local.class
          )}
          {...others}
        >
          <ProgressPrimitive.Track class="h-full w-full">
            <ProgressPrimitive.Fill
              class={cn(
                'h-full w-[var(--kb-progress-fill-width)] rounded-full transition-all duration-500 ease-out',
                variantStyles[variant()],
                local.showGlow && glowStyles[variant()],
                local.animated && 'relative overflow-hidden',
                local.indicatorClassName
              )}
            >
              {/* Animated shine effect */}
              <Show when={local.animated}>
                <div
                  class="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  style={{ "animation-duration": '2s' }}
                />
              </Show>
            </ProgressPrimitive.Fill>
          </ProgressPrimitive.Track>
        </ProgressPrimitive>

        {/* Milestone markers */}
        <Show when={local.showMilestones && milestones().length > 0}>
          <div class="absolute inset-0 pointer-events-none">
            <For each={milestones()}>
              {(milestone) => (
                <div
                  class={cn(
                    'absolute top-1/2 -translate-y-1/2 w-0.5 rounded-full transition-all duration-300',
                    sizeStyles[size()],
                    clampedValue() >= milestone
                      ? 'bg-white/60'
                      : 'bg-[var(--text-muted)]/30'
                  )}
                  style={{ left: `${milestone}%` }}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}

// Circular progress for compact displays
interface CircularProgressProps {
  value: number
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'danger'
  showValue?: boolean
  strokeWidth?: number
  class?: string
  children?: JSX.Element
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

function CircularProgress(props: CircularProgressProps) {
  const value = () => props.value ?? 0
  const size = () => props.size ?? 'default'
  const variant = () => props.variant ?? 'default'
  const showValue = () => props.showValue ?? true
  const strokeWidth = () => props.strokeWidth ?? 4

  const clampedValue = () => Math.max(0, Math.min(100, value()))
  const dimension = () => circularSizes[size()]
  const radius = () => (dimension() - strokeWidth()) / 2
  const circumference = () => 2 * Math.PI * radius()
  const offset = () => circumference() - (clampedValue() / 100) * circumference()

  return (
    <div class={cn('relative inline-flex items-center justify-center', props.class)}>
      <svg
        width={dimension()}
        height={dimension()}
        class="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={dimension() / 2}
          cy={dimension() / 2}
          r={radius()}
          fill="none"
          class="stroke-[var(--background-tertiary)]"
          stroke-width={strokeWidth()}
        />
        {/* Progress circle */}
        <circle
          cx={dimension() / 2}
          cy={dimension() / 2}
          r={radius()}
          fill="none"
          class={cn(circularVariantColors[variant()], 'transition-all duration-500 ease-out')}
          stroke-width={strokeWidth()}
          stroke-linecap="round"
          stroke-dasharray={circumference()}
          stroke-dashoffset={offset()}
        />
      </svg>

      {/* Center content */}
      <div class="absolute inset-0 flex items-center justify-center">
        <Show when={props.children} fallback={
          <Show when={showValue()}>
            <span class={cn(
              'font-bold tabular-nums text-[var(--text-primary)]',
              size() === 'sm' ? 'text-xs' : size() === 'lg' ? 'text-lg' : 'text-sm'
            )}>
              {Math.round(clampedValue())}%
            </span>
          </Show>
        }>
          {props.children}
        </Show>
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
  class?: string
  labels?: string[]
}

function SegmentedProgress(props: SegmentedProgressProps) {
  const variant = () => props.variant ?? 'default'
  const size = () => props.size ?? 'default'

  const segmentHeights = {
    sm: 'h-2',
    default: 'h-3',
    lg: 'h-4',
  }

  return (
    <div class={cn('w-full flex flex-col gap-1', props.class)}>
      <div class="flex gap-1">
        <For each={Array.from({ length: props.steps })}>
          {(_, index) => (
            <div
              class={cn(
                'flex-1 rounded-full transition-all duration-300',
                segmentHeights[size()],
                index() < props.currentStep
                  ? variantStyles[variant()]
                  : 'bg-[var(--background-tertiary)]/80'
              )}
            />
          )}
        </For>
      </div>

      {/* Labels */}
      <Show when={props.labels && props.labels.length > 0}>
        <div class="flex justify-between">
          <For each={props.labels}>
            {(label, index) => (
              <span
                class={cn(
                  'text-xs font-medium transition-colors',
                  index() < props.currentStep
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)]'
                )}
              >
                {label}
              </span>
            )}
          </For>
        </div>
      </Show>
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
  class?: string
  icon?: JSX.Element
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

function FuelGauge(props: FuelGaugeProps) {
  const maxValue = () => props.maxValue ?? 100
  const showValue = () => props.showValue ?? true
  const variant = () => props.variant ?? 'fuel'
  const size = () => props.size ?? 'default'

  const percentage = () => Math.max(0, Math.min(100, (props.value / maxValue()) * 100))
  const styles = () => fuelVariantStyles[variant()]
  const sizeStyle = () => fuelSizeStyles[size()]
  const isLow = () => percentage() < 25
  const isCritical = () => percentage() < 10

  return (
    <div class={cn('w-full flex flex-col gap-1', props.class)}>
      {/* Header */}
      <Show when={props.label || showValue() || props.icon}>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1">
            <Show when={props.icon}>
              <div class={cn('rounded-lg px-1 py-0.5', styles().bg, styles().text)}>
                {props.icon}
              </div>
            </Show>
            <Show when={props.label}>
              <span class={cn('font-medium text-[var(--text-secondary)]', sizeStyle().text)}>
                {props.label}
              </span>
            </Show>
          </div>
          <Show when={showValue()}>
            <span class={cn(
              'font-bold tabular-nums',
              sizeStyle().text,
              isCritical() ? 'text-[hsl(var(--destructive))] animate-pulse' : isLow() ? 'text-[hsl(var(--accent))]' : styles().text
            )}>
              {Math.round(props.value)}/{maxValue()}
            </span>
          </Show>
        </div>
      </Show>

      {/* Gauge bar */}
      <div class={cn(
        'relative w-full rounded-full overflow-hidden',
        sizeStyle().height,
        styles().bg,
        sizeStyle().padding
      )}>
        <div
          class={cn(
            'h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out',
            styles().gradient,
            percentage() > 50 && styles().glow,
            isCritical() && 'animate-pulse'
          )}
          style={{ width: `${percentage()}%` }}
        >
          {/* Animated shine */}
          <div
            class="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{ "animation-duration": '3s' }}
          />
        </div>

        {/* Segment markers */}
        <div class="absolute inset-0 flex pointer-events-none">
          <For each={[25, 50, 75]}>
            {(mark) => (
              <div
                class="absolute top-0 bottom-0 w-px bg-black/20"
                style={{ left: `${mark}%` }}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

export { Progress, CircularProgress, SegmentedProgress, FuelGauge }
