/**
 * CreateShipScreen - Full-screen overlay for creating new ships
 *
 * Matches the DeploymentScreen's cinematic style with:
 * - 3D turntable ship preview
 * - Bottom ship-type carousel with arrow navigation
 * - Stat bars, cost badge, name input
 */

import { type Component, createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js'
import { X, Zap, Gauge, Fuel, Radio, ChevronLeft, ChevronRight, Rocket, Shuffle, AlertCircle } from 'lucide-solid'
import { ShipPreview3D } from './ShipPreview3D'
import { shipStore } from '@/stores/shipStore'
import { configStore } from '@/stores/configStore'
import { userStore } from '@/stores/userStore'
import { cn } from '@/lib/utils'
import { formatPoints } from '@/types/game'
import type { ShipTypeDTO } from '@/types/api.generated'

// Random name generator for ships
const NAME_PREFIXES = [
  'Nexus', 'Void', 'Quantum', 'Cipher', 'Nova', 'Pulse', 'Echo', 'Phantom',
  'Apex', 'Zenith', 'Flux', 'Prism', 'Helix', 'Vector', 'Orbit', 'Synth',
  'Neuro', 'Axiom', 'Astra', 'Cosmo', 'Drift', 'Spark', 'Shade', 'Bolt',
  'Cryo', 'Pyro', 'Terra', 'Aqua', 'Aero', 'Lumen', 'Umbra', 'Spectra'
]

const NAME_SUFFIXES = [
  'Alpha', 'Prime', 'Core', 'X', 'Zero', 'One', 'Neo', 'Max',
  'Runner', 'Seeker', 'Walker', 'Scout', 'Hunter', 'Diver', 'Glider', 'Dash',
  'Mind', 'Soul', 'Spirit', 'Wave', 'Storm', 'Blaze', 'Frost', 'Tide',
  'Vessel', 'Cruiser', 'Voyager', 'Explorer', 'Pioneer', 'Pathfinder', 'Navigator', 'Wanderer'
]

function generateRandomName(): string {
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]
  const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]
  return `${prefix} ${suffix}`
}

