import { createSignal, onMount, onCleanup, Show, For, type Component } from 'solid-js'
import { Keyboard, X } from 'lucide-solid'

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

export const KeyboardShortcuts: Component = () => {
  const [show, setShow] = createSignal(false)

  const groupedShortcuts = () => {
    return shortcuts.reduce((acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = []
      }
      acc[shortcut.category].push(shortcut)
      return acc
    }, {} as Record<string, Shortcut[]>)
  }

  onMount(() => {
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

      if (e.key === 'Escape' && show()) {
        setShow(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    onCleanup(() => window.removeEventListener('keydown', handleKeyPress))
  })

  return (
    <Show when={show()}>
      <div
        class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-[var(--space-4)] animate-fade-in"
        onClick={() => setShow(false)}
      >
        <div
          class="relative max-w-2xl w-full animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Outer glow */}
          <div class="absolute -inset-1 bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 rounded-[var(--radius-2xl)] blur-xl" />

          <div class="relative bg-[var(--background-secondary)]/95 backdrop-blur-2xl border border-[var(--card-border)] rounded-[var(--radius-2xl)] shadow-2xl overflow-hidden">
            {/* Header */}
            <div class="relative border-b border-[var(--card-border)] px-[var(--space-6)] py-[var(--space-5)]">
              <div class="absolute inset-0 bg-gradient-to-r from-[var(--brand-teal-1)]/5 to-[var(--brand-blue-2)]/5" />

              <div class="relative flex items-center justify-between">
                <div class="flex items-center gap-[var(--space-4)]">
                  <div class="w-12 h-12 rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center shadow-lg shadow-[var(--brand-teal-1)]/20">
                    <Keyboard class="h-[var(--space-6)] w-[var(--space-6)] text-white" />
                  </div>
                  <div>
                    <h2 class="text-xl font-bold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
                    <p class="text-sm text-[var(--text-tertiary)] mt-[var(--space-1)]">Press <kbd class="px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)] bg-[var(--background-primary)] border border-[var(--card-border)] font-mono text-xs">?</kbd> to toggle</p>
                  </div>
                </div>
                <button
                  onClick={() => setShow(false)}
                  class="p-[var(--space-3)] rounded-[var(--radius-lg)] hover:bg-[var(--background-primary)] transition-colors"
                >
                  <X class="h-[var(--space-6)] w-[var(--space-6)] text-[var(--text-secondary)]" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div class="p-[var(--space-6)] max-h-[70vh] overflow-y-auto">
              <div class="space-y-[var(--space-8)]">
                <For each={Object.entries(groupedShortcuts())}>
                  {([category, items]) => (
                    <div>
                      <div class={`inline-flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] rounded-full text-sm font-semibold mb-[var(--space-4)] border ${categoryColors[category as Shortcut['category']]}`}>
                        {category}
                      </div>
                      <div class="space-y-[var(--space-3)]">
                        <For each={items}>
                          {(shortcut, index) => (
                            <div
                              class="flex items-center justify-between px-[var(--space-5)] py-[var(--space-4)] rounded-[var(--radius-xl)] bg-[var(--background-primary)]/50 hover:bg-[var(--background-primary)] transition-colors group animate-slide-in"
                              style={{ "animation-delay": `${index() * 30}ms` }}
                            >
                              <span class="text-base text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                                {shortcut.description}
                              </span>
                              <div class="flex items-center gap-[var(--space-2)]">
                                <For each={shortcut.keys}>
                                  {(key, i) => (
                                    <div class="flex items-center gap-[var(--space-2)]">
                                      <kbd class="px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-lg)] bg-[var(--background-secondary)] border border-[var(--card-border)] font-mono text-sm text-[var(--text-primary)] shadow-sm min-w-[2.5rem] text-center">
                                        {key}
                                      </kbd>
                                      <Show when={i() < shortcut.keys.length - 1}>
                                        <span class="text-[var(--text-muted)] text-sm">+</span>
                                      </Show>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Footer hint */}
            <div class="border-t border-[var(--card-border)] px-[var(--space-6)] py-[var(--space-3)] bg-[var(--background-primary)]/30">
              <p class="text-sm text-[var(--text-muted)] text-center">
                Press <kbd class="px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)] bg-[var(--background-secondary)] border border-[var(--card-border)] font-mono text-xs">Esc</kbd> or click outside to close
              </p>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
