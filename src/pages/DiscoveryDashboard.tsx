/**
 * Discovery Dashboard - SolidJS Version
 *
 * Main dashboard page with 3D brain visualization.
 * Uses vanilla Three.js integration layer instead of React Three Fiber.
 */

import { type Component, createSignal, createMemo, onMount, onCleanup, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import * as THREE from 'three'
import { ThreeCanvas } from '@/three'
import { DashboardHeader, BrainSceneMinimal, BrainMinimap, QualitySettings, LoginOverlay, SynapseListPanel, type QualityPreset } from '@/components/dashboard'
import { ToastContainer } from '@/components/ui/Toast'
import { ShipNavigator } from '@/components/ships/ShipNavigator'
import { CreateShipDialog } from '@/components/ships/CreateShipDialog'
import { ShipDetailPanel } from '@/components/ships/ShipDetailPanel'
import { ExplorePrompt } from '@/components/brain/ExplorePrompt'
import { RegionLegend } from '@/components/dashboard/RegionLegend'
import type { CameraUpdate } from '@/components/dashboard/BrainSceneMinimal'
import { shipStore, userStore, uiStore } from '@/stores'
import type { Ship, SynapseCluster } from '@/stores'
import { useWebSocketConnection } from '@/hooks'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { CAMERA_CONFIG } from '@/components/brain/core/brainConstants'
import { filterByRegion } from '@/lib/regionFilter'
import {
  SYNAPSE_COLORS,
  formatPoints,
  formatETA,
  getSynapseTypeLabel,
  type SynapseType,
} from '@/types/game'
import { configStore } from '@/stores/configStore'
import { getDominantSynapseType } from '@/utils/synapseUtils'
import { log, fmt } from '@/utils/logger'

// Helper to get brain region from position
function getRegionFromPosition(x: number, y: number, z: number): string {
  for (const region of FUNCTIONAL_BRAIN_REGIONS) {
    const b = region.bounds
    if (x >= b.xMin && x <= b.xMax &&
        y >= b.yMin && y <= b.yMax &&
        z >= b.zMin && z <= b.zMax) {
      return region.name
    }
  }
  return 'Unknown Region'
}

export const DiscoveryDashboard: Component = () => {
  // UI panel state — grouped to prevent cascade re-renders between unrelated panels
  const [panels, setPanels] = createStore({
    showHelp: false,
    minimapExpanded: false,
    qualityExpanded: false,
    shipNavigatorExpanded: true,
    synapseListExpanded: false,
    showCreateShipDialog: false,
    qualityPreset: 'high' as QualityPreset,
  })

  // Zoom info for LOD management
  const [zoomInfo, setZoomInfo] = createSignal({ distance: 5, lod: 1 })

  // Follow trigger — incremented on every ship click to force re-zoom even for same ship
  const [followTrigger, setFollowTrigger] = createSignal(0)

  // Region selection state
  const [selectedRegionIndex, setSelectedRegionIndex] = createSignal<number>(-1)
  const [highlightIntensity, setHighlightIntensity] = createSignal(0)

  // Ship deployment dialog state
  const [deployTarget, setDeployTarget] = createSignal<{ cluster: SynapseCluster; position: THREE.Vector3 } | null>(null)

  // Camera position for minimap
  const [cameraPosition, setCameraPosition] = createSignal({ x: 0, y: 0, z: 5 })
  const [cameraTarget, setCameraTarget] = createSignal({ x: 0, y: 0, z: 0 })

  // Synapse type filter - shared between list panel and 3D scene
  const [synapseTypeFilter, setSynapseTypeFilter] = createSignal<SynapseType | 'all'>('all')

  // Explore prompt state (for searching ships clicking a synapse)
  const [explorePromptData, setExplorePromptData] = createSignal<{
    cluster: SynapseCluster
    worldPosition: THREE.Vector3
  } | null>(null)

  // Handle camera updates from BrainScene
  const handleCameraUpdate = (update: CameraUpdate) => {
    setCameraPosition(update.position)
    setCameraTarget(update.target)
  }

  // WebSocket connection - automatically connects on mount
  const { isConnected } = useWebSocketConnection()

  // Select LOD-appropriate clusters based on camera distance
  const lodClusters = createMemo(() => {
    const lod = zoomInfo().lod
    if (lod === 0) return shipStore.synapseClustersLod0   // ~2,500 close-up detail
    if (lod === 1) return shipStore.synapseClustersLod1   // ~200 for medium view
    return shipStore.synapseClustersLod2                    // ~8 for far view
  })

  // Filter synapse clusters by selected region
  const filteredSynapseClusters = createMemo(() =>
    filterByRegion(lodClusters(), selectedRegionIndex())
  )

  // Keyboard handler for region navigation and shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      // DEV: Ctrl+Shift+D to bypass login for testing
      if (e.ctrlKey && e.shiftKey && key === 'd') {
        e.preventDefault()
        userStore.loginUser('0xDEV0000000000000000000000000000000000001')
        return
      }

      // Number keys 1-9 for region selection
      if (key >= '1' && key <= '9') {
        const regionIndex = parseInt(key) - 1
        if (regionIndex < FUNCTIONAL_BRAIN_REGIONS.length) {
          setSelectedRegionIndex(regionIndex)
          setHighlightIntensity(1.0)
        }
        return
      }

      // 0 or Escape to clear selection
      if (key === '0' || key === 'escape') {
        setSelectedRegionIndex(-1)
        setHighlightIntensity(0)
        setPanels('showHelp', false)
        setDeployTarget(null)
        setExplorePromptData(null)
        shipStore.selectShip(null)
        return
      }

      // H for help
      if (key === 'h') {
        setPanels('showHelp', !panels.showHelp)
        return
      }

      // R for reset (clear region selection)
      if (key === 'r') {
        setSelectedRegionIndex(-1)
        setHighlightIntensity(0)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown)
    })
  })

  // Handle space/synapse click - show deploy dialog or explore prompt immediately
  const handleSpaceClick = (cluster: unknown, position: THREE.Vector3) => {
    // If already showing a dialog, close it first
    if (deployTarget()) {
      setDeployTarget(null)
    }

    // Check if we have a selected idle ship - if so, show explore prompt for travel
    const selectedShip = shipStore.selectedShip
    if (selectedShip && selectedShip.state === 'idle') {
      const clusterData = cluster as SynapseCluster
      shipStore.setExplorationTargetByPosition(
        clusterData.positionX,
        clusterData.positionY,
        clusterData.positionZ
      )
      setExplorePromptData({
        cluster: clusterData,
        worldPosition: position.clone(),
      })
      return
    }

    // No ship selected — show deploy dialog
    shipStore.selectShip(null)
    setDeployTarget({ cluster: cluster as SynapseCluster, position: position.clone() })
  }

  // Handle synapse list navigation (no-op for now, camera stays centered)
  const handleSynapseListNavigate = (_cluster: unknown, _position: THREE.Vector3) => {
    // Camera always orbits brain center — no zoom animation needed
  }

  // Handle ship click - select the ship and trigger camera follow
  const handleShipClick = (ship: Ship) => {
    log.dashboard.info('Ship clicked:', {
      id: fmt.shortId(ship.id),
      name: ship.name,
      state: ship.state,
      position: fmt.pos(ship.positionX, ship.positionY, ship.positionZ),
    })
    shipStore.selectShip(ship.id)
    setFollowTrigger(n => n + 1)
  }

  // Login handler - called when user successfully authenticates
  const handleLogin = () => {
    // User is now logged in, the UI will update automatically
  }

  return (
    <div class="w-screen h-screen bg-black overflow-hidden">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Login Overlay - shown when user is not logged in */}
      <LoginOverlay
        isOpen={!userStore.isLoggedIn}
        onLogin={handleLogin}
      />

      {/* Dashboard Header */}
      <DashboardHeader
        onHelpClick={() => setPanels('showHelp', true)}
      />

      {/* 3D Brain Visualization */}
      <ThreeCanvas
        class="w-full h-full"
        camera={{
          fov: CAMERA_CONFIG.fov,
          position: CAMERA_CONFIG.defaultPosition,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
      >
        <BrainSceneMinimal
          spaceClusters={filteredSynapseClusters()}
          agentClusters={shipStore.shipClusters}
          userAgents={shipStore.userShips}
          recentDiscoveries={shipStore.recentDiscoveries}
          setZoomInfo={setZoomInfo}
          onSpaceClick={handleSpaceClick}
          onAgentClick={handleShipClick}
          selectedRegionIndex={selectedRegionIndex()}
          highlightIntensity={highlightIntensity()}
          onCameraUpdate={handleCameraUpdate}
          showIdleShips={uiStore.showIdleShips}
          selectedShipId={shipStore.selectedShipId}
          followTrigger={followTrigger()}
          synapseTypeFilter={synapseTypeFilter() === 'all' ? null : synapseTypeFilter()}
          explorationTarget={shipStore.explorationTarget}
        />
        {/* Explore Prompt - shown when searching ship clicks a synapse */}
        <Show when={explorePromptData() && shipStore.selectedShip}>
          <ExplorePrompt
            cluster={explorePromptData()!.cluster}
            synapse={shipStore.explorationTarget}
            worldPosition={explorePromptData()!.worldPosition}
            ship={shipStore.selectedShip!}
            onConfirm={async () => {
              const ship = shipStore.selectedShip
              const target = shipStore.explorationTarget
              if (ship && target) {
                const tc = configStore.getSynapseType(target.synapseType)
                const maxPerMin = tc ? Math.max(100, tc.pointsRequired / 60) : 100
                const pointsPerMin = Math.floor(maxPerMin / 2) || 50
                const success = await shipStore.travelToSynapse(ship.id, target.id, pointsPerMin)
                if (success) {
                  setExplorePromptData(null)
                }
              }
            }}
            onCancel={() => {
              setExplorePromptData(null)
              shipStore.setExplorationTarget(null)
            }}
          />
        </Show>
      </ThreeCanvas>

      {/* Overlay UI - pointer-events-none so clicks pass through to canvas */}
      <div class="absolute inset-0 pointer-events-none">
        {/* Status bar at bottom */}
        <div class="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          {/* Connection status */}
          <div class="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700">
            <div class={`w-2 h-2 rounded-full ${isConnected() ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span class="text-sm text-gray-300">
              {isConnected() ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Controls hint */}
          <div class="pointer-events-auto px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700">
            <p class="text-sm text-gray-300">
              <span class="text-teal-400">Drag</span> to rotate •
              <span class="text-teal-400"> Scroll</span> to zoom •
              <span class="text-teal-400"> Click</span> synapses to explore
            </p>
          </div>

          {/* Zoom info */}
          <div class="pointer-events-auto px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700">
            <p class="text-sm text-gray-300">
              LOD: {zoomInfo().lod} • Distance: {zoomInfo().distance.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Stats cards, Ship Navigator, and Synapse List */}
        <div class="absolute top-16 left-4 flex flex-col gap-2 w-56">
          {/* Ship Navigator */}
          <ShipNavigator
            onFocusShip={handleShipClick}
            onCreateShip={() => setPanels('showCreateShipDialog', true)}
            isExpanded={panels.shipNavigatorExpanded}
            onToggle={() => setPanels('shipNavigatorExpanded', !panels.shipNavigatorExpanded)}
          />

          {/* Synapse List Panel */}
          <SynapseListPanel
            onNavigate={handleSynapseListNavigate}
            isExpanded={panels.synapseListExpanded}
            onToggle={() => setPanels('synapseListExpanded', !panels.synapseListExpanded)}
            filterType={synapseTypeFilter()}
            onFilterChange={setSynapseTypeFilter}
          />

          {/* Discoveries today */}
          <div class="pointer-events-auto px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-purple-500/30">
            <p class="text-xs text-gray-400">Discoveries Today</p>
            <p class="text-lg font-bold text-purple-400">
              {shipStore.recentDiscoveries.length}
            </p>
          </div>
        </div>
      </div>

      {/* Help Overlay */}
      <Show when={panels.showHelp}>
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setPanels('showHelp', false)}
        >
          <div
            class="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-bold text-white mb-4">Keyboard Shortcuts</h2>
            <div class="space-y-2 text-gray-300">
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">H</kbd> Toggle help</p>
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">R</kbd> Reset camera</p>
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">1-9</kbd> Navigate regions</p>
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">Esc</kbd> Close overlays</p>
            </div>
            <button
              class="mt-4 w-full py-2 bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-lg transition-colors"
              onClick={() => setPanels('showHelp', false)}
            >
              Close
            </button>
          </div>
        </div>
      </Show>

      {/* Enhanced Ship Deployment Dialog */}
      <Show when={deployTarget()}>
        {(() => {
          const target = deployTarget()!
          const cluster = target.cluster
          const dominantType = getDominantSynapseType(cluster.typeCounts)
          const typeConfig = configStore.getSynapseType(dominantType)
          const typeColor = SYNAPSE_COLORS[dominantType]?.rgb || { r: 0.5, g: 0.7, b: 1.0 }
          const regionName = getRegionFromPosition(cluster.positionX, cluster.positionY, cluster.positionZ)
          const isLocked = false  // No level gating
          const idleShips = shipStore.idleShips

          return (
            <div
              class="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => setDeployTarget(null)}
            >
              <div
                class="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header with synapse type */}
                <div class="flex items-center gap-3 mb-4">
                  <div
                    class="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{
                      background: `rgba(${Math.round(typeColor.r * 255)}, ${Math.round(typeColor.g * 255)}, ${Math.round(typeColor.b * 255)}, 0.2)`,
                      border: `2px solid rgba(${Math.round(typeColor.r * 255)}, ${Math.round(typeColor.g * 255)}, ${Math.round(typeColor.b * 255)}, 0.6)`,
                    }}
                  >
                    <span class="text-2xl">🧠</span>
                  </div>
                  <div>
                    <h3 class="text-lg font-bold text-white">{getSynapseTypeLabel(dominantType)} Synapse</h3>
                    <p class="text-sm text-gray-400">{regionName}</p>
                  </div>
                </div>

                {/* Synapse info grid */}
                <div class="grid grid-cols-2 gap-3 mb-4">
                  <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <p class="text-xs text-gray-400">Synapses</p>
                    <p class="text-lg font-bold text-white">{cluster.synapseCount}</p>
                  </div>
                  <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <p class="text-xs text-gray-400">Exploring</p>
                    <p class="text-lg font-bold text-yellow-400">{cluster.beingExploredCount || 0}</p>
                  </div>
                  <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <p class="text-xs text-gray-400">Points Required</p>
                    <p class="text-lg font-bold text-cyan-400">{formatPoints(typeConfig?.pointsRequired)}</p>
                  </div>
                  <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <p class="text-xs text-gray-400">Reward</p>
                    <p class="text-lg font-bold text-purple-400">{typeConfig?.agiRewardMin}–{typeConfig?.agiRewardMax} AGI</p>
                  </div>
                </div>

                {/* Rewards section */}
                {typeConfig && (
                <div class="p-3 rounded-lg bg-gradient-to-r from-amber-900/30 to-purple-900/30 border border-amber-500/30 mb-4">
                  <p class="text-xs text-gray-400 mb-2">Completion Rewards</p>
                  <div class="flex justify-between items-center">
                    <div>
                      <span class="text-amber-400 font-bold">{typeConfig.agiRewardMin}–{typeConfig.agiRewardMax}</span>
                      <span class="text-xs text-gray-400 ml-1">$AGI</span>
                    </div>
                    <div class="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                      Fair Share
                    </div>
                  </div>
                </div>
                )}

                {/* Lock warning */}
                <Show when={isLocked}>
                  <div class="p-3 rounded-lg bg-red-900/20 border border-red-500/30 mb-4">
                    <p class="text-sm text-red-400">Locked</p>
                  </div>
                </Show>

                {/* Ship selection */}
                <div class="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <p class="text-xs text-gray-400 mb-2">Available Ships</p>
                  <p class="text-xl font-bold text-teal-400">
                    {idleShips.length}
                    <span class="text-sm font-normal text-gray-400"> / {shipStore.userShips.length}</span>
                  </p>
                </div>

                {/* Action buttons */}
                <div class="flex gap-2">
                  <button
                    class="flex-1 py-3 bg-teal-500 hover:bg-teal-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    disabled={idleShips.length === 0 || isLocked}
                    onClick={async () => {
                      const ship = idleShips[0]
                      const target = deployTarget()
                      if (ship && target) {
                        // Find nearest synapse and travel directly to it
                        const synapse = await shipStore.fetchSynapseByPosition(
                          target.cluster.positionX,
                          target.cluster.positionY,
                          target.cluster.positionZ
                        )
                        if (synapse) {
                          const stc = configStore.getSynapseType(synapse.synapseType)
                          const sMaxPerMin = stc ? Math.max(100, stc.pointsRequired / 60) : 100
                          const pointsPerMin = Math.floor(sMaxPerMin / 2) || 50
                          const success = await shipStore.travelToSynapse(ship.id, synapse.id, pointsPerMin)
                          if (success) {
                            setDeployTarget(null)
                            shipStore.selectShip(ship.id)
                          }
                        }
                      }
                    }}
                  >
                    {isLocked ? 'Locked' : 'Deploy Ship'}
                  </button>
                  <button
                    class="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                    onClick={() => setDeployTarget(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </Show>

      {/* Ship Detail Panel - shown when a ship is selected, positioned on right side */}
      <Show when={shipStore.selectedShipId}>
        <div class="absolute bottom-20 right-4 z-40">
          <ShipDetailPanel onClose={() => shipStore.selectShip(null)} />
        </div>
      </Show>

      {/* Region Legend, Minimap and indicator - top right */}
      <div class="absolute top-16 right-4 flex flex-col items-end gap-2">
        {/* Region Legend Panel */}
        <RegionLegend
          selectedRegionIndex={selectedRegionIndex()}
          onSelectRegion={(index) => {
            setSelectedRegionIndex(index)
            setHighlightIntensity(index >= 0 ? 1.0 : 0)
          }}
        />

        {/* Minimap (display-only) */}
        <BrainMinimap
          cameraPosition={cameraPosition()}
          cameraTarget={cameraTarget()}
          selectedRegionIndex={selectedRegionIndex()}
          isExpanded={panels.minimapExpanded}
          onToggle={() => setPanels('minimapExpanded', !panels.minimapExpanded)}
        />

        {/* Quality Settings */}
        <QualitySettings
          preset={panels.qualityPreset}
          onPresetChange={(p: QualityPreset) => setPanels('qualityPreset', p)}
          isExpanded={panels.qualityExpanded}
          onToggle={() => setPanels('qualityExpanded', !panels.qualityExpanded)}
        />

        {/* Selected region indicator */}
        <Show when={selectedRegionIndex() >= 0}>
          <div class="pointer-events-none">
            <div class="px-4 py-2 rounded-lg bg-purple-500/20 backdrop-blur-sm border border-purple-500/40">
              <p class="text-sm font-medium text-purple-300">
                {FUNCTIONAL_BRAIN_REGIONS[selectedRegionIndex()]?.name ?? 'Unknown Region'}
              </p>
              <p class="text-xs text-gray-400">
                {filteredSynapseClusters().length} clusters • Press 0 or Esc to clear
              </p>
            </div>
          </div>
        </Show>
      </div>

      {/* Create Ship Dialog */}
      <CreateShipDialog
        open={panels.showCreateShipDialog}
        onOpenChange={(v: boolean) => setPanels('showCreateShipDialog', v)}
      />
    </div>
  )
}

export default DiscoveryDashboard
