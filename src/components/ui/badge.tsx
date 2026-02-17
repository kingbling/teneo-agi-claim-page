import { cva, type VariantProps } from 'class-variance-authority'
import type { JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-semibold transition-all duration-200',
  {
    variants: {
      variant: {
        // Base variants
        default: 'bg-[var(--brand-teal-1)]/15 text-[var(--brand-teal-1)] border border-[var(--brand-teal-1)]/25',
        secondary: 'bg-[var(--background-tertiary)] text-[var(--text-secondary)] border border-[var(--card-border)]',
        success: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-[hsl(var(--success))]/25',
        warning: 'bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/25',
        destructive: 'bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/25',
        outline: 'border-2 border-[var(--card-border)] text-[var(--text-secondary)] bg-transparent',
        info: 'bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/25',

        // Rarity variants using CSS variables for consistency
        common: 'bg-[var(--rarity-common)]/15 text-[var(--rarity-common)] border border-[var(--rarity-common)]/25',
        uncommon: 'bg-[var(--rarity-uncommon)]/15 text-[var(--rarity-uncommon)] border border-[var(--rarity-uncommon)]/30 shadow-sm shadow-[var(--rarity-uncommon)]/10',
        rare: 'bg-[var(--rarity-rare)]/15 text-[var(--rarity-rare)] border border-[var(--rarity-rare)]/35 shadow-md shadow-[var(--rarity-rare)]/15',
        epic: 'bg-[var(--tier-epic)]/15 text-[var(--tier-epic)] border border-[var(--tier-epic)]/35 shadow-md shadow-[var(--tier-epic)]/15',
        legendary: 'bg-[var(--rarity-legendary)]/15 text-[var(--rarity-legendary)] border border-[var(--rarity-legendary)]/40 shadow-lg shadow-[var(--rarity-legendary)]/20',
        mythic: 'bg-gradient-to-r from-[var(--rarity-mythic)]/20 via-[var(--tier-epic)]/20 to-[var(--rarity-mythic)]/20 text-[var(--rarity-mythic)] border border-[var(--rarity-mythic)]/40 shadow-lg shadow-[var(--rarity-mythic)]/25',

        // Status badges with clear visual states
        active: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border border-[hsl(var(--success))]/30',
        idle: 'bg-[hsl(var(--muted))]/15 text-[hsl(var(--muted-foreground))] border border-[hsl(var(--muted))]/25',
        solving: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/35 shadow-sm shadow-[hsl(var(--accent))]/15',
        traveling: 'bg-[hsl(var(--tier-team))]/20 text-[hsl(var(--tier-team))] border border-[hsl(var(--tier-team))]/30',
        resting: 'bg-[hsl(var(--secondary))]/15 text-[hsl(var(--secondary))] border border-[hsl(var(--secondary))]/25',

        // Reward badges
        reward: 'bg-gradient-to-r from-[hsl(var(--accent))]/20 to-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/30 shadow-md shadow-[hsl(var(--accent))]/20',
        bonus: 'bg-gradient-to-r from-[hsl(var(--tier-team))]/20 to-[hsl(var(--success))]/20 text-[hsl(var(--tier-team))] border border-[hsl(var(--tier-team))]/30 shadow-md shadow-[hsl(var(--tier-team))]/20',
        achievement: 'bg-gradient-to-r from-[hsl(var(--secondary))]/20 to-[hsl(var(--tier-mythic))]/20 text-[hsl(var(--secondary))] border border-[hsl(var(--secondary))]/30 shadow-md shadow-[hsl(var(--secondary))]/20',

        // New/Hot badges
        new: 'bg-gradient-to-r from-[hsl(var(--success))]/20 to-[hsl(var(--success))]/20 text-[hsl(var(--success))] border border-[hsl(var(--success))]/30',
        hot: 'bg-gradient-to-r from-[hsl(var(--destructive))]/20 to-[hsl(var(--accent))]/20 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30',
        trending: 'bg-gradient-to-r from-[hsl(var(--tier-mythic))]/20 to-[hsl(var(--tier-mythic))]/20 text-[hsl(var(--tier-mythic))] border border-[hsl(var(--tier-mythic))]/30',
      },
      size: {
        xs: 'px-1 py-0.5 text-[10px]',
        sm: 'px-1.5 py-1 text-xs',
        default: 'px-2 py-1 text-sm',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends JSX.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean
  glow?: boolean
  icon?: JSX.Element
  dot?: boolean
  dotColor?: 'green' | 'red' | 'yellow' | 'blue' | 'purple'
}

const dotColors = {
  green: 'bg-[hsl(var(--success))]',
  red: 'bg-[hsl(var(--destructive))]',
  yellow: 'bg-[hsl(var(--accent))]',
  blue: 'bg-[hsl(var(--primary))]',
  purple: 'bg-[hsl(var(--secondary))]',
}

function Badge(props: BadgeProps) {
  const [local, others] = splitProps(props, [
    'class',
    'variant',
    'size',
    'pulse',
    'glow',
    'icon',
    'dot',
    'dotColor',
    'children',
  ])

  const color = () => local.dotColor ?? 'green'

  return (
    <div
      class={cn(
        badgeVariants({ variant: local.variant, size: local.size }),
        local.pulse && 'animate-pulse',
        local.glow && 'shadow-lg',
        local.class
      )}
      {...others}
    >
      <Show when={local.dot}>
        <span class="relative flex h-2 w-2">
          <Show when={local.pulse}>
            <span class={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              dotColors[color()]
            )} />
          </Show>
          <span class={cn('relative inline-flex rounded-full h-2 w-2', dotColors[color()])} />
        </span>
      </Show>
      <Show when={local.icon}>
        <span class="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{local.icon}</span>
      </Show>
      {local.children}
    </div>
  )
}

export { Badge }
