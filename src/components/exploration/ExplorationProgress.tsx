import { createEffect, onCleanup, Show, For, type JSX } from 'solid-js'
import { Brain, Users, Clock, Zap, Gift, LogOut, TrendingUp } from 'lucide-solid'
import { explorationStore } from '@/stores/explorationStore'
import { SYNAPSE_CONFIG, type SynapseType, formatPoints, formatETA, getSynapseTypeLabel } from '@/types/game'
import { cn } from '@/lib/utils'

// Synapse type colors
const SYNAPSE_TYPE_STYLES: Record<SynapseType, { bg: string; text: string; gradient: string }> = {
  minor: { bg: 'bg-blue-500', text: 'text-blue-400', gradient: 'from-blue-500 to-blue-600' },
  complex: { bg: 'bg-purple-500', text: 'text-purple-400', gradient: 'from-purple-500 to-purple-600' },
  deep: { bg: 'bg-teal-500', text: 'text-teal-400', gradient: 'from-teal-500 to-teal-600' },
  core: { bg: 'bg-yellow-500', text: 'text-yellow-400', gradient: 'from-yellow-500 to-yellow-600' },
  rare: { bg: 'bg-red-500', text: 'text-red-400', gradient: 'from-red-500 to-red-600' },
  legendary: { bg: 'bg-pink-500', text: 'text-pink-400', gradient: 'from-pink-500 to-pink-600' },
  unique: { bg: 'bg-amber-400', text: 'text-amber-300', gradient: 'from-amber-400 to-amber-500' },
}

/**
 * ExplorationProgress - Shows active synapse exploration status
 * Masterplan 2026: Progress bar, collaborators, ETA, rewards
 */
