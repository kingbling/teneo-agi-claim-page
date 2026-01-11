import { motion } from 'framer-motion'
import { Lock, Unlock, ChevronRight, Sparkles, Trophy, Target } from 'lucide-react'
import { useSectorStore, getSectorStatusColor, getSectorStatusLabel } from '@/stores/sectorStore'
import type { Sector, SectorStatus } from '@/stores/sectorStore'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

interface SectorChainViewerProps {
  compact?: boolean
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

const getStatusIcon = (status: SectorStatus) => {
  switch (status) {
    case 'completed':
      return Trophy
    case 'active':
      return Target
    case 'upcoming':
      return Sparkles
    case 'locked':
    default:
      return Lock
  }
}

/**
 * SectorChainViewer - Displays the sector unlock progression chain
 * Masterplan 2026: Shows all sectors with their status and progress
 */
export function SectorChainViewer({
  compact = false,
  orientation = 'horizontal',
  className,
}: SectorChainViewerProps) {
  const {
    sectors,
    activeSector,
    isLoading,
    fetchSectors,
    setActiveSector,
    canUnlockSector,
    getSectorProgressPercent,
  } = useSectorStore()

  useEffect(() => {
    if (sectors.length === 0) {
      fetchSectors()
    }
  }, [sectors.length, fetchSectors])

  if (isLoading) {
    return (
      <div className={cn(
        'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30',
        className
      )}>
        <div className="flex items-center justify-center h-20">
          <div className="animate-pulse text-[var(--text-muted)]">Loading sectors...</div>
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
        {sectors.map((sector, index) => {
          const isActive = activeSector?.id === sector.id
          const StatusIcon = getStatusIcon(sector.status)
          const color = getSectorStatusColor(sector.status)

          return (
            <div key={sector.id} className="flex items-center gap-1">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveSector(sector.id)}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  isActive && 'ring-2 ring-offset-1 ring-offset-[var(--background-primary)]'
                )}
                style={{
                  backgroundColor: `${color}20`,
                  // ringColor removed - not a valid CSS property
                }}
                title={sector.name}
              >
                <StatusIcon className="h-4 w-4" style={{ color }} />
              </motion.button>
              {index < sectors.length - 1 && (
                <ChevronRight className="h-3 w-3 text-[var(--text-muted)]" />
              )}
            </div>
          )
        })}
      </motion.div>
    )
  }

  const isVertical = orientation === 'vertical'

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
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[var(--brand-teal-1)]/20">
            <Target className="h-5 w-5 text-[var(--brand-teal-1)]" />
          </div>
          <div>
            <p className="font-bold text-[var(--text-primary)]">Sector Chain</p>
            <p className="text-xs text-[var(--text-muted)]">
              {sectors.filter(s => s.status === 'completed').length}/{sectors.length} Completed
            </p>
          </div>
        </div>
      </div>

      {/* Sector Chain */}
      <div className={cn(
        'flex gap-3',
        isVertical ? 'flex-col' : 'flex-row overflow-x-auto pb-2'
      )}>
        {sectors.map((sector, index) => (
          <SectorNode
            key={sector.id}
            sector={sector}
            isActive={activeSector?.id === sector.id}
            isLast={index === sectors.length - 1}
            orientation={orientation}
            progress={getSectorProgressPercent(sector.id)}
            unlockInfo={canUnlockSector(sector.id)}
            onClick={() => setActiveSector(sector.id)}
          />
        ))}
      </div>

      {/* Active Sector Details */}
      {activeSector && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-4 border-t border-[var(--card-border)]/30"
        >
          <ActiveSectorDetail sector={activeSector} />
        </motion.div>
      )}
    </motion.div>
  )
}

interface SectorNodeProps {
  sector: Sector
  isActive: boolean
  isLast: boolean
  orientation: 'horizontal' | 'vertical'
  progress: number
  unlockInfo: { canUnlock: boolean; reason: string | null }
  onClick: () => void
}

