import { motion } from 'framer-motion'
import { Zap, Clover, TrendingUp, Radar, EyeOff, Check, Clock, Coins } from 'lucide-react'
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

export interface ShopItemCardProps {
  item: ShopItem
  onPurchase: (itemType: string) => void
  isPurchasing?: boolean
}

/**
 * ShopItemCard - Displays a shop item with purchase capability
 * Shows item details, cost, duration, and purchase status
 */
export function ShopItemCard({ item, onPurchase, isPurchasing = false }: ShopItemCardProps) {
  const styles = ITEM_TYPE_STYLES[item.id] || ITEM_TYPE_STYLES.speed_boost
  const isOwned = item.isOwned
  const canPurchase = item.canPurchase && !isPurchasing

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl border-2 transition-all duration-300',
        isOwned
          ? `${styles.border} ${styles.bg}`
          : 'border-[var(--card-border)]/30 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]/50',
        canPurchase && 'hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 cursor-pointer'
      )}
    >
      {/* Owned indicator glow */}
      {isOwned && (
        <div className={cn(
          'absolute -inset-0.5 rounded-2xl opacity-30 blur-sm',
          styles.bg.replace('/10', '/30')
        )} />
      )}

      <div className="relative p-5">
        {/* Header: Icon + Name */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-3 rounded-xl border',
              styles.bg,
              styles.border
            )}>
              <ItemIcon itemType={item.id} className={cn('h-6 w-6', styles.text)} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[var(--text-primary)]">{item.name}</h3>
              <p className="text-sm text-[var(--text-muted)]">{item.description}</p>
            </div>
          </div>
          {isOwned && (
            <div className={cn(
              'p-1.5 rounded-full',
              styles.bg,
              styles.border,
              'border'
            )}>
              <Check className={cn('h-4 w-4', styles.text)} />
            </div>
          )}
        </div>

        {/* Effect Display */}
        <div className={cn(
          'p-3 rounded-xl mb-4',
          'bg-[var(--background-primary)]/50 border border-[var(--card-border)]/20'
        )}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Effect</span>
            <span className={cn('text-sm font-bold', styles.text)}>{item.effect}</span>
          </div>
        </div>

        {/* Duration & Cost Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              {formatDuration(item.duration)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-[hsl(var(--accent))]" />
            <span className="text-sm font-bold text-[hsl(var(--accent))]">
              {item.cost.toLocaleString()} $AGENTIC
            </span>
          </div>
        </div>

        {/* Owned Item Status */}
        {isOwned && item.ownedItem && (
          <div className={cn(
            'p-3 rounded-xl mb-4',
            styles.bg,
            styles.border,
            'border'
          )}>
            <div className="flex items-center justify-between">
              <span className={cn('text-sm font-medium', styles.text)}>Active</span>
              <span className="text-sm text-[var(--text-muted)]">
                {getRemainingTime(item.ownedItem.expiresAt)}
              </span>
            </div>
          </div>
        )}

        {/* Purchase Button */}
        {!isOwned && (
          <motion.button
            onClick={() => canPurchase && onPurchase(item.id)}
            disabled={!canPurchase}
            aria-label={`Purchase ${item.name} for ${item.cost.toLocaleString()} AGENTIC`}
            whileHover={canPurchase ? { scale: 1.02 } : undefined}
            whileTap={canPurchase ? { scale: 0.98 } : undefined}
            className={cn(
              'w-full px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
              canPurchase
                ? `bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[hsl(var(--accent))]/20 border ${styles.border} ${styles.text} hover:from-[var(--brand-teal-1)]/30 hover:to-[hsl(var(--accent))]/30 shadow-lg ${styles.glow}`
                : 'bg-[var(--background-primary)] text-[var(--text-muted)] border border-[var(--card-border)]/20 cursor-not-allowed'
            )}
          >
            {isPurchasing ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Zap className="h-4 w-4" />
                </motion.div>
                Purchasing...
              </>
            ) : canPurchase ? (
              <>
                <Coins className="h-4 w-4" />
                Purchase
              </>
            ) : (
              <span className="text-xs">{item.purchaseError || 'Unavailable'}</span>
            )}
          </motion.button>
        )}

        {/* Already Owned State */}
        {isOwned && (
          <div className={cn(
            'w-full px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2',
            styles.bg,
            styles.border,
            'border'
          )}>
            <Check className={cn('h-4 w-4', styles.text)} />
            <span className={styles.text}>Owned</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
