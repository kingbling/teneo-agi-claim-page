import { Show, For, onMount, createMemo } from 'solid-js'
import { Lock, Unlock, ChevronRight, Sparkles, Trophy, Target } from 'lucide-solid'
import { sectorStore, getSectorStatusColor, getSectorStatusLabel } from '@/stores/sectorStore'
import type { Sector, SectorStatus } from '@/stores/sectorStore'
import { cn } from '@/lib/utils'

interface SectorChainViewerProps {
  compact?: boolean
  orientation?: 'horizontal' | 'vertical'
  class?: string
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
export function SectorChainViewer(props: SectorChainViewerProps) {
  const compact = () => props.compact ?? false
  const orientation = () => props.orientation ?? 'horizontal'

  onMount(() => {
    if (sectorStore.sectors.length === 0) {
      sectorStore.fetchSectors()
    }
  })

  return (
    <Show
      when={!sectorStore.isLoading}
      fallback={
        <div class={cn(
          'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
          'border-[var(--card-border)]/30',
          props.class
        )}>
          <div class="flex items-center justify-center h-20">
            <div class="animate-pulse text-[var(--text-muted)]">Loading sectors...</div>
          </div>
        </div>
      }
    >
      <Show
        when={!compact()}
        fallback={<CompactView sectors={sectorStore.sectors} activeSector={sectorStore.activeSector} class={props.class} />}
      >
        <FullView
          sectors={sectorStore.sectors}
          activeSector={sectorStore.activeSector}
          orientation={orientation()}
          class={props.class}
        />
      </Show>
    </Show>
  )
}

interface CompactViewProps {
  sectors: Sector[]
  activeSector: Sector | null
  class?: string
}

function CompactView(props: CompactViewProps) {
  return (
    <div
      class={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border scale-in',
        'bg-gradient-to-r from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30',
        props.class
      )}
    >
      <For each={props.sectors}>
        {(sector, index) => {
          const isActive = () => props.activeSector?.id === sector.id
          const StatusIcon = getStatusIcon(sector.status)
          const color = getSectorStatusColor(sector.status)

          return (
            <div class="flex items-center gap-1">
              <button
                onClick={() => sectorStore.setActiveSector(sector.id)}
                class={cn(
                  'p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95',
                  isActive() && 'ring-2 ring-offset-1 ring-offset-[var(--background-primary)]'
                )}
                style={{
                  'background-color': `${color}20`,
                }}
                title={sector.name}
              >
                <StatusIcon class="h-4 w-4" style={{ color }} />
              </button>
              <Show when={index() < props.sectors.length - 1}>
                <ChevronRight class="h-3 w-3 text-[var(--text-muted)]" />
              </Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}

interface FullViewProps {
  sectors: Sector[]
  activeSector: Sector | null
  orientation: 'horizontal' | 'vertical'
  class?: string
}

function FullView(props: FullViewProps) {
  const isVertical = () => props.orientation === 'vertical'
  const completedCount = createMemo(() => props.sectors.filter(s => s.status === 'completed').length)

  return (
    <div
      class={cn(
        'rounded-xl border p-4 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--background-primary)]',
        'border-[var(--card-border)]/30 fade-in-up',
        props.class
      )}
    >
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-lg bg-[var(--brand-teal-1)]/20">
            <Target class="h-5 w-5 text-[var(--brand-teal-1)]" />
          </div>
          <div>
            <p class="font-bold text-[var(--text-primary)]">Sector Chain</p>
            <p class="text-xs text-[var(--text-muted)]">
              {completedCount()}/{props.sectors.length} Completed
            </p>
          </div>
        </div>
      </div>

      {/* Sector Chain */}
      <div class={cn(
        'flex gap-3',
        isVertical() ? 'flex-col' : 'flex-row overflow-x-auto pb-2'
      )}>
        <For each={props.sectors}>
          {(sector, index) => (
            <SectorNode
              sector={sector}
              isActive={props.activeSector?.id === sector.id}
              isLast={index() === props.sectors.length - 1}
              orientation={props.orientation}
              progress={sectorStore.getSectorProgressPercent(sector.id)}
              unlockInfo={sectorStore.canUnlockSector(sector.id)}
              onClick={() => sectorStore.setActiveSector(sector.id)}
            />
          )}
        </For>
      </div>

      {/* Active Sector Details */}
      <Show when={props.activeSector}>
        <div class="mt-4 pt-4 border-t border-[var(--card-border)]/30 fade-in">
          <ActiveSectorDetail sector={props.activeSector!} />
        </div>
      </Show>
    </div>
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

function SectorNode(props: SectorNodeProps) {
  const color = () => getSectorStatusColor(props.sector.status)
  const StatusIcon = getStatusIcon(props.sector.status)
  const isLocked = () => props.sector.status === 'locked' || props.sector.status === 'upcoming'
  const isVertical = () => props.orientation === 'vertical'

  return (
    <div class={cn(
      'flex items-center',
      isVertical() ? 'flex-row gap-3' : 'flex-col gap-2'
    )}>
      <button
        onClick={props.onClick}
        class={cn(
          'relative p-3 rounded-xl transition-all cursor-pointer min-w-[100px]',
          'hover:scale-105 active:scale-95',
          props.isActive && 'ring-2 ring-offset-2 ring-offset-[var(--background-primary)]',
          isLocked() && 'opacity-60'
        )}
        style={{
          'background-color': `${color()}15`,
          'border-color': color(),
        }}
      >
        <div class="flex flex-col items-center gap-2">
          <div
            class="p-2 rounded-lg"
            style={{ 'background-color': `${color()}30` }}
          >
            <StatusIcon class="h-5 w-5" style={{ color: color() }} />
          </div>
          <div class="text-center">
            <p class="text-xs font-medium text-[var(--text-primary)] truncate max-w-[80px]">
              {props.sector.name}
            </p>
            <p class="text-[10px] text-[var(--text-muted)]">
              {getSectorStatusLabel(props.sector.status)}
            </p>
          </div>

          {/* Progress bar for active sectors */}
          <Show when={props.sector.status === 'active'}>
            <div class="w-full h-1 rounded-full bg-[var(--background-primary)] overflow-hidden">
              <div
                class="h-full rounded-full transition-[width] duration-500"
                style={{
                  'background-color': color(),
                  width: `${props.progress}%`,
                }}
              />
            </div>
          </Show>

          {/* Completed checkmark */}
          <Show when={props.sector.status === 'completed'}>
            <div class="absolute -top-1 -right-1 p-0.5 rounded-full bg-[var(--background-primary)]">
              <Unlock class="h-3 w-3 text-green-400" />
            </div>
          </Show>
        </div>
      </button>

      {/* Connector line */}
      <Show when={!props.isLast}>
        <div class={cn(
          'flex items-center justify-center',
          isVertical() ? 'flex-col h-6' : 'flex-row w-6'
        )}>
          <div
            class={cn(
              'bg-[var(--card-border)]/50',
              isVertical() ? 'w-0.5 h-full' : 'h-0.5 w-full'
            )}
          />
          <ChevronRight
            class={cn(
              'h-4 w-4 text-[var(--text-muted)]',
              isVertical() && 'rotate-90'
            )}
          />
        </div>
      </Show>
    </div>
  )
}

interface ActiveSectorDetailProps {
  sector: Sector
}

function ActiveSectorDetail(props: ActiveSectorDetailProps) {
  const color = () => getSectorStatusColor(props.sector.status)

  return (
    <div class="space-y-3">
      <div class="flex items-start justify-between">
        <div>
          <h4 class="font-bold text-[var(--text-primary)]" style={{ color: color() }}>
            {props.sector.name}
          </h4>
          <p class="text-sm text-[var(--text-muted)] mt-1">
            {props.sector.description}
          </p>
        </div>
        <span
          class="px-2 py-0.5 rounded text-xs font-medium"
          style={{ 'background-color': `${color()}20`, color: color() }}
        >
          {getSectorStatusLabel(props.sector.status)}
        </span>
      </div>

      {/* Progress */}
      <div class="p-3 rounded-lg bg-[var(--background-primary)] border border-[var(--card-border)]/20">
        <div class="flex justify-between text-sm mb-2">
          <span class="text-[var(--text-muted)]">Synapses Discovered</span>
          <span class="font-medium text-[var(--text-primary)]">
            {props.sector.discoveredSynapses.toLocaleString()} / {props.sector.totalSynapses.toLocaleString()}
          </span>
        </div>
        <div class="h-2 rounded-full bg-[var(--background-secondary)] overflow-hidden">
          <div
            class="h-full rounded-full transition-[width] duration-500"
            style={{
              'background-color': color(),
              width: `${props.sector.progressPercent}%`,
            }}
          />
        </div>
        <p class="text-xs text-[var(--text-muted)] mt-1">
          {props.sector.progressPercent.toFixed(1)}% complete
        </p>
      </div>

      {/* Rewards */}
      <Show when={props.sector.rewardPool.length > 0}>
        <div>
          <p class="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <Sparkles class="h-3 w-3" />
            Reward Pool
          </p>
          <div class="flex flex-wrap gap-2">
            <For each={props.sector.rewardPool}>
              {(reward) => (
                <span class="px-2 py-1 rounded-lg text-xs bg-[var(--background-primary)] text-[var(--text-primary)] border border-[var(--card-border)]/20">
                  {reward.label}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Unlock Requirement */}
      <Show when={props.sector.unlockRequirement.type !== 'none'}>
        <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Lock class="h-3 w-3" />
          <span>
            {props.sector.unlockRequirement.type === 'brain_level'
              ? `Requires Brain Level ${props.sector.unlockRequirement.value}`
              : `Complete previous sector first`}
          </span>
        </div>
      </Show>
    </div>
  )
}

/**
 * SectorChainMini - Minimal version for headers
 */
export function SectorChainMini() {
  const activeIndex = createMemo(() =>
    sectorStore.sectors.findIndex(s => s.id === sectorStore.activeSector?.id)
  )
  const completed = createMemo(() =>
    sectorStore.sectors.filter(s => s.status === 'completed').length
  )

  return (
    <div class="flex items-center gap-2">
      <Target class="h-4 w-4 text-[var(--brand-teal-1)]" />
      <div class="flex gap-1">
        <For each={sectorStore.sectors}>
          {(sector, i) => {
            const color = getSectorStatusColor(sector.status)
            return (
              <div
                class={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i() === activeIndex() && 'ring-1 ring-offset-1 ring-offset-[var(--background-primary)]'
                )}
                style={{ 'background-color': color }}
              />
            )
          }}
        </For>
      </div>
      <span class="text-xs text-[var(--text-muted)]">
        {completed()}/{sectorStore.sectors.length}
      </span>
    </div>
  )
}
