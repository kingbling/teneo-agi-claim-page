import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Coins, Zap, Clover, TrendingUp, Radar, EyeOff, Package, RefreshCw } from 'lucide-react'
import { useShopStore, type ItemCategory, getItemCategoryLabel } from '@/stores/shopStore'
import { useUserStore } from '@/stores/userStore'
import { ShopItemCard } from './ShopItemCard'
import { PurchaseConfirmation } from './PurchaseConfirmation'
import { cn } from '@/lib/utils'

// Category icons
function CategoryIcon({ category, className }: { category: ItemCategory; className?: string }) {
  switch (category) {
    case 'speed':
      return <Zap className={className} />
    case 'luck':
      return <Clover className={className} />
    case 'xp':
      return <TrendingUp className={className} />
    case 'radar':
      return <Radar className={className} />
    case 'cloak':
      return <EyeOff className={className} />
    case 'all':
    default:
      return <Package className={className} />
  }
}

// Category filter options
const CATEGORIES: ItemCategory[] = ['all', 'speed', 'luck', 'xp', 'radar', 'cloak']

export interface ItemShopProps {
  className?: string
}

/**
 * ItemShop - Main shop interface for purchasing items
 * Displays grid of shop items with category filtering and user balance
 */
export function ItemShop({ className }: ItemShopProps) {
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory>('all')

  const {
    shopItems,
    isLoadingShopItems,
    fetchShopItems,
    getShopItemsByCategory,
    openPurchaseConfirmation,
    purchasingItemId,
    confirmationDialog,
  } = useShopStore()

  const { agenticBalance } = useUserStore()

  // Fetch shop items on mount
  useEffect(() => {
    fetchShopItems()
  }, [fetchShopItems])

  // Get filtered items
  const filteredItems = getShopItemsByCategory(selectedCategory)

  const handlePurchase = (itemType: string) => {
    openPurchaseConfirmation(itemType as any)
  }

  const handleRefresh = () => {
    fetchShopItems()
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--card-border)]/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/30">
            <ShoppingBag className="h-6 w-6 text-[hsl(var(--accent))]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Item Shop</h2>
            <p className="text-sm text-[var(--text-muted)]">Enhance your exploration</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Balance Display */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/30">
            <Coins className="h-5 w-5 text-[hsl(var(--accent))]" />
            <span className="font-bold text-[hsl(var(--accent))]">
              {agenticBalance.toLocaleString()}
            </span>
            <span className="text-sm text-[var(--text-muted)]">$AGENTIC</span>
          </div>

          {/* Refresh Button */}
          <motion.button
            onClick={handleRefresh}
            disabled={isLoadingShopItems}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg hover:bg-[var(--background-primary)] transition-colors"
          >
            <RefreshCw className={cn(
              'h-5 w-5 text-[var(--text-muted)]',
              isLoadingShopItems && 'animate-spin'
            )} />
          </motion.button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--card-border)]/10 overflow-x-auto">
        {CATEGORIES.map((category) => (
          <motion.button
            key={category}
            onClick={() => setSelectedCategory(category)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
              selectedCategory === category
                ? 'bg-[var(--brand-teal-1)]/20 text-[var(--brand-teal-1)] border border-[var(--brand-teal-1)]/40'
                : 'bg-[var(--background-primary)] text-[var(--text-muted)] border border-[var(--card-border)]/20 hover:border-[var(--card-border)]/40'
            )}
          >
            <CategoryIcon category={category} className="h-4 w-4" />
            <span>{getItemCategoryLabel(category)}</span>
          </motion.button>
        ))}
      </div>

      {/* Shop Items Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoadingShopItems && shopItems.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-[var(--background-primary)] animate-pulse"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Package className="h-12 w-12 text-[var(--text-muted)]/30 mb-4" />
            <p className="text-[var(--text-muted)]">No items in this category</p>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  onPurchase={handlePurchase}
                  isPurchasing={purchasingItemId === item.id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Active Effects Summary */}
      <ActiveEffectsSummary />

      {/* Purchase Confirmation Modal */}
      {confirmationDialog.isOpen && <PurchaseConfirmation />}
    </div>
  )
}

/**
 * ActiveEffectsSummary - Shows currently active item effects
 */
function ActiveEffectsSummary() {
  const { activeEffects, getActiveItems } = useShopStore()
  const activeItems = getActiveItems()

  if (activeItems.length === 0) return null

  return (
    <div className="px-6 py-4 border-t border-[var(--card-border)]/20 bg-[var(--background-primary)]/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--text-primary)]">Active Effects</span>
        <span className="text-xs text-[var(--text-muted)]">{activeItems.length} active</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeEffects.speedBoost > 1 && (
          <EffectBadge
            icon={<Zap className="h-3 w-3" />}
            label={`+${Math.round((activeEffects.speedBoost - 1) * 100)}% Speed`}
            color="yellow"
          />
        )}
        {activeEffects.luckBonus > 0 && (
          <EffectBadge
            icon={<Clover className="h-3 w-3" />}
            label={`+${Math.round(activeEffects.luckBonus * 100)}% Luck`}
            color="green"
          />
        )}
        {activeEffects.xpAmplifier > 1 && (
          <EffectBadge
            icon={<TrendingUp className="h-3 w-3" />}
            label={`+${Math.round((activeEffects.xpAmplifier - 1) * 100)}% XP`}
            color="purple"
          />
        )}
        {activeEffects.radarActive && (
          <EffectBadge
            icon={<Radar className="h-3 w-3" />}
            label="Radar Active"
            color="blue"
          />
        )}
        {activeEffects.cloakActive && (
          <EffectBadge
            icon={<EyeOff className="h-3 w-3" />}
            label="Cloaked"
            color="slate"
          />
        )}
      </div>
    </div>
  )
}

/**
 * EffectBadge - Small badge showing an active effect
 */
function EffectBadge({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode
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
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border',
      colorStyles[color]
    )}>
      {icon}
      <span>{label}</span>
    </div>
  )
}
