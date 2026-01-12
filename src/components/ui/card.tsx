import { cn } from '@/lib/utils'
import type { JSX, ParentComponent } from 'solid-js'
import { Show, splitProps } from 'solid-js'

interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  glow?: boolean
  interactive?: boolean
  size?: 'compact' | 'sm' | 'default' | 'lg' | 'xl'
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost' | 'gradient' | 'success' | 'warning' | 'danger'
  highlight?: boolean
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void)
}

const sizeClasses = {
  compact: 'p-3',
  sm: 'p-5',
  default: 'p-6',
  lg: 'p-8',
  xl: 'p-10',
}

const variantClasses = {
  default: 'border border-[var(--card-border)] bg-[var(--card-background)] shadow-lg',
  elevated: 'border border-[var(--card-border)] bg-[var(--background-secondary)] shadow-xl shadow-black/20',
  outlined: 'border-2 border-[var(--card-border)] bg-transparent',
  ghost: 'border-0 bg-[var(--background-primary)]/40',
  gradient: 'border border-[var(--card-border)] bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
  success: 'border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 shadow-lg shadow-[hsl(var(--success))]/10',
  warning: 'border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 shadow-lg shadow-[hsl(var(--accent))]/10',
  danger: 'border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 shadow-lg shadow-[hsl(var(--destructive))]/10',
}

const Card: ParentComponent<CardProps> = (props) => {
  const [local, others] = splitProps(props, [
    'class',
    'glow',
    'interactive',
    'size',
    'variant',
    'highlight',
    'children',
    'ref',
  ])

  const size = () => local.size ?? 'default'
  const variant = () => local.variant ?? 'default'

  return (
    <div
      ref={local.ref}
      class={cn(
        'rounded-2xl transition-all duration-200',
        sizeClasses[size()],
        variantClasses[variant()],
        local.glow && 'shadow-[0_0_20px_var(--brand-teal-1)/15] border-[var(--brand-teal-4)]',
        local.highlight && 'ring-2 ring-[var(--brand-teal-1)]/30 ring-offset-2 ring-offset-[var(--background-primary)]',
        local.interactive && 'cursor-pointer hover:border-[var(--card-border-hover)] hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:shadow-lg',
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  )
}

interface CardHeaderProps extends JSX.HTMLAttributes<HTMLDivElement> {
  spacing?: 'compact' | 'default' | 'relaxed'
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void)
}

const headerSpacingClasses = {
  compact: 'gap-1.5 pb-3',
  default: 'gap-2.5 pb-5',
  relaxed: 'gap-3 pb-6',
}

const CardHeader: ParentComponent<CardHeaderProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'spacing', 'children', 'ref'])
  const spacing = () => local.spacing ?? 'default'

  return (
    <div
      ref={local.ref}
      class={cn('flex flex-col', headerSpacingClasses[spacing()], local.class)}
      {...others}
    >
      {local.children}
    </div>
  )
}

interface CardTitleProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
  size?: 'sm' | 'default' | 'lg'
  ref?: HTMLHeadingElement | ((el: HTMLHeadingElement) => void)
}

const titleSizeClasses = {
  sm: 'text-base font-semibold',
  default: 'text-lg font-bold',
  lg: 'text-xl font-bold',
}

const CardTitle: ParentComponent<CardTitleProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'size', 'children', 'ref'])
  const size = () => local.size ?? 'default'

  return (
    <h3
      ref={local.ref}
      class={cn(
        'leading-tight tracking-tight text-[var(--text-primary)]',
        titleSizeClasses[size()],
        local.class
      )}
      {...others}
    >
      {local.children}
    </h3>
  )
}

interface CardDescriptionProps extends JSX.HTMLAttributes<HTMLParagraphElement> {
  ref?: HTMLParagraphElement | ((el: HTMLParagraphElement) => void)
}

const CardDescription: ParentComponent<CardDescriptionProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children', 'ref'])

  return (
    <p
      ref={local.ref}
      class={cn('text-sm text-[var(--text-tertiary)] mt-2 leading-relaxed', local.class)}
      {...others}
    >
      {local.children}
    </p>
  )
}

interface CardContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  spacing?: 'compact' | 'default' | 'relaxed'
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void)
}

const contentSpacingClasses = {
  compact: 'space-y-2',
  default: 'space-y-3',
  relaxed: 'space-y-5',
}

