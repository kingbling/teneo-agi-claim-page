import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
  gradient?: 'teal' | 'purple' | 'rose' | 'yellow' | 'cyan' | 'amber'
  className?: string
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

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  gradient = 'teal',
  className,
  size = 'default',
}: SectionHeaderProps) {
  const styles = sizeStyles[size]
  const gradientClass = gradients[gradient]
  const textColor = gradientClass.split(' ').pop() // Get the text color from gradient

  return (
    <div className={cn('flex items-center justify-between', styles.container, className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn(
            'flex items-center justify-center',
            styles.iconWrapper,
            'bg-gradient-to-br',
            gradientClass
          )}>
            <Icon className={cn(styles.icon, textColor)} />
          </div>
        )}
        <div>
          <h3 className={cn('text-foreground', styles.title)}>
            {title}
          </h3>
          {subtitle && (
            <p className={cn('text-muted-foreground mt-1', styles.subtitle)}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="flex items-center">
          {action}
        </div>
      )}
    </div>
  )
}

// Divider variant for section breaks
interface SectionDividerProps {
  label?: string
  className?: string
}

export function SectionDivider({ label, className }: SectionDividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-4 my-6', className)}>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
    )
  }

  return (
    <div className={cn('h-px bg-border my-5', className)} />
  )
}

// Stat display for section headers
interface StatDisplayProps {
  value: string | number
  label: string
  color?: string
  size?: 'sm' | 'default'
}

export function StatDisplay({ value, label, color = 'text-[var(--brand-teal-1)]', size = 'default' }: StatDisplayProps) {
  return (
    <div className={cn(
      'text-right',
      size === 'sm' ? 'space-y-1' : 'space-y-1'
    )}>
      <div className={cn(
        'font-bold tabular-nums',
        color,
        size === 'sm' ? 'text-sm' : 'text-lg'
      )}>
        {value}
      </div>
      <div className={cn(
        'text-muted-foreground uppercase tracking-wide',
        size === 'sm' ? 'text-[9px]' : 'text-[10px]'
      )}>
        {label}
      </div>
    </div>
  )
}
