import { Show, createMemo, createSignal, createEffect, onCleanup } from 'solid-js'
import { X, Navigation, Clock, Users, Target, ArrowLeft, Pause, Zap } from 'lucide-solid'
import { shipStore } from '@/stores/shipStore'
import {
  SYNAPSE_CONFIG,
  formatPoints,
  formatETA,
  getSynapseTypeLabel,
  type SynapseType,
} from '@/types/game'
import { SHIP_STATUS_COLORS, getSynapseRgbColor } from '@/constants/colors'

/**
 * TickingCounter - Fast-updating display showing points accumulating in real-time
 */
function TickingCounter(props: { baseValue: number; ratePerMin: number }) {
  const [displayValue, setDisplayValue] = createSignal(props.baseValue)
  const [lastBaseValue, setLastBaseValue] = createSignal(props.baseValue)
  const [lastUpdateTime, setLastUpdateTime] = createSignal(Date.now())

  // Reset when base value changes (server update)
  createEffect(() => {
    const newBase = props.baseValue
    if (newBase !== lastBaseValue()) {
      setLastBaseValue(newBase)
      setDisplayValue(newBase)
      setLastUpdateTime(Date.now())
    }
  })

  // Fast interval to interpolate between server updates
  createEffect(() => {
    const rate = props.ratePerMin
    if (rate <= 0) return

    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastUpdateTime()) / 1000 // seconds
      const pointsPerSecond = rate / 60
      const interpolated = lastBaseValue() + elapsed * pointsPerSecond
      setDisplayValue(interpolated)
    }, 50) // Update every 50ms for smooth animation

    onCleanup(() => clearInterval(interval))
  })

  return (
    <div class="flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/30 rounded px-2 py-1">
      <Zap class="w-3 h-3 text-teal-400 animate-pulse" />
      <span class="font-mono text-sm text-teal-300 tabular-nums">
        {displayValue().toFixed(1)}
      </span>
      <span class="text-[10px] text-teal-500">pts</span>
    </div>
  )
}

interface ShipDetailPanelProps {
  onClose: () => void
}

/**
 * ShipDetailPanel - Compact floating panel for ship details
 *
 * Shows selected ship info, exploration progress, and actions.
 */
