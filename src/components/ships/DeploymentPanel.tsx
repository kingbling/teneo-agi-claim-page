import { Show, For, createMemo, createEffect, onCleanup, on } from 'solid-js'
import { X, Target, ChevronDown, Loader2, AlertCircle } from 'lucide-solid'
import { shipStore, userStore } from '@/stores'
import {
  SYNAPSE_CONFIG,
  SYNAPSE_TYPE_COLORS,
  formatPoints,
  formatETA,
  getSynapseTypeLabel,
  type SynapseType,
} from '@/types/game'
import { getDominantSynapseType } from '@/utils/synapseUtils'
import { log, fmt } from '@/utils/logger'

// Helper to get brain region from position
function getRegionFromPosition(x: number, y: number, z: number): string {
  // Simplified region detection - can be expanded based on brain region bounds
  if (y > 0.3) return 'Cortex'
  if (y < -0.3) return 'Cerebellum'
  if (z > 0.3) return 'Frontal Lobe'
  if (z < -0.3) return 'Occipital Lobe'
  return 'Core'
}

interface DeploymentPanelProps {
  onClose?: () => void
  onDeployStart?: (shipId: string) => void
}

/**
 * DeploymentPanel - Unified panel for synapse deployment
 *
 * Replaces both the deployment dialog (modal) and ExplorePrompt (floating)
 * Shows synapse info, ship selector, and deploy/cancel actions
 */
