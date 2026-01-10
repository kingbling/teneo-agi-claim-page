import { motion } from 'framer-motion'
import { HelpCircle, X } from 'lucide-react'
import { TipsPanel, KeyboardShortcutsReference } from '@/components/ui/GameTips'

export interface HelpOverlayProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * HelpOverlay - Help dialog with keyboard shortcuts and tips
 *
 * Extracted from DiscoveryDashboard, this component provides
 * help information to users about controls and gameplay.
 */
export function HelpOverlay({ isOpen, onClose }: HelpOverlayProps) {
  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative bg-[var(--background-secondary)]/95 backdrop-blur-xl border border-[var(--card-border)] rounded-2xl p-8 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-[var(--background-primary)] transition-colors"
        >
          <X className="h-5 w-5 text-[var(--text-secondary)]" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center shadow-lg shadow-[var(--brand-teal-1)]/20">
            <HelpCircle className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Help & Tips</h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">Master the TENEO Discovery Portal</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Keyboard Shortcuts Section */}
          <div className="p-6 rounded-2xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]">
            <KeyboardShortcutsReference />
          </div>

          {/* Mouse Controls */}
          <div className="p-6 rounded-2xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Mouse Controls</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--background-secondary)]/50">
                <span className="text-[var(--text-muted)]">Left drag</span>
                <span className="text-[var(--text-primary)] font-medium">Rotate camera</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--background-secondary)]/50">
                <span className="text-[var(--text-muted)]">Scroll</span>
                <span className="text-[var(--text-primary)] font-medium">Zoom in/out</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--background-secondary)]/50">
                <span className="text-[var(--text-muted)]">Click space</span>
                <span className="text-[var(--text-primary)] font-medium">Deploy agent</span>
              </div>
            </div>
          </div>

          {/* Game Tips Section */}
          <div className="p-6 rounded-2xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]">
            <TipsPanel />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
