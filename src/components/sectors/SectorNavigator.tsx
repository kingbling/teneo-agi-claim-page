import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Map,
  Lock,
  CheckCircle2,
  Clock,
  ChevronRight,
  Trophy,
  Sparkles,
} from 'lucide-react'
import {
  useSectorStore,
  type Sector,
  type SectorStatus,
  getSectorStatusLabel,
  getSectorStatusColor,
} from '@/stores/sectorStore'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface SectorNavigatorProps {
  compact?: boolean
  showLocked?: boolean
  className?: string
  onSectorSelect?: (sector: Sector) => void
}

/**
 * SectorNavigator - Season/sector selection component
 * Displays available sectors with unlock status and progress
 */
export function SectorNavigator({
  compact = false,
  showLocked = true,
  className,
  onSectorSelect,
}: SectorNavigatorProps) {
  // Granular selectors for sector store - prevents re-renders when unrelated state changes
  const sectors = useSectorStore(state => state.sectors)
  const activeSector = useSectorStore(state => state.activeSector)
  const isLoading = useSectorStore(state => state.isLoading)
  const fetchSectors = useSectorStore(state => state.fetchSectors)
  const setActiveSector = useSectorStore(state => state.setActiveSector)
  const canUnlockSector = useSectorStore(state => state.canUnlockSector)

  useEffect(() => {
    if (sectors.length === 0) {
      fetchSectors()
    }
  }, [sectors.length, fetchSectors])

  const handleSectorClick = (sector: Sector) => {
    const { canUnlock } = canUnlockSector(sector.id)
    if (canUnlock) {
      setActiveSector(sector.id)
      onSectorSelect?.(sector)
    }
  }

  const displayedSectors = showLocked
    ? sectors
    : sectors.filter(s => s.status === 'active' || s.status === 'completed')

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-[var(--background-tertiary)]/50"
            />
          ))}
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {displayedSectors.map((sector) => (
          <SectorChip
            key={sector.id}
            sector={sector}
            isActive={activeSector?.id === sector.id}
            onClick={() => handleSectorClick(sector)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-[var(--text-muted)]" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            Sectors
          </h3>
        </div>
        {activeSector && (
          <span className="text-sm text-[var(--text-muted)]">
            Current: <span className="font-medium text-[var(--text-primary)]">{activeSector.name}</span>
          </span>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {displayedSectors.map((sector, index) => (
          <motion.div
            key={sector.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: index * 0.05 }}
          >
            <SectorCard
              sector={sector}
              isActive={activeSector?.id === sector.id}
              onClick={() => handleSectorClick(sector)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ============ SECTOR CHIP (Compact) ============

interface SectorChipProps {
  sector: Sector
  isActive: boolean
  onClick: () => void
}

function SectorChip({ sector, isActive, onClick }: SectorChipProps) {
  // Granular selector for canUnlockSector action
  const canUnlockSector = useSectorStore(state => state.canUnlockSector)
  const { canUnlock, reason } = canUnlockSector(sector.id)
  const statusColor = getSectorStatusColor(sector.status)
  const isLocked = !canUnlock

  return (
    <motion.button
      whileHover={{ scale: isLocked ? 1 : 1.02 }}
      whileTap={{ scale: isLocked ? 1 : 0.98 }}
      onClick={onClick}
      disabled={isLocked}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
        'bg-[var(--background-secondary)]',
        isActive && 'ring-2 ring-offset-2 ring-offset-[var(--background-primary)]',
        isLocked
          ? 'opacity-50 cursor-not-allowed border-[var(--card-border)]/30'
          : 'hover:border-[var(--card-border-hover)] cursor-pointer border-[var(--card-border)]'
      )}
      style={{
        borderColor: isActive ? statusColor : undefined,
        // ringColor removed - not a valid CSS property
      }}
      title={isLocked ? reason || 'Locked' : sector.name}
    >
      <StatusIcon status={sector.status} size="sm" />
      <span
        className="text-sm font-medium"
        style={{ color: isActive ? statusColor : 'var(--text-primary)' }}
      >
        {sector.name}
      </span>
      {sector.status === 'active' && (
        <span className="text-xs text-[var(--text-muted)]">
          {sector.progressPercent.toFixed(0)}%
        </span>
      )}
    </motion.button>
  )
}

// ============ SECTOR CARD (Full) ============

interface SectorCardProps {
  sector: Sector
  isActive: boolean
  onClick: () => void
}

function SectorCard({ sector, isActive, onClick }: SectorCardProps) {
  // Granular selector for canUnlockSector action
  const canUnlockSector = useSectorStore(state => state.canUnlockSector)
  const { canUnlock, reason } = canUnlockSector(sector.id)
  const statusColor = getSectorStatusColor(sector.status)
  const isLocked = !canUnlock

  return (
    <motion.button
      whileHover={{ scale: isLocked ? 1 : 1.01 }}
      whileTap={{ scale: isLocked ? 1 : 0.99 }}
      onClick={onClick}
      disabled={isLocked}
      className={cn(
        'w-full text-left rounded-xl border p-4 transition-all',
        'bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        isActive && 'ring-2 ring-offset-2 ring-offset-[var(--background-primary)]',
        isLocked
          ? 'opacity-60 cursor-not-allowed border-[var(--card-border)]/30'
          : 'hover:border-[var(--card-border-hover)] hover:shadow-lg cursor-pointer border-[var(--card-border)]'
      )}
      style={{
        borderColor: isActive ? statusColor : undefined,
        // ringColor removed - not a valid CSS property
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ backgroundColor: `${sector.color}20` }}
          >
            <StatusIcon status={sector.status} color={sector.color} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className="font-bold text-base"
                style={{ color: isActive ? statusColor : 'var(--text-primary)' }}
              >
                {sector.name}
              </h4>
              <StatusBadge status={sector.status} />
            </div>
            <p className="text-sm text-[var(--text-muted)] line-clamp-1">
              {sector.description}
            </p>
          </div>
        </div>
        <ChevronRight
          className={cn(
            'h-5 w-5 transition-transform',
            isActive ? 'rotate-90 text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
          )}
        />
      </div>

      {/* Progress (for active/completed sectors) */}
      {(sector.status === 'active' || sector.status === 'completed') && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-[var(--text-muted)]">Progress</span>
            <span className="font-medium text-[var(--text-primary)]">
              {sector.discoveredSynapses.toLocaleString()} / {sector.totalSynapses.toLocaleString()}
            </span>
          </div>
          <Progress
            value={sector.progressPercent}
            size="sm"
            variant={sector.status === 'completed' ? 'success' : 'default'}
            showGlow={sector.status === 'active'}
          />
        </div>
      )}

      {/* Lock reason */}
      {isLocked && reason && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 p-2 rounded-lg bg-[var(--background-primary)]/50">
          <Lock className="h-4 w-4" />
          <span>{reason}</span>
        </div>
      )}

      {/* Rewards */}
      {sector.rewardPool.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sector.rewardPool.slice(0, 3).map((reward, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--background-primary)]/50 text-xs"
            >
              <Trophy className="h-3 w-3 text-[var(--text-muted)]" />
              <span className="text-[var(--text-secondary)]">{reward.label}</span>
            </div>
          ))}
          {sector.rewardPool.length > 3 && (
            <div className="px-2 py-1 rounded-lg bg-[var(--background-primary)]/50 text-xs text-[var(--text-muted)]">
              +{sector.rewardPool.length - 3} more
            </div>
          )}
        </div>
      )}
    </motion.button>
  )
}

// ============ STATUS ICON ============

interface StatusIconProps {
  status: SectorStatus
  color?: string
  size?: 'sm' | 'md'
}

function StatusIcon({ status, color, size = 'md' }: StatusIconProps) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const statusColor = color || getSectorStatusColor(status)

  switch (status) {
    case 'active':
      return <Sparkles className={iconSize} style={{ color: statusColor }} />
    case 'completed':
      return <CheckCircle2 className={iconSize} style={{ color: statusColor }} />
    case 'upcoming':
      return <Clock className={iconSize} style={{ color: statusColor }} />
    case 'locked':
      return <Lock className={iconSize} style={{ color: statusColor }} />
    default:
      return <Map className={iconSize} style={{ color: statusColor }} />
  }
}

