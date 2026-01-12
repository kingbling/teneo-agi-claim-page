import { Filter, ArrowUpDown } from 'lucide-solid'
import { cn } from '@/lib/utils'
import { For, Show, type Component } from 'solid-js'

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
  class?: string
}

/**
 * FilterSortBar - Standardized filter and sort controls
 *
 * Provides a consistent interface for filtering and sorting lists
 * of items like agents, discoveries, or any other collection.
 */
export const FilterSortBar: Component<FilterSortBarProps> = (props) => {
  return (
    <div class={cn(
      'p-4 border-b border-[var(--card-border)]/50 bg-[var(--background-primary)]/30 flex items-center gap-4',
      props.class
    )}>
      {/* Filter */}
      <div class="flex items-center gap-2">
        <Filter class="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <select
          value={props.filterValue}
          onChange={(e) => props.onFilterChange(e.currentTarget.value)}
          class="text-xs bg-[var(--background-secondary)] border border-[var(--card-border)] rounded-lg px-2.5 py-1.5 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand-teal-1)]/50 cursor-pointer"
        >
          <For each={props.filterOptions}>
            {(option) => (
              <option value={option.value}>
                {option.label}
              </option>
            )}
          </For>
        </select>
      </div>

      {/* Sort */}
      <div class="flex items-center gap-2">
        <ArrowUpDown class="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <select
          value={props.sortValue}
          onChange={(e) => props.onSortChange(e.currentTarget.value)}
          class="text-xs bg-[var(--background-secondary)] border border-[var(--card-border)] rounded-lg px-2.5 py-1.5 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand-teal-1)]/50 cursor-pointer"
        >
          <For each={props.sortOptions}>
            {(option) => (
              <option value={option.value}>
                {option.label}
              </option>
            )}
          </For>
        </select>
      </div>

      {/* Item Count */}
      <Show when={props.itemCount}>
        <span class="ml-auto text-xs text-[var(--text-muted)] bg-[var(--background-secondary)]/50 px-2.5 py-1 rounded-lg font-medium">
          {props.itemCount!.current}/{props.itemCount!.total}
        </span>
      </Show>
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
  class?: string
}

export const FilterPill: Component<FilterPillProps> = (props) => {
  return (
    <button
      onClick={props.onClick}
      class={cn(
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
        props.isActive
          ? 'bg-[var(--brand-teal-1)] text-[var(--background-primary)]'
          : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--background-primary)]',
        props.class
      )}
    >
      {props.label}
      <Show when={props.count !== undefined}>
        <span class={cn('ml-1', props.isActive ? 'opacity-80' : 'text-[var(--text-muted)]')}>
          ({props.count})
        </span>
      </Show>
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
  class?: string
}

export const FilterPillGroup: Component<FilterPillGroupProps> = (props) => {
  return (
    <div class={cn('flex gap-2 flex-wrap', props.class)}>
      <For each={props.options}>
        {(option) => (
          <FilterPill
            label={option.label}
            isActive={props.value === option.value}
            count={option.count}
            onClick={() => props.onChange(option.value)}
          />
        )}
      </For>
    </div>
  )
}
