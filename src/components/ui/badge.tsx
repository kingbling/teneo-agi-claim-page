import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
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
        deploying: 'bg-[hsl(var(--tier-team))]/20 text-[hsl(var(--tier-team))] border border-[hsl(var(--tier-team))]/30',
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
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean
  glow?: boolean
  icon?: React.ReactNode
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

function Badge({
  className,
  variant,
  size,
  pulse,
  glow,
  icon,
  dot,
  dotColor = 'green',
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        badgeVariants({ variant, size }),
        pulse && 'animate-pulse',
        glow && 'shadow-lg',
        className
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              dotColors[dotColor]
            )} />
          )}
          <span className={cn('relative inline-flex rounded-full h-2 w-2', dotColors[dotColor])} />
        </span>
      )}
      {icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {children}
    </div>
  )
}

// Specialized badge for displaying counts
interface CountBadgeProps extends Omit<BadgeProps, 'children'> {
  count: number
  max?: number
  showPlus?: boolean
}

function CountBadge({ count, max = 99, showPlus = true, size = 'sm', ...props }: CountBadgeProps) {
  const displayCount = count > max ? `${max}${showPlus ? '+' : ''}` : count.toString()

  return (
    <Badge size={size} {...props}>
      <span className="tabular-nums font-bold">{displayCount}</span>
    </Badge>
  )
}

// Status indicator badge with animation
interface StatusBadgeProps extends Omit<BadgeProps, 'children' | 'variant'> {
  status: 'online' | 'offline' | 'busy' | 'away' | 'active' | 'idle' | 'solving' | 'deploying' | 'returning' | 'resting'
  label?: string
  showDot?: boolean
}

const statusConfig = {
  online: { variant: 'success' as const, dotColor: 'green' as const, label: 'Online' },
  offline: { variant: 'secondary' as const, dotColor: 'red' as const, label: 'Offline' },
  busy: { variant: 'destructive' as const, dotColor: 'red' as const, label: 'Busy' },
  away: { variant: 'warning' as const, dotColor: 'yellow' as const, label: 'Away' },
  active: { variant: 'active' as const, dotColor: 'green' as const, label: 'Active' },
  idle: { variant: 'idle' as const, dotColor: 'yellow' as const, label: 'Idle' },
  solving: { variant: 'solving' as const, dotColor: 'yellow' as const, label: 'Solving' },
  deploying: { variant: 'deploying' as const, dotColor: 'blue' as const, label: 'Deploying' },
  returning: { variant: 'active' as const, dotColor: 'green' as const, label: 'Returning' },
  resting: { variant: 'resting' as const, dotColor: 'purple' as const, label: 'Resting' },
}

function StatusBadge({ status, label, showDot = true, ...props }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge
      variant={config.variant}
      dot={showDot}
      dotColor={config.dotColor}
      pulse={status === 'active' || status === 'solving' || status === 'deploying'}
      {...props}
    >
      {label || config.label}
    </Badge>
  )
}

// Rarity badge with appropriate styling
interface RarityBadgeProps extends Omit<BadgeProps, 'children' | 'variant'> {
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
  showLabel?: boolean
}

const rarityLabels = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
}

function RarityBadge({ rarity, showLabel = true, ...props }: RarityBadgeProps) {
  return (
    <Badge
      variant={rarity}
      glow={rarity === 'legendary' || rarity === 'mythic'}
      {...props}
    >
      {showLabel && rarityLabels[rarity]}
    </Badge>
  )
}

// Multiplier badge for showing bonuses
interface MultiplierBadgeProps extends Omit<BadgeProps, 'children'> {
  value: number
  prefix?: string
}

function MultiplierBadge({ value, prefix = 'x', variant = 'reward', ...props }: MultiplierBadgeProps) {
  return (
    <Badge variant={variant} glow={value >= 2} {...props}>
      <span className="tabular-nums font-bold">
        {prefix}{value.toFixed(value % 1 === 0 ? 0 : 1)}
      </span>
    </Badge>
  )
}

// Level badge for progression
interface LevelBadgeProps extends Omit<BadgeProps, 'children'> {
  level: number
  maxLevel?: number
}

function LevelBadge({ level, maxLevel, variant = 'default', ...props }: LevelBadgeProps) {
  const isMax = maxLevel !== undefined && level >= maxLevel

  return (
    <Badge
      variant={isMax ? 'legendary' : variant}
      glow={isMax || undefined}
      {...props}
    >
      <span className="tabular-nums font-bold">
        Lv.{level}
        {maxLevel && <span className="text-[var(--text-muted)]">/{maxLevel}</span>}
      </span>
    </Badge>
  )
}

export {
  Badge,
  CountBadge,
  StatusBadge,
  RarityBadge,
  MultiplierBadge,
  LevelBadge,
  badgeVariants,
}
