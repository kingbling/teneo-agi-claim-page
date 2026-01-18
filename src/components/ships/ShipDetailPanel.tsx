import { Show, createMemo } from 'solid-js'
import { X, Navigation, Clock, Users, Target, ArrowLeft, Pause, Play } from 'lucide-solid'
import { shipStore, type Ship } from '@/stores/shipStore'
import {
  SYNAPSE_CONFIG,
  SYNAPSE_TYPE_COLORS,
  formatPoints,
  formatETA,
  getSynapseTypeLabel,
  type SynapseType,
} from '@/types/game'

interface ShipDetailPanelProps {
  onClose: () => void
}

/**
 * ShipDetailPanel - Compact floating panel for ship details
 */
export function ShipDetailPanel(props: ShipDetailPanelProps) {
  const ship = createMemo(() => shipStore.selectedShip)
  const synapse = createMemo(() => shipStore.currentExplorationSynapse)
  const explorers = createMemo(() => shipStore.currentExplorers)
  const explorationTarget = createMemo(() => shipStore.explorationTarget)

  const travelProgress = createMemo(() => {
    const s = ship()
    if (!s || !s.travelStartTime || !s.travelDuration) return null
    const elapsed = Date.now() - s.travelStartTime
    const progress = Math.min(elapsed / s.travelDuration, 1)
    const remainingMs = Math.max(0, s.travelDuration - elapsed)
    return { progress, remainingMinutes: remainingMs / 60000 }
  })

  const statusConfig: Record<Ship['state'], { iconClass: string; badgeClass: string; barClass: string; label: string }> = {
    idle: { iconClass: 'text-gray-400', badgeClass: 'bg-gray-500/20 text-gray-400', barClass: 'bg-gray-500', label: 'Idle' },
    exploring: { iconClass: 'text-teal-400', badgeClass: 'bg-teal-500/20 text-teal-400', barClass: 'bg-teal-500', label: 'Exploring' },
    deploying: { iconClass: 'text-yellow-400', badgeClass: 'bg-yellow-500/20 text-yellow-400', barClass: 'bg-yellow-500', label: 'Deploying' },
    returning: { iconClass: 'text-purple-400', badgeClass: 'bg-purple-500/20 text-purple-400', barClass: 'bg-purple-500', label: 'Returning' },
  }

  const getSynapseColor = (type: SynapseType | undefined) => {
    const c = SYNAPSE_TYPE_COLORS[type || 'minor'] || SYNAPSE_TYPE_COLORS.minor
    return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
  }

  return (
    <Show when={ship()}>
      {(currentShip) => {
        // Use getter function for reactivity - plain variable assignment doesn't track changes
        const getStatus = () => statusConfig[currentShip().state] || statusConfig.idle

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
              <Show when={currentShip().state === 'exploring' && synapse()}>
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

              {/* Idle - show target if selected, otherwise prompt to select a synapse */}
              <Show when={currentShip().state === 'idle'}>
                <Show when={explorationTarget()} fallback={
                  <p class="text-xs text-gray-500 text-center py-2">Click a synapse to explore</p>
                }>
                  {(target) => {
                    const config = SYNAPSE_CONFIG[target().synapseType as SynapseType] || SYNAPSE_CONFIG.minor
                    return (
                      <div class="p-2 rounded bg-teal-500/10 border border-teal-500/20 space-y-1">
                        <div class="flex items-center gap-1.5 text-xs">
                          <Target class="w-3 h-3 text-teal-400" />
                          <span class="text-white">{getSynapseTypeLabel(target().synapseType as SynapseType)}</span>
                        </div>
                        <div class="flex justify-between text-[10px]">
                          <span class="text-gray-500">{formatPoints(target().pointsRequired)} pts</span>
                          <span class="text-amber-400">{formatPoints(config.agiReward)} $AGI</span>
                        </div>
                      </div>
                    )
                  }}
                </Show>
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
                <Show when={currentShip().state === 'idle' && explorationTarget()}>
                  <button
                    onClick={() => {
                      const target = explorationTarget()
                      if (target) {
                        // Use travelToSynapse for the full flow: travel then auto-explore
                        shipStore.travelToSynapse(currentShip().id, target.id, currentShip().currentPointsPerMin || 100)
                      }
                    }}
                    class="flex-1 py-1.5 rounded bg-teal-500/20 border border-teal-500/30 text-teal-400 text-xs font-medium hover:bg-teal-500/30 flex items-center justify-center gap-1"
                  >
                    <Play class="w-3 h-3" />
                    Travel & Explore
                  </button>
                </Show>

                <Show when={currentShip().state === 'exploring'}>
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
