import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, X } from 'lucide-react'

interface PerformanceStats {
  fps: number
  frameTime: number
  memory?: number
}

export function PerformanceMonitor() {
  const [show, setShow] = useState(false)
  const [stats, setStats] = useState<PerformanceStats>({ fps: 60, frameTime: 16.67 })

  useEffect(() => {
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

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setShow(!show)}
        className="fixed bottom-[var(--space-5)] right-[var(--space-5)] z-[60] w-[var(--space-10)] h-[var(--space-10)] rounded-full bg-[var(--background-secondary)] border border-[var(--card-border)] hover:border-[var(--brand-teal-1)]/50 flex items-center justify-center transition-all hover:scale-110 shadow-lg"
        title="Performance Monitor (Ctrl+Shift+P)"
      >
        <Activity className="h-[var(--space-4)] w-[var(--space-4)] text-[var(--text-secondary)]" />
      </button>

      {/* Stats panel */}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-[var(--space-16)] right-[var(--space-5)] z-[60] w-[var(--content-max-sm)] rounded-xl border border-[var(--card-border)] bg-[var(--background-secondary)]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--card-border)]">
              <div className="flex items-center gap-[var(--gap-items)]">
                <Activity className="h-[var(--space-4)] w-[var(--space-4)] text-[var(--brand-teal-1)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">Performance</span>
              </div>
              <button
                onClick={() => setShow(false)}
                className="p-[var(--space-2)] rounded-lg hover:bg-[var(--background-primary)] transition-colors"
              >
                <X className="h-[var(--space-4)] w-[var(--space-4)] text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Stats */}
            <div className="p-[var(--space-5)] space-y-[var(--gap-items)]">
              {/* FPS */}
              <div className="space-y-[var(--space-2)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">FPS</span>
                  <span className={`font-bold tabular-nums ${
                    stats.fps >= 55 ? 'text-[#10b981]' :
                    stats.fps >= 30 ? 'text-[var(--state-solving)]' :
                    'text-[var(--state-exhausted)]'
                  }`}>
                    {stats.fps}
                  </span>
                </div>
                <div className="h-[var(--space-2)] rounded-full bg-[var(--background-primary)] overflow-hidden">
                  <motion.div
                    className={`h-full ${
                      stats.fps >= 55 ? 'bg-[#10b981]' :
                      stats.fps >= 30 ? 'bg-[var(--state-solving)]' :
                      'bg-[var(--state-exhausted)]'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (stats.fps / 60) * 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Frame Time */}
              <div className="space-y-[var(--space-2)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Frame Time</span>
                  <span className="font-bold text-[var(--text-primary)] tabular-nums">
                    {stats.frameTime}ms
                  </span>
                </div>
                <div className="h-[var(--space-2)] rounded-full bg-[var(--background-primary)] overflow-hidden">
                  <motion.div
                    className={`h-full ${
                      stats.frameTime <= 16.67 ? 'bg-[#10b981]' :
                      stats.frameTime <= 33.33 ? 'bg-[var(--state-solving)]' :
                      'bg-[var(--state-exhausted)]'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (stats.frameTime / 33.33) * 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Memory (if available) */}
              {stats.memory !== undefined && (
                <div className="space-y-[var(--space-2)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Memory</span>
                    <span className="font-bold text-[var(--text-primary)] tabular-nums">
                      {stats.memory}MB
                    </span>
                  </div>
                  <div className="h-[var(--space-2)] rounded-full bg-[var(--background-primary)] overflow-hidden">
                    <motion.div
                      className="h-full bg-[var(--brand-teal-1)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (stats.memory / 500) * 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="pt-[var(--space-2)] border-t border-[var(--card-border)] text-xs text-[var(--text-muted)]">
                Toggle with <kbd className="px-[var(--space-2)] py-[var(--space-1)] rounded bg-[var(--background-primary)] border border-[var(--card-border)] font-mono">Ctrl+Shift+P</kbd>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
