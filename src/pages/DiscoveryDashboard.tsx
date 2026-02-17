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
import { CreateShipScreen } from '@/components/ships/CreateShipScreen'
import { ShipDetailPanel } from '@/components/ships/ShipDetailPanel'
import { DeploymentScreen } from '@/components/ships/DeploymentScreen'
import { ExplorePrompt } from '@/components/brain/ExplorePrompt'
import { RegionLegend } from '@/components/dashboard/RegionLegend'
import type { CameraUpdate } from '@/components/dashboard/BrainSceneMinimal'
import { shipStore, userStore, uiStore } from '@/stores'
import type { Ship, SynapseCluster } from '@/stores'
import { useWebSocketConnection } from '@/hooks'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { CAMERA_CONFIG } from '@/components/brain/core/brainConstants'
import { filterByRegion } from '@/lib/regionFilter'
import type { SynapseType } from '@/types/game'
import { configStore } from '@/stores/configStore'
import { log, fmt } from '@/utils/logger'

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

      // Number keys 1-9 for region selection (maps to enabled regions only)
      if (key >= '1' && key <= '9') {
        const displayIndex = parseInt(key) - 1
        const enabledIds = new Set(configStore.enabledRegions.map((n: string) => n.replace(/_/g, '-')))
        const enabledIndices = FUNCTIONAL_BRAIN_REGIONS
          .map((r, i) => ({ id: r.id, idx: i }))
          .filter(({ id }) => enabledIds.has(id))
        if (displayIndex < enabledIndices.length) {
          setSelectedRegionIndex(enabledIndices[displayIndex].idx)
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
          disableTooltip={!!deployTarget() || panels.showCreateShipDialog}
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
                const maxPerMin = tc ? tc.maxPointsPerMin : 100
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

      {/* Ship Deployment Screen (Gran Turismo-style) */}
      <Show when={deployTarget()}>
        <DeploymentScreen
          cluster={deployTarget()!.cluster}
          position={deployTarget()!.position}
          onDeploy={async (shipId) => {
            const target = deployTarget()
            if (!target) return
            const synapse = await shipStore.fetchSynapseByPosition(
              target.cluster.positionX,
              target.cluster.positionY,
              target.cluster.positionZ
            )
            if (synapse) {
              const stc = configStore.getSynapseType(synapse.synapseType)
              const sMaxPerMin = stc ? stc.maxPointsPerMin : 100
              const pointsPerMin = Math.floor(sMaxPerMin / 2) || 50
              const success = await shipStore.travelToSynapse(shipId, synapse.id, pointsPerMin)
              if (success) {
                setDeployTarget(null)
                shipStore.selectShip(shipId)
              }
            }
          }}
          onClose={() => setDeployTarget(null)}
        />
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

      {/* Create Ship Screen */}
      <Show when={panels.showCreateShipDialog}>
        <CreateShipScreen onClose={() => setPanels('showCreateShipDialog', false)} />
      </Show>
    </div>
  )
}

export default DiscoveryDashboard