const CardContent: ParentComponent<CardContentProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'spacing', 'children', 'ref'])
  const spacing = () => local.spacing ?? 'default'

  return (
    <div ref={local.ref} class={cn(contentSpacingClasses[spacing()], local.class)} {...others}>
      {local.children}
    </div>
  )
}

interface CardFooterProps extends JSX.HTMLAttributes<HTMLDivElement> {
  divided?: boolean
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void)
}

const CardFooter: ParentComponent<CardFooterProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'divided', 'children', 'ref'])
  const divided = () => local.divided ?? true

  return (
    <div
      ref={local.ref}
      class={cn(
        'flex items-center gap-3 pt-5 mt-5',
        divided() && 'border-t border-[var(--card-border)]/50',
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  )
}

// Specialized stat card for displaying metrics
interface StatCardProps extends Omit<CardProps, 'children'> {
  label: string
  value: string | number
  icon?: JSX.Element
  trend?: { value: number; isPositive: boolean }
  suffix?: string
  accentColor?: 'teal' | 'green' | 'amber' | 'red' | 'blue' | 'purple'
}

const accentColors = {
  teal: 'from-[var(--brand-teal-1)]/20 to-[var(--brand-teal-1)]/5 text-[var(--brand-teal-1)]',
  green: 'from-[hsl(var(--success))]/20 to-[hsl(var(--success))]/5 text-[hsl(var(--success))]',
  amber: 'from-[hsl(var(--accent))]/20 to-[hsl(var(--accent))]/5 text-[hsl(var(--accent))]',
  red: 'from-[hsl(var(--destructive))]/20 to-[hsl(var(--destructive))]/5 text-[hsl(var(--destructive))]',
  blue: 'from-[var(--brand-blue-2)]/20 to-[var(--brand-blue-2)]/5 text-[var(--brand-blue-2)]',
  purple: 'from-[hsl(var(--tier-mythic))]/20 to-[hsl(var(--tier-mythic))]/5 text-[hsl(var(--tier-mythic))]',
}

const StatCard: ParentComponent<StatCardProps> = (props) => {
  const [local, others] = splitProps(props, [
    'label',
    'value',
    'icon',
    'trend',
    'suffix',
    'accentColor',
    'class',
  ])

  const color = () => local.accentColor ?? 'teal'

  return (
    <Card
      size="default"
      class={cn('relative overflow-hidden', local.class)}
      {...others}
    >
      {/* Accent gradient background */}
      <div class={cn(
        'absolute inset-0 bg-gradient-to-br opacity-50',
        accentColors[color()]
      )} />

      <div class="relative space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-[var(--text-secondary)]">{local.label}</span>
          <Show when={local.icon}>
            <div class={cn('p-2 rounded-lg bg-[var(--background-primary)]/50', accentColors[color()].split(' ').pop())}>
              {local.icon}
            </div>
          </Show>
        </div>

        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
            {local.value}
          </span>
          <Show when={local.suffix}>
            <span class="text-sm font-medium text-[var(--text-muted)]">{local.suffix}</span>
          </Show>
        </div>

        <Show when={local.trend}>
          {(trend) => (
            <div class={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              trend().isPositive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
            )}>
              <span>{trend().isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend().value)}%</span>
              <span class="text-[var(--text-muted)]">vs last period</span>
            </div>
          )}
        </Show>
      </div>
    </Card>
  )
}

// Feature card for highlighting capabilities
interface FeatureCardProps extends Omit<CardProps, 'children'> {
  title: string
  description: string
  icon: JSX.Element
  badge?: string
}

const FeatureCard: ParentComponent<FeatureCardProps> = (props) => {
  const [local, others] = splitProps(props, [
    'title',
    'description',
    'icon',
    'badge',
    'class',
  ])

  return (
    <Card
      size="lg"
      interactive
      class={cn('group', local.class)}
      {...others}
    >
      <div class="flex items-start gap-5">
        <div class="p-3 rounded-xl bg-[var(--brand-teal-1)]/10 text-[var(--brand-teal-1)] group-hover:bg-[var(--brand-teal-1)]/20 transition-colors">
          {local.icon}
        </div>
        <div class="flex-1 space-y-2">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-bold text-[var(--text-primary)]">{local.title}</h3>
            <Show when={local.badge}>
              <span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--brand-teal-1)]/15 text-[var(--brand-teal-1)]">
                {local.badge}
              </span>
            </Show>
          </div>
          <p class="text-sm text-[var(--text-tertiary)] leading-relaxed">{local.description}</p>
        </div>
      </div>
    </Card>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  FeatureCard,
}
