/**
 * LogsPage - Admin action log viewer
 */

import { createSignal, onMount, For, Show } from 'solid-js'
import { Terminal, Download, Filter } from 'lucide-solid'
import { authStore } from '@/stores/authStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface LogEntry {
  id: string
  type: string
  action: string
  details: string | null
  adminId: string | null
  targetId: string | null
  createdAt: number
}

export default function LogsPage() {
  const [logs, setLogs] = createSignal<LogEntry[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [filter, setFilter] = createSignal<string>('')
  const [typeFilter, setTypeFilter] = createSignal<string>('all')
  const [error, setError] = createSignal<string | null>(null)

  async function fetchLogs() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/admin/logs?limit=200`, {
        headers: authStore.getAuthHeader(),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch logs')
    } finally {
      setIsLoading(false)
    }
  }

  function exportLogs() {
    const data = JSON.stringify(logs(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-logs-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredLogs = () => {
    let result = logs()

    if (typeFilter() !== 'all') {
      result = result.filter((entry) => entry.type === typeFilter())
    }

    if (filter()) {
      const search = filter().toLowerCase()
      result = result.filter((entry) => entry.action.toLowerCase().includes(search))
    }

    return result
  }

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'intervention':
        return 'text-orange-400'
      default:
        return 'text-[var(--brand-teal-1)]'
    }
  }

  onMount(() => {
    fetchLogs()
  })

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Admin Logs</h1>
          <p class="text-[var(--text-secondary)] mt-1">Admin action history</p>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} class="gap-2">
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs} class="gap-2">
            <Download class="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent class="p-4">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <Filter class="w-4 h-4 text-[var(--text-secondary)]" />
              <select
                value={typeFilter()}
                onChange={(e) => setTypeFilter(e.target.value)}
                class="bg-[var(--background-secondary)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)]"
              >
                <option value="all">All Types</option>
                <option value="user">User</option>
                <option value="intervention">Intervention</option>
                <option value="event">Event</option>
                <option value="system">System</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Search actions..."
              value={filter()}
              onInput={(e) => setFilter(e.target.value)}
              class="flex-1 bg-[var(--background-secondary)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <div class="text-sm text-[var(--text-secondary)]">
              {filteredLogs().length} entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      <Show when={error()}>
        <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p class="text-red-400">{error()}</p>
        </div>
      </Show>

      {/* Logs */}
      <Card>
        <CardHeader class="pb-2">
          <div class="flex items-center gap-2">
            <Terminal class="w-5 h-5 text-[var(--brand-teal-1)]" />
            <CardTitle>Log Entries</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <div class="h-[600px] overflow-y-auto font-mono text-xs bg-[var(--background-primary)] rounded-b-lg">
            <Show when={isLoading()}>
              <div class="p-4 text-[var(--text-secondary)]">Loading logs...</div>
            </Show>

            <Show when={!isLoading() && filteredLogs().length === 0}>
              <div class="p-4 text-[var(--text-secondary)]">No log entries to display</div>
            </Show>

            <For each={filteredLogs()}>
              {(entry) => (
                <div class="px-4 py-1.5 border-b border-[var(--card-border)]/30 hover:bg-[var(--background-secondary)]">
                  <span class="text-[var(--text-tertiary)] mr-3">{formatTime(entry.createdAt)}</span>
                  <span class={`uppercase font-semibold mr-3 w-16 inline-block ${getTypeColor(entry.type)}`}>
                    {entry.type}
                  </span>
                  <span class="text-[var(--text-primary)] mr-3">{entry.action}</span>
                  <Show when={entry.details}>
                    <span class="text-[var(--text-tertiary)]">{entry.details}</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
