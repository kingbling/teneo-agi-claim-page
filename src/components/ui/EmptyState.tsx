import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { Sparkles, Zap } from 'lucide-solid'
import { Button } from './button'

interface EmptyStateProps {
  icon?: Component<{ class?: string }>
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'default'
  size?: 'sm' | 'default' | 'lg'
}

const variantConfig = {
  default: {
    icon: Sparkles,
    gradient: 'from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20',
    iconColor: 'text-[var(--brand-teal-1)]',
    iconBg: 'bg-[var(--brand-teal-1)]/10',
  },
}

const sizeConfig = {
  sm: {
    container: 'py-[var(--space-8)] px-[var(--space-6)]',
    iconWrapper: 'w-14 h-14',
    icon: 'h-7 w-7',
    title: 'text-base',
    description: 'text-sm max-w-[var(--content-max-sm)]',
    button: 'h-10',
  },
  default: {
    container: 'py-[var(--space-12)] px-[var(--space-8)]',
    iconWrapper: 'w-20 h-20',
    icon: 'h-10 w-10',
    title: 'text-lg',
    description: 'text-base max-w-[var(--content-max-md)]',
    button: 'h-11',
  },
  lg: {
    container: 'py-[var(--space-16)] px-[var(--space-10)]',
    iconWrapper: 'w-24 h-24',
    icon: 'h-12 w-12',
    title: 'text-xl',
    description: 'text-base max-w-[var(--content-max-lg)]',
    button: 'h-12',
  },
}

export function EmptyState(props: EmptyStateProps) {
  const variant = () => props.variant ?? 'default'
  const size = () => props.size ?? 'default'
  const config = () => variantConfig[variant()]
  const sizes = () => sizeConfig[size()]
  const Icon = () => props.icon ?? config().icon

  return (
    <div
      class={`flex flex-col items-center justify-center text-center empty-state-enter ${sizes().container}`}
    >
      {/* Animated icon with rings */}
      <div class="relative mb-[var(--space-6)]">
        {/* Pulse rings */}
        <div
          class={`absolute inset-0 rounded-full bg-gradient-to-r ${config().gradient} blur-xl pulse-ring`}
        />

        {/* Outer ring */}
        <div
          class={`absolute -inset-[var(--space-3)] rounded-full border border-current ${config().iconColor} opacity-10 outer-ring-pulse`}
        />

        {/* Icon container */}
        <div
          class={`relative ${sizes().iconWrapper} rounded-[var(--radius-2xl)] ${config().iconBg} border border-current/10 flex items-center justify-center shadow-lg icon-wiggle`}
        >
          <Icon class={`${sizes().icon} ${config().iconColor}`} />
        </div>
      </div>

      {/* Title */}
      <h3 class={`font-bold text-[var(--text-primary)] mb-[var(--space-3)] ${sizes().title}`}>
        {props.title}
      </h3>

      {/* Description */}
      <p class={`text-[var(--text-tertiary)] leading-relaxed mb-[var(--space-6)] ${sizes().description}`}>
        {props.description}
      </p>

      {/* Action button */}
      <Show when={props.actionLabel && props.onAction}>
        <Button
          onClick={props.onAction}
          class={`gap-[var(--space-2)] ${sizes().button}`}
        >
          <Zap class="h-[var(--space-4)] w-[var(--space-4)]" />
          {props.actionLabel}
        </Button>
      </Show>
    </div>
  )
}
