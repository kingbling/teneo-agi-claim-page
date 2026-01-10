import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Loader2 } from 'lucide-react'

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
  icon?: React.ReactNode
  /** Whether confirm action is loading */
  isLoading?: boolean
  /** Whether confirm action is disabled */
  isDisabled?: boolean
  /** Additional content to display */
  children?: React.ReactNode
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
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  previewData,
  icon,
  isLoading = false,
  isDisabled = false,
  children,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  const variantConfig = DIALOG_VARIANTS[variant]

  const handleConfirm = async () => {
    if (isConfirming || isDisabled) return
    setIsConfirming(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className={cn(
              'p-4 border-b border-[var(--card-border)]',
              variantConfig.bg
            )}>
              <div className="flex items-center gap-4">
                {icon ? (
                  <div className={cn('p-2 rounded-xl', variantConfig.bg, variantConfig.icon)}>
                    {icon}
                  </div>
                ) : (
                  <div className={cn('p-2 rounded-xl', variantConfig.bg, variantConfig.icon)}>
                    <div className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
                  {description && (
                    <p className="text-xs text-[var(--text-muted)]">{description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Preview Data */}
              {previewData && previewData.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {previewData.map((item, index) => (
                    <div
                      key={index}
                      className={cn(
                        'px-4 py-3 rounded-xl border',
                        item.highlight
                          ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30'
                          : 'bg-[var(--background-primary)] border-[var(--card-border)]'
                      )}
                    >
                      <div className="text-xs text-[var(--text-muted)] mb-1">{item.label}</div>
                      <div className={cn(
                        'text-lg font-bold',
                        item.highlight ? 'text-[hsl(var(--primary))]' : 'text-[var(--text-primary)]'
                      )}>
                        {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom content */}
              {children}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[var(--card-border)] flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isConfirming}
                className="flex-1"
              >
                {cancelLabel}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isConfirming || isDisabled}
                className={cn('flex-1', variantConfig.button)}
              >
                {isConfirming || isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  confirmLabel
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
