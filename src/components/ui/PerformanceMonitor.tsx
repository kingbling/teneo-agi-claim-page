import { createSignal, onMount, onCleanup, Show, type Component } from 'solid-js'
import { Activity, X } from 'lucide-solid'

interface PerformanceStats {
  fps: number
  frameTime: number
  memory?: number
}

export const PerformanceMonitor: Component = () => {
  const [show, setShow] = createSignal(false)
  const [stats, setStats] = createSignal<PerformanceStats>({ fps: 60, frameTime: 16.67 })

  onMount(() => {
    let frameCount = 0
    let lastTime = performance.now()
    let rafId: number

    const updateStats = () => {
      frameCount++
      const currentTime = performance.now()
      const elapsed = currentTime - lastTime

      // Update every second
      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed)
        const frameTime = elapsed / frameCount

        setStats({
          fps,
          frameTime: Math.round(frameTime * 100) / 100,
          memory: (performance as any).memory
            ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
            : undefined
        })

        frameCount = 0
        lastTime = currentTime
      }

      rafId = requestAnimationFrame(updateStats)
    }

    rafId = requestAnimationFrame(updateStats)

    // Keyboard shortcut: Ctrl+Shift+P to toggle
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        setShow(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)

    onCleanup(() => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', handleKeyPress)
    })
  })

  const fpsColor = () => {
    const fps = stats().fps
    if (fps >= 55) return 'bg-[#10b981]'
    if (fps >= 30) return 'bg-[var(--state-solving)]'
    return 'bg-[var(--state-exhausted)]'
  }

  const fpsTextColor = () => {
    const fps = stats().fps
    if (fps >= 55) return 'text-[#10b981]'
    if (fps >= 30) return 'text-[var(--state-solving)]'
    return 'text-[var(--state-exhausted)]'
  }

  const frameTimeColor = () => {
    const frameTime = stats().frameTime
    if (frameTime <= 16.67) return 'bg-[#10b981]'
    if (frameTime <= 33.33) return 'bg-[var(--state-solving)]'
    return 'bg-[var(--state-exhausted)]'
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setShow(!show())}
        class="fixed bottom-[var(--space-5)] right-[var(--space-5)] z-[60] w-[var(--space-10)] h-[var(--space-10)] rounded-full bg-[var(--background-secondary)] border border-[var(--card-border)] hover:border-[var(--brand-teal-1)]/50 flex items-center justify-center transition-all hover:scale-110 shadow-lg"
        title="Performance Monitor (Ctrl+Shift+P)"
      >
        <Activity class="h-[var(--space-4)] w-[var(--space-4)] text-[var(--text-secondary)]" />
      </button>

      {/* Stats panel */}
      <Show when={show()}>
        <div
          class="fixed bottom-[var(--space-16)] right-[var(--space-5)] z-[60] w-[var(--content-max-sm)] rounded-xl border border-[var(--card-border)] bg-[var(--background-secondary)]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-scale-in"
        >
          {/* Header */}
          <div class="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--card-border)]">
            <div class="flex items-center gap-[var(--gap-items)]">
              <Activity class="h-[var(--space-4)] w-[var(--space-4)] text-[var(--brand-teal-1)]" />
              <span class="text-sm font-semibold text-[var(--text-primary)]">Performance</span>
            </div>
            <button
              onClick={() => setShow(false)}
              class="p-[var(--space-2)] rounded-lg hover:bg-[var(--background-primary)] transition-colors"
            >
              <X class="h-[var(--space-4)] w-[var(--space-4)] text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Stats */}
          <div class="p-[var(--space-5)] space-y-[var(--gap-items)]">
            {/* FPS */}
            <div class="space-y-[var(--space-2)]">
              <div class="flex items-center justify-between text-xs">
                <span class="text-[var(--text-secondary)]">FPS</span>
                <span class={`font-bold tabular-nums ${fpsTextColor()}`}>
                  {stats().fps}
                </span>
              </div>
              <div class="h-[var(--space-2)] rounded-full bg-[var(--background-primary)] overflow-hidden">
                <div
                  class={`h-full transition-all duration-300 ${fpsColor()}`}
                  style={{ width: `${Math.min(100, (stats().fps / 60) * 100)}%` }}
                />
              </div>
            </div>

            {/* Frame Time */}
            <div class="space-y-[var(--space-2)]">
              <div class="flex items-center justify-between text-xs">
                <span class="text-[var(--text-secondary)]">Frame Time</span>
                <span class="font-bold text-[var(--text-primary)] tabular-nums">
                  {stats().frameTime}ms
                </span>
              </div>
              <div class="h-[var(--space-2)] rounded-full bg-[var(--background-primary)] overflow-hidden">
                <div
                  class={`h-full transition-all duration-300 ${frameTimeColor()}`}
                  style={{ width: `${Math.min(100, (stats().frameTime / 33.33) * 100)}%` }}
                />
              </div>
            </div>

            {/* Memory (if available) */}
            <Show when={stats().memory !== undefined}>
              <div class="space-y-[var(--space-2)]">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-[var(--text-secondary)]">Memory</span>
                  <span class="font-bold text-[var(--text-primary)] tabular-nums">
                    {stats().memory}MB
                  </span>
                </div>
                <div class="h-[var(--space-2)] rounded-full bg-[var(--background-primary)] overflow-hidden">
                  <div
                    class="h-full bg-[var(--brand-teal-1)] transition-all duration-300"
                    style={{ width: `${Math.min(100, (stats().memory! / 500) * 100)}%` }}
                  />
                </div>
              </div>
            </Show>

            {/* Info */}
            <div class="pt-[var(--space-2)] border-t border-[var(--card-border)] text-xs text-[var(--text-muted)]">
              Toggle with <kbd class="px-[var(--space-2)] py-[var(--space-1)] rounded bg-[var(--background-primary)] border border-[var(--card-border)] font-mono">Ctrl+Shift+P</kbd>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}
