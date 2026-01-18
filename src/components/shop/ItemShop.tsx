import { createSignal, onMount, For, Show, type JSX } from 'solid-js'
import { Zap, Clover, TrendingUp, Radar, EyeOff, Package } from 'lucide-solid'
import { shopStore, type ItemCategory, getItemCategoryLabel } from '@/stores/shopStore'
import { userStore } from '@/stores/userStore'
import { ShopItemCard } from './ShopItemCard'
import { PurchaseConfirmation } from './PurchaseConfirmation'
import { cn } from '@/lib/utils'

// Category icons
function CategoryIcon(props: { category: ItemCategory; class?: string }) {
  switch (props.category) {
    case 'speed': return <Zap class={props.class} />
    case 'luck': return <Clover class={props.class} />
    case 'xp': return <TrendingUp class={props.class} />
    case 'radar': return <Radar class={props.class} />
    case 'cloak': return <EyeOff class={props.class} />
    case 'all':
    default: return <Package class={props.class} />
  }
}

const CATEGORIES: ItemCategory[] = ['all', 'speed', 'luck', 'xp', 'radar', 'cloak']

export interface ItemShopProps {
  class?: string
}

export function ItemShop(props: ItemShopProps) {
  const [selectedCategory, setSelectedCategory] = createSignal<ItemCategory>('all')

  const shopItems = () => shopStore.shopItems
  const isLoadingShopItems = () => shopStore.isLoadingShopItems
  const purchasingItemId = () => shopStore.purchasingItemId
  const confirmationDialog = () => shopStore.confirmationDialog
  const agenticBalance = () => userStore.agenticBalance
  const filteredItems = () => shopStore.getShopItemsByCategory(selectedCategory())

  onMount(() => {
    shopStore.fetchShopItems()
  })

  const handlePurchase = (itemType: string) => {
    shopStore.openPurchaseConfirmation(itemType as 'speed_boost' | 'luck_charm' | 'xp_amplifier' | 'radar' | 'cloak')
  }

  return (
    <div class={cn('flex flex-col h-full bg-[#0d0f12]', props.class)}>
      {/* Minimal Header */}
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <h2 class="text-base font-semibold text-white">Item Shop</h2>
        <div class="flex items-center gap-1.5 text-sm">
          <span class="text-white font-semibold">{agenticBalance().toLocaleString()}</span>
          <span class="text-white/40">$AGENTIC</span>
        </div>
      </div>

      {/* Category Pills */}
      <div class="flex items-center gap-1.5 px-5 py-3 border-b border-white/[0.04] overflow-x-auto">
        <For each={CATEGORIES}>
          {(category) => (
            <button
              onClick={() => setSelectedCategory(category)}
              class={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                selectedCategory() === category
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
              )}
            >
              <CategoryIcon category={category} class="w-3.5 h-3.5" />
              <span>{getItemCategoryLabel(category)}</span>
            </button>
          )}
        </For>
      </div>

      {/* Items Grid */}
      <div class="flex-1 overflow-y-auto p-4">
        <Show
          when={!(isLoadingShopItems() && shopItems().length === 0)}
          fallback={
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <For each={[1, 2, 3, 4, 5]}>
                {() => <div class="h-40 rounded-xl bg-white/[0.02] animate-pulse" />}
              </For>
            </div>
          }
        >
          <Show
            when={filteredItems().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center h-40 text-center">
                <Package class="w-8 h-8 text-white/10 mb-2" />
                <p class="text-white/30 text-sm">No items</p>
              </div>
            }
          >
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <For each={filteredItems()}>
                {(item) => (
                  <ShopItemCard
                    item={item}
                    onPurchase={handlePurchase}
                    isPurchasing={purchasingItemId() === item.id}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Active Effects - Compact */}
      <ActiveEffectsSummary />

      {/* Purchase Modal */}
      <Show when={confirmationDialog().isOpen}>
        <PurchaseConfirmation />
      </Show>
    </div>
  )
}

function ActiveEffectsSummary() {
  const activeEffects = () => shopStore.activeEffects
  const activeItems = () => shopStore.getActiveItems()

  return (
    <Show when={activeItems().length > 0}>
      <div class="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
        <div class="flex flex-wrap gap-2">
          <Show when={activeEffects().speedBoost > 1}>
            <EffectPill icon={<Zap class="w-3 h-3" />} label={`+${Math.round((activeEffects().speedBoost - 1) * 100)}%`} color="#75e6ea" />
          </Show>
          <Show when={activeEffects().luckBonus > 0}>
            <EffectPill icon={<Clover class="w-3 h-3" />} label={`+${Math.round(activeEffects().luckBonus * 100)}%`} color="#41cba4" />
          </Show>
          <Show when={activeEffects().xpAmplifier > 1}>
            <EffectPill icon={<TrendingUp class="w-3 h-3" />} label={`+${Math.round((activeEffects().xpAmplifier - 1) * 100)}%`} color="#a855f7" />
          </Show>
          <Show when={activeEffects().radarActive}>
            <EffectPill icon={<Radar class="w-3 h-3" />} label="On" color="#397bff" />
          </Show>
          <Show when={activeEffects().cloakActive}>
            <EffectPill icon={<EyeOff class="w-3 h-3" />} label="On" color="#94a3b8" />
          </Show>
        </div>
      </div>
    </Show>
  )
}

function EffectPill(props: { icon: JSX.Element; label: string; color: string }) {
  return (
    <div
      class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
      style={{ background: `${props.color}15`, color: props.color }}
    >
      {props.icon}
      <span>{props.label}</span>
    </div>
  )
}