export function ShipDetailPanel(props: ShipDetailPanelProps) {
  const ship = createMemo(() => shipStore.selectedShip)
  const synapse = createMemo(() => shipStore.currentExplorationSynapse)
  const explorers = createMemo(() => shipStore.currentExplorers)

  const travelProgress = createMemo(() => {
    const s = ship()
    if (!s || !s.travelStartTime || !s.travelDuration) return null
    const elapsed = Date.now() - s.travelStartTime
    const progress = Math.min(elapsed / s.travelDuration, 1)
    const remainingMs = Math.max(0, s.travelDuration - elapsed)
    return { progress, remainingMinutes: remainingMs / 60000 }
  })

  const getSynapseColor = (type: SynapseType | undefined) => getSynapseRgbColor(type)

  return (
    <Show when={ship()}>
      {(currentShip) => {
        // Use getter function for reactivity - plain variable assignment doesn't track changes
        const getStatus = () => SHIP_STATUS_COLORS[currentShip().state] || SHIP_STATUS_COLORS.idle

        return (
          <div class="pointer-events-auto w-72 rounded-lg bg-gray-900/90 backdrop-blur border border-gray-700/50 shadow-xl text-sm">
            {/* Header - compact */}
            <div class="px-3 py-2 border-b border-gray-700/50 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Navigation class={`w-4 h-4 ${getStatus().iconClass}`} />
                <span class="font-medium text-white">{currentShip().name}</span>
                <span class={`text-[10px] px-1.5 py-0.5 rounded ${getStatus().badgeClass}`}>
                  {getStatus().label}
                </span>
              </div>
              <button
                onClick={props.onClose}
                class="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <div class="p-3 space-y-3">
              {/* Travel Progress */}
              <Show when={(currentShip().state === 'deploying' || currentShip().state === 'returning') && travelProgress()}>
                {(progress) => (
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-gray-400">Progress</span>
                      <span class="text-gray-300">{Math.round(progress().progress * 100)}%</span>
                    </div>
                    <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        class={`h-full ${getStatus().barClass}`}
                        style={{ width: `${progress().progress * 100}%` }}
                      />
                    </div>
                    <div class="flex items-center gap-1 text-[10px] text-gray-500">
                      <Clock class="w-2.5 h-2.5" />
                      <span>ETA: {formatETA(progress().remainingMinutes)}</span>
                    </div>
                  </div>
                )}
              </Show>

              {/* Exploring Synapse */}
              <Show when={currentShip().state === 'solving' && synapse()}>
                {(currentSynapse) => {
                  const config = SYNAPSE_CONFIG[currentSynapse().synapseType] || SYNAPSE_CONFIG.minor
                  const pct = currentSynapse().pointsRequired > 0
                    ? (currentSynapse().pointsAccumulated / currentSynapse().pointsRequired) * 100
                    : 0

                  return (
                    <div class="space-y-2">
                      {/* Synapse info */}
                      <div class="flex items-center gap-2">
                        <Target class="w-3.5 h-3.5" style={{ color: getSynapseColor(currentSynapse().synapseType) }} />
                        <span class="text-xs text-white">{getSynapseTypeLabel(currentSynapse().synapseType)}</span>
                        <span class="text-[10px] text-gray-500">{currentSynapse().region}</span>
                      </div>

                      {/* Progress */}
                      <div class="space-y-1">
                        <div class="flex justify-between text-xs">
                          <span class="text-gray-400">{Math.round(pct)}%</span>
                          <span class="text-teal-400">{currentShip().currentPointsPerMin} pts/min</span>
                        </div>
                        <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div class="h-full bg-teal-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Live points counter */}
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] text-gray-500">Points accumulated</span>
                        <TickingCounter
                          baseValue={currentSynapse().pointsAccumulated}
                          ratePerMin={currentShip().currentPointsPerMin ?? 0}
                        />
                      </div>

                      {/* Reward */}
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-500">Reward</span>
                        <span class="text-amber-400 font-medium">{formatPoints(config.agiReward)} $AGI</span>
                      </div>

                      {/* Explorers count */}
                      <Show when={explorers().length > 0}>
                        <div class="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <Users class="w-3 h-3" />
                          <span>{explorers().length} exploring</span>
                        </div>
                      </Show>
                    </div>
                  )
                }}
              </Show>

              {/* Idle state - prompt to click synapse */}
              <Show when={currentShip().state === 'idle'}>
                <p class="text-xs text-gray-500 text-center py-2">Click a synapse to deploy</p>
              </Show>

              {/* Stats row */}
              <div class="flex gap-2 pt-2 border-t border-gray-700/50">
                <div class="flex-1 text-center">
                  <p class="text-sm font-semibold text-white">{currentShip().spacesDiscovered}</p>
                  <p class="text-[10px] text-gray-500">Found</p>
                </div>
                <div class="flex-1 text-center">
                  <p class="text-sm font-semibold text-amber-400">{formatPoints(currentShip().totalAgiEarned)}</p>
                  <p class="text-[10px] text-gray-500">$AGI</p>
                </div>
              </div>

              {/* Actions */}
              <div class="flex gap-2">
                <Show when={currentShip().state === 'solving'}>
                  <button
                    onClick={() => shipStore.leaveExploration(currentShip().id)}
                    class="flex-1 py-1.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 flex items-center justify-center gap-1"
                  >
                    <Pause class="w-3 h-3" />
                    Leave
                  </button>
                </Show>

                <Show when={currentShip().state === 'deploying' || currentShip().state === 'returning'}>
                  <button
                    onClick={() => shipStore.recallShip(currentShip().id)}
                    class="flex-1 py-1.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-medium hover:bg-purple-500/30 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft class="w-3 h-3" />
                    Recall
                  </button>
                </Show>
              </div>
            </div>
          </div>
        )
      }}
    </Show>
  )
}

export default ShipDetailPanel
