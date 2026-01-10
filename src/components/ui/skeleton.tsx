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

export function AgentCardSkeleton() {
  return (
    <div
      className="border border-[var(--card-border)] bg-[var(--background-secondary)]"
      style={{
        borderRadius: 'var(--radius-2xl)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: 'var(--space-4)' }}>
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-6 w-32" style={{ borderRadius: 'var(--radius-md)' }} />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* Fuel bar */}
      <div
        className="bg-[var(--background-primary)]/40"
        style={{
          padding: 'var(--space-5)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)'
        }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
            <Skeleton className="w-8 h-8" style={{ borderRadius: 'var(--radius-md)' }} />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-3.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-6 w-16" style={{ borderRadius: 'var(--radius-sm)' }} />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Traits */}
      <div className="flex" style={{ gap: 'var(--space-3)' }}>
        <Skeleton className="h-9 w-24" style={{ borderRadius: 'var(--radius-md)' }} />
        <Skeleton className="h-9 w-24" style={{ borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
        <div
          className="bg-[var(--background-primary)]/30"
          style={{
            padding: 'var(--space-5) var(--space-5) var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)'
          }}
        >
          <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-7 w-12" />
        </div>
        <div
          className="bg-[var(--background-primary)]/30"
          style={{
            padding: 'var(--space-5) var(--space-5) var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)'
          }}
        >
          <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-7 w-14" />
        </div>
      </div>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex justify-between items-center bg-[var(--background-primary)]/30"
          style={{
            padding: 'var(--space-5) var(--space-5) var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      {/* Header skeleton */}
      <div className="flex items-center" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <Skeleton className="w-11 h-11" style={{ borderRadius: 'var(--radius-xl)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Progress skeleton */}
      <div
        className="bg-[var(--background-primary)]/30"
        style={{
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-2xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)'
        }}
      >
        <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
          <Skeleton className="w-11 h-11" style={{ borderRadius: 'var(--radius-xl)' }} />
          <Skeleton className="h-5 w-32" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3.5 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <div
            className="bg-[var(--background-secondary)]/50 text-center"
            style={{
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <Skeleton className="h-8 w-16 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
          <div
            className="bg-[var(--background-secondary)]/50 text-center"
            style={{
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <Skeleton className="h-8 w-14 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        </div>
      </div>

      {/* Stats skeleton */}
      <div
        className="bg-[var(--background-primary)]/30"
        style={{
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-2xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)'
        }}
      >
        <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
          <Skeleton className="w-11 h-11" style={{ borderRadius: 'var(--radius-xl)' }} />
          <Skeleton className="h-5 w-24" />
        </div>
        <StatsSkeleton />
      </div>
    </div>
  )
}

// Dashboard grid skeleton
export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="border border-[var(--card-border)] bg-[var(--background-secondary)]"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-2xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)'
          }}
        >
          <div className="flex items-center" style={{ gap: 'var(--space-4)' }}>
            <Skeleton className="w-12 h-12" style={{ borderRadius: 'var(--radius-xl)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" style={{ borderRadius: 'var(--radius-xl)' }} />
          <div className="flex" style={{ gap: 'var(--space-3)' }}>
            <Skeleton className="h-10 flex-1" style={{ borderRadius: 'var(--radius-xl)' }} />
            <Skeleton className="h-10 w-10" style={{ borderRadius: 'var(--radius-xl)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Button skeleton for loading states
export function ButtonSkeleton({ className, size = 'default' }: SkeletonProps & { size?: 'sm' | 'default' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-9 w-20',
    default: 'h-11 w-28',
    lg: 'h-14 w-36',
  }
  return (
    <Skeleton className={cn(sizeClasses[size], className)} style={{ borderRadius: 'var(--radius-xl)' }} />
  )
}

// Avatar skeleton
export function AvatarSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
  }
  return (
    <Skeleton className={cn('rounded-full', sizeClasses[size])} />
  )
}

// List item skeleton
export function ListItemSkeleton() {
  return (
    <div
      className="flex items-center bg-[var(--background-primary)]/30"
      style={{
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-xl)'
      }}
    >
      <Skeleton className="w-10 h-10 shrink-0" style={{ borderRadius: 'var(--radius-md)' }} />
      <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-8 h-8 shrink-0" style={{ borderRadius: 'var(--radius-md)' }} />
    </div>
  )
}

// Table skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Header */}
      <div
        className="flex bg-[var(--background-primary)]/50"
        style={{
          gap: 'var(--space-4)',
          padding: 'var(--space-5) var(--space-5) var(--space-4) var(--space-5)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center bg-[var(--background-primary)]/20"
          style={{
            gap: 'var(--space-4)',
            padding: 'var(--space-5) var(--space-5) var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="flex items-center flex-1" style={{ gap: 'var(--space-3)' }}>
            <Skeleton className="w-8 h-8 shrink-0" style={{ borderRadius: 'var(--radius-md)' }} />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" style={{ borderRadius: 'var(--radius-md)' }} />
        </div>
      ))}
    </div>
  )
}
