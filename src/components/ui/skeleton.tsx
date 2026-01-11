import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-[var(--background-tertiary)] via-[var(--background-secondary)] to-[var(--background-tertiary)] bg-[length:200%_100%]',
        className
      )}
      style={{
        animation: 'shimmer 1.5s ease-in-out infinite',
        borderRadius: 'var(--radius-md)',
        ...style,
      }}
    />
  )
}

export function SkeletonText({ className, lines = 1 }: SkeletonProps & { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full',
            className
          )}
        />
      ))}
    </div>
  )
}

export function SkeletonCircle({ className, size = 'md' }: SkeletonProps & { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  }
  return (
    <Skeleton className={cn('rounded-full', sizeClasses[size], className)} />
  )
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn(className)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Skeleton className="h-[140px] w-full" style={{ borderRadius: 'var(--radius-xl)' }} />
    </div>
  )
}
