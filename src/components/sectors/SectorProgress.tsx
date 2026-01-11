import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Brain,
  Target,
  Trophy,
  Gift,
  Sparkles,
  TrendingUp,
  Clock,
} from 'lucide-react'
import {
  useSectorStore,
  type Sector,
  type SectorReward,
  formatSectorReward,
} from '@/stores/sectorStore'
import { cn } from '@/lib/utils'
import { Progress, CircularProgress } from '@/components/ui/progress'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface SectorProgressProps {
  sectorId?: string
  variant?: 'card' | 'inline' | 'compact'
  showRewards?: boolean
  showStats?: boolean
  className?: string
}

/**
 * SectorProgress - Displays progress for current sector
 * Shows synapses discovered, reward pool, and completion status
 */
export function SectorProgress({
  sectorId,
  variant = 'card',
  showRewards = true,
  showStats = true,
  className,
}: SectorProgressProps) {
  const {
    activeSector,
    sectorProgress,
    isLoadingProgress,
    fetchSectorProgress,
    getSectorById,
  } = useSectorStore()

  // Use provided sectorId or fall back to active sector
  const sector = sectorId ? getSectorById(sectorId) : activeSector

  useEffect(() => {
    if (sector && !sectorProgress[sector.id]) {
      fetchSectorProgress(sector.id)
    }
  }, [sector, sectorProgress, fetchSectorProgress])

  if (!sector) {
    return (
      <div className={cn('p-4 text-center text-[var(--text-muted)]', className)}>
        No sector selected
      </div>
    )
  }

  if (isLoadingProgress) {
    return (
      <div className={cn('p-4', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 rounded bg-[var(--background-tertiary)]/50 w-3/4" />
          <div className="h-4 rounded bg-[var(--background-tertiary)]/50" />
          <div className="h-20 rounded bg-[var(--background-tertiary)]/50" />
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return <CompactProgress sector={sector} className={className} />
  }

  if (variant === 'inline') {
    return <InlineProgress sector={sector} className={className} />
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader spacing="compact">
        <div className="flex items-center justify-between">
          <CardTitle size="default" className="flex items-center gap-2">
            <Target className="h-5 w-5" style={{ color: sector.color }} />
            {sector.name} Progress
          </CardTitle>
          <CompletionBadge percent={sector.progressPercent} color={sector.color} />
        </div>
      </CardHeader>

      <CardContent spacing="default">
        {/* Main Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[var(--text-muted)]">Synapses Discovered</span>
            <span className="font-bold text-[var(--text-primary)]">
              {sector.discoveredSynapses.toLocaleString()} / {sector.totalSynapses.toLocaleString()}
            </span>
          </div>
          <Progress
            value={sector.progressPercent}
            size="lg"
            variant="default"
            showGlow={sector.status === 'active'}
            animated={sector.status === 'active'}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-muted)]">
            <span>{sector.progressPercent.toFixed(1)}% Complete</span>
            {sector.endDate && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ends {new Date(sector.endDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        {showStats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatBox
              icon={<Brain className="h-4 w-4" />}
              label="Total"
              value={sector.totalSynapses.toLocaleString()}
              color={sector.color}
            />
            <StatBox
              icon={<Sparkles className="h-4 w-4" />}
              label="Found"
              value={sector.discoveredSynapses.toLocaleString()}
              color="#10B981"
            />
            <StatBox
              icon={<Target className="h-4 w-4" />}
              label="Remaining"
              value={(sector.totalSynapses - sector.discoveredSynapses).toLocaleString()}
              color="#F59E0B"
            />
          </div>
        )}

        {/* Rewards */}
        {showRewards && sector.rewardPool.length > 0 && (
          <RewardPool rewards={sector.rewardPool} bonus={sector.completionBonus} />
        )}
      </CardContent>
    </Card>
  )
}

// ============ INLINE PROGRESS ============

interface InlineProgressProps {
  sector: Sector
  className?: string
}

function InlineProgress({ sector, className }: InlineProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border',
        'bg-[var(--background-secondary)] border-[var(--card-border)]',
        className
      )}
    >
      <CircularProgress
        value={sector.progressPercent}
        size="lg"
        showValue
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-bold text-[var(--text-primary)] truncate">
            {sector.name}
          </h4>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${sector.color}20`,
              color: sector.color,
            }}
          >
            {sector.status}
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {sector.discoveredSynapses.toLocaleString()} of {sector.totalSynapses.toLocaleString()} synapses
        </p>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-lg font-bold" style={{ color: sector.color }}>
          {sector.progressPercent.toFixed(1)}%
        </span>
        <span className="text-xs text-[var(--text-muted)]">Complete</span>
      </div>
    </motion.div>
  )
}

// ============ COMPACT PROGRESS ============

interface CompactProgressProps {
  sector: Sector
  className?: string
}

function CompactProgress({ sector, className }: CompactProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('flex items-center gap-3', className)}
    >
      <div
        className="p-2 rounded-lg"
        style={{ backgroundColor: `${sector.color}20` }}
      >
        <Target className="h-4 w-4" style={{ color: sector.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {sector.name}
          </span>
          <span className="text-xs font-bold" style={{ color: sector.color }}>
            {sector.progressPercent.toFixed(0)}%
          </span>
        </div>
        <Progress value={sector.progressPercent} size="sm" showGlow />
      </div>
    </motion.div>
  )
}

// ============ COMPLETION BADGE ============

interface CompletionBadgeProps {
  percent: number
  color: string
}

function CompletionBadge({ percent, color }: CompletionBadgeProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
      style={{ backgroundColor: `${color}20` }}
    >
      <TrendingUp className="h-4 w-4" style={{ color }} />
      <span className="text-sm font-bold" style={{ color }}>
        {percent.toFixed(1)}%
      </span>
    </div>
  )
}

// ============ STAT BOX ============

interface StatBoxProps {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}

function StatBox({ icon, label, value, color }: StatBoxProps) {
  return (
    <div className="p-3 rounded-lg bg-[var(--background-primary)]/50 border border-[var(--card-border)]/30">
      <div className="flex items-center gap-2 mb-1">
        <div style={{ color }} className="opacity-80">
          {icon}
        </div>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

// ============ REWARD POOL ============

interface RewardPoolProps {
  rewards: SectorReward[]
  bonus: SectorReward | null
}

function RewardPool({ rewards, bonus }: RewardPoolProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-[var(--text-muted)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Reward Pool
        </span>
      </div>

      <div className="space-y-2">
        {rewards.map((reward, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--background-primary)]/50 border border-[var(--card-border)]/20"
          >
            <div className="flex items-center gap-2">
              <RewardIcon type={reward.type} />
              <span className="text-sm text-[var(--text-secondary)]">
                {reward.label}
              </span>
            </div>
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {formatSectorReward(reward)}
            </span>
          </motion.div>
        ))}

        {bonus && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: rewards.length * 0.05 }}
            className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-[hsl(var(--accent))]/10 to-transparent border border-[hsl(var(--accent))]/30"
          >
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-[hsl(var(--accent))]" />
              <span className="text-sm font-medium text-[hsl(var(--accent))]">
                Completion Bonus
              </span>
            </div>
            <span className="text-sm font-bold text-[hsl(var(--accent))]">
              {bonus.label}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ============ REWARD ICON ============

interface RewardIconProps {
  type: string
}

function RewardIcon({ type }: RewardIconProps) {
  const iconClass = 'h-4 w-4'

  switch (type) {
    case 'agi':
      return <Sparkles className={cn(iconClass, 'text-[#10B981]')} />
    case 'teneo':
      return <Sparkles className={cn(iconClass, 'text-[#8B5CF6]')} />
    case 'nft':
      return <Gift className={cn(iconClass, 'text-[#F59E0B]')} />
    case 'lottery_tickets':
      return <Trophy className={cn(iconClass, 'text-[#EC4899]')} />
    case 'agentic':
      return <Sparkles className={cn(iconClass, 'text-[#3B82F6]')} />
    default:
      return <Gift className={cn(iconClass, 'text-[var(--text-muted)]')} />
  }
}

// ============ SECTOR PROGRESS MINI ============

interface SectorProgressMiniProps {
  className?: string
}

/**
 * SectorProgressMini - Minimal progress indicator for headers
 */
export function SectorProgressMini({ className }: SectorProgressMiniProps) {
  const { activeSector } = useSectorStore()

  if (!activeSector) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Target className="h-4 w-4" style={{ color: activeSector.color }} />
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {activeSector.progressPercent.toFixed(0)}%
      </span>
      <div className="w-16 h-1.5 rounded-full bg-[var(--background-tertiary)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${activeSector.progressPercent}%` }}
          className="h-full rounded-full"
          style={{ backgroundColor: activeSector.color }}
        />
      </div>
    </div>
  )
}
