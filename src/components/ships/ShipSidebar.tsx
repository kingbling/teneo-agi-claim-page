import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Ship as ShipIcon, ChevronDown, ChevronUp, Brain, Zap } from 'lucide-react'
import { ShipCard } from './ShipCard'
import { useShipStore, type Ship } from '@/stores/shipStore'
import { useUserStore } from '@/stores/userStore'
import { useExplorationStore } from '@/stores/explorationStore'
import type { SynapseType } from '@/types/game'
import { cn } from '@/lib/utils'

interface ShipSidebarProps {
  onCreateShip: () => void
  onStartExploration: (ship: Ship) => void
  onFocusShip?: (ship: Ship) => void
}

/**
 * ShipSidebar - Displays list of user's ships with actions
 * Masterplan 2026: Replaces agent-based sidebar
 */
export function ShipSidebar({
  onCreateShip,
  onStartExploration,
  onFocusShip,
}: ShipSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [filter, setFilter] = useState<'all' | 'idle' | 'exploring'>('all')

  // Granular selectors for ship store - prevents re-renders when unrelated state changes
  const userShipsRaw = useShipStore(state => state.userShips)
  const selectedShipId = useShipStore(state => state.selectedShipId)

  // Safeguard: ensure userShips is always an array
  const userShips = Array.isArray(userShipsRaw) ? userShipsRaw : []
  const selectShip = useShipStore(state => state.selectShip)
  const toggleAutopilot = useShipStore(state => state.toggleAutopilot)
  const currentExplorationSynapse = useShipStore(state => state.currentExplorationSynapse)

  // Granular selector for user store
  const maxShips = useUserStore(state => state.maxShips)

  // Granular selector for exploration store
  const getSynapseProgress = useExplorationStore(state => state.getSynapseProgress)

  // Filter ships based on state
  const filteredShips = userShips.filter(ship => {
    if (filter === 'all') return true
    if (filter === 'idle') return ship.state === 'idle'
    if (filter === 'exploring') return ship.state === 'exploring'
    return true
  })

  const idleCount = userShips.filter(s => s.state === 'idle').length
  const exploringCount = userShips.filter(s => s.state === 'exploring').length

  const handleToggleAutopilot = async (ship: Ship) => {
    await toggleAutopilot(ship.id, !ship.autopilotEnabled)
  }

  // Get synapse type for a ship that's exploring
  const getSynapseTypeForShip = (ship: Ship): SynapseType | undefined => {
    if (ship.state !== 'exploring' || !ship.currentSynapseId) return undefined
    if (currentExplorationSynapse?.id === ship.currentSynapseId) {
      return currentExplorationSynapse.synapseType as SynapseType
    }
    return 'minor' // Default fallback
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]/20">
        <div className="flex items-center gap-3">
          <ShipIcon className="h-5 w-5 text-[var(--brand-teal-1)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Ships</h2>
          <span className="text-sm text-[var(--text-muted)]">
            {userShips.length}/{maxShips}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Filter Tabs */}
            <div className="flex gap-2 p-3 border-b border-[var(--card-border)]/20">
              <FilterButton
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                label="All"
                count={userShips.length}
              />
              <FilterButton
                active={filter === 'idle'}
                onClick={() => setFilter('idle')}
                label="Idle"
                count={idleCount}
                icon={<ShipIcon className="h-3 w-3" />}
              />
              <FilterButton
                active={filter === 'exploring'}
                onClick={() => setFilter('exploring')}
                label="Exploring"
                count={exploringCount}
                icon={<Brain className="h-3 w-3" />}
              />
            </div>

            {/* Ship List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {filteredShips.length === 0 ? (
                <div className="text-center py-8">
                  <ShipIcon className="h-12 w-12 mx-auto text-[var(--text-muted)]/30 mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">
                    {filter === 'all' ? 'No ships yet' : `No ${filter} ships`}
                  </p>
                </div>
              ) : (
                filteredShips.map((ship) => (
                  <ShipCard
                    key={ship.id}
                    ship={ship}
                    isSelected={selectedShipId === ship.id}
                    currentSynapseType={getSynapseTypeForShip(ship)}
                    explorationProgress={
                      ship.currentSynapseId === currentExplorationSynapse?.id
                        ? getSynapseProgress()
                        : 0
                    }
                    onSelect={() => selectShip(ship.id)}
                    onToggleAutopilot={() => handleToggleAutopilot(ship)}
                    onStartExploration={() => onStartExploration(ship)}
                    onFocus={() => onFocusShip?.(ship)}
                  />
                ))
              )}
            </div>

            {/* Create Ship Button */}
            {userShips.length < maxShips && (
              <div className="p-3 border-t border-[var(--card-border)]/20">
                <motion.button
                  onClick={onCreateShip}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[hsl(var(--accent))]/20 border border-[var(--brand-teal-1)]/40 text-[var(--brand-teal-1)] font-bold text-sm hover:from-[var(--brand-teal-1)]/30 hover:to-[hsl(var(--accent))]/30 transition-all flex items-center justify-center gap-3"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Ship</span>
                </motion.button>
              </div>
            )}

            {/* Summary Stats */}
            <div className="p-3 border-t border-[var(--card-border)]/20 bg-[var(--background-secondary)]/30">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3 text-[hsl(var(--accent))]" />
                  <span className="text-[var(--text-muted)]">Active:</span>
                  <span className="font-bold text-[hsl(var(--accent))]">{exploringCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShipIcon className="h-3 w-3 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">Idle:</span>
                  <span className="font-bold text-[var(--text-primary)]">{idleCount}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Filter button component
function FilterButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  icon?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
        active
          ? 'bg-[var(--brand-teal-1)]/20 text-[var(--brand-teal-1)] border border-[var(--brand-teal-1)]/40'
          : 'bg-[var(--background-primary)] text-[var(--text-muted)] border border-[var(--card-border)]/20 hover:bg-[var(--background-secondary)]'
      )}
    >
      {icon}
      <span>{label}</span>
      <span className={cn(
        'px-1.5 py-0.5 rounded text-[10px]',
        active ? 'bg-[var(--brand-teal-1)]/30' : 'bg-[var(--background-secondary)]'
      )}>
        {count}
      </span>
    </button>
  )
}
