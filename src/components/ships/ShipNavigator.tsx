import { Show, For, createMemo } from 'solid-js'
import { ChevronDown, ChevronUp, Ship as ShipIcon, Compass, Eye, EyeOff, Plus, LayoutGrid } from 'lucide-solid'
import { shipStore, type Ship } from '@/stores/shipStore'
import { userStore } from '@/stores/userStore'
import { uiStore } from '@/stores/uiStore'
import { SHIP_STATUS_COLORS } from '@/constants/colors'

interface ShipNavigatorProps {
  onFocusShip: (ship: Ship) => void
  onCreateShip: () => void
  onOpenSwitcher: () => void
  isExpanded: boolean
  onToggle: () => void
}

/**
 * ShipNavigator - Compact ship navigation panel for the dashboard overlay
 * Shows list of ships with click-to-navigate functionality
 */
export function ShipNavigator(props: ShipNavigatorProps) {
  // Access userShips directly from store getter - SolidJS tracks the dependency
  // The spread creates a new array reference to ensure reactivity on state changes
  const userShips = createMemo(() => {
    const ships = shipStore.userShips
    // Creating a new array with spread ensures SolidJS detects changes to individual ship properties
    return Array.isArray(ships) ? [...ships] : []
  })

  const idleCount = createMemo(() => userShips().filter(s => s.state === 'idle').length)
  const activeCount = createMemo(() => userShips().filter(s => s.state !== 'idle').length)

  // Get status badge color and text
  const getStatusStyle = (state: Ship['state']) => {
    const config = SHIP_STATUS_COLORS[state] || SHIP_STATUS_COLORS.idle
    return { bg: config.badgeClass.split(' ')[0], text: config.textClass, label: config.label }
  }

  return (
    <div class="pointer-events-auto">
      {/* Header - always visible */}
      <div class="flex items-center gap-1">
        <button
          onClick={props.onToggle}
          class="flex-1 flex items-center justify-between px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700 hover:bg-black/70 transition-colors"
        >
          <div class="flex items-center gap-2">
            <ShipIcon class="h-4 w-4 text-teal-400" />
            <span class="text-sm font-medium text-white">Ships</span>
            <span class="text-xs text-gray-400">
              {activeCount()}/{userShips().length}
            </span>
          </div>
          <Show when={props.isExpanded} fallback={<ChevronDown class="h-4 w-4 text-gray-400" />}>
            <ChevronUp class="h-4 w-4 text-gray-400" />
          </Show>
        </button>

        {/* Ship Switcher button */}
        <button
          onClick={props.onOpenSwitcher}
          class="p-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700 hover:bg-black/70 hover:border-teal-500/50 transition-colors"
          title="Open ship switcher"
        >
          <LayoutGrid class="h-4 w-4 text-gray-400 hover:text-teal-400" />
        </button>
      </div>

      {/* Expanded panel */}
      <Show when={props.isExpanded}>
        <div class="mt-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700 overflow-hidden">
          {/* Show idle ships toggle */}
          <button
            onClick={() => uiStore.toggleShowIdleShips()}
            class="w-full flex items-center justify-between px-3 py-2 border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors"
          >
            <span class="text-xs text-gray-400">Show idle ships on map</span>
            <Show when={uiStore.showIdleShips} fallback={<EyeOff class="h-3 w-3 text-gray-500" />}>
              <Eye class="h-3 w-3 text-teal-400" />
            </Show>
          </button>

          {/* Ship list */}
          <div class="max-h-64 overflow-y-auto">
            <Show
              when={userShips().length > 0}
              fallback={
                <div class="p-4 text-center text-gray-500 text-sm">
                  No ships yet
                </div>
              }
            >
              <For each={userShips()}>
                {(ship) => {
                  // Wrap status in a function for SolidJS reactivity
                  // This ensures the status updates when ship.state changes
                  const status = () => getStatusStyle(ship.state)
                  return (
                    <button
                      onClick={() => props.onFocusShip(ship)}
                      class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 transition-colors text-left border-b border-gray-700/30 last:border-b-0"
                    >
                      {/* Navigate icon */}
                      <Compass class="h-4 w-4 text-gray-500 hover:text-teal-400 flex-shrink-0" />

                      {/* Ship info */}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-sm text-white truncate">{ship.name}</span>
                          <span class={`text-[10px] px-1.5 py-0.5 rounded ${status().bg} ${status().text}`}>
                            {status().label}
                          </span>
                        </div>
                        <Show when={ship.state === 'solving' && ship.currentSynapseId}>
                          <p class="text-[10px] text-gray-500 truncate">
                            Synapse: {ship.currentSynapseId?.slice(0, 8)}...
                          </p>
                        </Show>
                      </div>

                      {/* Autopilot indicator */}
                      <Show when={ship.autopilotEnabled}>
                        <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" title="Autopilot" />
                      </Show>
                    </button>
                  )
                }}
              </For>
            </Show>
          </div>

          {/* Create Ship Button */}
          <Show when={userShips().length < userStore.maxShips}>
            <div class="px-3 py-2 border-t border-gray-700/50">
              <button
                onClick={props.onCreateShip}
                class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-400 text-xs font-medium hover:bg-teal-500/30 transition-colors"
              >
                <Plus class="h-3 w-3" />
                Create Ship
              </button>
            </div>
          </Show>

          {/* Summary */}
          <div class="px-3 py-2 border-t border-gray-700/50 bg-gray-800/30">
            <div class="flex justify-between text-xs">
              <span class="text-gray-500">Active: <span class="text-teal-400 font-medium">{activeCount()}</span></span>
              <span class="text-gray-500">Idle: <span class="text-gray-400 font-medium">{idleCount()}</span></span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default ShipNavigator
