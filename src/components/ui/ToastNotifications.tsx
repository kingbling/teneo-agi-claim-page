import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, Sparkles, Zap } from 'lucide-react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'discovery' | 'trance'
  title: string
  message?: string
  duration?: number
}

interface ToastNotificationsProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  discovery: Sparkles,
  trance: Zap,
}

const toastColors = {
  success: {
    bg: 'bg-[hsl(var(--success))]/10',
    border: 'border-[hsl(var(--success))]/30',
    text: 'text-[hsl(var(--success))]',
    glow: 'shadow-[hsl(var(--success))]/20',
  },
  error: {
    bg: 'bg-[hsl(var(--destructive))]/10',
    border: 'border-[hsl(var(--destructive))]/30',
    text: 'text-[hsl(var(--destructive))]',
    glow: 'shadow-[hsl(var(--destructive))]/20',
  },
  info: {
    bg: 'bg-[var(--brand-blue-2)]/10',
    border: 'border-[var(--brand-blue-2)]/30',
    text: 'text-[var(--brand-blue-2)]',
    glow: 'shadow-[var(--brand-blue-2)]/20',
  },
  discovery: {
    bg: 'bg-[var(--brand-teal-1)]/10',
    border: 'border-[var(--brand-teal-1)]/30',
    text: 'text-[var(--brand-teal-1)]',
    glow: 'shadow-[var(--brand-teal-1)]/20',
  },
  trance: {
    bg: 'bg-[hsl(var(--tier-mythic))]/10',
    border: 'border-[hsl(var(--tier-mythic))]/30',
    text: 'text-[hsl(var(--tier-mythic))]',
    glow: 'shadow-[hsl(var(--tier-mythic))]/20',
  },
}

const MAX_VISIBLE_TOASTS = 4

export function ToastNotifications({ toasts, onRemove }: ToastNotificationsProps) {
  // Only show the most recent toasts, limit to prevent overflow
  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS)
  const hiddenCount = toasts.length - visibleToasts.length

  return (
    <div className="fixed top-[var(--space-16)] right-[var(--space-4)] z-[70] flex flex-col gap-[var(--space-2)] max-w-xs w-full px-[var(--space-4)] sm:px-0 sm:w-auto">
      <AnimatePresence>
        {hiddenCount > 0 && (
          <motion.div
            key="hidden-count"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xs text-[var(--text-muted)] text-right pr-[var(--space-2)]"
          >
            +{hiddenCount} more notification{hiddenCount > 1 ? 's' : ''}
          </motion.div>
        )}
        {visibleToasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={onRemove}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [progress, setProgress] = useState(100)
  const duration = toast.duration || 5000
  const Icon = toastIcons[toast.type]
  const colors = toastColors[toast.type]

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(newProgress)

      if (newProgress <= 0) {
        clearInterval(interval)
        onRemove(toast.id)
      }
    }, 16) // ~60fps

    return () => clearInterval(interval)
  }, [toast.id, duration, onRemove])

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="relative"
    >
      {/* Glow effect */}
      <div className={`absolute -inset-[var(--space-0-5)] rounded-xl blur-lg ${colors.glow} opacity-50`} />

      <div className={`relative rounded-xl border ${colors.border} ${colors.bg} backdrop-blur-xl overflow-hidden shadow-xl`}>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[var(--space-1)] bg-[var(--background-primary)]/30">
          <motion.div
            className={`h-full ${colors.text.replace('text-', 'bg-')}`}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>

        <div className="px-[var(--space-3)] py-[var(--space-2-5)] pr-[var(--space-10)]">
          <div className="flex items-center gap-[var(--space-2-5)]">
            {/* Icon - Smaller */}
            <div className={`w-[var(--space-8)] h-[var(--space-8)] rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
              <Icon className={`h-[var(--space-4)] w-[var(--space-4)] ${colors.text}`} />
            </div>

            {/* Content - Compact */}
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-sm ${colors.text} leading-tight`}>
                {toast.title}
              </h4>
              {toast.message && (
                <p className="text-xs text-[var(--text-secondary)] leading-snug mt-[var(--space-0-5)]">
                  {toast.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Close button - Smaller */}
        <button
          onClick={() => onRemove(toast.id)}
          className="absolute top-[var(--space-2)] right-[var(--space-2)] p-[var(--space-1-5)] rounded-md hover:bg-[var(--background-primary)]/50 transition-colors"
        >
          <X className="h-[var(--space-3-5)] w-[var(--space-3-5)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]" />
        </button>
      </div>
    </motion.div>
  )
}

// Hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { ...toast, id }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, addToast, removeToast }
}
