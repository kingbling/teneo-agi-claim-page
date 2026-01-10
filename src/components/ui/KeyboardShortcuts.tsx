import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, X } from 'lucide-react'

interface Shortcut {
  keys: string[]
  description: string
  category: 'Navigation' | 'View' | 'Actions' | 'System'
}

const shortcuts: Shortcut[] = [
  // Navigation
  { keys: ['W'], description: 'Move forward', category: 'Navigation' },
  { keys: ['S'], description: 'Move backward', category: 'Navigation' },
  { keys: ['A'], description: 'Move left', category: 'Navigation' },
  { keys: ['D'], description: 'Move right', category: 'Navigation' },
  { keys: ['Scroll'], description: 'Zoom in/out', category: 'Navigation' },
  { keys: ['Left Click + Drag'], description: 'Rotate view', category: 'Navigation' },

  // View
  { keys: ['3'], description: 'Switch to 3D view', category: 'View' },
  { keys: ['2'], description: 'Switch to 2D view', category: 'View' },

  // Actions
  { keys: ['D'], description: 'Deploy all idle agents', category: 'Actions' },
  { keys: ['R'], description: 'Refuel all low agents', category: 'Actions' },
  { keys: ['Shift', 'R'], description: 'Refuel selected agent', category: 'Actions' },
  { keys: ['N'], description: 'Create new agent', category: 'Actions' },
  { keys: ['F'], description: 'Focus camera on selected agent', category: 'Actions' },

  // System
  { keys: ['Ctrl', 'Shift', 'P'], description: 'Toggle performance monitor', category: 'System' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'System' },
  { keys: ['Esc'], description: 'Close dialogs', category: 'System' },
]

const categoryColors: Record<Shortcut['category'], string> = {
  'Navigation': 'text-[var(--state-wandering)] bg-[var(--state-wandering)]/10 border-[var(--state-wandering)]/20',
  'View': 'text-[var(--tier-trait)] bg-[var(--tier-trait)]/10 border-[var(--tier-trait)]/20',
  'Actions': 'text-[var(--state-solving)] bg-[var(--state-solving)]/10 border-[var(--state-solving)]/20',
  'System': 'text-[var(--brand-teal-1)] bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/20',
}

export function KeyboardShortcuts() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShow(prev => !prev)
      }

      if (e.key === 'Escape' && show) {
        setShow(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [show])

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, Shortcut[]>)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-[var(--space-4)]"
          onClick={() => setShow(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Outer glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 rounded-[var(--radius-2xl)] blur-xl" />

            <div className="relative bg-[var(--background-secondary)]/95 backdrop-blur-2xl border border-[var(--card-border)] rounded-[var(--radius-2xl)] shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative border-b border-[var(--card-border)] px-[var(--space-6)] py-[var(--space-5)]">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-teal-1)]/5 to-[var(--brand-blue-2)]/5" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-[var(--space-4)]">
                    <div className="w-12 h-12 rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center shadow-lg shadow-[var(--brand-teal-1)]/20">
                      <Keyboard className="h-[var(--space-6)] w-[var(--space-6)] text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
                      <p className="text-sm text-[var(--text-tertiary)] mt-[var(--space-1)]">Press <kbd className="px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)] bg-[var(--background-primary)] border border-[var(--card-border)] font-mono text-xs">?</kbd> to toggle</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShow(false)}
                    className="p-[var(--space-3)] rounded-[var(--radius-lg)] hover:bg-[var(--background-primary)] transition-colors"
                  >
                    <X className="h-[var(--space-6)] w-[var(--space-6)] text-[var(--text-secondary)]" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-[var(--space-6)] max-h-[70vh] overflow-y-auto">
                <div className="space-y-[var(--space-8)]">
                  {Object.entries(groupedShortcuts).map(([category, items]) => (
                    <div key={category}>
                      <div className={`inline-flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] rounded-full text-sm font-semibold mb-[var(--space-4)] border ${categoryColors[category as Shortcut['category']]}`}>
                        {category}
                      </div>
                      <div className="space-y-[var(--space-3)]">
                        {items.map((shortcut, index) => (
                          <motion.div
                            key={`${category}-${index}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="flex items-center justify-between px-[var(--space-5)] py-[var(--space-4)] rounded-[var(--radius-xl)] bg-[var(--background-primary)]/50 hover:bg-[var(--background-primary)] transition-colors group"
                          >
                            <span className="text-base text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                              {shortcut.description}
                            </span>
                            <div className="flex items-center gap-[var(--space-2)]">
                              {shortcut.keys.map((key, i) => (
                                <div key={i} className="flex items-center gap-[var(--space-2)]">
                                  <kbd className="px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-lg)] bg-[var(--background-secondary)] border border-[var(--card-border)] font-mono text-sm text-[var(--text-primary)] shadow-sm min-w-[2.5rem] text-center">
                                    {key}
                                  </kbd>
                                  {i < shortcut.keys.length - 1 && (
                                    <span className="text-[var(--text-muted)] text-sm">+</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer hint */}
              <div className="border-t border-[var(--card-border)] px-[var(--space-6)] py-[var(--space-3)] bg-[var(--background-primary)]/30">
                <p className="text-sm text-[var(--text-muted)] text-center">
                  Press <kbd className="px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)] bg-[var(--background-secondary)] border border-[var(--card-border)] font-mono text-xs">Esc</kbd> or click outside to close
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
