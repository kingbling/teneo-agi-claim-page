/**
 * LogsPage - Real-time server log viewer
 */

import { createSignal, onMount, onCleanup, For, Show } from 'solid-js'
import { Terminal, Trash2, Download, Filter, Pause, Play } from 'lucide-solid'
import { authStore } from '@/stores/authStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const WS_URL = import.meta.env.VITE_WS_URL ?? ''

interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: any
}

export default function LogsPage() {
  const [logs, setLogs] = createSignal<LogEntry[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [isPaused, setIsPaused] = createSignal(false)
  const [filter, setFilter] = createSignal<string>('')
  const [levelFilter, setLevelFilter] = createSignal<string>('all')
  const [error, setError] = createSignal<string | null>(null)

  let logContainerRef: HTMLDivElement | undefined
  let wsRef: WebSocket | null = null

  // Fetch initial logs
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
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs')
    } finally {
      setIsLoading(false)
    }
  }

  // Clear logs
  async function clearLogs() {
    if (!confirm('Clear all server logs?')) return

    try {
      const response = await fetch(`${API_URL}/api/admin/logs`, {
        method: 'DELETE',
        headers: authStore.getAuthHeader(),
      })

      if (response.ok) {
        setLogs([])
      }
    } catch (err) {
      console.error('Failed to clear logs:', err)
    }
  }

  // Connect to WebSocket for live logs
  function connectWebSocket() {
    if (wsRef?.readyState === WebSocket.OPEN) return

    wsRef = new WebSocket(WS_URL)

    wsRef.onmessage = (event) => {
      if (isPaused()) return

      try {
        const message = JSON.parse(event.data)
        if (message.type === 'log:entry') {
          setLogs((prev) => {
            const newLogs = [message.data, ...prev]
            // Keep max 500 logs in memory
            return newLogs.slice(0, 500)
          })

          // Auto-scroll to top (newest first)
          if (logContainerRef) {
            logContainerRef.scrollTop = 0
          }
        }
      } catch (err) {
        // Ignore parse errors
      }
    }

    wsRef.onclose = () => {
      // Reconnect after delay
      setTimeout(connectWebSocket, 3000)
    }
  }

  // Export logs
  function exportLogs() {
    const data = JSON.stringify(logs(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `server-logs-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter logs
  const filteredLogs = () => {
    let result = logs()

    if (levelFilter() !== 'all') {
      result = result.filter((log) => log.level === levelFilter())
    }

    if (filter()) {
      const search = filter().toLowerCase()
      result = result.filter((log) => log.message.toLowerCase().includes(search))
    }

    return result
  }

  // Format timestamp
  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  }

  // Get log level color
  function getLevelColor(level: string) {
    switch (level) {
      case 'error':
        return 'text-red-400'
      case 'warn':
        return 'text-yellow-400'
      case 'debug':
        return 'text-gray-400'
      default:
        return 'text-[var(--brand-teal-1)]'
    }
  }

  function getLevelBg(level: string) {
    switch (level) {
      case 'error':
        return 'bg-red-500/10'
      case 'warn':
        return 'bg-yellow-500/10'
      default:
        return ''
    }
  }

  onMount(() => {
    fetchLogs()
    connectWebSocket()
  })

  onCleanup(() => {
    if (wsRef) {
      wsRef.close()
    }
  })

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Server Logs</h1>
          <p class="text-[var(--text-secondary)] mt-1">Real-time server log streaming</p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused())}
            class="gap-2"
          >
            {isPaused() ? <Play class="w-4 h-4" /> : <Pause class="w-4 h-4" />}
            {isPaused() ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs} class="gap-2">
            <Download class="w-4 h-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs} class="gap-2 text-red-400 hover:text-red-300">
            <Trash2 class="w-4 h-4" />
            Clear
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
                value={levelFilter()}
                onChange={(e) => setLevelFilter(e.target.value)}
                class="bg-[var(--background-secondary)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)]"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warnings</option>
                <option value="error">Errors</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Search logs..."
              value={filter()}
              onInput={(e) => setFilter(e.target.value)}
              class="flex-1 bg-[var(--background-secondary)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <div class="text-sm text-[var(--text-secondary)]">
              {filteredLogs().length} logs
              {isPaused() && <span class="ml-2 text-yellow-400">(paused)</span>}
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
            <CardTitle>Log Stream</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <div
            ref={logContainerRef}
            class="h-[600px] overflow-y-auto font-mono text-xs bg-[var(--background-primary)] rounded-b-lg"
          >
            <Show when={isLoading()}>
              <div class="p-4 text-[var(--text-secondary)]">Loading logs...</div>
            </Show>

            <Show when={!isLoading() && filteredLogs().length === 0}>
              <div class="p-4 text-[var(--text-secondary)]">No logs to display</div>
            </Show>

            <For each={filteredLogs()}>
              {(log) => (
                <div
                  class={`px-4 py-1.5 border-b border-[var(--card-border)]/30 hover:bg-[var(--background-secondary)] ${getLevelBg(log.level)}`}
                >
                  <span class="text-[var(--text-tertiary)] mr-3">{formatTime(log.timestamp)}</span>
                  <span class={`uppercase font-semibold mr-3 w-12 inline-block ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span class="text-[var(--text-primary)]">{log.message}</span>
                </div>
              )}
            </For>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
