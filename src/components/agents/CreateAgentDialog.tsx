import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Shuffle, Sparkles, Fuel } from 'lucide-react'
import { useConfigStore } from '@/stores/configStore'
import type { AgentTrait, TraitType } from '@/types/agent'
import { TRAIT_EFFECTS } from '@/types/agent'
import { Button } from '@/components/ui/button'
import { RippleButton } from '@/components/ui/RippleButton'
import { cn } from '@/lib/utils'

// Trait colors
const TRAIT_COLORS: Record<TraitType, string> = {
  explorer: 'bg-[hsl(var(--tier-trait))]/20 text-[hsl(var(--tier-trait))] border-[hsl(var(--tier-trait))]/30',
  solver: 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))] border-[hsl(var(--tier-legendary))]/30',
  swift: 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30',
  efficient: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  pioneer: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30',
  networker: 'bg-[hsl(var(--tier-team))]/20 text-[hsl(var(--tier-team))] border-[hsl(var(--tier-team))]/30',
  beacon: 'bg-[hsl(var(--tier-mythic))]/20 text-[hsl(var(--tier-mythic))] border-[hsl(var(--tier-mythic))]/30',
  lucky: 'bg-[hsl(var(--tier-legendary))]/20 text-[hsl(var(--tier-legendary))] border-[hsl(var(--tier-legendary))]/30',
  collaborative: 'bg-[hsl(var(--tier-team))]/20 text-[hsl(var(--tier-team))] border-[hsl(var(--tier-team))]/30',
  trance: 'bg-[hsl(var(--tier-trait))]/20 text-[hsl(var(--tier-trait))] border-[hsl(var(--tier-trait))]/30',
  staker: 'bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/30',
}

// Random name generator
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
  'Bot', 'Unit', 'Node', 'Link', 'Byte', 'Bit', 'Chip', 'Grid'
]

function generateRandomName(): string {
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]
  const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]
  return `${prefix}${suffix}`
}

export interface CreateAgentDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, traits: AgentTrait[]) => void
  userPoints: number
}

/**
 * CreateAgentDialog - Dialog for creating new agents with traits
 */
export function CreateAgentDialog({
  isOpen,
  onClose,
  onCreate,
  userPoints,
}: CreateAgentDialogProps) {
  const config = useConfigStore()
  const [name, setName] = useState('')
  const [selectedTraits, setSelectedTraits] = useState<AgentTrait[]>([])

  const allTraits: TraitType[] = ['explorer', 'solver', 'swift', 'efficient', 'pioneer', 'networker', 'beacon', 'lucky', 'collaborative', 'trance', 'staker']

  const handleRandomName = () => {
    setName(generateRandomName())
  }

  const toggleTrait = (type: TraitType) => {
    const existing = selectedTraits.find(t => t.type === type)
    if (existing) {
      setSelectedTraits(selectedTraits.filter(t => t.type !== type))
    } else if (selectedTraits.length < 3) {
      setSelectedTraits([...selectedTraits, { type, level: 1 }])
    }
  }

  const totalCost = config.calculateAgentCost(selectedTraits)
  const canAfford = userPoints >= totalCost

  const handleCreate = () => {
    if (name.trim() && canAfford) {
      onCreate(name.trim(), selectedTraits)
      setName('')
      setSelectedTraits([])
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[hsl(var(--tier-mythic))]/20 to-[hsl(var(--tier-trait))]/20 rounded-2xl blur-lg" />

        <div className="relative glass-strong border border-[var(--border)] rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] shadow-lg glow-primary">
              <Plus className="h-6 w-6 text-[hsl(var(--primary-foreground))]" />
            </div>
            <div className="flex-1">
              <h2 className="text-title text-[var(--text-primary)]">Create Agent</h2>
              <p className="text-sm">Build your neural exploration bot</p>
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-[var(--border)]" />

          {/* Name input */}
          <div className="space-y-4">
            <label htmlFor="agent-name" className="text-xs uppercase tracking-wider block">Agent Name</label>
            <div className="flex gap-4">
              <input
                id="agent-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter agent name..."
                className="flex-1 h-12 px-4 rounded-xl bg-[var(--background-primary)] border border-[var(--border)] text-[var(--text-primary)] text-base placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[hsl(var(--ring))] focus:ring-2 focus:ring-[hsl(var(--ring))]/20 transition-all"
              />
              <button
                type="button"
                onClick={handleRandomName}
                className="h-12 w-12 rounded-xl bg-[var(--background-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--primary))]/10 transition-all flex items-center justify-center"
                title="Generate random name"
              >
                <Shuffle className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-[var(--border)]" />

          {/* Trait selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider">Select Traits</label>
              <span className="text-xs font-semibold px-2 py-1 rounded-md bg-[var(--muted)] text-[var(--text-secondary)]">
                {selectedTraits.length}/3 Selected
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-4">
              {allTraits.map((type) => {
                const isSelected = selectedTraits.some(t => t.type === type)
                return (
                  <RippleButton
                    key={type}
                    onClick={() => toggleTrait(type)}
                    disabled={!isSelected && selectedTraits.length >= 3}
                    className={cn(
                      'relative p-4 rounded-xl border text-left transition-all overflow-hidden',
                      isSelected
                        ? `${TRAIT_COLORS[type]} border-current shadow-md`
                        : selectedTraits.length >= 3
                          ? 'border-[var(--border)] text-[var(--text-muted)] opacity-50 cursor-not-allowed'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--primary))]/5'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-current/20 flex items-center justify-center pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-current" />
                      </div>
                    )}
                    <div className="text-lg font-semibold capitalize">{type}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">{TRAIT_EFFECTS[type].effectPerLevel}</div>
                  </RippleButton>
                )
              })}
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-[var(--border)]" />

          {/* Cost display */}
          <div className={cn('p-6 rounded-xl border', canAfford
            ? 'bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30'
            : 'bg-[hsl(var(--destructive))]/10 border-[hsl(var(--destructive))]/30'
          )}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Fuel className={cn('h-5 w-5', canAfford ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]')} />
                <div>
                  <p className="text-xs uppercase tracking-wider">Creation Cost</p>
                  <p className={cn('text-2xl font-bold tabular-nums', canAfford ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]')}>
                    {totalCost} pts
                  </p>
                </div>
              </div>
              {canAfford ? (
                <span className="text-xs font-semibold px-3 py-2 rounded-md bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
                  Can Afford
                </span>
              ) : (
                <span className="text-xs font-semibold px-3 py-2 rounded-md bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">
                  Need {totalCost - userPoints} more
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl text-base"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl text-base bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] hover:opacity-90 shadow-lg glow-primary"
              onClick={handleCreate}
              disabled={!name.trim() || !canAfford}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
