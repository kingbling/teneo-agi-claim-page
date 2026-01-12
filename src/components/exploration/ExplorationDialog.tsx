import { Show, For, createMemo, type JSX } from 'solid-js'
import { X, Brain, Zap, Users, Clock, Gift, Ship as ShipIcon, AlertTriangle } from 'lucide-solid'
import { explorationStore, getSpendingRateOptions } from '@/stores/explorationStore'
import { shipStore } from '@/stores/shipStore'
import { userStore } from '@/stores/userStore'
import { SYNAPSE_CONFIG, type SynapseType, formatPoints, formatETA, getSynapseTypeLabel } from '@/types/game'
import { cn } from '@/lib/utils'

// Synapse type colors
const SYNAPSE_TYPE_STYLES: Record<SynapseType, { bg: string; text: string; border: string }> = {
  minor: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  complex: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  deep: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
  core: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  rare: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  legendary: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  unique: { bg: 'bg-amber-400/10', text: 'text-amber-300', border: 'border-amber-400/30' },
}

/**
 * ExplorationDialog - Modal for starting synapse exploration
 * Masterplan 2026: Choose ship, set spending rate, see rewards
 */
export function ExplorationDialog() {
  // Access store state directly
  const explorationDialog = () => explorationStore.explorationDialog
  const closeExplorationDialog = explorationStore.closeExplorationDialog
  const setDialogShip = explorationStore.setDialogShip
  const setDialogSpendingRate = explorationStore.setDialogSpendingRate
  const confirmStartExploration = explorationStore.confirmStartExploration
  const canExplore = explorationStore.canExplore

  const userShips = () => shipStore.userShips
  // Access userStore to ensure reactivity (even if not directly used)
  const _user = () => userStore

  const isOpen = () => explorationDialog().isOpen
  const synapse = () => explorationDialog().synapse
  const selectedShipId = () => explorationDialog().selectedShipId
  const spendingRate = () => explorationDialog().spendingRate
  const isStarting = () => explorationDialog().isStarting
  const error = () => explorationDialog().error

  const synapseType = createMemo(() => synapse()?.synapseType as SynapseType | undefined)
  const config = createMemo(() => synapseType() ? SYNAPSE_CONFIG[synapseType()!] : null)
  const styles = createMemo(() => synapseType() ? SYNAPSE_TYPE_STYLES[synapseType()!] : null)
  const spendingRateOptions = createMemo(() => synapseType() ? getSpendingRateOptions(synapseType()!) : [])
  const isLottery = createMemo(() => config()?.distribution === 'lottery')
  const canExploreResult = createMemo(() => synapse() ? canExplore(synapse()!) : { canExplore: false, reason: '' })

  // Get idle ships
  const idleShips = createMemo(() => userShips().filter(s => s.state === 'idle'))

  // Calculate ETA based on current spending rate and explorers
  const etaMinutes = createMemo(() => {
    const s = synapse()
    if (!s) return 0
    const pointsRemaining = s.pointsRequired - s.pointsAccumulated
    const totalPointsPerMin = (s.explorerCount * 100) + spendingRate() // Estimate
    return Math.ceil(pointsRemaining / totalPointsPerMin)
  })

  return (
    <Show when={isOpen() && synapse()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={closeExplorationDialog}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          class="w-full max-w-lg bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]/30 shadow-2xl overflow-hidden transition-transform duration-200"
          style={{ animation: 'scaleIn 0.2s ease-out' }}
        >
          {/* Header */}
          <div class={cn('p-6 border-b border-[var(--card-border)]/20', styles()?.bg)}>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class={cn('p-3 rounded-xl', styles()?.bg, styles()?.border, 'border')}>
                  <Brain class={cn('h-6 w-6', styles()?.text)} />
                </div>
                <div>
                  <h2 class={cn('text-xl font-bold', styles()?.text)}>
                    {synapseType() && getSynapseTypeLabel(synapseType()!)} Synapse
                  </h2>
                  <p class="text-sm text-[var(--text-muted)]">
                    {synapse()?.region} - {synapse()?.zone}
                  </p>
                </div>
              </div>
              <button
                onClick={closeExplorationDialog}
                class="p-2 rounded-lg hover:bg-[var(--background-primary)] transition-colors"
              >
                <X class="h-5 w-5 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div class="p-6 space-y-6">
            {/* Synapse Info */}
            <div class="grid grid-cols-3 gap-4">
              <InfoCard
                icon={<Clock class="h-4 w-4" />}
                label="Est. Time"
                value={formatETA(etaMinutes())}
              />
              <InfoCard
                icon={<Users class="h-4 w-4" />}
                label="Explorers"
                value={`${synapse()?.explorerCount}${config()?.maxExplorers !== -1 ? `/${config()?.maxExplorers}` : ''}`}
              />
              <InfoCard
                icon={<Gift class="h-4 w-4" />}
                label="Reward"
                value={formatPoints(config()?.agiReward ?? 0)}
                highlight
              />
            </div>

            {/* Progress */}
            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-[var(--text-muted)]">Progress</span>
                <span class="font-medium">
                  {formatPoints(synapse()?.pointsAccumulated ?? 0)} / {formatPoints(synapse()?.pointsRequired ?? 0)}
                </span>
              </div>
              <div class="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
                <div
                  class={cn('h-full rounded-full transition-all', styles()?.bg?.replace('/10', ''))}
                  style={{ width: `${((synapse()?.pointsAccumulated ?? 0) / (synapse()?.pointsRequired ?? 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Reward Info */}
            <div class={cn(
              'p-4 rounded-xl border',
              isLottery() ? 'bg-purple-500/10 border-purple-500/30' : 'bg-green-500/10 border-green-500/30'
            )}>
              <div class="flex items-start gap-3">
                <Gift class={cn('h-5 w-5 mt-0.5', isLottery() ? 'text-purple-400' : 'text-green-400')} />
                <div>
                  <p class={cn('font-semibold', isLottery() ? 'text-purple-400' : 'text-green-400')}>
                    {isLottery() ? 'Lottery Distribution' : 'Fair Share Distribution'}
                  </p>
                  <p class="text-sm text-[var(--text-muted)] mt-1">
                    {isLottery()
                      ? 'Winner takes all! Your odds are based on your contribution percentage. Non-winners receive lottery tickets.'
                      : 'Rewards are split proportionally based on points contributed.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Ship Selection */}
            <div>
              <label class="block text-sm font-medium text-[var(--text-primary)] mb-3">
                Select Ship
              </label>
              <Show
                when={idleShips().length > 0}
                fallback={
                  <div class="p-4 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
                    <ShipIcon class="h-8 w-8 mx-auto text-[var(--text-muted)]/30 mb-2" />
                    <p class="text-sm text-[var(--text-muted)]">No idle ships available</p>
                  </div>
                }
              >
                <div class="grid grid-cols-2 gap-3">
                  <For each={idleShips()}>
                    {(ship) => (
                      <button
                        onClick={() => setDialogShip(ship.id)}
                        class={cn(
                          'p-3 rounded-xl border text-left transition-all',
                          selectedShipId() === ship.id
                            ? 'bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/40'
                            : 'bg-[var(--background-primary)] border-[var(--card-border)]/20 hover:border-[var(--card-border)]/40'
                        )}
                      >
                        <div class="flex items-center gap-2">
                          <ShipIcon class={cn(
                            'h-4 w-4',
                            selectedShipId() === ship.id ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'
                          )} />
                          <span class={cn(
                            'font-medium text-sm',
                            selectedShipId() === ship.id ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
                          )}>
                            {ship.name}
                          </span>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Spending Rate */}
            <div>
              <label class="block text-sm font-medium text-[var(--text-primary)] mb-3">
                Spending Rate
              </label>
              <div class="flex flex-wrap gap-2">
                <For each={spendingRateOptions()}>
                  {(rate) => (
                    <button
                      onClick={() => setDialogSpendingRate(rate)}
                      class={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        spendingRate() === rate
                          ? 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/40'
                          : 'bg-[var(--background-primary)] text-[var(--text-muted)] border border-[var(--card-border)]/20 hover:border-[var(--card-border)]/40'
                      )}
                    >
                      {rate} pts/min
                    </button>
                  )}
                </For>
              </div>
              <p class="text-xs text-[var(--text-muted)] mt-2">
                Max for {synapseType() && getSynapseTypeLabel(synapseType()!)}: {config()?.maxPerMin} pts/min
              </p>
            </div>

            {/* Error */}
            <Show when={error() || !canExploreResult().canExplore}>
              <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertTriangle class="h-5 w-5 text-red-400 mt-0.5" />
                <p class="text-sm text-red-400">
                  {error() || canExploreResult().reason}
                </p>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="p-6 border-t border-[var(--card-border)]/20 bg-[var(--background-primary)]/50">
            <div class="flex gap-3">
              <button
                onClick={closeExplorationDialog}
                class="flex-1 px-4 py-3 rounded-xl bg-[var(--background-secondary)] border border-[var(--card-border)]/20 text-[var(--text-muted)] font-medium hover:bg-[var(--background-secondary)]/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStartExploration}
                disabled={!selectedShipId() || !canExploreResult().canExplore || isStarting()}
                class={cn(
                  'flex-1 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                  selectedShipId() && canExploreResult().canExplore
                    ? 'bg-gradient-to-r from-[var(--brand-teal-1)] to-[hsl(var(--accent))] text-white shadow-lg shadow-[var(--brand-teal-1)]/20 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-[var(--background-secondary)] text-[var(--text-muted)] cursor-not-allowed'
                )}
              >
                <Show
                  when={!isStarting()}
                  fallback={
                    <>
                      <div class="animate-spin">
                        <Zap class="h-4 w-4" />
                      </div>
                      Starting...
                    </>
                  }
                >
                  <Brain class="h-4 w-4" />
                  Start Exploration
                </Show>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}

// Info card component
function InfoCard(props: {
  icon: JSX.Element
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div class="p-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20">
      <div class="flex items-center gap-2 mb-1">
        <span class={props.highlight ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'}>
          {props.icon}
        </span>
        <span class="text-xs text-[var(--text-muted)]">{props.label}</span>
      </div>
      <p class={cn(
        'font-bold',
        props.highlight ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
      )}>
        {props.value}
      </p>
    </div>
  )
}
