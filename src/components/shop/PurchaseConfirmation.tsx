import { motion, AnimatePresence } from 'framer-motion'
import { X, Coins, Clock, Zap, Clover, TrendingUp, Radar, EyeOff, AlertTriangle, Check, Sparkles } from 'lucide-react'
import { useShopStore, formatDuration } from '@/stores/shopStore'
import { useUserStore } from '@/stores/userStore'
import { cn } from '@/lib/utils'

// Item type colors
const ITEM_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  speed_boost: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  luck_charm: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  xp_amplifier: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  radar: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  cloak: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
  },
}

// Icon component
function ItemIcon({ itemType, className }: { itemType: string; className?: string }) {
  switch (itemType) {
    case 'speed_boost':
      return <Zap className={className} />
    case 'luck_charm':
      return <Clover className={className} />
    case 'xp_amplifier':
      return <TrendingUp className={className} />
    case 'radar':
      return <Radar className={className} />
    case 'cloak':
      return <EyeOff className={className} />
    default:
      return <Coins className={className} />
  }
}

/**
 * PurchaseConfirmation - Modal for confirming item purchases
 * Shows item details, cost, and remaining balance after purchase
 */
export function PurchaseConfirmation() {
  const { confirmationDialog, closePurchaseConfirmation, confirmPurchase } = useShopStore()
  const { agenticBalance } = useUserStore()

  const { isOpen, item, isPurchasing, error } = confirmationDialog

  if (!isOpen || !item) return null

  const styles = ITEM_TYPE_STYLES[item.id] || ITEM_TYPE_STYLES.speed_boost
  const remainingBalance = agenticBalance - item.cost
  const canAfford = remainingBalance >= 0

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={closePurchaseConfirmation}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]/30 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className={cn('p-6 border-b border-[var(--card-border)]/20', styles.bg)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('p-3 rounded-xl border', styles.bg, styles.border)}>
                  <ItemIcon itemType={item.id} className={cn('h-6 w-6', styles.text)} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    Confirm Purchase
                  </h2>
                  <p className={cn('text-sm font-medium', styles.text)}>{item.name}</p>
                </div>
              </div>
              <button
                onClick={closePurchaseConfirmation}
                className="p-2 rounded-lg hover:bg-[var(--background-primary)] transition-colors"
              >
                <X className="h-5 w-5 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Item Description */}
            <p className="text-[var(--text-secondary)] text-center">
              {item.description}
            </p>

            {/* Item Details */}
            <div className="space-y-3">
              {/* Effect */}
              <div className={cn(
                'p-4 rounded-xl border',
                styles.bg,
                styles.border
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn('h-4 w-4', styles.text)} />
                    <span className="text-sm text-[var(--text-muted)]">Effect</span>
                  </div>
                  <span className={cn('text-sm font-bold', styles.text)}>{item.effect}</span>
                </div>
              </div>

              {/* Duration */}
              <div className="p-4 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                    <span className="text-sm text-[var(--text-muted)]">Duration</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {formatDuration(item.duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost Summary */}
            <div className="p-4 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Current Balance</span>
                <div className="flex items-center gap-1">
                  <Coins className="h-4 w-4 text-[hsl(var(--accent))]" />
                  <span className="font-medium text-[hsl(var(--accent))]">
                    {agenticBalance.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Item Cost</span>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-red-400">
                    -{item.cost.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="h-px bg-[var(--card-border)]/20" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">After Purchase</span>
                <div className="flex items-center gap-1">
                  <Coins className={cn(
                    'h-4 w-4',
                    canAfford ? 'text-green-400' : 'text-red-400'
                  )} />
                  <span className={cn(
                    'font-bold',
                    canAfford ? 'text-green-400' : 'text-red-400'
                  )}>
                    {remainingBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Insufficient Balance Warning */}
            {!canAfford && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">
                  Insufficient $AGENTIC balance. You need {Math.abs(remainingBalance).toLocaleString()} more.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[var(--card-border)]/20 bg-[var(--background-primary)]/50">
            <div className="flex gap-3">
              <button
                onClick={closePurchaseConfirmation}
                disabled={isPurchasing}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--background-secondary)] border border-[var(--card-border)]/20 text-[var(--text-muted)] font-medium hover:bg-[var(--background-secondary)]/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <motion.button
                onClick={confirmPurchase}
                disabled={!canAfford || isPurchasing}
                whileHover={canAfford && !isPurchasing ? { scale: 1.02 } : undefined}
                whileTap={canAfford && !isPurchasing ? { scale: 0.98 } : undefined}
                className={cn(
                  'flex-1 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                  canAfford && !isPurchasing
                    ? 'bg-gradient-to-r from-[var(--brand-teal-1)] to-[hsl(var(--accent))] text-white shadow-lg shadow-[var(--brand-teal-1)]/20'
                    : 'bg-[var(--background-secondary)] text-[var(--text-muted)] cursor-not-allowed'
                )}
              >
                {isPurchasing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Coins className="h-4 w-4" />
                    </motion.div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm Purchase
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * PurchaseSuccess - Optional success state overlay
 * Can be used for showing purchase success animation
 */
export function PurchaseSuccessOverlay({
  itemName,
  onClose
}: {
  itemName: string
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className="flex flex-col items-center gap-4 p-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="p-6 rounded-full bg-green-500/20 border-2 border-green-500/40"
        >
          <Check className="h-12 w-12 text-green-400" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Purchase Complete!
          </h3>
          <p className="text-[var(--text-muted)]">
            {itemName} is now active
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