export function ExplorationProgress() {
  // Access store state directly
  const activeSynapse = () => explorationStore.activeSynapse
  const collaborators = () => explorationStore.collaborators
  const isLoadingCollaborators = () => explorationStore.isLoadingCollaborators
  const recentSpendingRates = () => explorationStore.recentSpendingRates

  // Actions
  const getSynapseProgress = explorationStore.getSynapseProgress
  const getMyContributionPercent = explorationStore.getMyContributionPercent
  const getEstimatedReward = explorationStore.getEstimatedReward
  const leaveCurrentExploration = explorationStore.leaveCurrentExploration
  const refreshActiveSynapse = explorationStore.refreshActiveSynapse
  const refreshCollaborators = explorationStore.refreshCollaborators
  const updateSpendingRate = explorationStore.updateSpendingRate

  // Refresh data periodically
  createEffect(() => {
    const synapse = activeSynapse()
    if (!synapse) return

    const interval = setInterval(() => {
      refreshActiveSynapse()
      refreshCollaborators()
    }, 5000) // Every 5 seconds

    onCleanup(() => clearInterval(interval))
  })

  return (
    <Show when={activeSynapse()}>
      {(synapse) => {
        const synapseType = () => synapse().synapseType as SynapseType
        const config = () => SYNAPSE_CONFIG[synapseType()]
        const styles = () => SYNAPSE_TYPE_STYLES[synapseType()]
        const progress = () => getSynapseProgress()
        const myContribution = () => getMyContributionPercent()
        const estimatedReward = () => getEstimatedReward()
        const isLottery = () => config().distribution === 'lottery'

        // Find my explorer entry
        const myExplorer = () => collaborators().find(c => c.isCurrentUser)

        return (
          <div
            class="bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]/30 overflow-hidden transition-all duration-300"
            style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
          >
            {/* Header */}
            <div class={cn('p-4 bg-gradient-to-r', styles().gradient)}>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Brain class="h-6 w-6 text-white" />
                  <div>
                    <h3 class="font-bold text-white">
                      {getSynapseTypeLabel(synapseType())} Synapse
                    </h3>
                    <p class="text-sm text-white/70">
                      {synapse().region} - {synapse().zone}
                    </p>
                  </div>
                </div>
                <button
                  onClick={leaveCurrentExploration}
                  class="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title="Leave exploration"
                >
                  <LogOut class="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Progress Section */}
            <div class="p-4 space-y-4">
              {/* Main Progress Bar */}
              <div>
                <div class="flex justify-between text-sm mb-2">
                  <span class="text-[var(--text-muted)]">Exploration Progress</span>
                  <span class="font-bold text-[var(--text-primary)]">{progress().toFixed(1)}%</span>
                </div>
                <div class="h-4 rounded-full bg-[var(--background-primary)] overflow-hidden">
                  <div
                    class={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', styles().gradient)}
                    style={{ width: `${progress()}%` }}
                  />
                </div>
                <div class="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                  <span>{formatPoints(synapse().pointsAccumulated)}</span>
                  <span>{formatPoints(synapse().pointsRequired)}</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div class="grid grid-cols-3 gap-3">
                <StatCard
                  icon={<Clock class="h-4 w-4" />}
                  label="ETA"
                  value={synapse().currentEtaMinutes ? formatETA(synapse().currentEtaMinutes) : '—'}
                />
                <StatCard
                  icon={<Users class="h-4 w-4" />}
                  label="Explorers"
                  value={`${synapse().explorerCount}`}
                />
                <StatCard
                  icon={<TrendingUp class="h-4 w-4" />}
                  label="My Share"
                  value={`${myContribution().toFixed(1)}%`}
                  highlight
                />
              </div>

              {/* Spending Rate Control */}
              <Show when={myExplorer()}>
                {(explorer) => (
                  <div class="p-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <Zap class="h-4 w-4 text-[hsl(var(--accent))]" />
                        <span class="text-sm font-medium text-[var(--text-primary)]">My Spending Rate</span>
                      </div>
                      <span class="text-sm font-bold text-[hsl(var(--accent))]">
                        {explorer().pointsPerMinute} pts/min
                      </span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <For each={recentSpendingRates().slice(0, 4)}>
                        {(rate) => (
                          <button
                            onClick={() => updateSpendingRate(rate)}
                            disabled={rate === explorer().pointsPerMinute}
                            class={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                              rate === explorer().pointsPerMinute
                                ? 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/40'
                                : 'bg-[var(--background-secondary)] text-[var(--text-muted)] hover:bg-[var(--background-secondary)]/80'
                            )}
                          >
                            {rate}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </Show>

              {/* Reward Preview */}
              <div class={cn(
                'p-4 rounded-xl border',
                isLottery() ? 'bg-purple-500/10 border-purple-500/30' : 'bg-green-500/10 border-green-500/30'
              )}>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Gift class={cn('h-5 w-5', isLottery() ? 'text-purple-400' : 'text-green-400')} />
                    <span class={cn('font-semibold', isLottery() ? 'text-purple-400' : 'text-green-400')}>
                      {isLottery() ? 'Potential Reward' : 'Estimated Reward'}
                    </span>
                  </div>
                  <div class="text-right">
                    <p class={cn('font-bold', isLottery() ? 'text-purple-400' : 'text-green-400')}>
                      {formatPoints(estimatedReward().agi)} AGI
                    </p>
                    <p class="text-xs text-[var(--text-muted)]">
                      +{formatPoints(estimatedReward().brainXp)} XP
                    </p>
                  </div>
                </div>
                <Show when={isLottery()}>
                  <p class="text-xs text-[var(--text-muted)] mt-2">
                    Win chance: ~{myContribution().toFixed(1)}% based on contribution
                  </p>
                </Show>
              </div>

              {/* Collaborators */}
              <div>
                <h4 class="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Users class="h-4 w-4 text-[var(--text-muted)]" />
                  Collaborators ({collaborators().length})
                </h4>
                <Show
                  when={!isLoadingCollaborators()}
                  fallback={
                    <div class="text-center py-4">
                      <div class="inline-block animate-spin">
                        <Zap class="h-5 w-5 text-[var(--text-muted)]" />
                      </div>
                    </div>
                  }
                >
                  <Show
                    when={collaborators().length > 0}
                    fallback={
                      <p class="text-sm text-[var(--text-muted)] text-center py-4">
                        You're the first explorer!
                      </p>
                    }
                  >
                    <div class="space-y-2 max-h-40 overflow-y-auto">
                      <For each={collaborators()}>
                        {(collab) => (
                          <div
                            class={cn(
                              'flex items-center justify-between p-2 rounded-lg',
                              collab.isCurrentUser
                                ? 'bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30'
                                : 'bg-[var(--background-primary)]'
                            )}
                          >
                            <div class="flex items-center gap-2">
                              <div class={cn(
                                'w-2 h-2 rounded-full',
                                collab.isCurrentUser ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--text-muted)]'
                              )} />
                              <span class={cn(
                                'text-sm font-medium',
                                collab.isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
                              )}>
                                {collab.shipName}
                                {collab.isCurrentUser && ' (You)'}
                              </span>
                            </div>
                            <div class="text-right">
                              <span class="text-xs font-medium text-[var(--text-primary)]">
                                {collab.contributionPercent.toFixed(1)}%
                              </span>
                              <span class="text-xs text-[var(--text-muted)] ml-2">
                                {collab.pointsPerMinute}/min
                              </span>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        )
      }}
    </Show>
  )
}

// Stat card component
function StatCard(props: {
  icon: JSX.Element
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div class="p-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
      <div class={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2',
        props.highlight ? 'bg-[var(--brand-teal-1)]/20 text-[var(--brand-teal-1)]' : 'bg-[var(--background-secondary)] text-[var(--text-muted)]'
      )}>
        {props.icon}
      </div>
      <p class="text-xs text-[var(--text-muted)]">{props.label}</p>
      <p class={cn(
        'font-bold',
        props.highlight ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
      )}>
        {props.value}
      </p>
    </div>
  )
}
