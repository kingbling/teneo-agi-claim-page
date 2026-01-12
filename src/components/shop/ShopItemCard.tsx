import { Show } from 'solid-js'
import { Zap, Clover, TrendingUp, Radar, EyeOff, Check, Clock, Coins } from 'lucide-solid'
import type { ShopItem } from '@/stores/shopStore'
import { formatDuration, getRemainingTime } from '@/stores/shopStore'
import { cn } from '@/lib/utils'

// Item type colors and styles
const ITEM_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  speed_boost: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    glow: 'shadow-yellow-500/20',
  },
  luck_charm: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
    glow: 'shadow-green-500/20',
  },
  xp_amplifier: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    glow: 'shadow-purple-500/20',
  },
  radar: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  cloak: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    glow: 'shadow-slate-500/20',
  },
}

// Icon component based on item type
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

export interface ShopItemCardProps {
  item: ShopItem
  onPurchase: (itemType: string) => void
  isPurchasing?: boolean
}

/**
 * ShopItemCard - Displays a shop item with purchase capability
 * Shows item details, cost, duration, and purchase status
 */
export function ShopItemCard(props: ShopItemCardProps) {
  const styles = () => ITEM_TYPE_STYLES[props.item.id] || ITEM_TYPE_STYLES.speed_boost
  const isOwned = () => props.item.isOwned
  const canPurchase = () => props.item.canPurchase && !props.isPurchasing

  return (
    <div
      class={cn(
        'relative rounded-2xl border-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2',
        isOwned()
          ? `${styles().border} ${styles().bg}`
          : 'border-[var(--card-border)]/30 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]/50',
        canPurchase() && 'hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 cursor-pointer'
      )}
    >
      {/* Owned indicator glow */}
      <Show when={isOwned()}>
        <div class={cn(
          'absolute -inset-0.5 rounded-2xl opacity-30 blur-sm',
          styles().bg.replace('/10', '/30')
        )} />
      </Show>

      <div class="relative p-5">
        {/* Header: Icon + Name */}
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class={cn(
              'p-3 rounded-xl border',
              styles().bg,
              styles().border
            )}>
              <ItemIcon itemType={props.item.id} class={cn('h-6 w-6', styles().text)} />
            </div>
            <div>
              <h3 class="font-bold text-lg text-[var(--text-primary)]">{props.item.name}</h3>
              <p class="text-sm text-[var(--text-muted)]">{props.item.description}</p>
            </div>
          </div>
          <Show when={isOwned()}>
            <div class={cn(
              'p-1.5 rounded-full',
              styles().bg,
              styles().border,
              'border'
            )}>
              <Check class={cn('h-4 w-4', styles().text)} />
            </div>
          </Show>
        </div>

        {/* Effect Display */}
        <div class={cn(
          'p-3 rounded-xl mb-4',
          'bg-[var(--background-primary)]/50 border border-[var(--card-border)]/20'
        )}>
          <div class="flex items-center justify-between">
            <span class="text-sm text-[var(--text-muted)]">Effect</span>
            <span class={cn('text-sm font-bold', styles().text)}>{props.item.effect}</span>
          </div>
        </div>

        {/* Duration & Cost Row */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <Clock class="h-4 w-4 text-[var(--text-muted)]" />
            <span class="text-sm text-[var(--text-muted)]">
              {formatDuration(props.item.duration)}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Coins class="h-4 w-4 text-[hsl(var(--accent))]" />
            <span class="text-sm font-bold text-[hsl(var(--accent))]">
              {props.item.cost.toLocaleString()} $AGENTIC
            </span>
          </div>
        </div>

        {/* Owned Item Status */}
        <Show when={isOwned() && props.item.ownedItem}>
          <div class={cn(
            'p-3 rounded-xl mb-4',
            styles().bg,
            styles().border,
            'border'
          )}>
            <div class="flex items-center justify-between">
              <span class={cn('text-sm font-medium', styles().text)}>Active</span>
              <span class="text-sm text-[var(--text-muted)]">
                {getRemainingTime(props.item.ownedItem!.expiresAt)}
              </span>
            </div>
          </div>
        </Show>

        {/* Purchase Button */}
        <Show when={!isOwned()}>
          <button
            onClick={() => canPurchase() && props.onPurchase(props.item.id)}
            disabled={!canPurchase()}
            aria-label={`Purchase ${props.item.name} for ${props.item.cost.toLocaleString()} AGENTIC`}
            class={cn(
              'w-full px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200',
              canPurchase()
                ? `bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[hsl(var(--accent))]/20 border ${styles().border} ${styles().text} hover:from-[var(--brand-teal-1)]/30 hover:to-[hsl(var(--accent))]/30 shadow-lg ${styles().glow} hover:scale-[1.02] active:scale-[0.98]`
                : 'bg-[var(--background-primary)] text-[var(--text-muted)] border border-[var(--card-border)]/20 cursor-not-allowed'
            )}
          >
            <Show
              when={!props.isPurchasing}
              fallback={
                <>
                  <Zap class="h-4 w-4 animate-spin" />
                  Purchasing...
                </>
              }
            >
              <Show
                when={canPurchase()}
                fallback={<span class="text-xs">{props.item.purchaseError || 'Unavailable'}</span>}
              >
                <Coins class="h-4 w-4" />
                Purchase
              </Show>
            </Show>
          </button>
        </Show>

        {/* Already Owned State */}
        <Show when={isOwned()}>
          <div class={cn(
            'w-full px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2',
            styles().bg,
            styles().border,
            'border'
          )}>
            <Check class={cn('h-4 w-4', styles().text)} />
            <span class={styles().text}>Owned</span>
          </div>
        </Show>
      </div>
    </div>
  )
}
