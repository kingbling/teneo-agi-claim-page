import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import { useShipStore } from '@/stores/shipStore'
import { useUserStore } from '@/stores/userStore'
import { useBrainRegionStore } from '@/stores/brainRegionStore'
import { useWebSocketConnection, useDashboardStats, useVisualizationState } from '@/hooks'
import { TopDownView } from '@/components/brain/TopDownView'
import { PerformanceMonitor } from '@/components/ui/PerformanceMonitor'
import { ToastNotifications, useToasts } from '@/components/ui/ToastNotifications'
import { Confetti } from '@/components/ui/Confetti'
import { MobileNav } from '@/components/ui/MobileNav'

// Dashboard components
import {
  LoginOverlay,
  HelpOverlay,
  DashboardHeader,
  ViewModeToggle,
} from '@/components/dashboard'
import { RegionNavigator, SelectedRegionInfo } from '@/components/dashboard/RegionNavigator'
import { BrainSceneMinimal } from '@/components/dashboard/BrainSceneMinimal'

// Masterplan 2026 Components
import { ShipSidebar } from '@/components/ships/ShipSidebar'
import { CreateShipDialog } from '@/components/ships/CreateShipDialog'
import { ExplorationDialog } from '@/components/exploration/ExplorationDialog'

import type { Ship } from '@/stores/shipStore'
import { BRAIN_SCALE, TOAST_DURATIONS } from '@/constants'
import { getSynapseTypeLabel, formatPoints } from '@/types/game'

// Synapse discovery loot thresholds (replaces space tier thresholds)
const SYNAPSE_LOOT_THRESHOLDS = {
  MIN_NOTIFY: 50,
  CONFETTI: 1000,
  DEEP: 4000,
  CORE: 40000,
  RARE: 100000,
  LEGENDARY: 200000,
  UNIQUE: 1000000,
} as const

