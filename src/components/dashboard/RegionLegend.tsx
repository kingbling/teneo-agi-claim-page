/**
 * RegionLegend - Collapsible panel showing brain regions with navigation
 *
 * Only shows regions that are enabled in the database (via configStore.enabledRegions).
 */

import { type Component, createSignal, createMemo, For, Show } from 'solid-js'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { configStore } from '@/stores/configStore'

interface RegionLegendProps {
  selectedRegionIndex: number
  onSelectRegion: (index: number) => void
}

/** Map brain_parts.name (snake_case) to brainRegions id (kebab-case) */
function nameToId(name: string): string {
  return name.replace(/_/g, '-')
}

export const RegionLegend: Component<RegionLegendProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false)

  // Compute enabled regions: only those whose id matches an enabled brain part name
  const enabledRegions = createMemo(() => {
    const enabled = configStore.enabledRegions
    if (enabled.length === 0) return []
    const enabledIds = new Set(enabled.map(nameToId))
    return FUNCTIONAL_BRAIN_REGIONS
      .map((region, index) => ({ region, originalIndex: index }))
      .filter(({ region }) => enabledIds.has(region.id))
  })

  const toggleExpand = () => setIsExpanded(!isExpanded())

  return (
    <div class="pointer-events-auto">
      {/* Toggle button */}
      <button
        onClick={toggleExpand}
        class="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700 hover:border-gray-500 transition-colors"
      >
        <span class="text-sm">🧠</span>
        <span class="text-sm text-gray-300">Regions</span>
        <span class="text-xs text-gray-500">{isExpanded() ? '▼' : '▶'}</span>
      </button>

      {/* Expanded panel */}
      <Show when={isExpanded()}>
        <div class="mt-2 p-3 rounded-lg bg-black/80 backdrop-blur-sm border border-gray-700 max-h-[400px] overflow-y-auto">
          <div class="text-xs text-gray-400 mb-2 flex justify-between items-center">
            <span>Brain Regions</span>
            <Show when={enabledRegions().length > 0}>
              <span class="text-gray-500">Press 1-{Math.min(enabledRegions().length, 9)}</span>
            </Show>
          </div>

          <Show when={enabledRegions().length === 0}>
            <p class="text-xs text-gray-500 py-2">No regions enabled yet.</p>
          </Show>

          <div class="space-y-1">
            <For each={enabledRegions()}>
              {(item, displayIndex) => {
                const isSelected = () => props.selectedRegionIndex === item.originalIndex
                const colorStyle = `rgb(${Math.round(item.region.color.r * 255)}, ${Math.round(item.region.color.g * 255)}, ${Math.round(item.region.color.b * 255)})`

                return (
                  <button
                    onClick={() => props.onSelectRegion(item.originalIndex)}
                    class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                    classList={{
                      'bg-white/10 border border-white/20': isSelected(),
                      'hover:bg-white/5': !isSelected(),
                    }}
                  >
                    {/* Color swatch */}
                    <div
                      class="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: colorStyle }}
                    />

                    {/* Region name */}
                    <span
                      class="text-xs flex-1 truncate"
                      classList={{
                        'text-white font-medium': isSelected(),
                        'text-gray-300': !isSelected(),
                      }}
                    >
                      {item.region.name}
                    </span>

                    {/* Keyboard shortcut */}
                    <Show when={displayIndex() < 9}>
                      <kbd class="text-[10px] px-1 py-0.5 rounded bg-gray-800 text-gray-500">
                        {displayIndex() + 1}
                      </kbd>
                    </Show>
                  </button>
                )
              }}
            </For>
          </div>

          {/* Clear selection button */}
          <Show when={props.selectedRegionIndex >= 0}>
            <button
              onClick={() => props.onSelectRegion(-1)}
              class="w-full mt-2 px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Clear Selection (0 or Esc)
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default RegionLegend