function SectorNode({
  sector,
  isActive,
  isLast,
  orientation,
  progress,
  unlockInfo: _unlockInfo,
  onClick,
}: SectorNodeProps) {
  const color = getSectorStatusColor(sector.status)
  const StatusIcon = getStatusIcon(sector.status)
  const isLocked = sector.status === 'locked' || sector.status === 'upcoming'
  const isVertical = orientation === 'vertical'

  return (
    <div className={cn(
      'flex items-center',
      isVertical ? 'flex-row gap-3' : 'flex-col gap-2'
    )}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={cn(
          'relative p-3 rounded-xl transition-all cursor-pointer min-w-[100px]',
          isActive && 'ring-2 ring-offset-2 ring-offset-[var(--background-primary)]',
          isLocked && 'opacity-60'
        )}
        style={{
          backgroundColor: `${color}15`,
          borderColor: color,
          // ringColor removed - not a valid CSS property
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}30` }}
          >
            <StatusIcon className="h-5 w-5" style={{ color }} />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[80px]">
              {sector.name}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">
              {getSectorStatusLabel(sector.status)}
            </p>
          </div>

          {/* Progress bar for active sectors */}
          {sector.status === 'active' && (
            <div className="w-full h-1 rounded-full bg-[var(--background-primary)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          )}

          {/* Completed checkmark */}
          {sector.status === 'completed' && (
            <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-[var(--background-primary)]">
              <Unlock className="h-3 w-3 text-green-400" />
            </div>
          )}
        </div>
      </motion.button>

      {/* Connector line */}
      {!isLast && (
        <div className={cn(
          'flex items-center justify-center',
          isVertical ? 'flex-col h-6' : 'flex-row w-6'
        )}>
          <div
            className={cn(
              'bg-[var(--card-border)]/50',
              isVertical ? 'w-0.5 h-full' : 'h-0.5 w-full'
            )}
          />
          <ChevronRight
            className={cn(
              'h-4 w-4 text-[var(--text-muted)]',
              isVertical && 'rotate-90'
            )}
          />
        </div>
      )}
    </div>
  )
}

interface ActiveSectorDetailProps {
  sector: Sector
}

function ActiveSectorDetail({ sector }: ActiveSectorDetailProps) {
  const color = getSectorStatusColor(sector.status)

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-bold text-[var(--text-primary)]" style={{ color }}>
            {sector.name}
          </h4>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {sector.description}
          </p>
        </div>
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {getSectorStatusLabel(sector.status)}
        </span>
      </div>

      {/* Progress */}
      <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--text-muted)]">Synapses Discovered</span>
          <span className="font-medium text-[var(--text-primary)]">
            {sector.discoveredSynapses.toLocaleString()} / {sector.totalSynapses.toLocaleString()}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--background-secondary)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${sector.progressPercent}%` }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {sector.progressPercent.toFixed(1)}% complete
        </p>
      </div>

      {/* Rewards */}
      {sector.rewardPool.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Reward Pool
          </p>
          <div className="flex flex-wrap gap-2">
            {sector.rewardPool.map((reward, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded-lg text-xs bg-[var(--background-primary)] text-[var(--text-primary)] border border-[var(--card-border)]/20"
              >
                {reward.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Unlock Requirement */}
      {sector.unlockRequirement.type !== 'none' && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Lock className="h-3 w-3" />
          <span>
            {sector.unlockRequirement.type === 'brain_level'
              ? `Requires Brain Level ${sector.unlockRequirement.value}`
              : `Complete previous sector first`}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * SectorChainMini - Minimal version for headers
 */
export function SectorChainMini() {
  const { sectors, activeSector } = useSectorStore()

  const activeIndex = sectors.findIndex(s => s.id === activeSector?.id)
  const completed = sectors.filter(s => s.status === 'completed').length

  return (
    <div className="flex items-center gap-2">
      <Target className="h-4 w-4 text-[var(--brand-teal-1)]" />
      <div className="flex gap-1">
        {sectors.map((sector, i) => {
          const color = getSectorStatusColor(sector.status)
          return (
            <div
              key={sector.id}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === activeIndex && 'ring-1 ring-offset-1 ring-offset-[var(--background-primary)]'
              )}
              style={{ backgroundColor: color }}
            />
          )
        })}
      </div>
      <span className="text-xs text-[var(--text-muted)]">
        {completed}/{sectors.length}
      </span>
    </div>
  )
}
