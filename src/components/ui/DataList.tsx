import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface DataListColumn<T> {
  /** Unique key for the column */
  key: keyof T | string
  /** Header label */
  label: string
  /** Optional custom render function */
  render?: (item: T, index: number) => React.ReactNode
  /** Optional column width */
  width?: string
  /** Align text content */
  align?: 'left' | 'center' | 'right'
  /** Whether to sort by this column */
  sortable?: boolean
}

export interface DataListProps<T> {
  /** Data array to render */
  data: T[]
  /** Column definitions */
  columns: DataListColumn<T>[]
  /** Unique key extractor */
  keyExtractor: (item: T, index: number) => string
  /** Row click handler */
  onRowClick?: (item: T, index: number) => void
  /** Selected item */
  selectedItemId?: string | null
  /** Loading state */
  isLoading?: boolean
  /** Number of skeleton rows to show when loading */
  skeletonCount?: number
  /** Optional empty state */
  emptyState?: React.ReactNode
  /** Optional header actions */
  headerActions?: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Compact variant for tighter spacing */
  variant?: 'default' | 'compact'
}

/**
 * DataList - A consistent list component for displaying tabular data
 *
 * Features:
 * - Sortable columns (visual only, sorting logic handled externally)
 * - Row selection with hover states
 * - Loading skeleton state
 * - Empty state handling
 * - Responsive layout
 *
 * @example
 * ```tsx
 * <DataList
 *   data={agents}
 *   columns={[
 *     { key: 'name', label: 'Name', render: (agent) => <strong>{agent.name}</strong> },
 *     { key: 'state', label: 'Status', align: 'center' },
 *     { key: 'pointsBalance', label: 'Fuel', align: 'right' },
 *   ]}
 *   keyExtractor={(agent) => agent.id}
 *   onRowClick={(agent) => console.log(agent)}
 *   selectedItemId={selectedId}
 * />
 * ```
 */
export function DataList<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectedItemId,
  isLoading = false,
  skeletonCount = 5,
  emptyState,
  headerActions,
  className,
  variant = 'default',
}: DataListProps<T>) {
  const rowPadding = variant === 'compact' ? 'py-2 px-3' : 'py-3 px-4'

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      {(headerActions || columns.length > 0) && (
        <div className="flex items-center border-b border-[var(--card-border)] bg-[var(--background-secondary)]/50">
          <div className="flex flex-1">
            {columns.map((column) => (
              <div
                key={String(column.key)}
                className={cn(
                  'text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  column.width ? `w-[${column.width}]` : 'flex-1'
                )}
                style={{ width: column.width }}
              >
                {column.label}
              </div>
            ))}
          </div>
          {headerActions && (
            <div className="flex-shrink-0 ml-2">{headerActions}</div>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="divide-y divide-[var(--card-border)]/50">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <motion.div
              key={`skeleton-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn('flex items-center', rowPadding)}
            >
              {columns.map((column, j) => (
                <div
                  key={j}
                  className={cn(
                    'h-4 bg-[var(--background-primary)] rounded animate-pulse',
                    column.align === 'center' && 'mx-auto',
                    column.align === 'right' && 'ml-auto',
                    column.width ? `w-[${column.width}]` : 'flex-1'
                  )}
                  style={{
                    width: column.width || '100%',
                    maxWidth: column.width ? undefined : '200px',
                  }}
                />
              ))}
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && data.length === 0 && emptyState && (
        <div className="py-12 px-4 text-center">
          {emptyState}
        </div>
      )}

      {/* Data Rows */}
      <AnimatePresence mode="popLayout">
        {!isLoading && data.length > 0 && (
          <div className="divide-y divide-[var(--card-border)]/50">
            {data.map((item, index) => {
              const key = keyExtractor(item, index)
              const isSelected = selectedItemId === key

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  onClick={() => onRowClick?.(item, index)}
                  className={cn(
                    'flex items-center transition-colors cursor-pointer',
                    rowPadding,
                    onRowClick && 'hover:bg-[var(--background-primary)]/50',
                    isSelected && 'bg-[var(--brand-teal-1)]/10 border-l-2 border-l-[var(--brand-teal-1)]'
                  )}
                >
                  {columns.map((column) => (
                    <div
                      key={String(column.key)}
                      className={cn(
                        'text-sm text-[var(--text-secondary)]',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right'
                      )}
                      style={{ width: column.width, flex: column.width ? undefined : 1 }}
                    >
                      {column.render
                        ? column.render(item, index)
                        : String(item[column.key as keyof T] ?? '')}
                    </div>
                  ))}
                </motion.div>
              )
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * DataListEmptyState - Default empty state component
 */
export interface DataListEmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

export function DataListEmptyState({
  title,
  description,
  icon,
  action,
}: DataListEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--background-primary)] flex items-center justify-center mb-4 border border-[var(--card-border)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] mb-4 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-lg bg-[var(--brand-teal-1)] text-[var(--background-primary)] font-medium text-sm hover:bg-[var(--brand-teal-1)]/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

/**
 * CompactDataListItem - A single compact list item
 */
export interface CompactDataListItemProps {
  label: string
  value: React.ReactNode
  description?: string
  icon?: React.ReactNode
  onClick?: () => void
  className?: string
}

export function CompactDataListItem({
  label,
  value,
  description,
  icon,
  onClick,
  className,
}: CompactDataListItemProps) {
  return (
    <motion.div
      whileHover={onClick ? { scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-3 rounded-xl bg-[var(--background-primary)]/30 border border-[var(--card-border)]/30',
        onClick && 'cursor-pointer hover:bg-[var(--background-primary)]/50 hover:border-[var(--card-border)]/50',
        className
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
          {description && (
            <div className="text-xs text-[var(--text-muted)] truncate">{description}</div>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 ml-3">
        {typeof value === 'string' ? (
          <span className="text-sm font-semibold text-[var(--text-secondary)]">{value}</span>
        ) : (
          value
        )}
      </div>
    </motion.div>
  )
}

/**
 * CompactDataList - A compact vertical list for small datasets
 */
export interface CompactDataListProps {
  items: Array<{
    id: string
    label: string
    value: React.ReactNode
    description?: string
    icon?: React.ReactNode
  }>
  onItemClick?: (id: string) => void
  className?: string
}

export function CompactDataList({
  items,
  onItemClick,
  className,
}: CompactDataListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <CompactDataListItem
              label={item.label}
              value={item.value}
              description={item.description}
              icon={item.icon}
              onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
