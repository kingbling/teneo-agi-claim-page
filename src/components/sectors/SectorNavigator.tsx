import { createEffect, Show, For, type JSX } from 'solid-js'
import {
  Map,
  Lock,
  CheckCircle2,
  Clock,
  ChevronRight,
  Trophy,
  Sparkles,
} from 'lucide-solid'
import {
  sectorStore,
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
  class?: string
  onSectorSelect?: (sector: Sector) => void
}

/**
 * SectorNavigator - Season/sector selection component
 * Displays available sectors with unlock status and progress
 */
export function SectorNavigator(props: SectorNavigatorProps) {
  const compact = () => props.compact ?? false
  const showLocked = () => props.showLocked ?? true

  createEffect(() => {
    if (sectorStore.sectors.length === 0) {
      sectorStore.fetchSectors()
    }
  })

  const handleSectorClick = (sector: Sector) => {
    const { canUnlock } = sectorStore.canUnlockSector(sector.id)
    if (canUnlock) {
      sectorStore.setActiveSector(sector.id)
      props.onSectorSelect?.(sector)
    }
  }

  const displayedSectors = () => showLocked()
    ? sectorStore.sectors
    : sectorStore.sectors.filter(s => s.status === 'active' || s.status === 'completed')

  return (
    <Show
      when={!sectorStore.isLoading}
      fallback={
        <div class={cn('p-4', props.class)}>
          <div class="animate-pulse space-y-4">
            <For each={[1, 2, 3]}>
              {(i) => (
                <div
                  class="h-24 rounded-xl bg-[var(--background-tertiary)]/50"
                />
              )}
            </For>
          </div>
        </div>
      }
    >
      <Show
        when={!compact()}
        fallback={
          <div class={cn('flex flex-wrap gap-2', props.class)}>
            <For each={displayedSectors()}>
              {(sector) => (
                <SectorChip
                  sector={sector}
                  isActive={sectorStore.activeSector?.id === sector.id}
                  onClick={() => handleSectorClick(sector)}
                />
              )}
            </For>
          </div>
        }
      >
        <div class={cn('space-y-3', props.class)}>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <Map class="h-5 w-5 text-[var(--text-muted)]" />
              <h3 class="text-lg font-bold text-[var(--text-primary)]">
                Sectors
              </h3>
            </div>
            <Show when={sectorStore.activeSector}>
              <span class="text-sm text-[var(--text-muted)]">
                Current: <span class="font-medium text-[var(--text-primary)]">{sectorStore.activeSector!.name}</span>
              </span>
            </Show>
          </div>

          <For each={displayedSectors()}>
            {(sector) => (
              <div class="transition-all duration-200">
                <SectorCard
                  sector={sector}
                  isActive={sectorStore.activeSector?.id === sector.id}
                  onClick={() => handleSectorClick(sector)}
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </Show>
  )
}

// ============ SECTOR CHIP (Compact) ============

interface SectorChipProps {
  sector: Sector
  isActive: boolean
  onClick: () => void
}

function SectorChip(props: SectorChipProps) {
  const unlockStatus = () => sectorStore.canUnlockSector(props.sector.id)
  const statusColor = () => getSectorStatusColor(props.sector.status)
  const isLocked = () => !unlockStatus().canUnlock

  return (
    <button
      onClick={props.onClick}
      disabled={isLocked()}
      class={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
        'bg-[var(--background-secondary)]',
        props.isActive && 'ring-2 ring-offset-2 ring-offset-[var(--background-primary)]',
        isLocked()
          ? 'opacity-50 cursor-not-allowed border-[var(--card-border)]/30'
          : 'hover:border-[var(--card-border-hover)] cursor-pointer border-[var(--card-border)] hover:scale-[1.02] active:scale-[0.98]'
      )}
      style={{
        "border-color": props.isActive ? statusColor() : undefined,
      }}
      title={isLocked() ? unlockStatus().reason || 'Locked' : props.sector.name}
    >
      <StatusIcon status={props.sector.status} size="sm" />
      <span
        class="text-sm font-medium"
        style={{ color: props.isActive ? statusColor() : 'var(--text-primary)' }}
      >
        {props.sector.name}
      </span>
      <Show when={props.sector.status === 'active'}>
        <span class="text-xs text-[var(--text-muted)]">
          {props.sector.progressPercent.toFixed(0)}%
        </span>
      </Show>
    </button>
  )
}

// ============ SECTOR CARD (Full) ============

interface SectorCardProps {
  sector: Sector
  isActive: boolean
  onClick: () => void
}

function SectorCard(props: SectorCardProps) {
  const unlockStatus = () => sectorStore.canUnlockSector(props.sector.id)
  const statusColor = () => getSectorStatusColor(props.sector.status)
  const isLocked = () => !unlockStatus().canUnlock

  return (
    <button
      onClick={props.onClick}
      disabled={isLocked()}
      class={cn(
        'w-full text-left rounded-xl border p-4 transition-all',
        'bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        props.isActive && 'ring-2 ring-offset-2 ring-offset-[var(--background-primary)]',
        isLocked()
          ? 'opacity-60 cursor-not-allowed border-[var(--card-border)]/30'
          : 'hover:border-[var(--card-border-hover)] hover:shadow-lg cursor-pointer border-[var(--card-border)] hover:scale-[1.01] active:scale-[0.99]'
      )}
      style={{
        "border-color": props.isActive ? statusColor() : undefined,
      }}
    >
      {/* Header */}
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <div
            class="p-2.5 rounded-xl"
            style={{ "background-color": `${props.sector.color}20` }}
          >
            <StatusIcon status={props.sector.status} color={props.sector.color} />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4
                class="font-bold text-base"
                style={{ color: props.isActive ? statusColor() : 'var(--text-primary)' }}
              >
                {props.sector.name}
              </h4>
              <StatusBadge status={props.sector.status} />
            </div>
            <p class="text-sm text-[var(--text-muted)] line-clamp-1">
              {props.sector.description}
            </p>
          </div>
        </div>
        <ChevronRight
          class={cn(
            'h-5 w-5 transition-transform',
            props.isActive ? 'rotate-90 text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
          )}
        />
      </div>

      {/* Progress (for active/completed sectors) */}
      <Show when={props.sector.status === 'active' || props.sector.status === 'completed'}>
        <div class="mb-3">
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="text-[var(--text-muted)]">Progress</span>
            <span class="font-medium text-[var(--text-primary)]">
              {props.sector.discoveredSynapses.toLocaleString()} / {props.sector.totalSynapses.toLocaleString()}
            </span>
          </div>
          <Progress
            value={props.sector.progressPercent}
            size="sm"
            variant={props.sector.status === 'completed' ? 'success' : 'default'}
            showGlow={props.sector.status === 'active'}
          />
        </div>
      </Show>

      {/* Lock reason */}
      <Show when={isLocked() && unlockStatus().reason}>
        <div class="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 p-2 rounded-lg bg-[var(--background-primary)]/50">
          <Lock class="h-4 w-4" />
          <span>{unlockStatus().reason}</span>
        </div>
      </Show>

      {/* Rewards */}
      <Show when={props.sector.rewardPool.length > 0}>
        <div class="flex flex-wrap gap-2">
          <For each={props.sector.rewardPool.slice(0, 3)}>
            {(reward) => (
              <div
                class="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--background-primary)]/50 text-xs"
              >
                <Trophy class="h-3 w-3 text-[var(--text-muted)]" />
                <span class="text-[var(--text-secondary)]">{reward.label}</span>
              </div>
            )}
          </For>
          <Show when={props.sector.rewardPool.length > 3}>
            <div class="px-2 py-1 rounded-lg bg-[var(--background-primary)]/50 text-xs text-[var(--text-muted)]">
              +{props.sector.rewardPool.length - 3} more
            </div>
          </Show>
        </div>
      </Show>
    </button>
  )
}

// ============ STATUS ICON ============

interface StatusIconProps {
  status: SectorStatus
  color?: string
  size?: 'sm' | 'md'
}

function StatusIcon(props: StatusIconProps) {
  const iconSize = () => props.size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const statusColor = () => props.color || getSectorStatusColor(props.status)

  return (
    <>
      <Show when={props.status === 'active'}>
        <Sparkles class={iconSize()} style={{ color: statusColor() }} />
      </Show>
      <Show when={props.status === 'completed'}>
        <CheckCircle2 class={iconSize()} style={{ color: statusColor() }} />
      </Show>
      <Show when={props.status === 'upcoming'}>
        <Clock class={iconSize()} style={{ color: statusColor() }} />
      </Show>
      <Show when={props.status === 'locked'}>
        <Lock class={iconSize()} style={{ color: statusColor() }} />
      </Show>
      <Show when={!['active', 'completed', 'upcoming', 'locked'].includes(props.status)}>
        <Map class={iconSize()} style={{ color: statusColor() }} />
      </Show>
    </>
  )
}

// ============ STATUS BADGE ============

interface StatusBadgeProps {
  status: SectorStatus
}

function StatusBadge(props: StatusBadgeProps) {
  const label = () => getSectorStatusLabel(props.status)
  const color = () => getSectorStatusColor(props.status)

  return (
    <span
      class="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        "background-color": `${color()}20`,
        color: color(),
      }}
    >
      {label()}
    </span>
  )
}

// ============ MINI SECTOR INDICATOR ============

interface SectorIndicatorProps {
  class?: string
}

/**
 * SectorIndicator - Minimal indicator showing current sector
 */
export function SectorIndicator(props: SectorIndicatorProps) {
  createEffect(() => {
    if (sectorStore.sectors.length === 0) {
      sectorStore.fetchSectors()
    }
  })

  const statusColor = () => sectorStore.activeSector ? getSectorStatusColor(sectorStore.activeSector.status) : ''

  return (
    <Show when={!sectorStore.isLoading && sectorStore.activeSector}>
      <div
        class={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
          'bg-[var(--background-secondary)] border-[var(--card-border)]/50',
          props.class
        )}
      >
        <StatusIcon status={sectorStore.activeSector!.status} color={statusColor()} size="sm" />
        <span class="text-sm font-medium text-[var(--text-primary)]">
          {sectorStore.activeSector!.name}
        </span>
        <span class="text-xs text-[var(--text-muted)]">
          {sectorStore.activeSector!.progressPercent.toFixed(0)}%
        </span>
      </div>
    </Show>
  )
}