export function DiscoveryDashboard() {
  const { toasts, addToast, removeToast } = useToasts()

  // Custom hooks for connection, stats, and visualization
  useWebSocketConnection()
  useDashboardStats() // Keep for side effects, stats displayed in header
  const {
    viewMode,
    setViewMode,
    setZoomInfo,
    zoomTarget,
    setZoomTarget,
    currentSpaceClusters,
    agentClustersLod0,
  } = useVisualizationState()

  // User store values
  const { userId, loginUser, initFromStorage } = useUserStore()

  // Auto-login from localStorage on mount
  useEffect(() => {
    if (!userId) {
      initFromStorage()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ship store values
  const {
    userShips,
    selectedShipId,
    recentDiscoveries,
    recentLoot,
  } = useShipStore()

  // Ship store - select ship for exploration
  const { selectShip } = useShipStore()

  // Brain region navigation state
  const selectedRegionIndex = useBrainRegionStore(state => state.selectedRegionIndex)
  const highlightIntensity = useBrainRegionStore(state => state.highlightIntensity)
  const getSelectedRegion = useBrainRegionStore(state => state.getSelectedRegion)

  // Compute camera target from selected region
  const regionCamera = useMemo(() => {
    const selectedRegion = getSelectedRegion()
    if (!selectedRegion) return null
    return {
      position: selectedRegion.cameraPosition,
      target: selectedRegion.cameraTarget,
    }
  }, [selectedRegionIndex, getSelectedRegion])

  // Local UI state
  const [isCreateShipOpen, setIsCreateShipOpen] = useState(false)
  const [walletInput, setWalletInput] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [mobileTab, setMobileTab] = useState<'home' | 'agents' | 'stats' | 'settings'>('home')

  // Handle focus on ship to zoom camera to their position
  const handleFocusShip = useCallback((ship: Ship) => {
    const target = new THREE.Vector3(
      ship.positionX * BRAIN_SCALE.x,
      ship.positionY * BRAIN_SCALE.y,
      ship.positionZ * BRAIN_SCALE.z
    )
    setZoomTarget(target)
    setViewMode('3d')

    addToast({
      type: 'info',
      title: 'Camera Focus',
      message: `Focusing on ${ship.name}`,
      duration: TOAST_DURATIONS.SHORT,
    })
  }, [BRAIN_SCALE, setZoomTarget, setViewMode, addToast])

  // Handle starting exploration for a ship - select ship then user clicks synapse
  const handleStartExploration = useCallback((ship: Ship) => {
    // Select the ship - user then clicks on a synapse marker to start exploration
    selectShip(ship.id)
    addToast({
      type: 'info',
      title: 'Ship Selected',
      message: `Click on a synapse to start exploring with ${ship.name}`,
      duration: TOAST_DURATIONS.MEDIUM,
    })
  }, [selectShip, addToast])

  // Handle create ship
  const handleCreateShip = useCallback(() => {
    setIsCreateShipOpen(true)
  }, [])

  // Show toast notifications for loot distributions
  const lastNotifiedLootRef = useRef<string | null>(null)

  useEffect(() => {
    if (recentLoot.length > 0) {
      const latestLoot = recentLoot[0]

      // Only notify for user's own loot
      if (latestLoot.userId !== userId) return

      // Avoid duplicate notifications
      const lootKey = `${latestLoot.synapseId}-${latestLoot.timestamp}`
      if (lastNotifiedLootRef.current === lootKey) return

      const agiAmount = latestLoot.agiAmount
      if (agiAmount < SYNAPSE_LOOT_THRESHOLDS.MIN_NOTIFY) return

      lastNotifiedLootRef.current = lootKey

      const ship = userShips.find(s => s.id === latestLoot.shipId)
      const shipName = ship?.name || 'Your ship'

      // Determine tier based on synapse type rewards
      const tierInfo = latestLoot.isLotteryWin
        ? { tier: 'Lottery Win! 🎰', emoji: '🌟' }
        : agiAmount >= SYNAPSE_LOOT_THRESHOLDS.UNIQUE
          ? { tier: 'Unique', emoji: '🌟' }
          : agiAmount >= SYNAPSE_LOOT_THRESHOLDS.LEGENDARY
            ? { tier: 'Legendary', emoji: '✨' }
            : agiAmount >= SYNAPSE_LOOT_THRESHOLDS.RARE
              ? { tier: 'Rare', emoji: '💎' }
              : agiAmount >= SYNAPSE_LOOT_THRESHOLDS.CORE
                ? { tier: 'Core', emoji: '💫' }
                : { tier: getSynapseTypeLabel(latestLoot.synapseType), emoji: '⚡' }

      addToast({
        type: 'discovery',
        title: `${shipName} earned ${tierInfo.tier} rewards!`,
        message: `${tierInfo.emoji} +${formatPoints(agiAmount)} $AGI earned`,
        duration: agiAmount >= SYNAPSE_LOOT_THRESHOLDS.CONFETTI ? TOAST_DURATIONS.LONG : TOAST_DURATIONS.MEDIUM,
      })

      // Show confetti for big wins
      if (agiAmount >= SYNAPSE_LOOT_THRESHOLDS.CONFETTI || latestLoot.isLotteryWin) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 100)
      }
    }
  }, [recentLoot, userId, userShips, addToast])

  // Login handler
  const handleLogin = () => {
    if (walletInput.trim()) {
      loginUser(walletInput.trim())
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // H - Toggle help
      if (e.key === 'h' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setShowHelp(v => !v)
      }

      // ESC - Close dialogs
      if (e.key === 'Escape') {
        setShowHelp(false)
        setIsCreateShipOpen(false)
      }

      // F - Focus camera on selected ship
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (selectedShipId) {
          const ship = userShips.find(s => s.id === selectedShipId)
          if (ship && ship.state !== 'idle') {
            handleFocusShip(ship)
          }
        }
      }

      // N - Create new ship
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setIsCreateShipOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [userShips, selectedShipId, handleFocusShip])

  // Login overlay
  if (!userId) {
    return (
      <LoginOverlay
        isOpen={true}
        walletInput={walletInput}
        onWalletInputChange={setWalletInput}
        onLogin={handleLogin}
      />
    )
  }

  return (
    <div className="min-h-screen w-full bg-[var(--background-primary)]">
      {/* Header */}
      <DashboardHeader onHelpClick={() => setShowHelp(true)} />

      {/* Main content */}
      <main className="flex pt-12 h-screen">
        {/* Center - 3D/Top-Down Visualization */}
        <div className="flex-1 relative">
          {/* Region Navigator - centered at top */}
          {viewMode === '3d' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-2xl">
              <div className="bg-[var(--background-primary)]/80 backdrop-blur-sm rounded-xl px-3 py-2">
                <RegionNavigator compact />
              </div>
            </div>
          )}

          {viewMode === '3d' ? (
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">Loading 3D...</div>}>
              <Canvas
                gl={{ antialias: true, alpha: true }}
                className="w-full h-full"
                style={{ background: 'radial-gradient(ellipse at center, #0d1526 0%, #050810 70%, #020305 100%)' }}
              >
                <BrainSceneMinimal
                  spaceClusters={currentSpaceClusters}
                  agentClusters={agentClustersLod0}
                  userAgents={userShips}
                  recentDiscoveries={recentDiscoveries}
                  zoomTarget={zoomTarget}
                  setZoomInfo={setZoomInfo}
                  regionCamera={regionCamera}
                  selectedRegionIndex={selectedRegionIndex}
                  highlightIntensity={highlightIntensity}
                />
              </Canvas>
            </Suspense>
          ) : (
            <TopDownView spaceClusters={currentSpaceClusters} userAgents={userShips} />
          )}

          {/* Selected region info panel - shows in both views */}
          {selectedRegionIndex >= 0 && (
            <div className="absolute bottom-20 left-4 z-10 w-64">
              <SelectedRegionInfo />
            </div>
          )}

          {/* View Mode Toggle */}
          <ViewModeToggle viewMode={viewMode} onViewChange={setViewMode} />

          {/* Gradient overlays */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-[var(--background-primary)]/80" />
          </div>
        </div>

        {/* Right Sidebar - Ship Management */}
        <div className="w-72 flex-shrink-0 border-l border-[var(--card-border)] bg-[var(--background-secondary)]">
          <ShipSidebar
            onCreateShip={handleCreateShip}
            onStartExploration={handleStartExploration}
            onFocusShip={handleFocusShip}
          />
        </div>
      </main>

      {/* Overlays */}
      <HelpOverlay isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Create Ship Dialog */}
      <CreateShipDialog
        open={isCreateShipOpen}
        onOpenChange={(open) => setIsCreateShipOpen(open)}
      />

      {/* Exploration Dialog (controlled by explorationStore) */}
      <ExplorationDialog />

      {/* Confetti effect */}
      {showConfetti && <Confetti active={true} />}

      {/* Toast notifications */}
      <ToastNotifications toasts={toasts} onRemove={removeToast} />

      {/* Performance monitor (dev only) */}
      {import.meta.env.DEV && <PerformanceMonitor />}

      {/* Mobile navigation */}
      <MobileNav
        activeTab={mobileTab}
        onTabChange={setMobileTab}
      />
    </div>
  )
}
