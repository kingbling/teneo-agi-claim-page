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

export { Progress }