// ============ STATUS BADGE ============

interface StatusBadgeProps {
  status: SectorStatus
}

function StatusBadge({ status }: StatusBadgeProps) {
  const label = getSectorStatusLabel(status)
  const color = getSectorStatusColor(status)

  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {label}
    </span>
  )
}

// ============ MINI SECTOR INDICATOR ============

interface SectorIndicatorProps {
  className?: string
}

/**
 * SectorIndicator - Minimal indicator showing current sector
 */
export function SectorIndicator({ className }: SectorIndicatorProps) {
  // Granular selectors for sector store - prevents re-renders when unrelated state changes
  const activeSector = useSectorStore(state => state.activeSector)
  const isLoading = useSectorStore(state => state.isLoading)
  const fetchSectors = useSectorStore(state => state.fetchSectors)
  const sectors = useSectorStore(state => state.sectors)

  useEffect(() => {
    if (sectors.length === 0) {
      fetchSectors()
    }
  }, [sectors.length, fetchSectors])

  if (isLoading || !activeSector) {
    return null
  }

  const statusColor = getSectorStatusColor(activeSector.status)

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
        'bg-[var(--background-secondary)] border-[var(--card-border)]/50',
        className
      )}
    >
      <StatusIcon status={activeSector.status} color={statusColor} size="sm" />
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {activeSector.name}
      </span>
      <span className="text-xs text-[var(--text-muted)]">
        {activeSector.progressPercent.toFixed(0)}%
      </span>
    </div>
  )
}
