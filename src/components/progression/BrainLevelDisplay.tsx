import { Show, For } from 'solid-js'
import { Brain, Lock, Unlock } from 'lucide-solid'
import { userStore } from '@/stores/userStore'
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
  class?: string
}

/**
 * BrainLevelDisplay - Shows brain level with XP progress
 * Masterplan 2026: 248 levels with exponential XP curve
 */
export function BrainLevelDisplay(props: BrainLevelDisplayProps) {
  const compact = () => props.compact ?? false
  const showUnlocks = () => props.showUnlocks ?? true

  const color = () => getBrainLevelColor(userStore.brainLevel)
  const title = () => getBrainLevelTitle(userStore.brainLevel)
  const isMaxLevel = () => userStore.brainLevel >= BRAIN_LEVEL_CONFIG.maxLevel

  // Get next unlock
  const getNextUnlock = (): { type: string; level: number } | null => {
    // Check synapse unlocks
    for (const [type, level] of Object.entries(SYNAPSE_UNLOCK_LEVELS)) {
      if (userStore.brainLevel < level) {
        return { type: `${getSynapseTypeLabel(type as SynapseType)} Synapses`, level }
      }
    }
    // Check ship unlocks
    for (const [level, ships] of Object.entries(SHIP_UNLOCK_MILESTONES)) {
      const lvl = parseInt(level)
      if (userStore.brainLevel < lvl) {
        return { type: `${ships} Ships`, level: lvl }
      }
    }
    return null
  }

  const nextUnlock = () => getNextUnlock()

  return (
    <Show
      when={!compact()}
      fallback={
        <div
          class={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
            'bg-gradient-to-r from-[var(--background-secondary)] to-[var(--background-primary)]',
            'border-[var(--card-border)]/30',
            'animate-in fade-in zoom-in-95 duration-200',
            props.class
          )}
        >
          <Brain class="h-4 w-4" style={{ color: color() }} />
          <span class="font-bold" style={{ color: color() }}>
            Lvl {userStore.brainLevel}
          </span>
          <div class="w-16 h-1.5 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              style={{ width: `${userStore.xpProgress}%`, "background-color": color() }}
            />
          </div>
        </div>
      }
    >
      <div
        class={cn(
          'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
          'border-[var(--card-border)]/30',
          'animate-in fade-in slide-in-from-bottom-2 duration-300',
          props.class
        )}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div
              class="p-2.5 rounded-xl"
              style={{ "background-color": `${color()}20` }}
            >
              <Brain class="h-6 w-6" style={{ color: color() }} />
            </div>
            <div>
              <p class="font-bold text-lg" style={{ color: color() }}>
                Brain Level {userStore.brainLevel}
              </p>
              <p class="text-sm text-[var(--text-muted)]">{title()}</p>
            </div>
          </div>
          <div
            class="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ "background-color": `${color()}20`, color: color() }}
          >
            {isMaxLevel() ? 'MAX' : `${userStore.xpProgress.toFixed(1)}%`}
          </div>
        </div>

        {/* XP Progress */}
        <Show when={!isMaxLevel()}>
          <div class="mb-4">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-[var(--text-muted)]">XP to Level {userStore.brainLevel + 1}</span>
              <span class="font-medium text-[var(--text-primary)]">
                {formatPoints(userStore.brainXP)} / {formatPoints(userStore.xpToNextLevel)}
              </span>
            </div>
            <div class="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                style={{ width: `${userStore.xpProgress}%`, "background-color": color() }}
              />
            </div>
            <p class="text-xs text-[var(--text-muted)] mt-1">
              Total XP: {formatPoints(userStore.totalBrainXP)}
            </p>
          </div>
        </Show>

        {/* Next Unlock */}
        <Show when={nextUnlock() && showUnlocks()}>
          <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20 mb-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Lock class="h-4 w-4 text-[var(--text-muted)]" />
                <span class="text-sm text-[var(--text-muted)]">Next Unlock</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-[var(--text-primary)]">
                  {nextUnlock()!.type}
                </span>
                <span class="text-xs px-2 py-0.5 rounded bg-[var(--background-secondary)] text-[var(--text-muted)]">
                  Lvl {nextUnlock()!.level}
                </span>
              </div>
            </div>
          </div>
        </Show>

        {/* Unlocked Synapses */}
        <Show when={showUnlocks()}>
          <div>
            <p class="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <Unlock class="h-4 w-4 text-[var(--text-muted)]" />
              Unlocked Synapses
            </p>
            <div class="flex flex-wrap gap-2">
              <For each={userStore.unlockedSynapseTypes}>
                {(type) => <SynapseTypeBadge type={type} />}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )
}

// Synapse type badge
function SynapseTypeBadge(props: { type: SynapseType }) {
  const colors: Record<SynapseType, { bg: string; text: string }> = {
    minor: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    complex: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    deep: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
    core: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    rare: { bg: 'bg-red-500/20', text: 'text-red-400' },
    legendary: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
    unique: { bg: 'bg-amber-400/20', text: 'text-amber-300' },
  }

  const styles = () => colors[props.type]

  return (
    <span class={cn('px-2 py-1 rounded-lg text-xs font-medium capitalize', styles().bg, styles().text)}>
      {props.type}
    </span>
  )
}

/**
 * BrainLevelMini - Minimal version for headers
 */
export function BrainLevelMini() {
  const color = () => getBrainLevelColor(userStore.brainLevel)

  return (
    <div class="flex items-center gap-2">
      <Brain class="h-4 w-4" style={{ color: color() }} />
      <span class="text-sm font-bold" style={{ color: color() }}>
        {userStore.brainLevel}
      </span>
      <div class="w-12 h-1 rounded-full bg-[var(--background-primary)] overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          style={{ width: `${userStore.xpProgress}%`, "background-color": color() }}
        />
      </div>
    </div>
  )
}
