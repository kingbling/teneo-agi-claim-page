import { createSignal, Show } from 'solid-js'
import { Plus, Shuffle, Rocket, AlertCircle } from 'lucide-solid'
import { shipStore } from '@/stores/shipStore'
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

/**
 * CreateShipDialog - Dialog for creating new ships (Masterplan 2026)
 * Simplified from CreateAgentDialog - no traits, just name input
 */
export function CreateShipDialog(props: CreateShipDialogProps) {
  const [name, setName] = createSignal('')
  const [isCreating, setIsCreating] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

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

    setIsCreating(true)
    setError(null)

    try {
      const ship = await shipStore.createShip(trimmedName)
      if (ship) {
        // Success - close dialog and reset state
        setName('')
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
      setError(null)
      props.onOpenChange(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleClose}>
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <div class="flex items-center gap-4">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-teal-2)] shadow-lg shadow-[var(--brand-teal-1)]/25 transition-transform duration-300"
              style={{ transform: 'scale(1)', opacity: 1 }}
            >
              <Plus class="h-6 w-6 text-[var(--brand-neutral-1)]" />
            </div>
            <div class="flex-1">
              <DialogTitle>Create Ship</DialogTitle>
              <DialogDescription>
                Launch a new exploration vessel
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="space-y-6 py-4">
          {/* Name input */}
          <div
            class="space-y-3 transition-all duration-200"
            style={{ opacity: 1, transform: 'translateY(0)' }}
          >
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
                  if (e.key === 'Enter' && !isCreating() && name().trim()) {
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
            <div
              class="flex items-center gap-2 p-3 rounded-lg bg-[var(--brand-red-4)]/10 border border-[var(--brand-red-4)]/30 transition-all duration-200"
            >
              <AlertCircle class="h-4 w-4 text-[var(--brand-red-4)] shrink-0" />
              <p class="text-sm text-[var(--brand-red-4)]">{error()}</p>
            </div>
          </Show>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isCreating()}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name().trim() || isCreating()}
            loading={isCreating()}
            loadingText="Creating..."
            leftIcon={<Rocket class="h-4 w-4" />}
          >
            Create Ship
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
