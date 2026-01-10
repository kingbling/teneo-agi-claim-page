import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean
  interactive?: boolean
  size?: 'compact' | 'sm' | 'default' | 'lg' | 'xl'
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost' | 'gradient' | 'success' | 'warning' | 'danger'
  highlight?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow, interactive, size = 'default', variant = 'default', highlight, ...props }, ref) => {
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

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-200',
          sizeClasses[size],
          variantClasses[variant],
          glow && 'shadow-[0_0_20px_var(--brand-teal-1)/15] border-[var(--brand-teal-4)]',
          highlight && 'ring-2 ring-[var(--brand-teal-1)]/30 ring-offset-2 ring-offset-[var(--background-primary)]',
          interactive && 'cursor-pointer hover:border-[var(--card-border-hover)] hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:shadow-lg',
          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { spacing?: 'compact' | 'default' | 'relaxed' }
>(({ className, spacing = 'default', ...props }, ref) => {
  const spacingClasses = {
    compact: 'gap-1.5 pb-3',
    default: 'gap-2.5 pb-5',
    relaxed: 'gap-3 pb-6',
  }

  return (
    <div
      ref={ref}
      className={cn('flex flex-col', spacingClasses[spacing], className)}
      {...props}
    />
  )
})
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { size?: 'sm' | 'default' | 'lg' }
>(({ className, size = 'default', ...props }, ref) => {
  const sizeClasses = {
    sm: 'text-base font-semibold',
    default: 'text-lg font-bold',
    lg: 'text-xl font-bold',
  }

  return (
    <h3
      ref={ref}
      className={cn(
        'leading-tight tracking-tight text-[var(--text-primary)]',
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
})
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-[var(--text-tertiary)] mt-2 leading-relaxed', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { spacing?: 'compact' | 'default' | 'relaxed' }
>(({ className, spacing = 'default', ...props }, ref) => {
  const spacingClasses = {
    compact: 'space-y-2',
    default: 'space-y-3',
    relaxed: 'space-y-5',
  }

  return (
    <div ref={ref} className={cn(spacingClasses[spacing], className)} {...props} />
  )
})
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { divided?: boolean }
>(({ className, divided = true, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center gap-3 pt-5 mt-5',
      divided && 'border-t border-[var(--card-border)]/50',
      className
    )}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

// Specialized stat card for displaying metrics
interface StatCardProps extends Omit<CardProps, 'children'> {
  label: string
  value: string | number
  icon?: React.ReactNode
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

function StatCard({
  label,
  value,
  icon,
  trend,
  suffix,
  accentColor = 'teal',
  className,
  ...props
}: StatCardProps) {
  return (
    <Card
      size="default"
      className={cn(
        'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Accent gradient background */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-50',
        accentColors[accentColor]
      )} />

      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
          {icon && (
            <div className={cn('p-2 rounded-lg bg-[var(--background-primary)]/50', accentColors[accentColor].split(' ').pop())}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
            {value}
          </span>
          {suffix && (
            <span className="text-sm font-medium text-[var(--text-muted)]">{suffix}</span>
          )}
        </div>

        {trend && (
          <div className={cn(
            'flex items-center gap-1.5 text-sm font-medium',
            trend.isPositive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
          )}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
            <span className="text-[var(--text-muted)]">vs last period</span>
          </div>
        )}
      </div>
    </Card>
  )
}

// Feature card for highlighting capabilities
interface FeatureCardProps extends Omit<CardProps, 'children'> {
  title: string
  description: string
  icon: React.ReactNode
  badge?: string
}

function FeatureCard({ title, description, icon, badge, className, ...props }: FeatureCardProps) {
  return (
    <Card
      size="lg"
      interactive
      className={cn('group', className)}
      {...props}
    >
      <div className="flex items-start gap-5">
        <div className="p-3 rounded-xl bg-[var(--brand-teal-1)]/10 text-[var(--brand-teal-1)] group-hover:bg-[var(--brand-teal-1)]/20 transition-colors">
          {icon}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
            {badge && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--brand-teal-1)]/15 text-[var(--brand-teal-1)]">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{description}</p>
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
