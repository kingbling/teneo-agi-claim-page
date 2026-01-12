import { Show, type JSX, type Component } from 'solid-js'
import type { LucideIcon } from 'lucide-solid'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  action?: JSX.Element
  gradient?: 'teal' | 'purple' | 'rose' | 'yellow' | 'cyan' | 'amber'
  class?: string
  size?: 'sm' | 'default' | 'lg'
}

const gradients = {
  teal: 'from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 text-[var(--brand-teal-1)]',
  purple: 'from-[hsl(var(--tier-mythic))]/20 to-[hsl(var(--tier-trait))]/20 text-[hsl(var(--tier-mythic))]',
  rose: 'from-[hsl(var(--destructive))]/20 to-[hsl(var(--accent))]/20 text-[hsl(var(--destructive))]',
  yellow: 'from-[hsl(var(--state-solving))]/20 to-[hsl(var(--accent))]/20 text-[hsl(var(--state-solving))]',
  cyan: 'from-[var(--brand-blue-2)]/20 to-[var(--brand-blue-2)]/20 text-[var(--brand-blue-2)]',
  amber: 'from-[hsl(var(--accent))]/20 to-[hsl(var(--state-solving))]/20 text-[hsl(var(--accent))]',
}

const sizeStyles = {
  sm: {
    container: 'gap-2 mb-3',
    iconWrapper: 'w-8 h-8 rounded-lg',
    icon: 'h-4 w-4',
    title: 'text-sm font-semibold',
    subtitle: 'text-xs',
  },
  default: {
    container: 'gap-3 mb-4',
    iconWrapper: 'w-9 h-9 rounded-lg',
    icon: 'h-4 w-4',
    title: 'text-base font-semibold',
    subtitle: 'text-sm',
  },
  lg: {
    container: 'gap-4 mb-5',
    iconWrapper: 'w-12 h-12 rounded-lg',
    icon: 'h-6 w-6',
    title: 'text-lg font-bold',
    subtitle: 'text-sm',
  },
}

export function SectionHeader(props: SectionHeaderProps) {
  const gradient = () => props.gradient ?? 'teal'
  const size = () => props.size ?? 'default'
  const styles = () => sizeStyles[size()]
  const gradientClass = () => gradients[gradient()]
  const textColor = () => gradientClass().split(' ').pop() // Get the text color from gradient

  return (
    <div class={cn('flex items-center justify-between', styles().container, props.class)}>
      <div class="flex items-center gap-3">
        <Show when={props.icon}>
          {(Icon) => (
            <div class={cn('flex items-center justify-center', styles().iconWrapper, 'bg-gradient-to-br', gradientClass())}>
              <Icon class={cn(styles().icon, textColor())} />
            </div>
          )}
        </Show>
        <div>
          <h3 class={cn('text-foreground', styles().title)}>{props.title}</h3>
          <Show when={props.subtitle}>
            <p class={cn('text-muted-foreground mt-1', styles().subtitle)}>{props.subtitle}</p>
          </Show>
        </div>
      </div>

      <Show when={props.action}>
        <div class="flex items-center">{props.action}</div>
      </Show>
    </div>
  )
}

// Divider variant for section breaks
interface SectionDividerProps {
  label?: string
  class?: string
}

export function SectionDivider(props: SectionDividerProps) {
  return (
    <Show
      when={props.label}
      fallback={<div class={cn('h-px bg-border my-5', props.class)} />}
    >
      <div class={cn('flex items-center gap-4 my-6', props.class)}>
        <div class="flex-1 h-px bg-border" />
        <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">{props.label}</span>
        <div class="flex-1 h-px bg-border" />
      </div>
    </Show>
  )
}

// Stat display for section headers
interface StatDisplayProps {
  value: string | number
  label: string
  color?: string
  size?: 'sm' | 'default'
}

export function StatDisplay(props: StatDisplayProps) {
  const color = () => props.color ?? 'text-[var(--brand-teal-1)]'
  const size = () => props.size ?? 'default'

  return (
    <div class={cn('text-right', size() === 'sm' ? 'space-y-1' : 'space-y-1')}>
      <div class={cn('font-bold tabular-nums', color(), size() === 'sm' ? 'text-sm' : 'text-lg')}>{props.value}</div>
      <div class={cn('text-muted-foreground uppercase tracking-wide', size() === 'sm' ? 'text-[9px]' : 'text-[10px]')}>
        {props.label}
      </div>
    </div>
  )
}
