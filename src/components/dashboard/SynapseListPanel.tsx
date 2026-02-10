import { createSignal, Show, For, createMemo } from 'solid-js'
import { ChevronDown, ChevronUp, Zap, Compass, Filter, Lock } from 'lucide-solid'
import { shipStore, userStore, type SynapseCluster } from '@/stores'
import type { SynapseType, UserLevel } from '@/types/game'
import * as THREE from 'three'
import { getDominantSynapseType, isSynapseTypeLocked } from '@/utils/synapseUtils'
import { SYNAPSE_COLORS, SYNAPSE_TYPE_ORDER } from '@/constants/colors'

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
  const [showUnlockedOnly, setShowUnlockedOnly] = createSignal(false)

  // Get user level for filtering
  const userLevel = createMemo(() => userStore.userLevel || 1 as UserLevel)

  // Get clusters from store (use LOD0 for most detail)
  const clusters = createMemo(() => {
    const lod0 = shipStore.synapseClustersLod0
    let result = Array.isArray(lod0) ? lod0 : []

    // Filter by user level if unlocked only is enabled
    if (showUnlockedOnly()) {
      result = result.filter(cluster => {
        const dominantType = getDominantSynapseType(cluster.typeCounts)
        return !isSynapseTypeLocked(dominantType, userLevel())
      })
    }

    return result
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

  // Stats — single reduce pass instead of 3 separate filters
  const stats = createMemo(() => {
    const all = clusters()
    let exploring = 0
    let undiscovered = 0
    for (const c of all) {
      if (c.beingExploredCount > 0) exploring++
      if (c.discoveredCount === 0) undiscovered++
    }
    return { total: all.length, exploring, undiscovered }
  })

  // Get position for navigation
  const getClusterPosition = (cluster: SynapseCluster): THREE.Vector3 => {
    return new THREE.Vector3(cluster.positionX, cluster.positionY, cluster.positionZ)
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
            {stats().exploring}/{stats().total}
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
              <For each={SYNAPSE_TYPE_ORDER}>
                {(type) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onFilterChange(type)
                    }}
                    class={`px-2 py-0.5 rounded text-[10px] capitalize transition-colors ${
                      props.filterType === type
                        ? `${SYNAPSE_COLORS[type].tw.bg} ${SYNAPSE_COLORS[type].tw.text} border border-current/50`
                        : 'bg-gray-700/50 text-gray-400 border border-gray-600/50 hover:bg-gray-700'
                    }`}
                  >
                    {type}
                  </button>
                )}
              </For>
            </div>
            {/* Unlocked only filter */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowUnlockedOnly(!showUnlockedOnly())
              }}
              class={`mx-3 mb-2 px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                showUnlockedOnly()
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600/50 hover:bg-gray-700'
              }`}
            >
              <Lock class="h-3 w-3" />
              <span>Show unlocked only (Lvl {userLevel()}+)</span>
            </button>
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
                  const typeColor = SYNAPSE_COLORS[dominantType].tw
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
                Exploring: <span class="text-yellow-400 font-medium">{stats().exploring}</span>
              </span>
              <span class="text-gray-500">
                Undiscovered: <span class="text-gray-400 font-medium">{stats().undiscovered}</span>
              </span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default SynapseListPanel
