/**
 * ShipStatusLegend - Shows current status of all user's ships
 *
 * Displays ship status in a legend format, grouped by state.
 */

import { createMemo, For, Show } from 'solid-js'
import { shipStore } from '@/stores/shipStore'
import type { Ship, ShipStatus } from '@/stores/shipStore'
import { SHIP_STATUS_COLORS, SHIP_STATUS_ORDER } from '@/constants/colors'

interface ShipStatusLegendProps {
  onShipClick?: (ship: Ship) => void
  selectedShipId?: string | null
}

export function ShipStatusLegend(props: ShipStatusLegendProps) {
  // Access userShips inside reactive contexts (memo/JSX) for proper SolidJS reactivity
  // DO NOT capture as a const outside memo - that breaks reactivity

  // Group ships by status - reads shipStore.userShips inside memo for tracking
  const shipsByStatus = createMemo(() => {
    const ships = shipStore.userShips
    if (!Array.isArray(ships)) return {} as Record<ShipStatus, Ship[]>

    const grouped: Record<ShipStatus, Ship[]> = {
      idle: [],
      deploying: [],
      exploring: [],
      returning: [],
    }

    for (const ship of ships) {
      if (grouped[ship.state]) {
        grouped[ship.state].push(ship)
      }
    }

    return grouped
  })

  const totalCount = createMemo(() => {
    const ships = shipStore.userShips
    if (!Array.isArray(ships)) return 0
    return ships.length
  })

  return (
    <div class="pointer-events-auto">
      {/* Header */}
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700">
        <span class="text-sm">🚀</span>
        <span class="text-sm text-gray-300">Fleet Status</span>
        <span class="text-xs text-gray-500">{totalCount()}</span>
      </div>

      {/* Ship List - Grouped by Status */}
      <div class="mt-2 p-3 rounded-lg bg-black/80 backdrop-blur-sm border border-gray-700 max-h-[400px] overflow-y-auto">
        <For each={SHIP_STATUS_ORDER}>
          {(status) => {
            const ships = () => shipsByStatus()[status] || []
            const statusConfig = SHIP_STATUS_COLORS[status]

            return (
              <Show when={ships().length > 0}>
                <div class="mb-3">
                  {/* Status Header */}
                  <div class="flex items-center gap-2 mb-2">
                    <span class={statusConfig.textClass}>
                      {statusConfig.icon}
                    </span>
                    <span class={`text-xs font-medium ${statusConfig.textClass}`}>
                      {statusConfig.label}
                    </span>
                    <span class="text-xs text-gray-500">• {ships().length}</span>
                  </div>

                  {/* Ships in this status */}
                  <div class="space-y-1 ml-4">
                    <For each={ships()}>
                      {(ship) => {
                        const isSelected = () => props.selectedShipId === ship.id

                        return (
                          <button
                            onClick={() => props.onShipClick && props.onShipClick(ship)}
                            class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                            classList={{
                              'bg-white/10 border border-white/20': isSelected(),
                              'hover:bg-white/5 hover:border-white/30': !isSelected(),
                            }}
                          >
                            {/* Ship Name */}
                            <span
                              class="text-xs flex-1 truncate"
                              classList={{
                                'text-white font-medium': isSelected(),
                                'text-gray-300': !isSelected(),
                              }}
                            >
                              {ship.name}
                            </span>

                            {/* Ship Details */}
                            <div class="flex items-center gap-2 text-xs text-gray-500">
                              <span>{ship.shipType || 'neuron'}</span>
                              <Show when={ship.state === 'solving' && ship.currentPointsPerMin}>
                                <span>• {ship.currentPointsPerMin} pts/min</span>
                              </Show>
                            </div>
                          </button>
                        )
                      }}
                    </For>
                  </div>
                </div>
              </Show>
            )
          }}
        </For>

        <Show when={totalCount() === 0}>
          <div class="text-center py-4 text-xs text-gray-500">
            No ships available. Create your first ship to start exploring!
          </div>
        </Show>
      </div>
    </div>
  )
}

export default ShipStatusLegend
