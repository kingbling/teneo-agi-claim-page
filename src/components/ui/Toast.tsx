/**
 * Toast notification system for user feedback
 *
 * Shows temporary notifications for success/error messages.
 */

import { createSignal, createEffect, onCleanup, Show, For, type Component } from 'solid-js'
import { createStore } from 'solid-js/store'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number // Auto-dismiss duration in ms (default: 3000)
}

// Global toast store
let toastListeners: Array<(toasts: Toast[]) => void> = []
const globalToasts: Toast[] = []

function notifyListeners() {
  const toasts = [...globalToasts]
  for (const listener of toastListeners) {
    listener(toasts)
  }
}

export function showToast(toast: Omit<Toast, 'id'>): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const newToast: Toast = { ...toast, id }

  globalToasts.push(newToast)
  notifyListeners()

  // Auto-dismiss
  const duration = toast.duration ?? 3000
  setTimeout(() => {
    removeToast(id)
  }, duration)

  return id
}

export function removeToast(id: string): void {
  const index = globalToasts.findIndex(t => t.id === id)
  if (index >= 0) {
    globalToasts.splice(index, 1)
    notifyListeners()
  }
}

export function clearToasts(): void {
  globalToasts.length = 0
  notifyListeners()
}

// Convenience functions
export const toast = {
  success: (message: string, duration?: number) => showToast({ type: 'success', message, duration }),
  error: (message: string, duration?: number) => showToast({ type: 'error', message, duration }),
  info: (message: string, duration?: number) => showToast({ type: 'info', message, duration }),
  warning: (message: string, duration?: number) => showToast({ type: 'warning', message, duration }),
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-green-500/90 border-green-400 text-white',
  error: 'bg-red-500/90 border-red-400 text-white',
  info: 'bg-blue-500/90 border-blue-400 text-white',
  warning: 'bg-yellow-500/90 border-yellow-400 text-white',
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ⓘ',
  warning: '⚠',
}

export const ToastContainer: Component = () => {
  const [toasts, setToasts] = createSignal<Toast[]>([])

  createEffect(() => {
    // Subscribe to global toast updates
    toastListeners.push(setToasts)

    onCleanup(() => {
      const index = toastListeners.indexOf(setToasts)
      if (index >= 0) {
        toastListeners.splice(index, 1)
      }
    })
  })

  return (
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <For each={toasts()}>
        {(toast) => (
          <div
            class={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg
              border shadow-lg backdrop-blur-sm
              min-w-[300px] max-w-md
              animate-slide-in-right
              ${TOAST_STYLES[toast.type]}
            `}
          >
            <span class="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-white/20 rounded-full text-sm font-bold">
              {TOAST_ICONS[toast.type]}
            </span>
            <span class="flex-1 text-sm font-medium">{toast.message}</span>
            <button
              class="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => removeToast(toast.id)}
            >
              ✕
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
