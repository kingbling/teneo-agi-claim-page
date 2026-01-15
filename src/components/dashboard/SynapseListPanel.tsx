import { createSignal, Show, For, createMemo } from 'solid-js'
import { ChevronDown, ChevronUp, Zap, Compass, Filter } from 'lucide-solid'
import { shipStore, type SynapseCluster } from '@/stores/shipStore'
import type { SynapseType } from '@/types/game'
import * as THREE from 'three'
import { constrainToBrainShape } from '../brain/core/brainConstants'

// Synapse type priority for determining dominant type
const SYNAPSE_TYPE_PRIORITY: Record<SynapseType, number> = {
  minor: 1,
  complex: 2,
  deep: 3,
  core: 4,
  rare: 5,
  legendary: 6,
  unique: 7,
}

function getDominantSynapseType(typeCounts?: Record<SynapseType, number>): SynapseType {
  if (!typeCounts) return 'minor'

  let dominantType: SynapseType = 'minor'
  let highestCount = 0

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > highestCount) {
      dominantType = type as SynapseType
      highestCount = count
    } else if (count === highestCount && count > 0) {
      if (SYNAPSE_TYPE_PRIORITY[type as SynapseType] > SYNAPSE_TYPE_PRIORITY[dominantType]) {
        dominantType = type as SynapseType
      }
    }
  }

  return dominantType
}

// Synapse types in order for filter buttons
const SYNAPSE_TYPES: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']

// Type colors for badges
const TYPE_COLORS: Record<SynapseType, { bg: string; text: string }> = {
  minor: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  complex: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  deep: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
  core: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  rare: { bg: 'bg-red-500/20', text: 'text-red-400' },
  legendary: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
  unique: { bg: 'bg-amber-400/20', text: 'text-amber-300' },
}

interface SynapseListPanelProps {
  onNavigate: (cluster: SynapseCluster, position: THREE.Vector3) => void
  isExpanded: boolean
  onToggle: () => void
  // Filter state lifted to parent for sharing with 3D scene
  filterType: SynapseType | 'all'
  onFilterChange: (type: SynapseType | 'all') => void
}

/**
 * SynapseListPanel - Shows list of explorable synapse clusters
 * Click to navigate camera to synapse location
 */
