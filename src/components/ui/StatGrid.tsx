import { cn } from '@/lib/utils'

export interface StatGridProps {
  /** Number of columns in the grid */
  columns: 2 | 3 | 4
  /** Stat card children */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * StatGrid - A grid layout for stat cards with consistent spacing
 *
 * Provides standardized grid layouts for displaying multiple statistics:
 * - 2 columns: Default for most stat displays
 * - 3 columns: For compact stat rows (like in headers)
 * - 4 columns: For detailed statistics views
 */
export function StatGrid({ columns = 2, children, className }: StatGridProps) {
  const gridCols: Record<2 | 3 | 4, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  )
}
