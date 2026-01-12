import { Show } from 'solid-js'
import { X, Coins, Clock, Zap, Clover, TrendingUp, Radar, EyeOff, AlertTriangle, Check, Sparkles } from 'lucide-solid'
import { shopStore, formatDuration } from '@/stores/shopStore'
import { userStore } from '@/stores/userStore'
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
function ItemIcon(props: { itemType: string; class?: string }) {
  switch (props.itemType) {
    case 'speed_boost':
      return <Zap class={props.class} />
    case 'luck_charm':
      return <Clover class={props.class} />
    case 'xp_amplifier':
      return <TrendingUp class={props.class} />
    case 'radar':
      return <Radar class={props.class} />
    case 'cloak':
      return <EyeOff class={props.class} />
    default:
      return <Coins class={props.class} />
  }
}

/**
 * PurchaseConfirmation - Modal for confirming item purchases
 * Shows item details, cost, and remaining balance after purchase
 */
export function PurchaseConfirmation() {
  const confirmationDialog = () => shopStore.confirmationDialog
  const agenticBalance = () => userStore.agenticBalance
  const item = () => confirmationDialog().item
  const isOpen = () => confirmationDialog().isOpen
  const isPurchasing = () => confirmationDialog().isPurchasing
  const error = () => confirmationDialog().error

  const styles = () => ITEM_TYPE_STYLES[item()?.id || 'speed_boost'] || ITEM_TYPE_STYLES.speed_boost
  const remainingBalance = () => agenticBalance() - (item()?.cost || 0)
  const canAfford = () => remainingBalance() >= 0

  return (
    <Show when={isOpen() && item()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => shopStore.closePurchaseConfirmation()}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          class="w-full max-w-md bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]/30 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div class={cn('p-6 border-b border-[var(--card-border)]/20', styles().bg)}>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class={cn('p-3 rounded-xl border', styles().bg, styles().border)}>
                  <ItemIcon itemType={item()!.id} class={cn('h-6 w-6', styles().text)} />
                </div>
                <div>
                  <h2 class="text-xl font-bold text-[var(--text-primary)]">
                    Confirm Purchase
                  </h2>
                  <p class={cn('text-sm font-medium', styles().text)}>{item()!.name}</p>
                </div>
              </div>
              <button
                onClick={() => shopStore.closePurchaseConfirmation()}
                class="p-2 rounded-lg hover:bg-[var(--background-primary)] transition-colors"
              >
                <X class="h-5 w-5 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div class="p-6 space-y-6">
            {/* Item Description */}
            <p class="text-[var(--text-secondary)] text-center">
              {item()!.description}
            </p>

            {/* Item Details */}
            <div class="space-y-3">
              {/* Effect */}
              <div class={cn(
                'p-4 rounded-xl border',
                styles().bg,
                styles().border
              )}>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Sparkles class={cn('h-4 w-4', styles().text)} />
                    <span class="text-sm text-[var(--text-muted)]">Effect</span>
                  </div>
                  <span class={cn('text-sm font-bold', styles().text)}>{item()!.effect}</span>
                </div>
              </div>

              {/* Duration */}
              <div class="p-4 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Clock class="h-4 w-4 text-[var(--text-muted)]" />
                    <span class="text-sm text-[var(--text-muted)]">Duration</span>
                  </div>
                  <span class="text-sm font-medium text-[var(--text-primary)]">
                    {formatDuration(item()!.duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost Summary */}
            <div class="p-4 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-[var(--text-muted)]">Current Balance</span>
                <div class="flex items-center gap-1">
                  <Coins class="h-4 w-4 text-[hsl(var(--accent))]" />
                  <span class="font-medium text-[hsl(var(--accent))]">
                    {agenticBalance().toLocaleString()}
                  </span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-[var(--text-muted)]">Item Cost</span>
                <div class="flex items-center gap-1">
                  <span class="font-medium text-red-400">
                    -{item()!.cost.toLocaleString()}
                  </span>
                </div>
              </div>
              <div class="h-px bg-[var(--card-border)]/20" />
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-[var(--text-primary)]">After Purchase</span>
                <div class="flex items-center gap-1">
                  <Coins class={cn(
                    'h-4 w-4',
                    canAfford() ? 'text-green-400' : 'text-red-400'
                  )} />
                  <span class={cn(
                    'font-bold',
                    canAfford() ? 'text-green-400' : 'text-red-400'
                  )}>
                    {remainingBalance().toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            <Show when={error()}>
              <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertTriangle class="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p class="text-sm text-red-400">{error()}</p>
              </div>
            </Show>

            {/* Insufficient Balance Warning */}
            <Show when={!canAfford()}>
              <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertTriangle class="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p class="text-sm text-red-400">
                  Insufficient $AGENTIC balance. You need {Math.abs(remainingBalance()).toLocaleString()} more.
                </p>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="p-6 border-t border-[var(--card-border)]/20 bg-[var(--background-primary)]/50">
            <div class="flex gap-3">
              <button
                onClick={() => shopStore.closePurchaseConfirmation()}
                disabled={isPurchasing()}
                class="flex-1 px-4 py-3 rounded-xl bg-[var(--background-secondary)] border border-[var(--card-border)]/20 text-[var(--text-muted)] font-medium hover:bg-[var(--background-secondary)]/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => shopStore.confirmPurchase()}
                disabled={!canAfford() || isPurchasing()}
                class={cn(
                  'flex-1 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200',
                  canAfford() && !isPurchasing()
                    ? 'bg-gradient-to-r from-[var(--brand-teal-1)] to-[hsl(var(--accent))] text-white shadow-lg shadow-[var(--brand-teal-1)]/20 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-[var(--background-secondary)] text-[var(--text-muted)] cursor-not-allowed'
                )}
              >
                <Show
                  when={!isPurchasing()}
                  fallback={
                    <>
                      <Coins class="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  }
                >
                  <Check class="h-4 w-4" />
                  Confirm Purchase
                </Show>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}

/**
 * PurchaseSuccessOverlay - Optional success state overlay
 * Can be used for showing purchase success animation
 */
export function PurchaseSuccessOverlay(props: {
  itemName: string
  onClose: () => void
}) {
  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={props.onClose}
    >
      <div class="flex flex-col items-center gap-4 p-8 animate-in zoom-in-50 duration-300">
        <div class="p-6 rounded-full bg-green-500/20 border-2 border-green-500/40 animate-in zoom-in duration-500 delay-200">
          <Check class="h-12 w-12 text-green-400" />
        </div>
        <div class="text-center animate-in slide-in-from-bottom-4 duration-300 delay-400">
          <h3 class="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Purchase Complete!
          </h3>
          <p class="text-[var(--text-muted)]">
            {props.itemName} is now active
          </p>
        </div>
      </div>
    </div>
  )
}
