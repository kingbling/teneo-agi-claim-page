import { createSignal, createMemo, Show, For, type JSX } from 'solid-js'
import { Plus, Ship as ShipIcon, ChevronDown, ChevronUp, Brain, Zap } from 'lucide-solid'
import { ShipCard } from './ShipCard'
import { shipStore, type Ship } from '@/stores/shipStore'
import { userStore } from '@/stores/userStore'
import { explorationStore } from '@/stores/explorationStore'
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
export function ShipSidebar(props: ShipSidebarProps) {
  const [isCollapsed, setIsCollapsed] = createSignal(false)
  const [filter, setFilter] = createSignal<'all' | 'idle' | 'exploring'>('all')

  // Derive values from stores
  const userShips = createMemo(() => {
    const ships = shipStore.userShips
    return Array.isArray(ships) ? ships : []
  })

  const selectedShipId = () => shipStore.selectedShipId
  const maxShips = () => userStore.maxShips
  const currentExplorationSynapse = () => shipStore.currentExplorationSynapse

  // Filter ships based on state
  const filteredShips = createMemo(() => {
    const ships = userShips()
    const currentFilter = filter()
    if (currentFilter === 'all') return ships
    if (currentFilter === 'idle') return ships.filter(s => s.state === 'idle')
    if (currentFilter === 'exploring') return ships.filter(s => s.state === 'exploring')
    return ships
  })

  const idleCount = createMemo(() => userShips().filter(s => s.state === 'idle').length)
  const exploringCount = createMemo(() => userShips().filter(s => s.state === 'exploring').length)

  const handleToggleAutopilot = async (ship: Ship) => {
    await shipStore.toggleAutopilot(ship.id, !ship.autopilotEnabled)
  }

  // Get synapse type for a ship that's exploring
  const getSynapseTypeForShip = (ship: Ship): SynapseType | undefined => {
    if (ship.state !== 'exploring' || !ship.currentSynapseId) return undefined
    const synapse = currentExplorationSynapse()
    if (synapse?.id === ship.currentSynapseId) {
      return synapse.synapseType as SynapseType
    }
    return 'minor' // Default fallback
  }

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center justify-between p-4 border-b border-[var(--card-border)]/20">
        <div class="flex items-center gap-3">
          <ShipIcon class="h-5 w-5 text-[var(--brand-teal-1)]" />
          <h2 class="text-lg font-bold text-[var(--text-primary)]">Ships</h2>
          <span class="text-sm text-[var(--text-muted)]">
            {userShips().length}/{maxShips()}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed())}
          class="p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
        >
          <Show when={isCollapsed()} fallback={<ChevronUp class="h-4 w-4 text-[var(--text-muted)]" />}>
            <ChevronDown class="h-4 w-4 text-[var(--text-muted)]" />
          </Show>
        </button>
      </div>

      <Show when={!isCollapsed()}>
        <div
          class="flex flex-col flex-1 overflow-hidden transition-all duration-300"
        >
          {/* Filter Tabs */}
          <div class="flex gap-2 p-3 border-b border-[var(--card-border)]/20">
            <FilterButton
              active={filter() === 'all'}
              onClick={() => setFilter('all')}
              label="All"
              count={userShips().length}
            />
            <FilterButton
              active={filter() === 'idle'}
              onClick={() => setFilter('idle')}
              label="Idle"
              count={idleCount()}
              icon={<ShipIcon class="h-3 w-3" />}
            />
            <FilterButton
              active={filter() === 'exploring'}
              onClick={() => setFilter('exploring')}
              label="Exploring"
              count={exploringCount()}
              icon={<Brain class="h-3 w-3" />}
            />
          </div>

          {/* Ship List */}
          <div class="flex-1 overflow-y-auto p-3 space-y-3">
            <Show
              when={filteredShips().length > 0}
              fallback={
                <div class="text-center py-8">
                  <ShipIcon class="h-12 w-12 mx-auto text-[var(--text-muted)]/30 mb-3" />
                  <p class="text-sm text-[var(--text-muted)]">
                    {filter() === 'all' ? 'No ships yet' : `No ${filter()} ships`}
                  </p>
                </div>
              }
            >
              <For each={filteredShips()}>
                {(ship) => (
                  <ShipCard
                    ship={ship}
                    isSelected={selectedShipId() === ship.id}
                    currentSynapseType={getSynapseTypeForShip(ship)}
                    explorationProgress={
                      ship.currentSynapseId === currentExplorationSynapse()?.id
                        ? explorationStore.getSynapseProgress()
                        : 0
                    }
                    onSelect={() => shipStore.selectShip(ship.id)}
                    onToggleAutopilot={() => handleToggleAutopilot(ship)}
                    onStartExploration={() => props.onStartExploration(ship)}
                    onFocus={() => props.onFocusShip?.(ship)}
                  />
                )}
              </For>
            </Show>
          </div>

          {/* Create Ship Button */}
          <Show when={userShips().length < maxShips()}>
            <div class="p-3 border-t border-[var(--card-border)]/20">
              <button
                onClick={props.onCreateShip}
                class="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[hsl(var(--accent))]/20 border border-[var(--brand-teal-1)]/40 text-[var(--brand-teal-1)] font-bold text-sm hover:from-[var(--brand-teal-1)]/30 hover:to-[hsl(var(--accent))]/30 transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus class="h-4 w-4" />
                <span>Create Ship</span>
              </button>
            </div>
          </Show>

          {/* Summary Stats */}
          <div class="p-3 border-t border-[var(--card-border)]/20 bg-[var(--background-secondary)]/30">
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="flex items-center gap-2">
                <Zap class="h-3 w-3 text-[hsl(var(--accent))]" />
                <span class="text-[var(--text-muted)]">Active:</span>
                <span class="font-bold text-[hsl(var(--accent))]">{exploringCount()}</span>
              </div>
              <div class="flex items-center gap-2">
                <ShipIcon class="h-3 w-3 text-[var(--text-muted)]" />
                <span class="text-[var(--text-muted)]">Idle:</span>
                <span class="font-bold text-[var(--text-primary)]">{idleCount()}</span>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

// Filter button component
function FilterButton(props: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  icon?: JSX.Element
}) {
  return (
    <button
      onClick={props.onClick}
      class={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
        props.active
          ? 'bg-[var(--brand-teal-1)]/20 text-[var(--brand-teal-1)] border border-[var(--brand-teal-1)]/40'
          : 'bg-[var(--background-primary)] text-[var(--text-muted)] border border-[var(--card-border)]/20 hover:bg-[var(--background-secondary)]'
      )}
    >
      {props.icon}
      <span>{props.label}</span>
      <span class={cn(
        'px-1.5 py-0.5 rounded text-[10px]',
        props.active ? 'bg-[var(--brand-teal-1)]/30' : 'bg-[var(--background-secondary)]'
      )}>
        {props.count}
      </span>
    </button>
  )
}
