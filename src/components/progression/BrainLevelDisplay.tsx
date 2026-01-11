import { motion } from 'framer-motion'
import { Brain, Lock, Unlock } from 'lucide-react'
import { useUserStore } from '@/stores/userStore'
import {
  BRAIN_LEVEL_CONFIG,
  SYNAPSE_UNLOCK_LEVELS,
  SHIP_UNLOCK_MILESTONES,
  type SynapseType,
  formatPoints,
  getSynapseTypeLabel,
} from '@/types/game'
import { cn } from '@/lib/utils'

// Colors for different brain level ranges
const getBrainLevelColor = (level: number): string => {
  if (level >= 200) return '#F59E0B' // Amber - Master
  if (level >= 150) return '#8B5CF6' // Purple - Expert
  if (level >= 100) return '#EC4899' // Pink - Advanced
  if (level >= 50) return '#10B981'  // Green - Intermediate
  if (level >= 20) return '#3B82F6'  // Blue - Apprentice
  return '#6B7280'                   // Gray - Novice
}

const getBrainLevelTitle = (level: number): string => {
  if (level >= 248) return 'Transcendent'
  if (level >= 200) return 'Master'
  if (level >= 150) return 'Expert'
  if (level >= 100) return 'Advanced'
  if (level >= 50) return 'Intermediate'
  if (level >= 20) return 'Apprentice'
  return 'Novice'
}

interface BrainLevelDisplayProps {
  compact?: boolean
  showUnlocks?: boolean
  className?: string
}

/**
 * BrainLevelDisplay - Shows brain level with XP progress
 * Masterplan 2026: 248 levels with exponential XP curve
 */
export function BrainLevelDisplay({
  compact = false,
  showUnlocks = true,
  className,
}: BrainLevelDisplayProps) {
  const {
    brainLevel,
    brainXP,
    totalBrainXP,
    xpToNextLevel,
    xpProgress,
    unlockedSynapseTypes,
  } = useUserStore()

  const color = getBrainLevelColor(brainLevel)
  const title = getBrainLevelTitle(brainLevel)
  const isMaxLevel = brainLevel >= BRAIN_LEVEL_CONFIG.maxLevel

  // Get next unlock
  const getNextUnlock = (): { type: string; level: number } | null => {
    // Check synapse unlocks
    for (const [type, level] of Object.entries(SYNAPSE_UNLOCK_LEVELS)) {
      if (brainLevel < level) {
        return { type: `${getSynapseTypeLabel(type as SynapseType)} Synapses`, level }
      }
    }
    // Check ship unlocks
    for (const [level, ships] of Object.entries(SHIP_UNLOCK_MILESTONES)) {
      const lvl = parseInt(level)
      if (brainLevel < lvl) {
        return { type: `${ships} Ships`, level: lvl }
      }
    }
    return null
  }

  const nextUnlock = getNextUnlock()

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
        <Brain className="h-4 w-4" style={{ color }} />
        <span className="font-bold" style={{ color }}>
          Lvl {brainLevel}
        </span>
        <div className="w-16 h-1.5 rounded-full bg-[var(--background-primary)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
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
          <div
            className="p-2.5 rounded-xl"
            style={{ backgroundColor: `${color}20` }}
          >
            <Brain className="h-6 w-6" style={{ color }} />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color }}>
              Brain Level {brainLevel}
            </p>
            <p className="text-sm text-[var(--text-muted)]">{title}</p>
          </div>
        </div>
        <div
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {isMaxLevel ? 'MAX' : `${xpProgress.toFixed(1)}%`}
        </div>
      </div>

      {/* XP Progress */}
      {!isMaxLevel && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--text-muted)]">XP to Level {brainLevel + 1}</span>
            <span className="font-medium text-[var(--text-primary)]">
              {formatPoints(brainXP)} / {formatPoints(xpToNextLevel)}
            </span>
          </div>
          <div className="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Total XP: {formatPoints(totalBrainXP)}
          </p>
        </div>
      )}

      {/* Next Unlock */}
      {nextUnlock && showUnlocks && (
        <div className="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-muted)]">Next Unlock</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {nextUnlock.type}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--background-secondary)] text-[var(--text-muted)]">
                Lvl {nextUnlock.level}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Unlocked Synapses */}
      {showUnlocks && (
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Unlock className="h-4 w-4 text-[var(--text-muted)]" />
            Unlocked Synapses
          </p>
          <div className="flex flex-wrap gap-2">
            {unlockedSynapseTypes.map((type) => (
              <SynapseTypeBadge key={type} type={type} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Synapse type badge
function SynapseTypeBadge({ type }: { type: SynapseType }) {
  const colors: Record<SynapseType, { bg: string; text: string }> = {
    minor: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    complex: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    deep: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
    core: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    rare: { bg: 'bg-red-500/20', text: 'text-red-400' },
    legendary: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
    unique: { bg: 'bg-amber-400/20', text: 'text-amber-300' },
  }

  const { bg, text } = colors[type]

  return (
    <span className={cn('px-2 py-1 rounded-lg text-xs font-medium capitalize', bg, text)}>
      {type}
    </span>
  )
}

/**
 * BrainLevelMini - Minimal version for headers
 */
export function BrainLevelMini() {
  const { brainLevel, xpProgress } = useUserStore()
  const color = getBrainLevelColor(brainLevel)

  return (
    <div className="flex items-center gap-2">
      <Brain className="h-4 w-4" style={{ color }} />
      <span className="text-sm font-bold" style={{ color }}>
        {brainLevel}
      </span>
      <div className="w-12 h-1 rounded-full bg-[var(--background-primary)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${xpProgress}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
