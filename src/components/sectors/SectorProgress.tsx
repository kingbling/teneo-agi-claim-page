import { createEffect, Show, For, type JSX } from 'solid-js'
import {
  Brain,
  Target,
  Trophy,
  Gift,
  Sparkles,
  TrendingUp,
  Clock,
} from 'lucide-solid'
import {
  sectorStore,
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
  class?: string
}

/**
 * SectorProgress - Displays progress for current sector
 * Shows synapses discovered, reward pool, and completion status
 */
export function SectorProgress(props: SectorProgressProps) {
  const variant = () => props.variant ?? 'card'
  const showRewards = () => props.showRewards ?? true
  const showStats = () => props.showStats ?? true

  // Use provided sectorId or fall back to active sector
  const sector = () => props.sectorId ? sectorStore.getSectorById(props.sectorId) : sectorStore.activeSector

  createEffect(() => {
    const s = sector()
    if (s && !sectorStore.sectorProgress[s.id]) {
      sectorStore.fetchSectorProgress(s.id)
    }
  })

  return (
    <Show
      when={sector()}
      fallback={
        <div class={cn('p-4 text-center text-[var(--text-muted)]', props.class)}>
          No sector selected
        </div>
      }
    >
      <Show
        when={!sectorStore.isLoadingProgress}
        fallback={
          <div class={cn('p-4', props.class)}>
            <div class="animate-pulse space-y-4">
              <div class="h-8 rounded bg-[var(--background-tertiary)]/50 w-3/4" />
              <div class="h-4 rounded bg-[var(--background-tertiary)]/50" />
              <div class="h-20 rounded bg-[var(--background-tertiary)]/50" />
            </div>
          </div>
        }
      >
        <Show when={variant() === 'compact'}>
          <CompactProgress sector={sector()!} class={props.class} />
        </Show>
        <Show when={variant() === 'inline'}>
          <InlineProgress sector={sector()!} class={props.class} />
        </Show>
        <Show when={variant() === 'card'}>
          <Card class={cn('overflow-hidden', props.class)}>
            <CardHeader spacing="compact">
              <div class="flex items-center justify-between">
                <CardTitle size="default" class="flex items-center gap-2">
                  <Target class="h-5 w-5" style={{ color: sector()!.color }} />
                  {sector()!.name} Progress
                </CardTitle>
                <CompletionBadge percent={sector()!.progressPercent} color={sector()!.color} />
              </div>
            </CardHeader>

            <CardContent spacing="default">
              {/* Main Progress */}
              <div class="mb-6">
                <div class="flex items-center justify-between text-sm mb-2">
                  <span class="text-[var(--text-muted)]">Synapses Discovered</span>
                  <span class="font-bold text-[var(--text-primary)]">
                    {sector()!.discoveredSynapses.toLocaleString()} / {sector()!.totalSynapses.toLocaleString()}
                  </span>
                </div>
                <Progress
                  value={sector()!.progressPercent}
                  size="lg"
                  variant="default"
                  showGlow={sector()!.status === 'active'}
                  animated={sector()!.status === 'active'}
                />
                <div class="flex items-center justify-between mt-2 text-xs text-[var(--text-muted)]">
                  <span>{sector()!.progressPercent.toFixed(1)}% Complete</span>
                  <Show when={sector()!.endDate}>
                    <span class="flex items-center gap-1">
                      <Clock class="h-3 w-3" />
                      Ends {new Date(sector()!.endDate!).toLocaleDateString()}
                    </span>
                  </Show>
                </div>
              </div>

              {/* Stats */}
              <Show when={showStats()}>
                <div class="grid grid-cols-3 gap-3 mb-6">
                  <StatBox
                    icon={<Brain class="h-4 w-4" />}
                    label="Total"
                    value={sector()!.totalSynapses.toLocaleString()}
                    color={sector()!.color}
                  />
                  <StatBox
                    icon={<Sparkles class="h-4 w-4" />}
                    label="Found"
                    value={sector()!.discoveredSynapses.toLocaleString()}
                    color="#10B981"
                  />
                  <StatBox
                    icon={<Target class="h-4 w-4" />}
                    label="Remaining"
                    value={(sector()!.totalSynapses - sector()!.discoveredSynapses).toLocaleString()}
                    color="#F59E0B"
                  />
                </div>
              </Show>

              {/* Rewards */}
              <Show when={showRewards() && sector()!.rewardPool.length > 0}>
                <RewardPool rewards={sector()!.rewardPool} bonus={sector()!.completionBonus} />
              </Show>
            </CardContent>
          </Card>
        </Show>
      </Show>
    </Show>
  )
}

// ============ INLINE PROGRESS ============

interface InlineProgressProps {
  sector: Sector
  class?: string
}

function InlineProgress(props: InlineProgressProps) {
  return (
    <div
      class={cn(
        'flex items-center gap-4 p-4 rounded-xl border transition-all duration-300',
        'bg-[var(--background-secondary)] border-[var(--card-border)]',
        props.class
      )}
    >
      <CircularProgress
        value={props.sector.progressPercent}
        size="lg"
        showValue
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <h4 class="font-bold text-[var(--text-primary)] truncate">
            {props.sector.name}
          </h4>
          <span
            class="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              "background-color": `${props.sector.color}20`,
              color: props.sector.color,
            }}
          >
            {props.sector.status}
          </span>
        </div>
        <p class="text-sm text-[var(--text-muted)]">
          {props.sector.discoveredSynapses.toLocaleString()} of {props.sector.totalSynapses.toLocaleString()} synapses
        </p>
      </div>

      <div class="flex flex-col items-end">
        <span class="text-lg font-bold" style={{ color: props.sector.color }}>
          {props.sector.progressPercent.toFixed(1)}%
        </span>
        <span class="text-xs text-[var(--text-muted)]">Complete</span>
      </div>
    </div>
  )
}