/** Stat bar with gradient fill — matches DeploymentScreen */
function CreateStatBar(props: { label: string; value: number; max: number; icon: typeof Zap; suffix?: string }) {
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

export interface CreateShipScreenProps {
  onClose: () => void
}

export const CreateShipScreen: Component<CreateShipScreenProps> = (props) => {
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [name, setName] = createSignal('')
  const [isCreating, setIsCreating] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [visible, setVisible] = createSignal(false)

  let nameInputRef: HTMLInputElement | undefined

  const shipTypes = () => configStore.shipTypes
  const userPoints = () => userStore.userPoints

  const selectedType = (): ShipTypeDTO | undefined => shipTypes()[selectedIndex()]

  // Stat normalization
  const maxSpeed = () => Math.max(...shipTypes().map((t: ShipTypeDTO) => t.speedMultiplier), 1)
  const maxSolve = () => Math.max(...shipTypes().map((t: ShipTypeDTO) => t.solveSpeedMultiplier), 1)
  const maxFuel = () => Math.max(...shipTypes().map((t: ShipTypeDTO) => t.fuelCapacity), 1)
  const maxDetection = () => Math.max(...shipTypes().map((t: ShipTypeDTO) => t.detectionRadius), 1)

  const canAfford = () => {
    const type = selectedType()
    if (!type) return true
    return userPoints() >= type.creationCost
  }

  // Clamp selectedIndex when types change
  createEffect(() => {
    const types = shipTypes()
    if (selectedIndex() >= types.length && types.length > 0) {
      setSelectedIndex(types.length - 1)
    }
  })

  // Entry animation
  onMount(() => {
    requestAnimationFrame(() => setVisible(true))
  })

  // Keyboard navigation
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle arrow keys when name input is focused
      const isInputFocused = document.activeElement === nameInputRef

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (!isCreating()) props.onClose()
      } else if (e.key === 'ArrowLeft' && !isInputFocused) {
        e.preventDefault()
        setSelectedIndex(i => Math.max(0, i - 1))
        setError(null)
      } else if (e.key === 'ArrowRight' && !isInputFocused) {
        e.preventDefault()
        setSelectedIndex(i => Math.min(shipTypes().length - 1, i + 1))
        setError(null)
      } else if (e.key === 'Enter' && isInputFocused) {
        e.preventDefault()
        if (!isCreating() && name().trim() && canAfford()) {
          handleCreate()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown, true))
  })

  const handleRandomName = () => {
    setName(generateRandomName())
    setError(null)
  }

  const handleCreate = async () => {
    const trimmedName = name().trim()

    if (!trimmedName) {
      setError('Please enter a ship name')
      return
    }

    if (!canAfford()) {
      setError('Insufficient points')
      return
    }

    const type = selectedType()
    if (!type) return

    setIsCreating(true)
    setError(null)

    try {
      const ship = await shipStore.createShip(trimmedName, type.name)
      if (ship) {
        setName('')
        setSelectedIndex(0)
        setError(null)
        props.onClose()
      } else {
        setError('Failed to create ship. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ship')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div
      class={cn(
        'fixed inset-0 z-50 flex flex-col transition-all duration-200 ease-out',
        visible() ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'
      )}
      style={{ background: 'rgba(0, 0, 0, 0.92)', 'backdrop-filter': 'blur(16px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isCreating()) props.onClose() }}
    >
      {/* Top bar */}
      <div class="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => { if (!isCreating()) props.onClose() }}
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
              when={selectedType()}
              fallback={
                <div class="w-full h-full flex items-center justify-center rounded-2xl">
                  <p class="text-gray-500 text-sm">No ship types available</p>
                </div>
              }
            >
              <div class="w-full h-full rounded-2xl overflow-hidden">
                <ShipPreview3D
                  shipType={selectedType()!.name}
                  class="w-full h-full"
                />
              </div>
            </Show>
          </div>

          {/* Right: Info panel */}
          <div class="w-80 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Type name + description */}
            <Show when={selectedType()}>
              {(type) => (
                <div>
                  <h2 class="text-2xl font-bold text-white">{type().displayName}</h2>
                  <div class="flex items-center gap-2 mt-1">
                    <span class={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-md',
                      type().creationCost === 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : canAfford()
                          ? 'bg-teal-500/15 text-teal-400'
                          : 'bg-red-500/15 text-red-400'
                    )}>
                      {type().creationCost === 0 ? 'FREE' : `${type().creationCost} pts`}
                    </span>
                  </div>
                  <Show when={type().description}>
                    <p class="text-sm text-gray-500 mt-2 leading-relaxed">{type().description}</p>
                  </Show>
                </div>
              )}
            </Show>

            {/* Stat bars */}
            <Show when={selectedType()}>
              {(type) => (
                <div>
                  <h3 class="text-[11px] uppercase tracking-wider text-gray-600 font-medium mb-2">Stats</h3>
                  <div class="space-y-2">
                    <CreateStatBar label="Speed" value={type().speedMultiplier} max={maxSpeed()} icon={Zap} />
                    <CreateStatBar label="Solve" value={type().solveSpeedMultiplier} max={maxSolve()} icon={Gauge} />
                    <CreateStatBar label="Fuel" value={type().fuelCapacity} max={maxFuel()} icon={Fuel} suffix="units" />
                    <CreateStatBar label="Detect" value={type().detectionRadius} max={maxDetection()} icon={Radio} />
                  </div>
                </div>
              )}
            </Show>

            {/* Name input */}
            <div>
              <h3 class="text-[11px] uppercase tracking-wider text-gray-600 font-medium mb-2">Ship Name</h3>
              <div class="flex gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name()}
                  onInput={(e) => {
                    setName(e.currentTarget.value)
                    setError(null)
                  }}
                  placeholder="Enter ship name..."
                  disabled={isCreating()}
                  class={cn(
                    'flex-1 h-10 px-3 rounded-xl',
                    'bg-white/[0.03] border border-white/10',
                    'text-white text-sm',
                    'placeholder:text-gray-600',
                    'focus:outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/20',
                    'transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                />
                <button
                  type="button"
                  onClick={handleRandomName}
                  disabled={isCreating()}
                  class={cn(
                    'h-10 w-10 rounded-xl shrink-0',
                    'bg-white/[0.03] border border-white/10',
                    'text-gray-500',
                    'hover:text-teal-400 hover:border-teal-500/50 hover:bg-teal-500/10',
                    'transition-all duration-200',
                    'flex items-center justify-center',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  title="Generate random name"
                >
                  <Shuffle class="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Error message */}
            <Show when={error()}>
              <div class="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertCircle class="h-4 w-4 text-red-400 shrink-0" />
                <p class="text-sm text-red-400">{error()}</p>
              </div>
            </Show>

            {/* Points balance */}
            <div class="flex items-center justify-between px-1">
              <span class="text-xs text-gray-500">Your balance</span>
              <span class="text-sm font-semibold text-amber-400">{formatPoints(userStore.userPoints)} $AGI</span>
            </div>

            {/* Create button */}
            <button
              class={cn(
                'w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
                'flex items-center justify-center gap-2',
                !name().trim() || !canAfford() || isCreating()
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-teal-400 text-black hover:from-teal-400 hover:to-teal-300 hover:shadow-lg hover:shadow-teal-500/25'
              )}
              disabled={!name().trim() || !canAfford() || isCreating()}
              onClick={handleCreate}
            >
              <Rocket class="h-4 w-4" />
              {isCreating()
                ? 'Creating...'
                : selectedType()?.creationCost
                  ? `Create Ship (${selectedType()!.creationCost} pts)`
                  : 'Create Ship'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom carousel: ship type selector */}
      <div class="px-6 pb-6">
        <Show
          when={shipTypes().length > 0}
          fallback={
            <div class="flex items-center justify-center py-4">
              <p class="text-sm text-gray-600">No ship types available</p>
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
              onClick={() => { setSelectedIndex(i => Math.max(0, i - 1)); setError(null) }}
            >
              <ChevronLeft class="h-5 w-5" />
            </button>

            {/* Type cards */}
            <div class="flex-1 overflow-x-auto flex gap-2 py-1 px-1" style={{ 'scroll-snap-type': 'x mandatory' }}>
              <For each={shipTypes()}>
                {(type: ShipTypeDTO, index) => {
                  const isSelected = () => index() === selectedIndex()
                  const affordable = () => userPoints() >= type.creationCost
                  return (
                    <button
                      class={cn(
                        'shrink-0 px-4 py-2.5 rounded-xl border transition-all duration-200 text-left',
                        'min-w-[160px]',
                        isSelected()
                          ? 'border-teal-500/60 bg-teal-500/10 scale-105 shadow-lg shadow-teal-500/10'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                      )}
                      style={{ 'scroll-snap-align': 'center' }}
                      onClick={() => { setSelectedIndex(index()); setError(null) }}
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
                          {type.displayName}
                        </span>
                      </div>
                      <p class="text-[10px] mt-0.5 ml-4">
                        <span class={cn(
                          type.creationCost === 0
                            ? 'text-emerald-500'
                            : affordable()
                              ? 'text-gray-500'
                              : 'text-red-400'
                        )}>
                          {type.creationCost === 0 ? 'FREE' : `${type.creationCost} pts`}
                        </span>
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
                selectedIndex() < shipTypes().length - 1 ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'
              )}
              disabled={selectedIndex() >= shipTypes().length - 1}
              onClick={() => { setSelectedIndex(i => Math.min(shipTypes().length - 1, i + 1)); setError(null) }}
            >
              <ChevronRight class="h-5 w-5" />
            </button>
          </div>
        </Show>
      </div>
    </div>
  )
}
