import { Filter, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
}

export interface SortOption {
  value: string
  label: string
}

export interface FilterSortBarProps {
  /** Available filter options */
  filterOptions: FilterOption[]
  /** Available sort options */
  sortOptions: SortOption[]
  /** Current filter value */
  filterValue: string
  /** Current sort value */
  sortValue: string
  /** Called when filter changes */
  onFilterChange: (value: string) => void
  /** Called when sort changes */
  onSortChange: (value: string) => void
  /** Optional item count display */
  itemCount?: { current: number; total: number }
  /** Additional CSS classes */
  className?: string
}

/**
 * FilterSortBar - Standardized filter and sort controls
 *
 * Provides a consistent interface for filtering and sorting lists
 * of items like agents, discoveries, or any other collection.
 */
export function FilterSortBar({
  filterOptions,
  sortOptions,
  filterValue,
  sortValue,
  onFilterChange,
  onSortChange,
  itemCount,
  className,
}: FilterSortBarProps) {
  return (
    <div className={cn(
      'p-4 border-b border-[var(--card-border)]/50 bg-[var(--background-primary)]/30 flex items-center gap-4',
      className
    )}>
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <select
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          className="text-xs bg-[var(--background-secondary)] border border-[var(--card-border)] rounded-lg px-2.5 py-1.5 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand-teal-1)]/50 cursor-pointer"
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <select
          value={sortValue}
          onChange={(e) => onSortChange(e.target.value)}
          className="text-xs bg-[var(--background-secondary)] border border-[var(--card-border)] rounded-lg px-2.5 py-1.5 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand-teal-1)]/50 cursor-pointer"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Item Count */}
      {itemCount && (
        <span className="ml-auto text-xs text-[var(--text-muted)] bg-[var(--background-secondary)]/50 px-2.5 py-1 rounded-lg font-medium">
          {itemCount.current}/{itemCount.total}
        </span>
      )}
    </div>
  )
}

/**
 * FilterPill - An individual filter pill for visual filter selection
 */
export interface FilterPillProps {
  label: string
  isActive: boolean
  onClick: () => void
  count?: number
  className?: string
}

export function FilterPill({ label, isActive, onClick, count, className }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
        isActive
          ? 'bg-[var(--brand-teal-1)] text-[var(--background-primary)]'
          : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--background-primary)]',
        className
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn('ml-1', isActive ? 'opacity-80' : 'text-[var(--text-muted)]')}>
          ({count})
        </span>
      )}
    </button>
  )
}

/**
 * FilterPillGroup - A group of filter pills
 */
export interface FilterPillGroupProps {
  options: Array<{ value: string; label: string; count?: number }>
  value: string
  onChange: (value: string) => void
  className?: string
}

export function FilterPillGroup({ options, value, onChange, className }: FilterPillGroupProps) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {options.map((option) => (
        <FilterPill
          key={option.value}
          label={option.label}
          isActive={value === option.value}
          count={option.count}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}