// ============ COMPACT PROGRESS ============

interface CompactProgressProps {
  sector: Sector
  class?: string
}

function CompactProgress(props: CompactProgressProps) {
  return (
    <div class={cn('flex items-center gap-3 transition-all duration-300', props.class)}>
      <div
        class="p-2 rounded-lg"
        style={{ "background-color": `${props.sector.color}20` }}
      >
        <Target class="h-4 w-4" style={{ color: props.sector.color }} />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-medium text-[var(--text-primary)] truncate">
            {props.sector.name}
          </span>
          <span class="text-xs font-bold" style={{ color: props.sector.color }}>
            {props.sector.progressPercent.toFixed(0)}%
          </span>
        </div>
        <Progress value={props.sector.progressPercent} size="sm" showGlow />
      </div>
    </div>
  )
}

// ============ COMPLETION BADGE ============

interface CompletionBadgeProps {
  percent: number
  color: string
}

function CompletionBadge(props: CompletionBadgeProps) {
  return (
    <div
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
      style={{ "background-color": `${props.color}20` }}
    >
      <TrendingUp class="h-4 w-4" style={{ color: props.color }} />
      <span class="text-sm font-bold" style={{ color: props.color }}>
        {props.percent.toFixed(1)}%
      </span>
    </div>
  )
}

// ============ STAT BOX ============

interface StatBoxProps {
  icon: JSX.Element
  label: string
  value: string
  color: string
}

function StatBox(props: StatBoxProps) {
  return (
    <div class="p-3 rounded-lg bg-[var(--background-primary)]/50 border border-[var(--card-border)]/30">
      <div class="flex items-center gap-2 mb-1">
        <div style={{ color: props.color }} class="opacity-80">
          {props.icon}
        </div>
        <span class="text-xs text-[var(--text-muted)]">{props.label}</span>
      </div>
      <p class="text-lg font-bold text-[var(--text-primary)]">{props.value}</p>
    </div>
  )
}

// ============ REWARD POOL ============

interface RewardPoolProps {
  rewards: SectorReward[]
  bonus: SectorReward | null
}

function RewardPool(props: RewardPoolProps) {
  return (
    <div>
      <div class="flex items-center gap-2 mb-3">
        <Trophy class="h-4 w-4 text-[var(--text-muted)]" />
        <span class="text-sm font-medium text-[var(--text-primary)]">
          Reward Pool
        </span>
      </div>

      <div class="space-y-2">
        <For each={props.rewards}>
          {(reward) => (
            <div
              class="flex items-center justify-between p-3 rounded-lg bg-[var(--background-primary)]/50 border border-[var(--card-border)]/20 transition-all duration-200"
            >
              <div class="flex items-center gap-2">
                <RewardIcon type={reward.type} />
                <span class="text-sm text-[var(--text-secondary)]">
                  {reward.label}
                </span>
              </div>
              <span class="text-sm font-bold text-[var(--text-primary)]">
                {formatSectorReward(reward)}
              </span>
            </div>
          )}
        </For>

        <Show when={props.bonus}>
          <div
            class="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-[hsl(var(--accent))]/10 to-transparent border border-[hsl(var(--accent))]/30 transition-all duration-200"
          >
            <div class="flex items-center gap-2">
              <Gift class="h-4 w-4 text-[hsl(var(--accent))]" />
              <span class="text-sm font-medium text-[hsl(var(--accent))]">
                Completion Bonus
              </span>
            </div>
            <span class="text-sm font-bold text-[hsl(var(--accent))]">
              {props.bonus!.label}
            </span>
          </div>
        </Show>
      </div>
    </div>
  )
}

// ============ REWARD ICON ============

interface RewardIconProps {
  type: string
}

function RewardIcon(props: RewardIconProps) {
  const iconClass = 'h-4 w-4'

  return (
    <>
      <Show when={props.type === 'agi'}>
        <Sparkles class={cn(iconClass, 'text-[#10B981]')} />
      </Show>
      <Show when={props.type === 'teneo'}>
        <Sparkles class={cn(iconClass, 'text-[#8B5CF6]')} />
      </Show>
      <Show when={props.type === 'nft'}>
        <Gift class={cn(iconClass, 'text-[#F59E0B]')} />
      </Show>
      <Show when={props.type === 'lottery_tickets'}>
        <Trophy class={cn(iconClass, 'text-[#EC4899]')} />
      </Show>
      <Show when={props.type === 'agentic'}>
        <Sparkles class={cn(iconClass, 'text-[#3B82F6]')} />
      </Show>
      <Show when={!['agi', 'teneo', 'nft', 'lottery_tickets', 'agentic'].includes(props.type)}>
        <Gift class={cn(iconClass, 'text-[var(--text-muted)]')} />
      </Show>
    </>
  )
}

// ============ SECTOR PROGRESS MINI ============

interface SectorProgressMiniProps {
  class?: string
}

/**
 * SectorProgressMini - Minimal progress indicator for headers
 */
export function SectorProgressMini(props: SectorProgressMiniProps) {
  return (
    <Show when={sectorStore.activeSector}>
      <div class={cn('flex items-center gap-2', props.class)}>
        <Target class="h-4 w-4" style={{ color: sectorStore.activeSector!.color }} />
        <span class="text-sm font-medium text-[var(--text-primary)]">
          {sectorStore.activeSector!.progressPercent.toFixed(0)}%
        </span>
        <div class="w-16 h-1.5 rounded-full bg-[var(--background-tertiary)] overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            style={{
              "background-color": sectorStore.activeSector!.color,
              width: `${sectorStore.activeSector!.progressPercent}%`,
            }}
          />
        </div>
      </div>
    </Show>
  )
}
