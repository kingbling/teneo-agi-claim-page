import { Show, For, onMount, onCleanup, createSignal, createMemo, type Component } from 'solid-js'
import {
  Package,
  Zap,
  Clover,
  TrendingUp,
  Radar,
  Eye,
  Clock,
  Power,
  PowerOff,
  Sparkles,
} from 'lucide-solid'
import { shopStore, getRemainingTime } from '@/stores/shopStore'
import type { UserItem } from '@/stores/shopStore'
import { ITEM_DEFINITIONS, type ItemType } from '@/types/game'
import { cn } from '@/lib/utils'

interface ItemInventoryProps {
  compact?: boolean
  showEffects?: boolean
  class?: string
}

// Map item types to icons
const getItemIcon = (itemType: ItemType): Component<{ class?: string; style?: any }> => {
  switch (itemType) {
    case 'speed_boost':
      return Zap
    case 'luck_charm':
      return Clover
    case 'xp_amplifier':
      return TrendingUp
    case 'radar':
      return Radar
    case 'cloak':
      return Eye
    default:
      return Package
  }
}

// Get item color
const getItemColor = (itemType: ItemType): string => {
  switch (itemType) {
    case 'speed_boost':
      return '#3B82F6' // Blue
    case 'luck_charm':
      return '#10B981' // Green
    case 'xp_amplifier':
      return '#8B5CF6' // Purple
    case 'radar':
      return '#F59E0B' // Amber
    case 'cloak':
      return '#EC4899' // Pink
    default:
      return '#6B7280' // Gray
  }
}

/**
 * ItemInventory - Displays user's equipped items and active effects
 * Masterplan 2026: Shows all equipped items on ships with their effects
 */
export function ItemInventory(props: ItemInventoryProps) {
  const compact = () => props.compact ?? false
  const showEffects = () => props.showEffects ?? true

  const [, setTick] = createSignal(0)

  // Fetch items on mount
  onMount(() => {
    shopStore.fetchUserItems()
  })

  // Check for expired items periodically
  onMount(() => {
    const interval = setInterval(() => {
      shopStore.checkExpiredItems()
      setTick((t) => t + 1) // Force re-render for time updates
    }, 10000) // Every 10 seconds

    onCleanup(() => clearInterval(interval))
  })

  const activeItems = createMemo(() => shopStore.getActiveItems())
  const inactiveItems = createMemo(() =>
    shopStore.userItems.filter(
      (item) => !item.isActive && (item.expiresAt === null || item.expiresAt > Date.now())
    )
  )

  return (
    <Show
      when={!shopStore.isLoadingUserItems}
      fallback={
        <div
          class={cn(
            'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
            'border-[var(--card-border)]/30',
            props.class
          )}
        >
          <div class="flex items-center justify-center h-20">
            <div class="animate-pulse text-[var(--text-muted)]">Loading inventory...</div>
          </div>
        </div>
      }
    >
      <Show when={!compact()} fallback={<CompactView activeItems={activeItems()} class={props.class} />}>
        <FullView
          activeItems={activeItems()}
          inactiveItems={inactiveItems()}
          showEffects={showEffects()}
          class={props.class}
        />
      </Show>
    </Show>
  )
}

interface CompactViewProps {
  activeItems: UserItem[]
  class?: string
}

