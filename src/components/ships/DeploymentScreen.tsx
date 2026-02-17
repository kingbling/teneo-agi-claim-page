/**
 * DeploymentScreen - Gran Turismo-style full-screen ship deployment overlay
 *
 * Replaces the basic deploy dialog with a cinematic selection screen featuring:
 * - 3D turntable ship preview
 * - Horizontal ship carousel
 * - Detailed stat bars
 * - Target synapse info
 */

import { type Component, createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js'
import * as THREE from 'three'
import { X, Zap, Gauge, Fuel, Radio, ChevronLeft, ChevronRight, Rocket, Ship as ShipIcon } from 'lucide-solid'
import { ShipPreview3D } from './ShipPreview3D'
import { shipStore } from '@/stores/shipStore'
import { configStore } from '@/stores/configStore'
import { cn } from '@/lib/utils'
import {
  SYNAPSE_COLORS,
  formatPoints,
  getSynapseTypeLabel,
} from '@/types/game'
import { getDominantSynapseType } from '@/utils/synapseUtils'
import type { Ship, SynapseCluster } from '@/stores/shipStore.types'
import type { ShipTypeDTO } from '@/types/api.generated'

// Region helper (same as DiscoveryDashboard)
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'

function getRegionFromPosition(x: number, y: number, z: number): string {
  for (const region of FUNCTIONAL_BRAIN_REGIONS) {
    const b = region.bounds
    if (x >= b.xMin && x <= b.xMax &&
        y >= b.yMin && y <= b.yMax &&
        z >= b.zMin && z <= b.zMax) {
      return region.name
    }
  }
  return 'Unknown Region'
}

/** Stat bar with gradient fill for the deployment screen */
function DeployStatBar(props: { label: string; value: number; max: number; icon: typeof Zap; suffix?: string }) {
  const pct = () => props.max > 0 ? Math.round((props.value / props.max) * 100) : 0
  return (
    <div class="flex items-center gap-3">
      <props.icon class="h-4 w-4 text-gray-500 shrink-0" />
      <span class="text-[11px] uppercase tracking-wider text-gray-500 w-14 shrink-0">{props.label}</span>
      <div class="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300 transition-all duration-500"
          style={{ width: `${pct()}%` }}
        />
      </div>
      <span class="text-xs text-gray-400 w-12 text-right font-mono">
        {props.suffix ? `${props.value}` : `${props.value.toFixed(1)}x`}
      </span>
    </div>
  )
}

export interface DeploymentScreenProps {
  cluster: SynapseCluster
  position: THREE.Vector3
  onDeploy: (shipId: string) => void
  onClose: () => void
}

export const DeploymentScreen: Component<DeploymentScreenProps> = (props) => {
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [isDeploying, setIsDeploying] = createSignal(false)
  const [visible, setVisible] = createSignal(false)

  const idleShips = () => shipStore.idleShips
  const selectedShip = (): Ship | undefined => idleShips()[selectedIndex()]

  // Ship type config for stat normalization
  const shipTypes = () => configStore.shipTypes
  const maxSpeed = () => Math.max(...shipTypes().map((t: ShipTypeDTO) => t.speedMultiplier), 1)
  const maxSolve = () => Math.max(...shipTypes().map((t: ShipTypeDTO) => t.solveSpeedMultiplier), 1)
  const maxFuel = () => Math.max(...shipTypes().map((t: ShipTypeDTO) => t.fuelCapacity), 1)
  const maxDetection = () => Math.max(...shipTypes().map((t: ShipTypeDTO) => t.detectionRadius), 1)

  const selectedTypeConfig = () => {
    const ship = selectedShip()
    if (!ship) return undefined
    return shipTypes().find((t: ShipTypeDTO) => t.name === ship.shipType)
  }

  // Synapse info
  const dominantType = () => getDominantSynapseType(props.cluster.typeCounts)
  const typeConfig = () => configStore.getSynapseType(dominantType())
  const typeColor = () => SYNAPSE_COLORS[dominantType()]?.rgb || { r: 0.5, g: 0.7, b: 1.0 }
  const regionName = () => getRegionFromPosition(props.cluster.positionX, props.cluster.positionY, props.cluster.positionZ)

  // Clamp selectedIndex when idle ships change
  createEffect(() => {
    const ships = idleShips()
    if (selectedIndex() >= ships.length && ships.length > 0) {
      setSelectedIndex(ships.length - 1)
    }
  })

  // Entry animation
  onMount(() => {
    requestAnimationFrame(() => setVisible(true))
  })

  // Keyboard navigation
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        props.onClose()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(idleShips().length - 1, i + 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const ship = selectedShip()
        if (ship && !isDeploying()) {
          handleDeploy()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown, true))
  })

  const handleDeploy = async () => {
    const ship = selectedShip()
    if (!ship || isDeploying()) return

    setIsDeploying(true)
    props.onDeploy(ship.id)
  }

  const col = () => {
    const c = typeColor()
    return `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`
  }

  return (
    <div
      class={cn(
        'fixed inset-0 z-50 flex flex-col transition-all duration-200 ease-out',
        visible() ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'
      )}
      style={{ background: 'rgba(0, 0, 0, 0.92)', 'backdrop-filter': 'blur(16px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose() }}
    >
      {/* Top bar */}
      <div class="flex items-center justify-between px-6 py-4">
        <button
          onClick={props.onClose}
          class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <X class="h-5 w-5" />
          <span class="text-sm">Close</span>
        </button>
        <span class="text-xs text-gray-600 font-mono">ESC to close</span>
      </div>

      {/* Main content */}
      <div class="flex-1 flex items-center justify-center px-6 pb-4 min-h-0">
        <div class="flex gap-8 max-w-5xl w-full h-full max-h-[600px]">
          {/* Left: 3D Preview */}
          <div class="flex-1 flex items-center justify-center">
            <Show
              when={selectedShip()}
              fallback={
                <div class="w-full h-full flex items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02]">
                  <div class="text-center">
                    <ShipIcon class="h-16 w-16 text-gray-700 mx-auto mb-3" />
                    <p class="text-gray-500 text-sm">No idle ships available</p>
                    <p class="text-gray-600 text-xs mt-1">All ships are deployed</p>
                  </div>
                </div>
              }
            >
              <div class="w-full h-full rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02]">
                <ShipPreview3D
                  shipType={selectedShip()!.shipType}
                  class="w-full h-full"
                />
              </div>
            </Show>
          </div>

          {/* Right: Info panel */}
          <div class="w-80 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Ship name + type */}
            <Show when={selectedShip()}>
              {(ship) => {
                const stc = () => selectedTypeConfig()
                return (
                  <div>
                    <h2 class="text-2xl font-bold text-white">{ship().name}</h2>
                    <div class="flex items-center gap-2 mt-1">
                      <span
                        class="text-xs font-medium px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-400"
                      >
                        {stc()?.displayName || ship().shipType}
                      </span>
                    </div>
                    <Show when={stc()?.description}>
                      <p class="text-sm text-gray-500 mt-2 leading-relaxed">{stc()!.description}</p>
                    </Show>
                  </div>
                )
              }}
            </Show>

            {/* Stat bars */}
            <Show when={selectedTypeConfig()}>
              {(tc) => (
                <div>
                  <h3 class="text-[11px] uppercase tracking-wider text-gray-600 font-medium mb-2">Stats</h3>
                  <div class="space-y-2">
                    <DeployStatBar label="Speed" value={tc().speedMultiplier} max={maxSpeed()} icon={Zap} />
                    <DeployStatBar label="Solve" value={tc().solveSpeedMultiplier} max={maxSolve()} icon={Gauge} />
                    <DeployStatBar label="Fuel" value={tc().fuelCapacity} max={maxFuel()} icon={Fuel} suffix="units" />
                    <DeployStatBar label="Detect" value={tc().detectionRadius} max={maxDetection()} icon={Radio} />
                  </div>
                </div>
              )}
            </Show>

            {/* Record */}
            <Show when={selectedShip()}>
              {(ship) => (
                <div>
                  <h3 class="text-[11px] uppercase tracking-wider text-gray-600 font-medium mb-2">Record</h3>
                  <div class="flex gap-4">
                    <div class="flex-1 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p class="text-xs text-gray-500">Discovered</p>
                      <p class="text-lg font-bold text-white">{ship().spacesDiscovered}</p>
                    </div>
                    <div class="flex-1 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p class="text-xs text-gray-500">AGI Earned</p>
                      <p class="text-lg font-bold text-white">{formatPoints(ship().totalAgiEarned)}</p>
                    </div>
                  </div>
                </div>
              )}
            </Show>

            {/* Target */}
            <div>
              <h3 class="text-[11px] uppercase tracking-wider text-gray-600 font-medium mb-2">Target</h3>
              <div class="p-3 rounded-lg border border-white/5" style={{ background: `rgba(${col()}, 0.05)` }}>
                <div class="flex items-center gap-2 mb-2">
                  <div
                    class="w-3 h-3 rounded-full"
                    style={{ background: `rgb(${col()})` }}
                  />
                  <span class="text-sm font-medium text-white">
                    {getSynapseTypeLabel(dominantType())} Synapse
                  </span>
                </div>
                <p class="text-xs text-gray-500 mb-2">{regionName()}</p>
                <div class="flex gap-3 text-xs text-gray-400">
                  <span>{props.cluster.synapseCount} synapses</span>
                  <span class="text-gray-600">|</span>
                  <span>{props.cluster.beingExploredCount || 0} exploring</span>
                </div>
                <Show when={typeConfig()}>
                  <div class="mt-2 pt-2 border-t border-white/5">
                    <span class="text-xs text-gray-500">Reward: </span>
                    <span class="text-xs font-medium text-amber-400">
                      {typeConfig()!.agiRewardMin}–{typeConfig()!.agiRewardMax} $AGI
                    </span>
                  </div>
                </Show>
              </div>
            </div>

            {/* Deploy button */}
            <button
              class={cn(
                'w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
                'flex items-center justify-center gap-2',
                idleShips().length === 0 || isDeploying()
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-teal-400 text-black hover:from-teal-400 hover:to-teal-300 hover:shadow-lg hover:shadow-teal-500/25'
              )}
              disabled={idleShips().length === 0 || isDeploying()}
              onClick={handleDeploy}
            >
              <Rocket class="h-4 w-4" />
              {isDeploying() ? 'Deploying...' : idleShips().length === 0 ? 'No Idle Ships' : 'Deploy Ship'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom carousel */}
      <div class="px-6 pb-6">
        <Show
          when={idleShips().length > 0}
          fallback={
            <div class="flex items-center justify-center py-4">
              <p class="text-sm text-gray-600">No idle ships — all deployed</p>
            </div>
          }
        >
          <div class="flex items-center gap-3">
            {/* Left arrow */}
            <button
              class={cn(
                'shrink-0 p-2 rounded-lg transition-colors',
                selectedIndex() > 0 ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'
              )}
              disabled={selectedIndex() <= 0}
              onClick={() => setSelectedIndex(i => Math.max(0, i - 1))}
            >
              <ChevronLeft class="h-5 w-5" />
            </button>

            {/* Ship cards */}
            <div class="flex-1 overflow-x-auto scroll-snap-x-mandatory flex gap-2 py-1 px-1" style={{ 'scroll-snap-type': 'x mandatory' }}>
              <For each={idleShips()}>
                {(ship, index) => {
                  const isSelected = () => index() === selectedIndex()
                  const stc = () => shipTypes().find((t: ShipTypeDTO) => t.name === ship.shipType)
                  return (
                    <button
                      class={cn(
                        'shrink-0 px-4 py-2.5 rounded-xl border transition-all duration-200 text-left',
                        'scroll-snap-align-center min-w-[160px]',
                        isSelected()
                          ? 'border-teal-500/60 bg-teal-500/10 scale-105 shadow-lg shadow-teal-500/10'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                      )}
                      style={{ 'scroll-snap-align': 'center' }}
                      onClick={() => setSelectedIndex(index())}
                    >
                      <div class="flex items-center gap-2">
                        <div
                          class={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            isSelected() ? 'bg-teal-400' : 'bg-gray-600'
                          )}
                        />
                        <span class={cn(
                          'text-sm font-medium truncate',
                          isSelected() ? 'text-white' : 'text-gray-400'
                        )}>
                          {ship.name}
                        </span>
                      </div>
                      <p class="text-[10px] text-gray-600 mt-0.5 ml-4">
                        {stc()?.displayName || ship.shipType}
                      </p>
                    </button>
                  )
                }}
              </For>
            </div>

            {/* Right arrow */}
            <button
              class={cn(
                'shrink-0 p-2 rounded-lg transition-colors',
                selectedIndex() < idleShips().length - 1 ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'
              )}
              disabled={selectedIndex() >= idleShips().length - 1}
              onClick={() => setSelectedIndex(i => Math.min(idleShips().length - 1, i + 1))}
            >
              <ChevronRight class="h-5 w-5" />
            </button>
          </div>
        </Show>
      </div>
    </div>
  )
}
