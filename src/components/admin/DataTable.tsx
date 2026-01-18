/**
 * DataTable - SolidJS table component with sorting and pagination
 */

import { For, Show, createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-solid'

export interface Column<T> {
  key: string
  label: string
  render?: (item: T) => JSX.Element
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
  isLoading?: boolean
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  onSort?: (column: string) => void
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    onPageChange: (page: number) => void
  }
  emptyMessage?: string
}

export function DataTable<T>(props: DataTableProps<T>) {
  const [hoveredRow, setHoveredRow] = createSignal<string | null>(null)

  const getValue = (item: T, key: string): unknown => {
    const keys = key.split('.')
    let value: unknown = item
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k]
    }
    return value
  }

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center'
      case 'right': return 'text-right'
      default: return 'text-left'
    }
  }

  return (
    <div class="w-full">
      {/* Table */}
      <div class="overflow-x-auto rounded-lg border border-[var(--card-border)]">
        <table class="w-full">
          {/* Header */}
          <thead class="bg-[var(--background-tertiary)]">
            <tr>
              <For each={props.columns}>
                {(column) => (
                  <th
                    class={`px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${alignClass(column.align)}`}
                    style={{ width: column.width }}
                  >
                    <Show
                      when={column.sortable && props.onSort}
                      fallback={column.label}
                    >
                      <button
                        class="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                        onClick={() => props.onSort?.(column.key)}
                      >
                        {column.label}
                        <Show when={props.sortBy === column.key}>
                          {props.sortOrder === 'ASC' ? (
                            <ChevronUp class="w-4 h-4" />
                          ) : (
                            <ChevronDown class="w-4 h-4" />
                          )}
                        </Show>
                      </button>
                    </Show>
                  </th>
                )}
              </For>
            </tr>
          </thead>

          {/* Body */}
          <tbody class="divide-y divide-[var(--card-border)]">
            <Show
              when={!props.isLoading}
              fallback={
                <For each={Array(5).fill(0)}>
                  {() => (
                    <tr>
                      <For each={props.columns}>
                        {() => (
                          <td class="px-4 py-3">
                            <div class="h-4 bg-[var(--background-tertiary)] rounded animate-pulse" />
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              }
            >
              <Show
                when={props.data.length > 0}
                fallback={
                  <tr>
                    <td
                      colspan={props.columns.length}
                      class="px-4 py-12 text-center text-[var(--text-tertiary)]"
                    >
                      {props.emptyMessage || 'No data found'}
                    </td>
                  </tr>
                }
              >
                <For each={props.data}>
                  {(item) => {
                    const key = props.keyExtractor(item)
                    return (
                      <tr
                        class={`transition-colors ${
                          props.onRowClick ? 'cursor-pointer' : ''
                        } ${
                          hoveredRow() === key
                            ? 'bg-[var(--background-tertiary)]'
                            : 'bg-[var(--background-secondary)]'
                        }`}
                        onClick={() => props.onRowClick?.(item)}
                        onMouseEnter={() => setHoveredRow(key)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <For each={props.columns}>
                          {(column) => (
                            <td
                              class={`px-4 py-3 text-sm text-[var(--text-primary)] ${alignClass(column.align)}`}
                            >
                              <Show
                                when={column.render}
                                fallback={
                                  <span class="truncate block max-w-xs">
                                    {String(getValue(item, column.key) ?? '-')}
                                  </span>
                                }
                              >
                                {column.render!(item)}
                              </Show>
                            </td>
                          )}
                        </For>
                      </tr>
                    )
                  }}
                </For>
              </Show>
            </Show>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Show when={props.pagination && props.pagination.totalPages > 1}>
        <div class="flex items-center justify-between mt-4 px-2">
          <p class="text-sm text-[var(--text-tertiary)]">
            Showing {((props.pagination!.page - 1) * props.pagination!.limit) + 1} to{' '}
            {Math.min(props.pagination!.page * props.pagination!.limit, props.pagination!.total)} of{' '}
            {props.pagination!.total} results
          </p>

          <div class="flex items-center gap-2">
            <button
              class="p-2 rounded-lg border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={props.pagination!.page <= 1}
              onClick={() => props.pagination!.onPageChange(props.pagination!.page - 1)}
            >
              <ChevronLeft class="w-4 h-4" />
            </button>

            <span class="px-3 py-1 text-sm text-[var(--text-primary)]">
              Page {props.pagination!.page} of {props.pagination!.totalPages}
            </span>

            <button
              class="p-2 rounded-lg border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={props.pagination!.page >= props.pagination!.totalPages}
              onClick={() => props.pagination!.onPageChange(props.pagination!.page + 1)}
            >
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}
