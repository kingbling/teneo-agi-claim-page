import { createSignal, For, Show } from 'solid-js'
import { Plus, Shuffle, Rocket, AlertCircle, Zap, Gauge, Fuel, Radio } from 'lucide-solid'
import { shipStore } from '@/stores/shipStore'
import { configStore } from '@/stores/configStore'
import { userStore } from '@/stores/userStore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
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

export interface CreateShipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Stat bar showing a value relative to max across all types */
function StatBar(props: { label: string; value: number; max: number; icon: typeof Zap }) {
  const pct = () => props.max > 0 ? Math.round((props.value / props.max) * 100) : 0
  return (
    <div class="flex items-center gap-2">
      <props.icon class="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
      <span class="text-[10px] text-[var(--text-tertiary)] w-12 shrink-0">{props.label}</span>
      <div class="flex-1 h-1.5 bg-[var(--background-tertiary)] rounded-full overflow-hidden">
        <div
          class="h-full bg-[var(--brand-teal-1)] rounded-full transition-all duration-300"
          style={{ width: `${pct()}%` }}
        />
      </div>
      <span class="text-[10px] text-[var(--text-tertiary)] w-8 text-right">{props.value.toFixed(1)}x</span>
    </div>
  )
}

/**
 * CreateShipDialog - Dialog for creating new ships with type selection
 */
