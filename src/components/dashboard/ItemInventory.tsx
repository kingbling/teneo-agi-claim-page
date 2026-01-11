import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
import { useShopStore, getRemainingTime } from '@/stores/shopStore'
import type { UserItem } from '@/stores/shopStore'
import { ITEM_DEFINITIONS, type ItemType } from '@/types/game'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface ItemInventoryProps {
  compact?: boolean
  showEffects?: boolean
  className?: string
}

// Map item types to icons
const getItemIcon = (itemType: ItemType) => {
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
export function ItemInventory({
  compact = false,
  showEffects = true,
  className,
}: ItemInventoryProps) {
  const {
    userItems,
    activeEffects,
    isLoadingUserItems,
    fetchUserItems,
    getActiveItems,
    activateItem,
    deactivateItem,
    checkExpiredItems,
  } = useShopStore()

  const [, setTick] = useState(0)

  // Fetch items on mount
  useEffect(() => {
    fetchUserItems()
  }, [fetchUserItems])

  // Check for expired items periodically
  useEffect(() => {
    const interval = setInterval(() => {
      checkExpiredItems()
      setTick((t) => t + 1) // Force re-render for time updates
    }, 10000) // Every 10 seconds

    return () => clearInterval(interval)
  }, [checkExpiredItems])

  const activeItems = getActiveItems()
  const inactiveItems = userItems.filter(
    (item) => !item.isActive && (item.expiresAt === null || item.expiresAt > Date.now())
  )

  if (isLoadingUserItems) {
    return (
      <div
        className={cn(
          'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
          'border-[var(--card-border)]/30',
          className
        )}
      >
        <div className="flex items-center justify-center h-20">
          <div className="animate-pulse text-[var(--text-muted)]">Loading inventory...</div>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
          'bg-gradient-to-r from-[var(--background-secondary)] to-[var(--background-primary)]',
          'border-[var(--card-border)]/30',
          className
        )}
      >
        <Package className="h-4 w-4 text-[var(--text-muted)]" />
        <span className="text-sm text-[var(--text-primary)]">
          {activeItems.length} active
        </span>
        {activeItems.length > 0 && (
          <div className="flex -space-x-1">
            {activeItems.slice(0, 3).map((item) => {
              const Icon = getItemIcon(item.itemType)
              const color = getItemColor(item.itemType)
              return (
                <div
                  key={item.id}
                  className="p-1 rounded-full"
                  style={{ backgroundColor: `${color}30` }}
                >
                  <Icon className="h-3 w-3" style={{ color }} />
                </div>
              )
            })}
            {activeItems.length > 3 && (
              <div className="p-1 rounded-full bg-[var(--background-primary)] text-[var(--text-muted)]">
                <span className="text-[10px]">+{activeItems.length - 3}</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20">
            <Package className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <p className="font-bold text-lg text-[var(--text-primary)]">Item Inventory</p>
            <p className="text-sm text-[var(--text-muted)]">
              {activeItems.length} active, {inactiveItems.length} inactive
            </p>
          </div>
        </div>
      </div>

      {/* Active Effects Summary */}
      {showEffects && (activeEffects.speedBoost > 1 || activeEffects.luckBonus > 0 || activeEffects.xpAmplifier > 1 || activeEffects.radarActive || activeEffects.cloakActive) && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 mb-4">
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-purple-400" />
            Active Effects
          </p>
          <div className="flex flex-wrap gap-2">
            {activeEffects.speedBoost > 1 && (
              <EffectBadge
                icon={Zap}
                label={`+${((activeEffects.speedBoost - 1) * 100).toFixed(0)}% Speed`}
                color="#3B82F6"
              />
            )}
            {activeEffects.luckBonus > 0 && (
              <EffectBadge
                icon={Clover}
                label={`+${(activeEffects.luckBonus * 100).toFixed(0)}% Luck`}
                color="#10B981"
              />
            )}
            {activeEffects.xpAmplifier > 1 && (
              <EffectBadge
                icon={TrendingUp}
                label={`+${((activeEffects.xpAmplifier - 1) * 100).toFixed(0)}% XP`}
                color="#8B5CF6"
              />
            )}
            {activeEffects.radarActive && (
              <EffectBadge icon={Radar} label="Radar Active" color="#F59E0B" />
            )}
            {activeEffects.cloakActive && (
              <EffectBadge icon={Eye} label="Cloaked" color="#EC4899" />
            )}
          </div>
        </div>
      )}

      {/* Active Items */}
      {activeItems.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Power className="h-4 w-4 text-green-400" />
            Active Items
          </p>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {activeItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onToggle={() => deactivateItem(item.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Inactive Items */}
      {inactiveItems.length > 0 && (
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)] mb-2 flex items-center gap-2">
            <PowerOff className="h-4 w-4" />
            Inactive Items
          </p>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {inactiveItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onToggle={() => activateItem(item.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty State */}
      {userItems.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No items in inventory</p>
          <p className="text-xs text-[var(--text-muted)]">
            Purchase items from the shop to boost your ships
          </p>
        </div>
      )}
    </motion.div>
  )
}

interface ItemCardProps {
  item: UserItem
  onToggle: () => void
}

function ItemCard({ item, onToggle }: ItemCardProps) {
  const definition = ITEM_DEFINITIONS[item.itemType]
  const Icon = getItemIcon(item.itemType)
  const color = getItemColor(item.itemType)
  const remainingTime = getRemainingTime(item.expiresAt)
  const isExpiringSoon = item.expiresAt && item.expiresAt - Date.now() < 5 * 60 * 1000 // 5 minutes

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'p-3 rounded-lg border transition-all',
        item.isActive
          ? 'bg-[var(--background-primary)] border-[var(--card-border)]/30'
          : 'bg-[var(--background-secondary)]/50 border-[var(--card-border)]/10 opacity-70'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <p className="font-medium text-[var(--text-primary)]">{definition.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{definition.effect}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Duration / Time Remaining */}
          {item.expiresAt && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                isExpiringSoon ? 'text-red-400' : 'text-[var(--text-muted)]'
              )}
            >
              <Clock className="h-3 w-3" />
              <span>{remainingTime}</span>
            </div>
          )}

          {/* Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggle}
            className={cn(
              'p-2 rounded-lg transition-colors',
              item.isActive
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-[var(--background-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            {item.isActive ? (
              <Power className="h-4 w-4" />
            ) : (
              <PowerOff className="h-4 w-4" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Cooldown/Duration Bar */}
      {item.isActive && item.expiresAt && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-[var(--background-secondary)] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: '100%' }}
              animate={{
                width: `${Math.max(0, ((item.expiresAt - Date.now()) / (definition.duration! * 60 * 1000)) * 100)}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}

interface EffectBadgeProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  color: string
}

function EffectBadge({ icon: Icon, label, color }: EffectBadgeProps) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      <Icon className="h-3 w-3" style={{ color }} />
      <span>{label}</span>
    </div>
  )
}

/**
 * ItemInventoryMini - Minimal version for headers
 */
export function ItemInventoryMini() {
  const { getActiveItems } = useShopStore()
  const activeItems = getActiveItems()

  return (
    <div className="flex items-center gap-2">
      <Package className="h-4 w-4 text-purple-400" />
      <div className="flex -space-x-1">
        {activeItems.length === 0 && (
          <span className="text-xs text-[var(--text-muted)]">No items</span>
        )}
        {activeItems.slice(0, 4).map((item) => {
          const Icon = getItemIcon(item.itemType)
          const color = getItemColor(item.itemType)
          return (
            <div
              key={item.id}
              className="p-1 rounded-full border border-[var(--background-primary)]"
              style={{ backgroundColor: `${color}30` }}
            >
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
          )
        })}
        {activeItems.length > 4 && (
          <div className="p-1 rounded-full bg-[var(--background-secondary)] border border-[var(--background-primary)]">
            <span className="text-[10px] text-[var(--text-muted)]">+{activeItems.length - 4}</span>
          </div>
        )}
      </div>
    </div>
  )
}