export function SynapseListPanel(props: SynapseListPanelProps) {
  const [showFilters, setShowFilters] = createSignal(false)

  // Get clusters from store (use LOD0 for most detail)
  const clusters = createMemo(() => {
    const lod0 = shipStore.synapseClustersLod0
    return Array.isArray(lod0) ? lod0 : []
  })

  // Filter clusters
  const filteredClusters = createMemo(() => {
    const all = clusters()
    const type = props.filterType

    // Return all clusters when 'all' filter is selected
    if (type === 'all') return all

    // Filter by dominant synapse type
    return all.filter(cluster => {
      const dominant = getDominantSynapseType(cluster.typeCounts)
      // Explicit string comparison to avoid type coercion issues
      return String(dominant) === String(type)
    })
  })

  // Stats
  const totalCount = createMemo(() => clusters().length)
  const exploringCount = createMemo(() =>
    clusters().filter(c => c.beingExploredCount > 0).length
  )
  const undiscoveredCount = createMemo(() =>
    clusters().filter(c => c.discoveredCount === 0).length
  )

  // Get position for navigation
  const getClusterPosition = (cluster: SynapseCluster): THREE.Vector3 => {
    const [x, y, z] = constrainToBrainShape(
      cluster.positionX,
      cluster.positionY,
      cluster.positionZ
    )
    return new THREE.Vector3(x, y, z)
  }

  // Get status style
  const getStatusStyle = (cluster: SynapseCluster) => {
    if (cluster.beingExploredCount > 0) {
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Exploring' }
    }
    if (cluster.discoveredCount > 0) {
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Partial' }
    }
    return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Undiscovered' }
  }

  return (
    <div class="pointer-events-auto">
      {/* Header */}
      <button
        onClick={props.onToggle}
        class="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700 hover:bg-black/70 transition-colors"
      >
        <div class="flex items-center gap-2">
          <Zap class="h-4 w-4 text-purple-400" />
          <span class="text-sm font-medium text-white">Synapses</span>
          <span class="text-xs text-gray-400">
            {exploringCount()}/{totalCount()}
          </span>
        </div>
        <Show when={props.isExpanded} fallback={<ChevronDown class="h-4 w-4 text-gray-400" />}>
          <ChevronUp class="h-4 w-4 text-gray-400" />
        </Show>
      </button>

      {/* Expanded panel */}
      <Show when={props.isExpanded}>
        <div class="mt-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700 overflow-hidden">
          {/* Filter toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowFilters(!showFilters())
            }}
            class="w-full flex items-center justify-between px-3 py-2 border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors"
          >
            <span class="text-xs text-gray-400">Filter by type</span>
            <Filter class={`h-3 w-3 ${showFilters() ? 'text-purple-400' : 'text-gray-500'}`} />
          </button>

          {/* Filter chips */}
          <Show when={showFilters()}>
            <div class="px-3 py-2 border-b border-gray-700/50 flex flex-wrap gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  props.onFilterChange('all')
                }}
                class={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  props.filterType === 'all'
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600/50 hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <For each={SYNAPSE_TYPES}>
                {(type) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onFilterChange(type)
                    }}
                    class={`px-2 py-0.5 rounded text-[10px] capitalize transition-colors ${
                      props.filterType === type
                        ? `${TYPE_COLORS[type].bg} ${TYPE_COLORS[type].text} border border-current/50`
                        : 'bg-gray-700/50 text-gray-400 border border-gray-600/50 hover:bg-gray-700'
                    }`}
                  >
                    {type}
                  </button>
                )}
              </For>
            </div>
          </Show>

          {/* Cluster list */}
          <div class="max-h-72 overflow-y-auto">
            <Show
              when={filteredClusters().length > 0}
              fallback={
                <div class="p-4 text-center text-gray-500 text-sm">
                  No synapses found
                </div>
              }
            >
              <For each={filteredClusters().slice(0, 50)}>
                {(cluster) => {
                  const dominantType = getDominantSynapseType(cluster.typeCounts)
                  const typeColor = TYPE_COLORS[dominantType]
                  const status = getStatusStyle(cluster)
                  const progress = cluster.synapseCount > 0
                    ? Math.round((cluster.discoveredCount / cluster.synapseCount) * 100)
                    : 0

                  return (
                    <button
                      onClick={() => props.onNavigate(cluster, getClusterPosition(cluster))}
                      class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 transition-colors text-left border-b border-gray-700/30 last:border-b-0"
                    >
                      {/* Navigate icon */}
                      <Compass class="h-4 w-4 text-gray-500 hover:text-purple-400 flex-shrink-0" />

                      {/* Cluster info */}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          {/* Type badge */}
                          <span class={`text-[10px] px-1.5 py-0.5 rounded capitalize ${typeColor.bg} ${typeColor.text}`}>
                            {dominantType}
                          </span>
                          {/* Status badge */}
                          <span class={`text-[10px] px-1.5 py-0.5 rounded ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                          <span class="text-xs text-gray-400">
                            {cluster.synapseCount} synapses
                          </span>
                          <span class="text-[10px] text-gray-500">
                            {progress}% discovered
                          </span>
                        </div>
                      </div>

                      {/* Explorer count */}
                      <Show when={cluster.beingExploredCount > 0}>
                        <span class="text-[10px] text-yellow-400 flex-shrink-0">
                          {cluster.beingExploredCount} active
                        </span>
                      </Show>
                    </button>
                  )
                }}
              </For>
            </Show>
          </div>

          {/* Summary */}
          <div class="px-3 py-2 border-t border-gray-700/50 bg-gray-800/30">
            <div class="flex justify-between text-xs">
              <span class="text-gray-500">
                Exploring: <span class="text-yellow-400 font-medium">{exploringCount()}</span>
              </span>
              <span class="text-gray-500">
                Undiscovered: <span class="text-gray-400 font-medium">{undiscoveredCount()}</span>
              </span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default SynapseListPanel