export function CreateShipDialog(props: CreateShipDialogProps) {
  const [name, setName] = createSignal('')
  const [selectedType, setSelectedType] = createSignal<string>('neuron')
  const [isCreating, setIsCreating] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const shipTypes = () => configStore.shipTypes
  const userPoints = () => userStore.userPoints

  // Compute max values for stat normalization
  const maxSpeed = () => Math.max(...shipTypes().map(t => t.speedMultiplier), 1)
  const maxSolve = () => Math.max(...shipTypes().map(t => t.solveSpeedMultiplier), 1)
  const maxFuel = () => Math.max(...shipTypes().map(t => t.fuelCapacity), 1)
  const maxDetection = () => Math.max(...shipTypes().map(t => t.detectionRadius), 1)

  const selectedTypeData = () => shipTypes().find(t => t.name === selectedType())
  const canAfford = () => {
    const type = selectedTypeData()
    if (!type) return true
    return userPoints() >= type.creationCost
  }

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

    setIsCreating(true)
    setError(null)

    try {
      const ship = await shipStore.createShip(trimmedName, selectedType())
      if (ship) {
        setName('')
        setSelectedType('neuron')
        setError(null)
        props.onOpenChange(false)
      } else {
        setError('Failed to create ship. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ship')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating()) {
      setName('')
      setSelectedType('neuron')
      setError(null)
      props.onOpenChange(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleClose}>
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <div class="flex items-center gap-4">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-teal-2)] shadow-lg shadow-[var(--brand-teal-1)]/25"
            >
              <Plus class="h-6 w-6 text-[var(--brand-neutral-1)]" />
            </div>
            <div class="flex-1">
              <DialogTitle>Create Ship</DialogTitle>
              <DialogDescription>
                Choose a vessel type and name your new ship
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="space-y-5 py-4">
          {/* Ship type selector */}
          <div class="space-y-3">
            <label class="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-medium block">
              Ship Type
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
              <For each={shipTypes()}>
                {(type: ShipTypeDTO) => {
                  const isSelected = () => selectedType() === type.name
                  const affordable = () => userPoints() >= type.creationCost
                  return (
                    <button
                      type="button"
                      onClick={() => { setSelectedType(type.name); setError(null) }}
                      disabled={isCreating()}
                      class={cn(
                        'relative p-3 rounded-xl border text-left transition-all duration-200',
                        isSelected()
                          ? 'border-[var(--brand-teal-1)] bg-[var(--brand-teal-1)]/10 ring-1 ring-[var(--brand-teal-1)]/30'
                          : 'border-[var(--card-border)] bg-[var(--background-primary)] hover:border-[var(--text-tertiary)]',
                        !affordable() && !isSelected() && 'opacity-50'
                      )}
                    >
                      <div class="flex items-start justify-between mb-2">
                        <div>
                          <div class="font-medium text-sm text-[var(--text-primary)]">{type.displayName}</div>
                          <div class="text-[11px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">{type.description}</div>
                        </div>
                        <div class={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 ml-2',
                          type.creationCost === 0
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : affordable()
                              ? 'bg-[var(--brand-teal-1)]/15 text-[var(--brand-teal-1)]'
                              : 'bg-red-500/15 text-red-400'
                        )}>
                          {type.creationCost === 0 ? 'FREE' : `${type.creationCost} pts`}
                        </div>
                      </div>

                      {/* Stat bars */}
                      <div class="space-y-1 mt-2">
                        <StatBar label="Speed" value={type.speedMultiplier} max={maxSpeed()} icon={Zap} />
                        <StatBar label="Solve" value={type.solveSpeedMultiplier} max={maxSolve()} icon={Gauge} />
                        <StatBar label="Fuel" value={type.fuelCapacity / maxFuel()} max={1} icon={Fuel} />
                        <StatBar label="Detect" value={type.detectionRadius} max={maxDetection()} icon={Radio} />
                      </div>
                    </button>
                  )
                }}
              </For>
            </div>
          </div>

          {/* Name input */}
          <div class="space-y-3">
            <label
              for="ship-name"
              class="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-medium block"
            >
              Ship Name
            </label>
            <div class="flex gap-3">
              <input
                id="ship-name"
                type="text"
                value={name()}
                onInput={(e) => {
                  setName(e.currentTarget.value)
                  setError(null)
                }}
                placeholder="Enter ship name..."
                disabled={isCreating()}
                class={cn(
                  'flex-1 h-12 px-4 rounded-xl',
                  'bg-[var(--background-primary)] border border-[var(--card-border)]',
                  'text-[var(--text-primary)] text-base',
                  'placeholder:text-[var(--text-muted)]',
                  'focus:outline-none focus:border-[var(--brand-teal-1)] focus:ring-2 focus:ring-[var(--brand-teal-1)]/20',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating() && name().trim() && canAfford()) {
                    handleCreate()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleRandomName}
                disabled={isCreating()}
                class={cn(
                  'h-12 w-12 rounded-xl',
                  'bg-[var(--background-primary)] border border-[var(--card-border)]',
                  'text-[var(--text-secondary)]',
                  'hover:text-[var(--brand-teal-1)] hover:border-[var(--brand-teal-1)]/50 hover:bg-[var(--brand-teal-1)]/10',
                  'transition-all duration-200',
                  'flex items-center justify-center',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-[var(--text-secondary)] disabled:hover:border-[var(--card-border)] disabled:hover:bg-[var(--background-primary)]'
                )}
                title="Generate random name"
              >
                <Shuffle class="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Error message */}
          <Show when={error()}>
            <div class="flex items-center gap-2 p-3 rounded-lg bg-[var(--brand-red-4)]/10 border border-[var(--brand-red-4)]/30">
              <AlertCircle class="h-4 w-4 text-[var(--brand-red-4)] shrink-0" />
              <p class="text-sm text-[var(--brand-red-4)]">{error()}</p>
            </div>
          </Show>
        </div>

        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <div class="text-xs text-[var(--text-tertiary)]">
              Balance: <span class="text-[var(--text-secondary)] font-medium">{Math.floor(userPoints())} pts</span>
            </div>
            <div class="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={isCreating()}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name().trim() || isCreating() || !canAfford()}
                loading={isCreating()}
                loadingText="Creating..."
                leftIcon={<Rocket class="h-4 w-4" />}
              >
                {selectedTypeData()?.creationCost
                  ? `Create (${selectedTypeData()!.creationCost} pts)`
                  : 'Create Ship'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