function CompactView(props: CompactViewProps) {
  return (
    <div
      class={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border scale-in',
        'bg-gradient-to-r from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30',
        props.class
      )}
    >
      <Package class="h-4 w-4 text-[var(--text-muted)]" />
      <span class="text-sm text-[var(--text-primary)]">
        {props.activeItems.length} active
      </span>
      <Show when={props.activeItems.length > 0}>
        <div class="flex -space-x-1">
          <For each={props.activeItems.slice(0, 3)}>
            {(item) => {
              const Icon = getItemIcon(item.itemType)
              const color = getItemColor(item.itemType)
              return (
                <div
                  class="p-1 rounded-full"
                  style={{ 'background-color': `${color}30` }}
                >
                  <Icon class="h-3 w-3" style={{ color }} />
                </div>
              )
            }}
          </For>
          <Show when={props.activeItems.length > 3}>
            <div class="p-1 rounded-full bg-[var(--background-primary)] text-[var(--text-muted)]">
              <span class="text-[10px]">+{props.activeItems.length - 3}</span>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

interface FullViewProps {
  activeItems: UserItem[]
  inactiveItems: UserItem[]
  showEffects: boolean
  class?: string
}

function FullView(props: FullViewProps) {
  const hasActiveEffects = createMemo(() =>
    shopStore.activeEffects.speedBoost > 1 ||
    shopStore.activeEffects.luckBonus > 0 ||
    shopStore.activeEffects.xpAmplifier > 1 ||
    shopStore.activeEffects.radarActive ||
    shopStore.activeEffects.cloakActive
  )

  return (
    <div
      class={cn(
        'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30 fade-in-up',
        props.class
      )}
    >
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-purple-500/20">
            <Package class="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <p class="font-bold text-lg text-[var(--text-primary)]">Item Inventory</p>
            <p class="text-sm text-[var(--text-muted)]">
              {props.activeItems.length} active, {props.inactiveItems.length} inactive
            </p>
          </div>
        </div>
      </div>

      {/* Active Effects Summary */}
      <Show when={props.showEffects && hasActiveEffects()}>
        <div class="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 mb-4">
          <p class="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <Sparkles class="h-3 w-3 text-purple-400" />
            Active Effects
          </p>
          <div class="flex flex-wrap gap-2">
            <Show when={shopStore.activeEffects.speedBoost > 1}>
              <EffectBadge
                icon={Zap}
                label={`+${((shopStore.activeEffects.speedBoost - 1) * 100).toFixed(0)}% Speed`}
                color="#3B82F6"
              />
            </Show>
            <Show when={shopStore.activeEffects.luckBonus > 0}>
              <EffectBadge
                icon={Clover}
                label={`+${(shopStore.activeEffects.luckBonus * 100).toFixed(0)}% Luck`}
                color="#10B981"
              />
            </Show>
            <Show when={shopStore.activeEffects.xpAmplifier > 1}>
              <EffectBadge
                icon={TrendingUp}
                label={`+${((shopStore.activeEffects.xpAmplifier - 1) * 100).toFixed(0)}% XP`}
                color="#8B5CF6"
              />
            </Show>
            <Show when={shopStore.activeEffects.radarActive}>
              <EffectBadge icon={Radar} label="Radar Active" color="#F59E0B" />
            </Show>
            <Show when={shopStore.activeEffects.cloakActive}>
              <EffectBadge icon={Eye} label="Cloaked" color="#EC4899" />
            </Show>
          </div>
        </div>
      </Show>

      {/* Active Items */}
      <Show when={props.activeItems.length > 0}>
        <div class="mb-4">
          <p class="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Power class="h-4 w-4 text-green-400" />
            Active Items
          </p>
          <div class="space-y-2">
            <For each={props.activeItems}>
              {(item) => (
                <ItemCard
                  item={item}
                  onToggle={() => shopStore.deactivateItem(item.id)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Inactive Items */}
      <Show when={props.inactiveItems.length > 0}>
        <div>
          <p class="text-sm font-medium text-[var(--text-muted)] mb-2 flex items-center gap-2">
            <PowerOff class="h-4 w-4" />
            Inactive Items
          </p>
          <div class="space-y-2">
            <For each={props.inactiveItems}>
              {(item) => (
                <ItemCard
                  item={item}
                  onToggle={() => shopStore.activateItem(item.id)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Empty State */}
      <Show when={shopStore.userItems.length === 0}>
        <div class="text-center py-8">
          <Package class="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p class="text-sm text-[var(--text-muted)]">No items in inventory</p>
          <p class="text-xs text-[var(--text-muted)]">
            Purchase items from the shop to boost your ships
          </p>
        </div>
      </Show>
    </div>
  )
}

interface ItemCardProps {
  item: UserItem
  onToggle: () => void
}

function ItemCard(props: ItemCardProps) {
  const definition = () => ITEM_DEFINITIONS[props.item.itemType]
  const Icon = getItemIcon(props.item.itemType)
  const color = () => getItemColor(props.item.itemType)
  const remainingTime = () => getRemainingTime(props.item.expiresAt)
  const isExpiringSoon = () => props.item.expiresAt && props.item.expiresAt - Date.now() < 5 * 60 * 1000 // 5 minutes

  const progressWidth = createMemo(() => {
    if (!props.item.isActive || !props.item.expiresAt || !definition().duration) return '100%'
    const totalMs = definition().duration! * 60 * 1000
    const remainingMs = Math.max(0, props.item.expiresAt - Date.now())
    return `${(remainingMs / totalMs) * 100}%`
  })

  return (
    <div
      class={cn(
        'p-3 rounded-lg border transition-all scale-in',
        props.item.isActive
          ? 'bg-[var(--background-primary)] border-[var(--card-border)]/30'
          : 'bg-[var(--background-secondary)]/50 border-[var(--card-border)]/10 opacity-70'
      )}
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="p-2 rounded-lg"
            style={{ 'background-color': `${color()}20` }}
          >
            <Icon class="h-5 w-5" style={{ color: color() }} />
          </div>
          <div>
            <p class="font-medium text-[var(--text-primary)]">{definition().name}</p>
            <p class="text-xs text-[var(--text-muted)]">{definition().effect}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          {/* Duration / Time Remaining */}
          <Show when={props.item.expiresAt}>
            <div
              class={cn(
                'flex items-center gap-1 text-xs',
                isExpiringSoon() ? 'text-red-400' : 'text-[var(--text-muted)]'
              )}
            >
              <Clock class="h-3 w-3" />
              <span>{remainingTime()}</span>
            </div>
          </Show>

          {/* Toggle Button */}
          <button
            onClick={props.onToggle}
            class={cn(
              'p-2 rounded-lg transition-all hover:scale-105 active:scale-95',
              props.item.isActive
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-[var(--background-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <Show
              when={props.item.isActive}
              fallback={<PowerOff class="h-4 w-4" />}
            >
              <Power class="h-4 w-4" />
            </Show>
          </button>
        </div>
      </div>

      {/* Cooldown/Duration Bar */}
      <Show when={props.item.isActive && props.item.expiresAt}>
        <div class="mt-2">
          <div class="h-1 rounded-full bg-[var(--background-secondary)] overflow-hidden">
            <div
              class="h-full rounded-full transition-[width] duration-500"
              style={{
                'background-color': color(),
                width: progressWidth(),
              }}
            />
          </div>
        </div>
      </Show>
    </div>
  )
}

interface EffectBadgeProps {
  icon: Component<{ class?: string; style?: any }>
  label: string
  color: string
}

function EffectBadge(props: EffectBadgeProps) {
  const Icon = props.icon
  return (
    <div
      class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
      style={{ 'background-color': `${props.color}20`, color: props.color }}
    >
      <Icon class="h-3 w-3" style={{ color: props.color }} />
      <span>{props.label}</span>
    </div>
  )
}

/**
 * ItemInventoryMini - Minimal version for headers
 */
export function ItemInventoryMini() {
  const activeItems = createMemo(() => shopStore.getActiveItems())

  return (
    <div class="flex items-center gap-2">
      <Package class="h-4 w-4 text-purple-400" />
      <div class="flex -space-x-1">
        <Show
          when={activeItems().length > 0}
          fallback={<span class="text-xs text-[var(--text-muted)]">No items</span>}
        >
          <For each={activeItems().slice(0, 4)}>
            {(item) => {
              const Icon = getItemIcon(item.itemType)
              const color = getItemColor(item.itemType)
              return (
                <div
                  class="p-1 rounded-full border border-[var(--background-primary)]"
                  style={{ 'background-color': `${color}30` }}
                >
                  <Icon class="h-3 w-3" style={{ color }} />
                </div>
              )
            }}
          </For>
          <Show when={activeItems().length > 4}>
            <div class="p-1 rounded-full bg-[var(--background-secondary)] border border-[var(--background-primary)]">
              <span class="text-[10px] text-[var(--text-muted)]">+{activeItems().length - 4}</span>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
