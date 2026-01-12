import { createSignal, Show, For, type Component, type JSX } from 'solid-js'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Loader2 } from 'lucide-solid'

export type ConfirmDialogVariant = 'primary' | 'success' | 'warning' | 'destructive'

/**
 * Dialog variant configurations
 */
const DIALOG_VARIANTS: Record<ConfirmDialogVariant, { bg: string; border: string; icon: string; button: string }> = {
  primary: {
    bg: 'bg-[hsl(var(--primary))]/10',
    border: 'border-[hsl(var(--primary))]/30',
    icon: 'text-[hsl(var(--primary))]',
    button: 'bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))]',
  },
  success: {
    bg: 'bg-[hsl(var(--success))]/10',
    border: 'border-[hsl(var(--success))]/30',
    icon: 'text-[hsl(var(--success))]',
    button: 'bg-gradient-to-r from-[hsl(var(--success))] to-[var(--brand-green-4)]',
  },
  warning: {
    bg: 'bg-[var(--brand-red-4)]/10',
    border: 'border-[var(--brand-red-4)]/30',
    icon: 'text-[var(--brand-red-4)]',
    button: 'bg-gradient-to-r from-[var(--brand-red-4)] to-[var(--brand-red-2)]',
  },
  destructive: {
    bg: 'bg-[hsl(var(--destructive))]/10',
    border: 'border-[hsl(var(--destructive))]/30',
    icon: 'text-[hsl(var(--destructive))]',
    button: 'bg-gradient-to-r from-[hsl(var(--destructive))] to-[var(--brand-red-2)]',
  },
}

export interface PreviewData {
  label: string
  value: string | number
  highlight?: boolean
}

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Called when dialog is closed */
  onClose: () => void
  /** Called when confirm is clicked */
  onConfirm: () => void | Promise<void>
  /** Dialog title */
  title: string
  /** Dialog description */
  description?: string
  /** Confirm button label */
  confirmLabel?: string
  /** Cancel button label */
  cancelLabel?: string
  /** Dialog variant */
  variant?: ConfirmDialogVariant
  /** Optional preview data rows */
  previewData?: PreviewData[]
  /** Icon component */
  icon?: JSX.Element
  /** Whether confirm action is loading */
  isLoading?: boolean
  /** Whether confirm action is disabled */
  isDisabled?: boolean
  /** Additional content to display */
  children?: JSX.Element
}

/**
 * ConfirmDialog - A reusable confirmation dialog
 *
 * Replaces duplicate confirmation dialogs throughout the app:
 * - Batch refuel confirmations
 * - Batch deploy confirmations
 * - Delete confirmations
 * - Any action that needs user confirmation
 */
export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  const [isConfirming, setIsConfirming] = createSignal(false)

  const variantConfig = () => DIALOG_VARIANTS[props.variant || 'primary']

  const handleConfirm = async () => {
    if (isConfirming() || props.isDisabled) return
    setIsConfirming(true)
    try {
      await props.onConfirm()
      props.onClose()
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
        onClick={props.onClose}
      >
        {/* Backdrop */}
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Dialog */}
        <div
          onClick={(e) => e.stopPropagation()}
          class="relative w-full max-w-sm rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)] shadow-2xl overflow-hidden animate-scale-in"
        >
          {/* Header */}
          <div class={cn(
            'p-4 border-b border-[var(--card-border)]',
            variantConfig().bg
          )}>
            <div class="flex items-center gap-4">
              <Show
                when={props.icon}
                fallback={
                  <div class={cn('p-2 rounded-xl', variantConfig().bg, variantConfig().icon)}>
                    <div class="w-5 h-5" />
                  </div>
                }
              >
                <div class={cn('p-2 rounded-xl', variantConfig().bg, variantConfig().icon)}>
                  {props.icon}
                </div>
              </Show>
              <div>
                <h3 class="font-semibold text-[var(--text-primary)]">{props.title}</h3>
                <Show when={props.description}>
                  <p class="text-xs text-[var(--text-muted)]">{props.description}</p>
                </Show>
              </div>
            </div>
          </div>

          {/* Content */}
          <div class="p-4 space-y-4">
            {/* Preview Data */}
            <Show when={props.previewData && props.previewData.length > 0}>
              <div class="grid grid-cols-2 gap-3">
                <For each={props.previewData}>
                  {(item) => (
                    <div
                      class={cn(
                        'px-4 py-3 rounded-xl border',
                        item.highlight
                          ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30'
                          : 'bg-[var(--background-primary)] border-[var(--card-border)]'
                      )}
                    >
                      <div class="text-xs text-[var(--text-muted)] mb-1">{item.label}</div>
                      <div class={cn(
                        'text-lg font-bold',
                        item.highlight ? 'text-[hsl(var(--primary))]' : 'text-[var(--text-primary)]'
                      )}>
                        {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Custom content */}
            {props.children}
          </div>

          {/* Actions */}
          <div class="p-4 border-t border-[var(--card-border)] flex gap-3">
            <Button
              variant="outline"
              onClick={props.onClose}
              disabled={isConfirming()}
              class="flex-1"
            >
              {props.cancelLabel || 'Cancel'}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming() || props.isDisabled}
              class={cn('flex-1', variantConfig().button)}
            >
              <Show
                when={isConfirming() || props.isLoading}
                fallback={props.confirmLabel || 'Confirm'}
              >
                <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </Show>
            </Button>
          </div>
        </div>
      </div>
    </Show>
  )
}
