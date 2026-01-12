import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js'
import { X, CheckCircle, AlertCircle, Info, Sparkles, Zap } from 'lucide-solid'
import type { Component, JSX } from 'solid-js'

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

const toastIcons: Record<Toast['type'], Component<{ class?: string }>> = {
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

export function ToastNotifications(props: ToastNotificationsProps) {
  // Only show the most recent toasts, limit to prevent overflow
  const visibleToasts = () => props.toasts.slice(-MAX_VISIBLE_TOASTS)
  const hiddenCount = () => props.toasts.length - visibleToasts().length

  return (
    <div class="fixed top-[var(--space-16)] right-[var(--space-4)] z-[70] flex flex-col gap-[var(--space-2)] max-w-xs w-full px-[var(--space-4)] sm:px-0 sm:w-auto">
      <Show when={hiddenCount() > 0}>
        <div
          class="text-xs text-[var(--text-muted)] text-right pr-[var(--space-2)] animate-[fadeIn_200ms_ease-out]"
        >
          +{hiddenCount()} more notification{hiddenCount() > 1 ? 's' : ''}
        </div>
      </Show>
      <For each={visibleToasts()}>
        {(toast) => (
          <ToastItem
            toast={toast}
            onRemove={props.onRemove}
          />
        )}
      </For>
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem(props: ToastItemProps) {
  const [progress, setProgress] = createSignal(100)
  const [isVisible, setIsVisible] = createSignal(false)
  const duration = () => props.toast.duration || 5000
  const Icon = toastIcons[props.toast.type]
  const colors = toastColors[props.toast.type]

  // Trigger entrance animation
  createEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  })

  createEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.max(0, 100 - (elapsed / duration()) * 100)
      setProgress(newProgress)

      if (newProgress <= 0) {
        clearInterval(interval)
        props.onRemove(props.toast.id)
      }
    }, 16) // ~60fps

    onCleanup(() => clearInterval(interval))
  })

  return (
    <div
      class="relative transition-all duration-300 ease-out"
      classList={{
        'opacity-0 translate-x-[300px] scale-90': !isVisible(),
        'opacity-100 translate-x-0 scale-100': isVisible(),
      }}
    >
      {/* Glow effect */}
      <div class={`absolute -inset-[var(--space-0-5)] rounded-xl blur-lg ${colors.glow} opacity-50`} />

      <div class={`relative rounded-xl border ${colors.border} ${colors.bg} backdrop-blur-xl overflow-hidden shadow-xl`}>
        {/* Progress bar */}
        <div class="absolute bottom-0 left-0 right-0 h-[var(--space-1)] bg-[var(--background-primary)]/30">
          <div
            class={`h-full ${colors.text.replace('text-', 'bg-')} transition-[width] duration-100 ease-linear`}
            style={{ width: `${progress()}%` }}
          />
        </div>

        <div class="px-[var(--space-3)] py-[var(--space-2-5)] pr-[var(--space-10)]">
          <div class="flex items-center gap-[var(--space-2-5)]">
            {/* Icon - Smaller */}
            <div class={`w-[var(--space-8)] h-[var(--space-8)] rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
              <Icon class={`h-[var(--space-4)] w-[var(--space-4)] ${colors.text}`} />
            </div>

            {/* Content - Compact */}
            <div class="flex-1 min-w-0">
              <h4 class={`font-semibold text-sm ${colors.text} leading-tight`}>
                {props.toast.title}
              </h4>
              <Show when={props.toast.message}>
                <p class="text-xs text-[var(--text-secondary)] leading-snug mt-[var(--space-0-5)]">
                  {props.toast.message}
                </p>
              </Show>
            </div>
          </div>
        </div>

        {/* Close button - Smaller */}
        <button
          onClick={() => props.onRemove(props.toast.id)}
          class="absolute top-[var(--space-2)] right-[var(--space-2)] p-[var(--space-1-5)] rounded-md hover:bg-[var(--background-primary)]/50 transition-colors"
        >
          <X class="h-[var(--space-3-5)] w-[var(--space-3-5)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]" />
        </button>
      </div>
    </div>
  )
}

// Hook for managing toasts
export function createToasts() {
  const [toasts, setToasts] = createSignal<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { ...toast, id }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, addToast, removeToast }
}
