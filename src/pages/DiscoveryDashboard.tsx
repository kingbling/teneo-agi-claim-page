/**
 * Discovery Dashboard - SolidJS Version
 *
 * Main dashboard page with 3D brain visualization.
 * Uses vanilla Three.js integration layer instead of React Three Fiber.
 */

import { type Component, createSignal, createMemo, onMount, onCleanup, Show, For } from 'solid-js'
import * as THREE from 'three'
import { ThreeCanvas } from '@/three'
import { DashboardHeader, BrainSceneMinimal, BrainMinimap, QualitySettings, LoginOverlay, SynapseListPanel, type QualityPreset } from '@/components/dashboard'
import { ItemShop } from '@/components/shop/ItemShop'
import { ShipNavigator } from '@/components/ships/ShipNavigator'
import { CreateShipDialog } from '@/components/ships/CreateShipDialog'
import { RegionLegend } from '@/components/dashboard/RegionLegend'
import type { RegionCamera, CameraUpdate } from '@/components/dashboard/BrainSceneMinimal'
import { shipStore, userStore, uiStore } from '@/stores'
import type { Ship } from '@/stores'
import { useWebSocketConnection } from '@/hooks'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { filterByRegion } from '@/lib/regionFilter'
import {
  SYNAPSE_CONFIG,
  SYNAPSE_TYPE_COLORS,
  formatPoints,
  formatETA,
  getSynapseTypeLabel,
  type SynapseType,
} from '@/types/game'
import { BRAIN_SCALE } from '@/components/brain/core/brainConstants'

