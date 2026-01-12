/**
 * HelpOverlay - SolidJS Version
 *
 * Help dialog with keyboard shortcuts and tips.
 */

import { type Component, Show } from 'solid-js'
import { HelpCircle, X } from 'lucide-solid'

export interface HelpOverlayProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * HelpOverlay - Help dialog with keyboard shortcuts and tips
 */
export const HelpOverlay: Component<HelpOverlayProps> = (props) => {
  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
        onClick={props.onClose}
      >
        <div
          class="relative bg-[var(--background-secondary)]/95 backdrop-blur-xl border border-[var(--card-border)] rounded-2xl p-8 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={props.onClose}
            class="absolute top-4 right-4 p-2 rounded-xl hover:bg-[var(--background-primary)] transition-colors"
          >
            <X class="h-5 w-5 text-[var(--text-secondary)]" />
          </button>

          {/* Header */}
          <div class="flex items-center gap-4 mb-8">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center shadow-lg shadow-[var(--brand-teal-1)]/20">
              <HelpCircle class="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 class="text-2xl font-bold text-[var(--text-primary)]">Help & Tips</h2>
              <p class="text-sm text-[var(--text-tertiary)] mt-1">Master the TENEO Discovery Portal</p>
            </div>
          </div>

          <div class="space-y-8">
            {/* Keyboard Shortcuts Section */}
            <div class="p-6 rounded-2xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]">
              <h4 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Keyboard Shortcuts</h4>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background-secondary)]/50">
                  <kbd class="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">H</kbd>
                  <span class="text-[var(--text-secondary)]">Toggle help</span>
                </div>
                <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background-secondary)]/50">
                  <kbd class="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">R</kbd>
                  <span class="text-[var(--text-secondary)]">Reset camera</span>
                </div>
                <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background-secondary)]/50">
                  <kbd class="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">1-9</kbd>
                  <span class="text-[var(--text-secondary)]">Navigate regions</span>
                </div>
                <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background-secondary)]/50">
                  <kbd class="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">Esc</kbd>
                  <span class="text-[var(--text-secondary)]">Close overlays</span>
                </div>
              </div>
            </div>

            {/* Mouse Controls */}
            <div class="p-6 rounded-2xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]">
              <h4 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Mouse Controls</h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--background-secondary)]/50">
                  <span class="text-[var(--text-muted)]">Left drag</span>
                  <span class="text-[var(--text-primary)] font-medium">Rotate camera</span>
                </div>
                <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--background-secondary)]/50">
                  <span class="text-[var(--text-muted)]">Scroll</span>
                  <span class="text-[var(--text-primary)] font-medium">Zoom in/out</span>
                </div>
                <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--background-secondary)]/50">
                  <span class="text-[var(--text-muted)]">Click space</span>
                  <span class="text-[var(--text-primary)] font-medium">Deploy agent</span>
                </div>
              </div>
            </div>

            {/* Game Tips Section */}
            <div class="p-6 rounded-2xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]">
              <h4 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Tips</h4>
              <ul class="space-y-3 text-sm text-[var(--text-secondary)]">
                <li class="flex items-start gap-2">
                  <span class="text-teal-400">•</span>
                  Deploy multiple ships to explore different regions simultaneously
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-teal-400">•</span>
                  Undiscovered synapses glow brighter - they yield more rewards
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-teal-400">•</span>
                  Use autopilot to let your ships explore automatically
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-teal-400">•</span>
                  Check the lottery for bonus rewards during events
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}

export default HelpOverlay