export function DeploymentPanel(props: DeploymentPanelProps) {
  const deployState = () => shipStore.deploymentState
  const cluster = () => deployState().targetCluster
  const synapse = () => deployState().targetSynapse
  const selectedShipId = () => deployState().selectedShipId
  const error = () => deployState().error
  const isDeploying = () => deployState().mode === 'deploying'

  // Get idle ships for the dropdown
  const idleShips = createMemo(() => shipStore.idleShips)

  // Auto-select first idle ship when panel opens or ships change
  // Track all relevant dependencies including selectedShipId
  createEffect(on(
    () => [idleShips(), deployState().mode, deployState().selectedShipId] as const,
    ([ships, mode, currentShipId]) => {
      // Only auto-select when in selecting mode and no ship is selected
      if (mode === 'selecting' && ships.length > 0 && !currentShipId) {
        shipStore.selectShipForDeployment(ships[0].id)
      }
    },
    { defer: false } // Run immediately on mount
  ))

  // Keyboard handler for Escape
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        shipStore.cancelDeployment()
        props.onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown))
  })

  // Get synapse type info
  const dominantType = createMemo((): SynapseType => {
    const c = cluster()
    return c ? getDominantSynapseType(c.typeCounts) : 'minor'
  })

  const config = createMemo(() => SYNAPSE_CONFIG[dominantType()])
  const typeColor = createMemo(() => SYNAPSE_TYPE_COLORS[dominantType()])

  // Lock status
  const unlockLevel = createMemo(() => config().unlockUserLevel)
  const isLocked = createMemo(() => userStore.userLevel < unlockLevel())

  // Region name from position
  const regionName = createMemo(() => {
    const c = cluster()
    return c ? getRegionFromPosition(c.positionX, c.positionY, c.positionZ) : 'Unknown'
  })

  // Check if synapse is completed
  const isCompleted = createMemo(() => {
    const s = synapse()
    return s?.state === 'discovered'
  })

  // Selected ship object
  const selectedShip = createMemo(() => {
    const id = selectedShipId()
    return id ? shipStore.userShips.find(s => s.id === id) : null
  })

  // Can deploy?
  const canDeploy = createMemo(() => {
    return !isLocked() && !isCompleted() && idleShips().length > 0 && selectedShipId() !== null
  })

  // Handle deploy button click
  const handleDeploy = async () => {
    // Get the ship ID BEFORE deployment so we can start camera follow immediately
    const shipId = selectedShipId()
    if (!shipId) return

    log.deploy.critical('Starting deployment for ship:', fmt.shortId(shipId))

    // Notify parent to start camera follow BEFORE the API call
    // This ensures the 3D model is visible from the very start of travel
    props.onDeployStart?.(shipId)

    const success = await shipStore.confirmDeployment()

    log.deploy.info('Deployment result:', success)

    if (success) {
      // Log ship state after deployment
      const ship = shipStore.userShips.find(s => s.id === shipId)
      log.deploy.success('Ship after deployment:', {
        state: ship?.state,
        startPos: fmt.pos(ship?.startPositionX, ship?.startPositionY, ship?.startPositionZ),
        targetPos: fmt.pos(ship?.targetPositionX, ship?.targetPositionY, ship?.targetPositionZ),
        travelDuration: fmt.ms(ship?.travelDuration),
      })

      props.onClose?.()
    }
  }

  // Handle cancel
  const handleCancel = () => {
    shipStore.cancelDeployment()
    props.onClose?.()
  }

  return (
    <Show when={cluster()}>
      <div class="pointer-events-auto w-80 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 shadow-2xl text-sm overflow-hidden">
        {/* Header */}
        <div
          class="px-4 py-3 border-b border-gray-700/50 flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, rgba(${Math.round(typeColor().r * 255)}, ${Math.round(typeColor().g * 255)}, ${Math.round(typeColor().b * 255)}, 0.15), transparent)`,
          }}
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: `rgba(${Math.round(typeColor().r * 255)}, ${Math.round(typeColor().g * 255)}, ${Math.round(typeColor().b * 255)}, 0.2)`,
                border: `2px solid rgba(${Math.round(typeColor().r * 255)}, ${Math.round(typeColor().g * 255)}, ${Math.round(typeColor().b * 255)}, 0.6)`,
              }}
            >
              <Target class="w-5 h-5" style={{ color: `rgb(${Math.round(typeColor().r * 255)}, ${Math.round(typeColor().g * 255)}, ${Math.round(typeColor().b * 255)})` }} />
            </div>
            <div>
              <h3 class="font-semibold text-white">{getSynapseTypeLabel(dominantType())} Synapse</h3>
              <p class="text-xs text-gray-400">{regionName()}</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            class="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div class="p-4 space-y-4">
          {/* Synapse info grid */}
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <p class="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Synapses</p>
              <p class="text-base font-semibold text-white">{cluster()!.synapseCount}</p>
            </div>
            <div class="p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <p class="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Exploring</p>
              <p class="text-base font-semibold text-yellow-400">{cluster()!.beingExploredCount || 0}</p>
            </div>
            <div class="p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <p class="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Points</p>
              <p class="text-base font-semibold text-cyan-400">{formatPoints(config().points)}</p>
            </div>
            <div class="p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <p class="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">ETA</p>
              <p class="text-base font-semibold text-purple-400">{formatETA(config().etaMinutes)}</p>
            </div>
          </div>

          {/* Rewards */}
          <div class="p-3 rounded-lg bg-gradient-to-r from-amber-900/20 to-purple-900/20 border border-amber-500/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Reward</p>
                <p class="text-lg font-bold text-amber-400">{formatPoints(config().agiReward)} <span class="text-sm font-normal text-gray-400">$AGI</span></p>
              </div>
              <div class="px-2 py-1 rounded text-xs font-medium" classList={{
                'bg-green-500/20 text-green-400': config().distribution === 'fair_share',
                'bg-amber-500/20 text-amber-400': config().distribution === 'lottery',
              }}>
                {config().distribution === 'fair_share' ? 'Fair Share' : 'Lottery'}
              </div>
            </div>
          </div>

          {/* Lock warning */}
          <Show when={isLocked()}>
            <div class="p-3 rounded-lg bg-red-900/20 border border-red-500/30 flex items-center gap-2">
              <AlertCircle class="w-4 h-4 text-red-400 flex-shrink-0" />
              <p class="text-sm text-red-400">
                Requires Level {unlockLevel()} (You: L{userStore.userLevel})
              </p>
            </div>
          </Show>

          {/* Completed warning */}
          <Show when={isCompleted()}>
            <div class="p-3 rounded-lg bg-green-900/20 border border-green-500/30 flex items-center gap-2">
              <Target class="w-4 h-4 text-green-400 flex-shrink-0" />
              <p class="text-sm text-green-400">This synapse has been completed</p>
            </div>
          </Show>

          {/* Ship selector */}
          <Show when={!isLocked() && !isCompleted()}>
            <div class="space-y-2">
              <label class="text-xs text-gray-400 uppercase tracking-wider">Select Ship</label>
              <Show when={idleShips().length > 0} fallback={
                <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 text-center">
                  <p class="text-sm text-gray-400">No idle ships available</p>
                  <p class="text-xs text-gray-500 mt-1">All ships are currently deployed</p>
                </div>
              }>
                <div class="relative">
                  <select
                    class="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20"
                    value={selectedShipId() || ''}
                    onChange={(e) => shipStore.selectShipForDeployment(e.currentTarget.value || null)}
                  >
                    <Show when={!selectedShipId()}>
                      <option value="" disabled>Choose a ship...</option>
                    </Show>
                    <For each={idleShips()}>
                      {(ship) => (
                        <option value={ship.id}>{ship.name}</option>
                      )}
                    </For>
                  </select>
                  <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>

                {/* Selected ship stats */}
                <Show when={selectedShip()}>
                  <div class="flex gap-2 text-xs">
                    <div class="flex-1 p-2 rounded bg-gray-800/50 text-center">
                      <span class="text-white font-medium">{selectedShip()!.spacesDiscovered}</span>
                      <span class="text-gray-500 ml-1">found</span>
                    </div>
                    <div class="flex-1 p-2 rounded bg-gray-800/50 text-center">
                      <span class="text-amber-400 font-medium">{formatPoints(selectedShip()!.totalAgiEarned)}</span>
                      <span class="text-gray-500 ml-1">$AGI</span>
                    </div>
                  </div>
                </Show>
              </Show>
            </div>
          </Show>

          {/* Error display */}
          <Show when={error()}>
            <div class="p-3 rounded-lg bg-red-900/20 border border-red-500/30 flex items-center gap-2">
              <AlertCircle class="w-4 h-4 text-red-400 flex-shrink-0" />
              <p class="text-sm text-red-400">{error()}</p>
            </div>
          </Show>

          {/* Action buttons */}
          <div class="flex gap-2 pt-2">
            <button
              onClick={handleDeploy}
              disabled={!canDeploy() || isDeploying()}
              class="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Show when={isDeploying()} fallback={
                <>Deploy Ship</>
              }>
                <Loader2 class="w-4 h-4 animate-spin" />
                Deploying...
              </Show>
            </button>
            <button
              onClick={handleCancel}
              disabled={isDeploying()}
              class="flex-1 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}

export default DeploymentPanel
