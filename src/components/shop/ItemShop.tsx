import { createSignal, createEffect, onMount, For, Show, type JSX } from 'solid-js'
import { ShoppingBag, Coins, Zap, Clover, TrendingUp, Radar, EyeOff, Package, RefreshCw } from 'lucide-solid'
import { shopStore, type ItemCategory, getItemCategoryLabel } from '@/stores/shopStore'
import { userStore } from '@/stores/userStore'
import { ShopItemCard } from './ShopItemCard'
import { PurchaseConfirmation } from './PurchaseConfirmation'
import { cn } from '@/lib/utils'

// Category icons
function CategoryIcon(props: { category: ItemCategory; class?: string }) {
  switch (props.category) {
    case 'speed':
      return <Zap class={props.class} />
    case 'luck':
      return <Clover class={props.class} />
    case 'xp':
      return <TrendingUp class={props.class} />
    case 'radar':
      return <Radar class={props.class} />
    case 'cloak':
      return <EyeOff class={props.class} />
    case 'all':
    default:
      return <Package class={props.class} />
  }
}

// Category filter options
const CATEGORIES: ItemCategory[] = ['all', 'speed', 'luck', 'xp', 'radar', 'cloak']

export interface ItemShopProps {
  class?: string
}

/**
 * ItemShop - Main shop interface for purchasing items
 * Displays grid of shop items with category filtering and user balance
 */
export function ItemShop(props: ItemShopProps) {
  const [selectedCategory, setSelectedCategory] = createSignal<ItemCategory>('all')

  // Reactive getters from stores
  const shopItems = () => shopStore.shopItems
  const isLoadingShopItems = () => shopStore.isLoadingShopItems
  const purchasingItemId = () => shopStore.purchasingItemId
  const confirmationDialog = () => shopStore.confirmationDialog
  const agenticBalance = () => userStore.agenticBalance

  // Get filtered items
  const filteredItems = () => shopStore.getShopItemsByCategory(selectedCategory())

  // Fetch shop items on mount
  onMount(() => {
    shopStore.fetchShopItems()
  })

  const handlePurchase = (itemType: string) => {
    shopStore.openPurchaseConfirmation(itemType as any)
  }

  const handleRefresh = () => {
    shopStore.fetchShopItems()
  }

  return (
    <div class={cn('flex flex-col h-full', props.class)}>
      {/* Header */}
      <div class="flex items-center justify-between p-6 border-b border-[var(--card-border)]/20">
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-xl bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/30">
            <ShoppingBag class="h-6 w-6 text-[hsl(var(--accent))]" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-[var(--text-primary)]">Item Shop</h2>
            <p class="text-sm text-[var(--text-muted)]">Enhance your exploration</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          {/* Balance Display */}
          <div class="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/30">
            <Coins class="h-5 w-5 text-[hsl(var(--accent))]" />
            <span class="font-bold text-[hsl(var(--accent))]">
              {agenticBalance().toLocaleString()}
            </span>
            <span class="text-sm text-[var(--text-muted)]">$AGENTIC</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoadingShopItems()}
            class="p-2 rounded-lg hover:bg-[var(--background-primary)] transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <RefreshCw class={cn(
              'h-5 w-5 text-[var(--text-muted)]',
              isLoadingShopItems() && 'animate-spin'
            )} />
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div class="flex items-center gap-2 px-6 py-4 border-b border-[var(--card-border)]/10 overflow-x-auto">
        <For each={CATEGORIES}>
          {(category) => (
            <button
              onClick={() => setSelectedCategory(category)}
              class={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap duration-200 hover:scale-[1.02] active:scale-[0.98]',
                selectedCategory() === category
                  ? 'bg-[var(--brand-teal-1)]/20 text-[var(--brand-teal-1)] border border-[var(--brand-teal-1)]/40'
                  : 'bg-[var(--background-primary)] text-[var(--text-muted)] border border-[var(--card-border)]/20 hover:border-[var(--card-border)]/40'
              )}
            >
              <CategoryIcon category={category} class="h-4 w-4" />
              <span>{getItemCategoryLabel(category)}</span>
            </button>
          )}
        </For>
      </div>

      {/* Shop Items Grid */}
      <div class="flex-1 overflow-y-auto p-6">
        <Show
          when={!(isLoadingShopItems() && shopItems().length === 0)}
          fallback={
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={[1, 2, 3, 4, 5]}>
                {(i) => (
                  <div class="h-64 rounded-2xl bg-[var(--background-primary)] animate-pulse" />
                )}
              </For>
            </div>
          }
        >
          <Show
            when={filteredItems().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center h-64 text-center">
                <Package class="h-12 w-12 text-[var(--text-muted)]/30 mb-4" />
                <p class="text-[var(--text-muted)]">No items in this category</p>
              </div>
            }
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Active Effects Summary */}
      <ActiveEffectsSummary />

      {/* Purchase Confirmation Modal */}
      <Show when={confirmationDialog().isOpen}>
        <PurchaseConfirmation />
      </Show>
    </div>
  )
}

/**
 * ActiveEffectsSummary - Shows currently active item effects
 */
function ActiveEffectsSummary() {
  const activeEffects = () => shopStore.activeEffects
  const activeItems = () => shopStore.getActiveItems()

  return (
    <Show when={activeItems().length > 0}>
      <div class="px-6 py-4 border-t border-[var(--card-border)]/20 bg-[var(--background-primary)]/50">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium text-[var(--text-primary)]">Active Effects</span>
          <span class="text-xs text-[var(--text-muted)]">{activeItems().length} active</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <Show when={activeEffects().speedBoost > 1}>
            <EffectBadge
              icon={<Zap class="h-3 w-3" />}
              label={`+${Math.round((activeEffects().speedBoost - 1) * 100)}% Speed`}
              color="yellow"
            />
          </Show>
          <Show when={activeEffects().luckBonus > 0}>
            <EffectBadge
              icon={<Clover class="h-3 w-3" />}
              label={`+${Math.round(activeEffects().luckBonus * 100)}% Luck`}
              color="green"
            />
          </Show>
          <Show when={activeEffects().xpAmplifier > 1}>
            <EffectBadge
              icon={<TrendingUp class="h-3 w-3" />}
              label={`+${Math.round((activeEffects().xpAmplifier - 1) * 100)}% XP`}
              color="purple"
            />
          </Show>
          <Show when={activeEffects().radarActive}>
            <EffectBadge
              icon={<Radar class="h-3 w-3" />}
              label="Radar Active"
              color="blue"
            />
          </Show>
          <Show when={activeEffects().cloakActive}>
            <EffectBadge
              icon={<EyeOff class="h-3 w-3" />}
              label="Cloaked"
              color="slate"
            />
          </Show>
        </div>
      </div>
    </Show>
  )
}

/**
 * EffectBadge - Small badge showing an active effect
 */
function EffectBadge(props: {
  icon: JSX.Element
  label: string
  color: 'yellow' | 'green' | 'purple' | 'blue' | 'slate'
}) {
  const colorStyles = {
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    green: 'bg-green-500/10 text-green-400 border-green-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  }

  return (
    <div class={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border',
      colorStyles[props.color]
    )}>
      {props.icon}
      <span>{props.label}</span>
    </div>
  )
}
