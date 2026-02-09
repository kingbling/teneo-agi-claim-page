/**
 * ShipSwitcher - Full-screen ship detail and switching overlay
 *
 * Shows ship preview, stats, perks, and allows switching between ships
 */

import { Show, For, createSignal, createMemo, createEffect, onMount, onCleanup } from 'solid-js'
import { X, ChevronLeft, ChevronRight, Clock, Coins, Target, Check, Zap } from 'lucide-solid'
import { shipStore, type Ship } from '@/stores/shipStore'
import { ShipPreview3D } from './ShipPreview3D'
import { formatPoints } from '@/types/game'
import { SHIP_TYPE_PERKS } from '@/constants/ships'
import { SHIP_STATUS_COLORS } from '@/constants/colors'

interface ShipSwitcherProps {
  open: boolean
  onClose: () => void
  onSelectShip?: (ship: Ship) => void
}

export function ShipSwitcher(props: ShipSwitcherProps) {
  const [currentIndex, setCurrentIndex] = createSignal(0)

  const ships = createMemo(() => {
    const userShips = shipStore.userShips
    return Array.isArray(userShips) ? userShips : []
  })

  const currentShip = createMemo(() => ships()[currentIndex()] || null)

  const shipPerkInfo = createMemo(() => {
    const ship = currentShip()
    if (!ship) return null
    return SHIP_TYPE_PERKS[ship.shipType] || SHIP_TYPE_PERKS.neuron
  })

  const statusInfo = createMemo(() => {
    const ship = currentShip()
    if (!ship) return SHIP_STATUS_COLORS.idle
    return SHIP_STATUS_COLORS[ship.state] || SHIP_STATUS_COLORS.idle
  })

  // Format creation date
  const createdDate = createMemo(() => {
    const ship = currentShip()
    if (!ship?.createdAt) return 'Unknown'
    const date = new Date(ship.createdAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  })

  // Initialize current index to selected ship
  createEffect(() => {
    if (props.open && ships().length > 0) {
      const selectedId = shipStore.selectedShipId
      if (selectedId) {
        const idx = ships().findIndex(s => s.id === selectedId)
        if (idx >= 0) {
          setCurrentIndex(idx)
        }
      }
    }
  })

  // Keyboard navigation
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!props.open) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          navigatePrev()
          break
        case 'ArrowRight':
          e.preventDefault()
          navigateNext()
          break
        case 'Escape':
          e.preventDefault()
          props.onClose()
          break
        case 'Enter':
          e.preventDefault()
          handleSelect()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown))
  })

  const navigatePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : ships().length - 1))
  }

  const navigateNext = () => {
    setCurrentIndex((prev) => (prev < ships().length - 1 ? prev + 1 : 0))
  }

  const handleSelect = () => {
    const ship = currentShip()
    if (ship) {
      shipStore.selectShip(ship.id)
      props.onSelectShip?.(ship)
      props.onClose()
    }
  }

  const isCurrentlySelected = createMemo(() => {
    const ship = currentShip()
    return ship?.id === shipStore.selectedShipId
  })

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center"
        onClick={props.onClose}
      >
        <div
          class="relative w-full max-w-2xl mx-4 bg-gray-900/95 border border-gray-700 rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
            <button
              onClick={props.onClose}
              class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft class="w-5 h-5" />
              <span class="text-sm font-medium">Back</span>
            </button>

            <h2 class="text-lg font-bold text-white">MY SHIPS</h2>

            <div class="text-sm text-gray-400">
              {currentIndex() + 1}/{ships().length}
            </div>
          </div>

          {/* Ship Preview with Navigation */}
          <div class="relative">
            {/* Navigation arrows */}
            <Show when={ships().length > 1}>
              <button
                onClick={navigatePrev}
                class="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 border border-gray-600 flex items-center justify-center text-gray-300 hover:text-white hover:bg-black/80 transition-colors"
              >
                <ChevronLeft class="w-6 h-6" />
              </button>
              <button
                onClick={navigateNext}
                class="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 border border-gray-600 flex items-center justify-center text-gray-300 hover:text-white hover:bg-black/80 transition-colors"
              >
                <ChevronRight class="w-6 h-6" />
              </button>
            </Show>

            {/* 3D Preview */}
            <div class="h-56 bg-gradient-to-b from-gray-900 to-gray-950">
              <Show when={currentShip()}>
                {(ship) => (
                  <ShipPreview3D
                    shipType={ship().shipType}
                    state={ship().state}
                  />
                )}
              </Show>
            </div>

            {/* Ship name plate */}
            <Show when={currentShip()}>
              {(ship) => (
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent pt-8 pb-4 text-center">
                  <div class="flex items-center justify-center gap-3 mb-1">
                    <div class="h-px w-12 bg-gradient-to-r from-transparent to-teal-500/50" />
                    <h3 class="text-xl font-bold text-white tracking-wide">{ship().name}</h3>
                    <div class="h-px w-12 bg-gradient-to-l from-transparent to-teal-500/50" />
                  </div>
                  <p class="text-sm text-gray-400">— {shipPerkInfo()?.className} —</p>
                </div>
              )}
            </Show>
          </div>

          {/* Content */}
          <Show when={currentShip()}>
            {(ship) => (
              <div class="px-6 py-4 space-y-4">
                {/* Stats and Perks grid */}
                <div class="grid grid-cols-2 gap-4">
                  {/* Stats */}
                  <div class="space-y-2">
                    <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stats</h4>
                    <div class="space-y-1.5">
                      <div class="flex items-center gap-2 text-sm">
                        <Target class="w-3.5 h-3.5 text-teal-400" />
                        <span class="text-gray-400">Discovered:</span>
                        <span class="text-white font-medium">{ship().spacesDiscovered}</span>
                      </div>
                      <div class="flex items-center gap-2 text-sm">
                        <Coins class="w-3.5 h-3.5 text-amber-400" />
                        <span class="text-gray-400">$AGI Earned:</span>
                        <span class="text-white font-medium">{formatPoints(ship().totalAgiEarned)}</span>
                      </div>
                      <div class="flex items-center gap-2 text-sm">
                        <div class={`w-2 h-2 rounded-full ${statusInfo().barClass}`} />
                        <span class="text-gray-400">Status:</span>
                        <span class={`font-medium ${statusInfo().textClass}`}>{statusInfo().label}</span>
                      </div>
                      <div class="flex items-center gap-2 text-sm">
                        <Clock class="w-3.5 h-3.5 text-gray-500" />
                        <span class="text-gray-400">Created:</span>
                        <span class="text-white font-medium">{createdDate()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ship Type Perks */}
                  <div class="space-y-2">
                    <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ship Type Perks</h4>
                    <div class="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                      <div class="flex items-center gap-2 mb-2">
                        <Zap class="w-4 h-4 text-teal-400" />
                        <span class="text-sm font-medium text-teal-300">{shipPerkInfo()?.className}</span>
                      </div>
                      <div class="space-y-1">
                        <For each={shipPerkInfo()?.perks || []}>
                          {(perk) => (
                            <div class="flex items-center gap-2 text-xs text-gray-300">
                              <perk.icon class="w-3 h-3 text-teal-400/70" />
                              <span>{perk.label}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equipped Items */}
                <div class="space-y-2">
                  <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipped Items</h4>
                  <div class="flex flex-wrap gap-2">
                    <Show
                      when={ship().equippedItems && ship().equippedItems.length > 0}
                      fallback={
                        <p class="text-sm text-gray-500 italic">No items equipped</p>
                      }
                    >
                      <For each={ship().equippedItems}>
                        {(item) => {
                          const hasExpiry = item.expiresAt !== null
                          const remainingMinutes = hasExpiry
                            ? Math.max(0, Math.floor((item.expiresAt! - Date.now()) / 60000))
                            : null

                          return (
                            <div class="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm">
                              <span class="text-purple-300">{item.itemType}</span>
                              <Show when={remainingMinutes !== null}>
                                <span class="text-purple-400/70 ml-2">
                                  {remainingMinutes}m left
                                </span>
                              </Show>
                              <Show when={!hasExpiry}>
                                <span class="text-green-400 ml-2">✓ Permanent</span>
                              </Show>
                            </div>
                          )
                        }}
                      </For>
                    </Show>
                    <button class="px-3 py-1.5 rounded-lg bg-gray-700/50 border border-gray-600 text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                      + Equip
                    </button>
                  </div>
                </div>

                {/* Select Button */}
                <div class="pt-2">
                  <button
                    onClick={handleSelect}
                    disabled={isCurrentlySelected()}
                    class={`w-full py-3 rounded-xl font-semibold text-base transition-all ${
                      isCurrentlySelected()
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 cursor-default'
                        : 'bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40'
                    }`}
                  >
                    <Show
                      when={isCurrentlySelected()}
                      fallback="Select This Ship"
                    >
                      <span class="flex items-center justify-center gap-2">
                        <Check class="w-5 h-5" />
                        Currently Selected
                      </span>
                    </Show>
                  </button>
                </div>
              </div>
            )}
          </Show>

          {/* Empty state */}
          <Show when={ships().length === 0}>
            <div class="px-6 py-12 text-center">
              <p class="text-gray-400">No ships yet. Create your first ship to get started!</p>
            </div>
          </Show>

          {/* Close button */}
          <button
            onClick={props.onClose}
            class="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Show>
  )
}

export default ShipSwitcher
