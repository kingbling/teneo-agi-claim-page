import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Shuffle, Rocket, AlertCircle } from 'lucide-react'
import { useShipStore } from '@/stores/shipStore'
import { useUserStore } from '@/stores/userStore'
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
export function CreateShipDialog({ open, onOpenChange }: CreateShipDialogProps) {
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createShip = useShipStore((state) => state.createShip)
  const userShips = useShipStore((state) => state.userShips)
  const maxShips = useUserStore((state) => state.maxShips)

  const currentShipCount = userShips.length
  const canCreateMore = currentShipCount < maxShips
  const isAtMax = currentShipCount >= maxShips

  const handleRandomName = () => {
    setName(generateRandomName())
    setError(null)
  }

  const handleCreate = async () => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Please enter a ship name')
      return
    }

    if (!canCreateMore) {
      setError('Maximum ship limit reached')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const ship = await createShip(trimmedName)
      if (ship) {
        // Success - close dialog and reset state
        setName('')
        setError(null)
        onOpenChange(false)
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
    if (!isCreating) {
      setName('')
      setError(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-teal-2)] shadow-lg shadow-[var(--brand-teal-1)]/25"
            >
              <Plus className="h-6 w-6 text-[var(--brand-neutral-1)]" />
            </motion.div>
            <div className="flex-1">
              <DialogTitle>Create Ship</DialogTitle>
              <DialogDescription>
                Launch a new exploration vessel
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Ship count indicator */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'flex items-center justify-between p-4 rounded-xl border',
              isAtMax
                ? 'bg-[var(--brand-red-4)]/10 border-[var(--brand-red-4)]/30'
                : 'bg-[var(--background-tertiary)] border-[var(--card-border)]'
            )}
          >
            <div className="flex items-center gap-3">
              <Rocket className={cn(
                'h-5 w-5',
                isAtMax ? 'text-[var(--brand-red-4)]' : 'text-[var(--brand-teal-1)]'
              )} />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Ship Fleet
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {isAtMax ? 'Fleet capacity reached' : 'Ships in your fleet'}
                </p>
              </div>
            </div>
            <div className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-bold tabular-nums',
              isAtMax
                ? 'bg-[var(--brand-red-4)]/20 text-[var(--brand-red-4)]'
                : 'bg-[var(--brand-teal-1)]/10 text-[var(--brand-teal-1)]'
            )}>
              {currentShipCount} / {maxShips}
            </div>
          </motion.div>

          {/* Name input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            <label
              htmlFor="ship-name"
              className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-medium block"
            >
              Ship Name
            </label>
            <div className="flex gap-3">
              <input
                id="ship-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                placeholder="Enter ship name..."
                disabled={isCreating || isAtMax}
                className={cn(
                  'flex-1 h-12 px-4 rounded-xl',
                  'bg-[var(--background-primary)] border border-[var(--card-border)]',
                  'text-[var(--text-primary)] text-base',
                  'placeholder:text-[var(--text-muted)]',
                  'focus:outline-none focus:border-[var(--brand-teal-1)] focus:ring-2 focus:ring-[var(--brand-teal-1)]/20',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating && canCreateMore && name.trim()) {
                    handleCreate()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleRandomName}
                disabled={isCreating || isAtMax}
                className={cn(
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
                <Shuffle className="h-5 w-5" />
              </button>
            </div>
          </motion.div>

          {/* Error message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-[var(--brand-red-4)]/10 border border-[var(--brand-red-4)]/30"
              >
                <AlertCircle className="h-4 w-4 text-[var(--brand-red-4)] shrink-0" />
                <p className="text-sm text-[var(--brand-red-4)]">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Max ships warning */}
          <AnimatePresence mode="wait">
            {isAtMax && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-[var(--brand-yellow-5)]/10 border border-[var(--brand-yellow-5)]/30"
              >
                <AlertCircle className="h-4 w-4 text-[var(--brand-yellow-5)] shrink-0" />
                <p className="text-sm text-[var(--brand-yellow-5)]">
                  Upgrade your account or level up to unlock more ship slots.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating || isAtMax}
            loading={isCreating}
            loadingText="Creating..."
            leftIcon={<Rocket className="h-4 w-4" />}
          >
            Create Ship
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
