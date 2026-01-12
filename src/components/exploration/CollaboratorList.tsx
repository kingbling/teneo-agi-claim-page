import { Show, For, createMemo } from 'solid-js'
import { Users, Ship, Gauge, Crown } from 'lucide-solid'
import { formatPoints } from '@/types/game'
import { cn } from '@/lib/utils'

export interface Collaborator {
  userId: string
  username?: string
  shipId: string
  shipName: string
  pointsContributed: number
  pointsPerMin: number
  joinedAt: number
  isCurrentUser?: boolean
}

export interface CollaboratorListProps {
  /** List of collaborators */
  collaborators: Collaborator[]
  /** Total points accumulated */
  totalPoints: number
  /** Current user's ID for highlighting */
  currentUserId?: string
  /** Compact mode */
  compact?: boolean
  /** Additional CSS classes */
  class?: string
}

/**
 * CollaboratorList - Shows current explorers on a synapse
 *
 * Displays who is exploring, their contribution rates, and
 * relative contribution percentages.
 */
export function CollaboratorList(props: CollaboratorListProps) {
  const compact = () => props.compact ?? false

  // Sort by contribution (highest first)
  const sorted = createMemo(() =>
    [...props.collaborators].sort((a, b) => b.pointsContributed - a.pointsContributed)
  )
  const topContributor = createMemo(() => sorted()[0])

  // Calculate total points per minute
  const totalPointsPerMin = createMemo(() =>
    props.collaborators.reduce((sum, c) => sum + c.pointsPerMin, 0)
  )

  return (
    <Show
      when={!compact()}
      fallback={
        <div class={cn('flex items-center gap-2', props.class)}>
          <Users class="h-4 w-4 text-[var(--text-muted)]" />
          <span class="text-sm text-[var(--text-muted)]">
            {props.collaborators.length} explorer{props.collaborators.length !== 1 ? 's' : ''}
          </span>
          <span class="text-sm font-medium text-[var(--brand-teal-1)]">
            {formatPoints(totalPointsPerMin())}/min
          </span>
        </div>
      }
    >
      <div
        class={cn(
          'rounded-xl border p-4 bg-[var(--background-secondary)] border-[var(--card-border)]/30 transition-all duration-300',
          props.class
        )}
        style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-purple-500/20">
              <Users class="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p class="text-sm font-semibold text-[var(--text-primary)]">
                {props.collaborators.length} Explorer{props.collaborators.length !== 1 ? 's' : ''}
              </p>
              <p class="text-xs text-[var(--text-muted)]">
                Combined: {formatPoints(totalPointsPerMin())}/min
              </p>
            </div>
          </div>
        </div>

        {/* Collaborator list */}
        <div class="space-y-2">
          <For each={sorted()}>
            {(collaborator, index) => {
              const isTopContributor = () => collaborator === topContributor() && props.collaborators.length > 1
              const isCurrentUser = () => collaborator.userId === props.currentUserId
              const contributionPercent = () => props.totalPoints > 0
                ? (collaborator.pointsContributed / props.totalPoints) * 100
                : 0

              return (
                <div
                  class={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-colors',
                    isCurrentUser()
                      ? 'bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/30'
                      : 'bg-[var(--background-primary)] border-[var(--card-border)]/20'
                  )}
                  style={{ animation: `fadeSlideIn 0.2s ease-out ${index() * 0.05}s both` }}
                >
                  <div class="flex items-center gap-3">
                    {/* Rank indicator */}
                    <div class={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      isTopContributor()
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-[var(--background-secondary)] text-[var(--text-muted)]'
                    )}>
                      <Show when={isTopContributor()} fallback={index() + 1}>
                        <Crown class="h-3 w-3" />
                      </Show>
                    </div>

                    {/* Ship info */}
                    <div class="flex items-center gap-2">
                      <Ship class={cn(
                        'h-4 w-4',
                        isCurrentUser() ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'
                      )} />
                      <div>
                        <p class={cn(
                          'text-sm font-medium',
                          isCurrentUser() ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
                        )}>
                          {collaborator.shipName}
                          <Show when={isCurrentUser()}>
                            <span class="ml-1 text-xs opacity-70">(You)</span>
                          </Show>
                        </p>
                        <p class="text-xs text-[var(--text-muted)]">
                          {collaborator.username || `User ${collaborator.userId.slice(0, 8)}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div class="text-right">
                    <div class="flex items-center gap-1 justify-end">
                      <Gauge class="h-3 w-3 text-[var(--text-muted)]" />
                      <span class="text-sm font-medium text-[var(--text-primary)]">
                        {formatPoints(collaborator.pointsPerMin)}/min
                      </span>
                    </div>
                    <div class="flex items-center gap-1 justify-end text-xs text-[var(--text-muted)]">
                      <span>{contributionPercent().toFixed(1)}% contributed</span>
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </div>

        {/* Empty state */}
        <Show when={props.collaborators.length === 0}>
          <div class="text-center py-6 text-[var(--text-muted)]">
            <Users class="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p class="text-sm">No explorers yet</p>
            <p class="text-xs">Be the first to explore this synapse!</p>
          </div>
        </Show>
      </div>
    </Show>
  )
}

/**
 * CollaboratorCount - Minimal count indicator
 */
export interface CollaboratorCountProps {
  count: number
  maxCount?: number
  class?: string
}

export function CollaboratorCount(props: CollaboratorCountProps) {
  const isFull = () => props.maxCount !== undefined && props.count >= props.maxCount

  return (
    <div class={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg',
      isFull()
        ? 'bg-amber-500/20 text-amber-400'
        : 'bg-[var(--background-primary)] text-[var(--text-muted)]',
      props.class
    )}>
      <Users class="h-3.5 w-3.5" />
      <span class="text-xs font-medium">
        {props.count}{props.maxCount !== undefined ? `/${props.maxCount}` : ''}
      </span>
    </div>
  )
}