// Helper to get dominant synapse type from cluster
function getDominantSynapseType(typeCounts?: Record<SynapseType, number>): SynapseType {
  if (!typeCounts) return 'minor'
  let dominant: SynapseType = 'minor'
  let maxCount = 0
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count
      dominant = type as SynapseType
    }
  }
  return dominant
}

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
  // Help overlay state
  const [showHelp, setShowHelp] = createSignal(false)

  // Zoom info for LOD management
  const [zoomInfo, setZoomInfo] = createSignal({ distance: 5, lod: 1 })

  // Zoom target for camera animations
  const [zoomTarget, setZoomTarget] = createSignal<THREE.Vector3 | null>(null)

  // Region selection state
  const [selectedRegionIndex, setSelectedRegionIndex] = createSignal<number>(-1)
  const [highlightIntensity, setHighlightIntensity] = createSignal(0)

  // Ship deployment dialog state
  const [deployTarget, setDeployTarget] = createSignal<{ cluster: any; position: THREE.Vector3 } | null>(null)

  // Pending deploy (waiting for zoom to complete)
  const [pendingDeploy, setPendingDeploy] = createSignal<{ cluster: any; position: THREE.Vector3 } | null>(null)

  // Zoom animation state
  const [isZooming, setIsZooming] = createSignal(false)

  // Ship zoom state - triggers close zoom for ship inspection
  const [isShipZoom, setIsShipZoom] = createSignal(false)

  // Camera position for minimap
  const [cameraPosition, setCameraPosition] = createSignal({ x: 0, y: 0, z: 5 })
  const [cameraTarget, setCameraTarget] = createSignal({ x: 0, y: 0, z: 0 })

  // Minimap expanded state
  const [minimapExpanded, setMinimapExpanded] = createSignal(false)

  // Quality settings state
  const [qualityExpanded, setQualityExpanded] = createSignal(false)
  const [qualityPreset, setQualityPreset] = createSignal<QualityPreset>('high')
  const [postProcessingEnabled, setPostProcessingEnabled] = createSignal(true)

  // Ship navigator expanded state
  const [shipNavigatorExpanded, setShipNavigatorExpanded] = createSignal(true)

  // Synapse list panel expanded state
  const [synapseListExpanded, setSynapseListExpanded] = createSignal(false)

  // Create ship dialog state
  const [showCreateShipDialog, setShowCreateShipDialog] = createSignal(false)

  // Shop panel state
  const [showShop, setShowShop] = createSignal(false)

  // Handle camera updates from BrainScene
  const handleCameraUpdate = (update: CameraUpdate) => {
    setCameraPosition(update.position)
    setCameraTarget(update.target)
  }

  // Handle minimap navigation
  const handleMinimapNavigate = (x: number, y: number, z: number) => {
    setZoomTarget(new THREE.Vector3(x, y, z))
  }

  // WebSocket connection - automatically connects on mount
  const { isConnected } = useWebSocketConnection()

  // Compute regionCamera from selectedRegionIndex
  const regionCamera = createMemo((): RegionCamera | null => {
    const idx = selectedRegionIndex()
    if (idx < 0 || idx >= FUNCTIONAL_BRAIN_REGIONS.length) return null
    const region = FUNCTIONAL_BRAIN_REGIONS[idx]
    return {
      position: region.cameraPosition as [number, number, number],
      target: region.cameraTarget as [number, number, number],
    }
  })

  // Filter synapse clusters by selected region
  const filteredSynapseClusters = createMemo(() =>
    filterByRegion(shipStore.synapseClusters, selectedRegionIndex())
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
        setShowHelp(false)
        setShowShop(false)
        setDeployTarget(null)
        setPendingDeploy(null)
        setIsZooming(false)
        setIsShipZoom(false)
        return
      }

      // S for shop
      if (key === 's') {
        setShowShop((prev) => !prev)
        return
      }

      // H for help
      if (key === 'h') {
        setShowHelp((prev) => !prev)
        return
      }

      // R for reset camera (clear zoom target and region)
      if (key === 'r') {
        setZoomTarget(null)
        setSelectedRegionIndex(-1)
        setHighlightIntensity(0)
        setIsShipZoom(false)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown))
  })

  // Handle space/synapse click - zoom camera first, then show deploy dialog
  const handleSpaceClick = (cluster: unknown, position: THREE.Vector3) => {
    // If already showing a dialog, close it first
    if (deployTarget()) {
      setDeployTarget(null)
    }

    // Clear ship zoom mode when clicking a space
    setIsShipZoom(false)

    // Store the pending deploy target
    const target = { cluster, position: position.clone() }
    setPendingDeploy(target)

    // Start zoom animation
    setZoomTarget(position.clone())
    setIsZooming(true)

    // Show dialog after zoom animation (delay ~800ms for smooth experience)
    setTimeout(() => {
      setIsZooming(false)
      // Only show dialog if this is still the pending target
      const pending = pendingDeploy()
      if (pending && pending.cluster === cluster) {
        setDeployTarget(target)
        setPendingDeploy(null)
      }
    }, 800)
  }

  // Handle synapse list navigation - just zoom to location without deploy dialog
  const handleSynapseListNavigate = (cluster: unknown, position: THREE.Vector3) => {
    setZoomTarget(position.clone())
    setIsShipZoom(false)
  }

  // Handle ship click - zoom camera to ship position with close zoom
  const handleShipClick = (ship: Ship) => {
    // Select the ship (enables selection ring, fetches synapse details)
    shipStore.selectShip(ship.id)

    // Apply BRAIN_SCALE to match rendered ship positions
    const pos = new THREE.Vector3(
      ship.positionX * BRAIN_SCALE.x,
      ship.positionY * BRAIN_SCALE.y,
      ship.positionZ * BRAIN_SCALE.z
    )
    setZoomTarget(pos)
    setIsShipZoom(true)  // Enable close zoom for ship inspection
  }

  // Login handler - called when user successfully authenticates
  const handleLogin = () => {
    // User is now logged in, the UI will update automatically
  }

  return (
    <div class="w-screen h-screen bg-black overflow-hidden">
      {/* Login Overlay - shown when user is not logged in */}
      <LoginOverlay
        isOpen={!userStore.isLoggedIn}
        onLogin={handleLogin}
      />

      {/* Dashboard Header */}
      <DashboardHeader
        onHelpClick={() => setShowHelp(true)}
        onShopClick={() => setShowShop(true)}
      />

      {/* 3D Brain Visualization */}
      <ThreeCanvas
        class="w-full h-full"
        camera={{
          fov: 50,
          position: [0, 0, 5],
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
          zoomTarget={zoomTarget()}
          setZoomInfo={setZoomInfo}
          onSpaceClick={handleSpaceClick}
          onAgentClick={handleShipClick}
          regionCamera={regionCamera()}
          selectedRegionIndex={selectedRegionIndex()}
          highlightIntensity={highlightIntensity()}
          onCameraUpdate={handleCameraUpdate}
          showIdleShips={uiStore.showIdleShips}
          selectedShipId={shipStore.selectedShipId}
          isShipZoom={isShipZoom()}
        />
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
            onCreateShip={() => setShowCreateShipDialog(true)}
            isExpanded={shipNavigatorExpanded()}
            onToggle={() => setShipNavigatorExpanded(!shipNavigatorExpanded())}
          />

          {/* Synapse List Panel */}
          <SynapseListPanel
            onNavigate={handleSynapseListNavigate}
            isExpanded={synapseListExpanded()}
            onToggle={() => setSynapseListExpanded(!synapseListExpanded())}
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

      {/* Zoom indicator */}
      <Show when={isZooming()}>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
          <div class="px-4 py-2 rounded-lg bg-black/70 backdrop-blur-sm border border-teal-500/50">
            <p class="text-sm text-teal-400 flex items-center gap-2">
              <span class="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              Focusing...
            </p>
          </div>
        </div>
      </Show>

      {/* Help Overlay */}
      <Show when={showHelp()}>
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowHelp(false)}
        >
          <div
            class="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-bold text-white mb-4">Keyboard Shortcuts</h2>
            <div class="space-y-2 text-gray-300">
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">S</kbd> Toggle shop</p>
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">H</kbd> Toggle help</p>
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">R</kbd> Reset camera</p>
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">1-9</kbd> Navigate regions</p>
              <p><kbd class="px-2 py-1 bg-gray-800 rounded text-xs">Esc</kbd> Close overlays</p>
            </div>
            <button
              class="mt-4 w-full py-2 bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-lg transition-colors"
              onClick={() => setShowHelp(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Show>

      {/* Shop Panel - Slide-in from right */}
      <Show when={showShop()}>
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setShowShop(false)}
        >
          <div
            class="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[var(--background-secondary)] border-l border-[var(--card-border)] shadow-2xl animate-slide-in-right overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowShop(false)}
              class="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <ItemShop class="h-full" />
          </div>
        </div>
      </Show>

      {/* Enhanced Ship Deployment Dialog */}
      <Show when={deployTarget()}>
        {(() => {
          const target = deployTarget()!
          const cluster = target.cluster
          const dominantType = getDominantSynapseType(cluster.typeCounts)
          const config = SYNAPSE_CONFIG[dominantType]
          const typeColor = SYNAPSE_TYPE_COLORS[dominantType]
          const regionName = getRegionFromPosition(cluster.positionX, cluster.positionY, cluster.positionZ)
          const unlockLevel = SYNAPSE_CONFIG[dominantType].unlockUserLevel
          const userLevel = userStore.userLevel
          const isLocked = userLevel < unlockLevel
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
                    <p class="text-lg font-bold text-cyan-400">{formatPoints(config.points)}</p>
                  </div>
                  <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <p class="text-xs text-gray-400">Base ETA</p>
                    <p class="text-lg font-bold text-purple-400">{formatETA(config.etaMinutes)}</p>
                  </div>
                </div>

                {/* Rewards section */}
                <div class="p-3 rounded-lg bg-gradient-to-r from-amber-900/30 to-purple-900/30 border border-amber-500/30 mb-4">
                  <p class="text-xs text-gray-400 mb-2">Completion Rewards</p>
                  <div class="flex justify-between items-center">
                    <div>
                      <span class="text-amber-400 font-bold">{formatPoints(config.agiReward)}</span>
                      <span class="text-xs text-gray-400 ml-1">$AGI</span>
                    </div>
                    <div class="px-2 py-1 rounded text-xs font-medium" classList={{
                      'bg-green-500/20 text-green-400': config.distribution === 'fair_share',
                      'bg-amber-500/20 text-amber-400': config.distribution === 'lottery',
                    }}>
                      {config.distribution === 'fair_share' ? 'Fair Share' : 'Lottery'}
                    </div>
                  </div>
                </div>

                {/* Lock warning */}
                <Show when={isLocked}>
                  <div class="p-3 rounded-lg bg-red-900/20 border border-red-500/30 mb-4">
                    <p class="text-sm text-red-400">
                      🔒 Requires User Level {unlockLevel} (You: L{userLevel})
                    </p>
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
                        const success = await shipStore.deployShip(ship.id, target.x, target.y, target.z)
                        if (success) {
                          setDeployTarget(null)
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

        {/* Minimap */}
        <BrainMinimap
          cameraPosition={cameraPosition()}
          cameraTarget={cameraTarget()}
          selectedRegionIndex={selectedRegionIndex()}
          isExpanded={minimapExpanded()}
          onToggle={() => setMinimapExpanded(!minimapExpanded())}
          onNavigate={handleMinimapNavigate}
        />

        {/* Quality Settings */}
        <QualitySettings
          preset={qualityPreset()}
          onPresetChange={setQualityPreset}
          postProcessingEnabled={postProcessingEnabled()}
          onPostProcessingChange={setPostProcessingEnabled}
          isExpanded={qualityExpanded()}
          onToggle={() => setQualityExpanded(!qualityExpanded())}
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
        open={showCreateShipDialog()}
        onOpenChange={setShowCreateShipDialog}
      />
    </div>
  )
}

export default DiscoveryDashboard
