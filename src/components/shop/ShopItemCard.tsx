import { Show } from 'solid-js'
import { Zap, Clover, TrendingUp, Radar, EyeOff, Check, Clock, Coins } from 'lucide-solid'
import type { ShopItem } from '@/stores/shopStore'
import { formatDuration, getRemainingTime } from '@/stores/shopStore'
import { cn } from '@/lib/utils'

type CSSProperties = JSX.CSSProperties & { [key: string]: string | number | undefined }

// Clean color system using brand colors
const ITEM_COLORS: Record<string, { accent: string; bg: string }> = {
  speed_boost: { accent: '#75e6ea', bg: 'rgba(117, 230, 234, 0.1)' },
  luck_charm: { accent: '#41cba4', bg: 'rgba(65, 203, 164, 0.1)' },
  xp_amplifier: { accent: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  radar: { accent: '#397bff', bg: 'rgba(57, 123, 255, 0.1)' },
  cloak: { accent: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
}

function ItemIcon(props: { itemType: string; class?: string }) {
  switch (props.itemType) {
    case 'speed_boost': return <Zap class={props.class} />
    case 'luck_charm': return <Clover class={props.class} />
    case 'xp_amplifier': return <TrendingUp class={props.class} />
    case 'radar': return <Radar class={props.class} />
    case 'cloak': return <EyeOff class={props.class} />
    default: return <Coins class={props.class} />
  }
}

export interface ShopItemCardProps {
  item: ShopItem
  onPurchase: (itemType: string) => void
  isPurchasing?: boolean
}

export function ShopItemCard(props: ShopItemCardProps) {
  const colors = () => ITEM_COLORS[props.item.id] || ITEM_COLORS.speed_boost
  const isOwned = () => props.item.isOwned
  const canPurchase = () => props.item.canPurchase && !props.isPurchasing

  return (
    <div
      class={cn(
        'relative rounded-xl overflow-hidden transition-all duration-200',
        'bg-white/[0.03] backdrop-blur-sm',
        'border border-white/[0.06]',
        canPurchase() && 'hover:bg-white/[0.05] hover:border-white/[0.1] cursor-pointer',
        isOwned() && 'ring-1 ring-inset'
      )}
      style={{
        '--card-accent': colors().accent,
        'ring-color': isOwned() ? colors().accent + '40' : undefined,
      } as CSSProperties}
    >
      {/* Content - Clean vertical stack */}
      <div class="p-4 flex flex-col items-center text-center">

        {/* Large centered icon */}
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
          style={{ background: colors().bg }}
        >
          <ItemIcon
            itemType={props.item.id}
            class="w-6 h-6"
            style={{ color: colors().accent } as CSSProperties}
          />
        </div>

        {/* Item name */}
        <h3 class="font-semibold text-white text-sm mb-1">
          {props.item.name}
        </h3>

        {/* Effect - prominent */}
        <p
          class="text-base font-bold mb-3"
          style={{ color: colors().accent }}
        >
          {props.item.effect}
        </p>

        {/* Owned status */}
        <Show when={isOwned() && props.item.ownedItem}>
          <div
            class="w-full py-2 px-3 rounded-lg mb-3 flex items-center justify-center gap-2"
            style={{ background: colors().bg }}
          >
            <Check class="w-3.5 h-3.5" style={{ color: colors().accent } as CSSProperties} />
            <span class="text-xs" style={{ color: colors().accent }}>
              {getRemainingTime(props.item.ownedItem!.expiresAt)}
            </span>
          </div>
        </Show>

        {/* Price CTA button */}
        <Show when={!isOwned()}>
          <button
            onClick={() => canPurchase() && props.onPurchase(props.item.id)}
            disabled={!canPurchase()}
            class={cn(
              'w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-150',
              'flex items-center justify-center gap-2',
              canPurchase()
                ? 'bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.1]'
                : 'bg-white/[0.02] text-white/40 border border-white/[0.04] cursor-not-allowed'
            )}
          >
            <Show
              when={!props.isPurchasing}
              fallback={<span class="text-xs">Purchasing...</span>}
            >
              <Show
                when={canPurchase()}
                fallback={<span class="text-xs opacity-60">{props.item.purchaseError || `Need ${props.item.cost - (props.item as ShopItem & { balance?: number }).balance || 0} more`}</span>}
              >
                <span>{props.item.cost.toLocaleString()}</span>
                <span class="text-white/50 text-xs">$AGENTIC</span>
              </Show>
            </Show>
          </button>
        </Show>

        {/* Already owned */}
        <Show when={isOwned() && !props.item.ownedItem}>
          <div
            class="w-full py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
            style={{ background: colors().bg }}
          >
            <Check class="w-4 h-4" style={{ color: colors().accent } as CSSProperties} />
            <span class="text-sm font-medium" style={{ color: colors().accent }}>Owned</span>
          </div>
        </Show>

        {/* Duration - subtle, below button */}
        <Show when={!isOwned()}>
          <div class="flex items-center gap-1.5 mt-2 text-white/30 text-xs">
            <Clock class="w-3 h-3" />
            <span>{formatDuration(props.item.duration)}</span>
          </div>
        </Show>
      </div>
    </div>
  )
}
