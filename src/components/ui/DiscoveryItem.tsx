import { motion } from 'framer-motion'
import type { SpaceDiscoveryEvent } from '@/types/agent'

interface DiscoveryItemProps {
  event: SpaceDiscoveryEvent
  onClick: () => void
}

export function DiscoveryItem({ event, onClick }: DiscoveryItemProps) {
  const lootAmount = event.lootDistribution.reduce((sum, d) => sum + d.amount, 0)

  // Determine tier based on loot amount
  const tier = lootAmount >= 500 ? 'mythic' : lootAmount >= 100 ? 'legendary' : lootAmount >= 50 ? 'epic' : 'common'

  const tierConfig = {
    mythic: { color: 'text-[hsl(var(--tier-mythic))]', bg: 'bg-[hsl(var(--tier-mythic))]/10', border: 'border-[hsl(var(--tier-mythic))]/30', glow: 'shadow-[hsl(var(--tier-mythic))]/25' },
    legendary: { color: 'text-[hsl(var(--tier-legendary))]', bg: 'bg-[hsl(var(--tier-legendary))]/10', border: 'border-[hsl(var(--tier-legendary))]/30', glow: 'shadow-[hsl(var(--tier-legendary))]/25' },
    epic: { color: 'text-[hsl(var(--tier-trait))]', bg: 'bg-[hsl(var(--tier-trait))]/10', border: 'border-[hsl(var(--tier-trait))]/30', glow: 'shadow-[hsl(var(--tier-trait))]/25' },
    common: { color: 'text-[hsl(var(--state-idle))]', bg: 'bg-[hsl(var(--state-idle))]/10', border: 'border-[hsl(var(--state-idle))]/30', glow: '' },
  }

  const config = tierConfig[tier]

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`flex items-center justify-between p-2.5 rounded-lg ${config.bg} ${config.border} border cursor-pointer hover:bg-opacity-80 transition-all`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Status indicator */}
        <div className={`w-1.5 h-1.5 rounded-full ${tier === 'mythic' ? 'bg-[hsl(var(--tier-mythic))]' : tier === 'legendary' ? 'bg-[hsl(var(--tier-legendary))]' : tier === 'epic' ? 'bg-[hsl(var(--tier-trait))]' : 'bg-[hsl(var(--state-idle))]'}`} />

        {/* Space ID */}
        <span className="text-[10px] text-muted-foreground truncate font-mono">
          {event.spaceId.slice(0, 10)}...
        </span>

        {/* Tier badge for rare+ */}
        {tier !== 'common' && (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${config.color} ${config.bg} border ${config.border}`}>
            {tier === 'mythic' ? 'MYTHIC' : tier === 'legendary' ? 'LEGENDARY' : 'EPIC'}
          </span>
        )}
      </div>

      {/* Loot amount */}
      <span className={`text-xs font-bold ${config.color} tabular-nums`}>
        +{lootAmount} AGI
      </span>
    </motion.div>
  )
}
