import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import { useAgentStore } from '@/stores/agentStore'
import { useBrainRegionStore } from '@/stores/brainRegionStore'
import { useWebSocketConnection, useDashboardStats, useVisualizationState } from '@/hooks'
import { DeploymentDialog } from '@/components/agents/DeploymentDialog'
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
  TranceModeOverlay,
  ViewModeToggle,
} from '@/components/dashboard'
import { AgentSidebar } from '@/components/dashboard/AgentSidebar'
import { RegionNavigator, SelectedRegionInfo } from '@/components/dashboard/RegionNavigator'
import { BrainSceneMinimal } from '@/components/dashboard/BrainSceneMinimal'

import type { SpaceCluster } from '@/types/agent'
import { BRAIN_SCALE, LOOT_THRESHOLDS, TOAST_DURATIONS, FUEL_THRESHOLDS } from '@/constants'

export function DiscoveryDashboard() {
  const { toasts, addToast, removeToast } = useToasts()

  // Custom hooks for connection, stats, and visualization
  useWebSocketConnection()
  const { userPoints } = useDashboardStats()
  const {
    viewMode,
    setViewMode,
    setZoomInfo,
    zoomTarget,
    setZoomTarget,
    currentSpaceClusters,
    agentClustersLod0,
  } = useVisualizationState()

  // Store values still needed directly
  const {
    loginUser,
    userId,
    userAgents,
    selectedAgentId,
    recentDiscoveries,
    refuelAgent,
  } = useAgentStore()

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
  const [deploymentTarget, setDeploymentTarget] = useState<SpaceCluster | null>(null)
  const [walletInput, setWalletInput] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [mobileTab, setMobileTab] = useState<'home' | 'agents' | 'stats' | 'settings'>('home')

  // Handle focus on agent to zoom camera to their position
  const handleFocusAgent = useCallback((x: number, y: number, z: number) => {
    const target = new THREE.Vector3(
      x * BRAIN_SCALE.x,
      y * BRAIN_SCALE.y,
      z * BRAIN_SCALE.z
    )
    setZoomTarget(target)
    setViewMode('3d')
  }, [BRAIN_SCALE])

  // Show toast notifications and confetti for significant discoveries
  const lastNotifiedDiscoveryRef = useRef<string | null>(null)

  useEffect(() => {
    if (recentDiscoveries.length > 0) {
      const latestDiscovery = recentDiscoveries[0]

      if (lastNotifiedDiscoveryRef.current === latestDiscovery.spaceId) {
        return
      }

      const lootAmount = latestDiscovery.lootDistribution.reduce((s, d) => s + d.amount, 0)

      if (lootAmount < LOOT_THRESHOLDS.MIN_NOTIFY) return

      lastNotifiedDiscoveryRef.current = latestDiscovery.spaceId

      const discovererAgentId = latestDiscovery.discoveredBy.find(
        (agentId) => userAgents.some((a) => a.id === agentId)
      )
      const discovererAgent = discovererAgentId
        ? userAgents.find((a) => a.id === discovererAgentId)
        : null

      const tierInfo =
        lootAmount >= LOOT_THRESHOLDS.MYTHIC
          ? { tier: 'Mythic', emoji: '🌟' }
          : lootAmount >= LOOT_THRESHOLDS.LEGENDARY
            ? { tier: 'Legendary', emoji: '✨' }
            : lootAmount >= LOOT_THRESHOLDS.TEAM
              ? { tier: 'Team', emoji: '💎' }
              : { tier: 'Trait', emoji: '💫' }

      const agentName = discovererAgent?.name || 'Unknown'
      const title = discovererAgent
        ? `${agentName} found a ${tierInfo.tier} Space!`
        : `${tierInfo.tier} Space Discovered!`

      addToast({
        type: 'discovery',
        title,
        message: `${tierInfo.emoji} +${lootAmount.toLocaleString()} AGI earned`,
        duration: lootAmount >= LOOT_THRESHOLDS.CONFETTI ? TOAST_DURATIONS.LONG : TOAST_DURATIONS.MEDIUM,
      })

      if (lootAmount >= LOOT_THRESHOLDS.CONFETTI) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 100)
      }
    }
  }, [recentDiscoveries, userAgents, addToast])

  // Login handler
  const handleLogin = () => {
    if (walletInput.trim()) {
      loginUser(walletInput.trim())
    }
  }

  // Trance state
  const tranceAgent = userAgents.find(a => a.tranceActive)
  const tranceActive = !!tranceAgent
  const tranceEndTime = tranceAgent?.tranceEndTime || null
  const prevTranceActiveRef = useRef(false)

  // Show trance notifications
  useEffect(() => {
    if (tranceActive && !prevTranceActiveRef.current) {
      addToast({
        type: 'trance',
        title: 'Trance Mode Activated!',
        message: '20x slowdown - auto-continue when done',
        duration: TOAST_DURATIONS.MEDIUM,
      })
    }
    if (!tranceActive && prevTranceActiveRef.current) {
      addToast({
        type: 'trance',
        title: 'Auto-Continue!',
        message: 'Agent redeploying to new location...',
        duration: TOAST_DURATIONS.MEDIUM,
      })
    }
    prevTranceActiveRef.current = tranceActive
  }, [tranceActive, addToast])

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
        setDeploymentTarget(null)
      }

      // R - Refuel all agents that need it
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const agentsNeedingFuel = userAgents.filter(a => a.pointsBalance < FUEL_THRESHOLDS.LOW)
        const costPerAgent = Math.floor(userPoints / agentsNeedingFuel.length)
        if (costPerAgent > 0) {
          Promise.all(agentsNeedingFuel.map(a => refuelAgent(a.id, costPerAgent)))
          addToast({
            type: 'success',
            title: 'Agents Refueled',
            message: `${agentsNeedingFuel.length} agents refueled`,
            duration: TOAST_DURATIONS.DEFAULT,
          })
        }
      }

      // F - Focus camera on selected agent
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (selectedAgentId) {
          const agent = userAgents.find(a => a.id === selectedAgentId)
          if (agent && agent.state !== 'idle') {
            handleFocusAgent(agent.positionX, agent.positionY, agent.positionZ)
            addToast({
              type: 'info',
              title: 'Camera Focus',
              message: `Focusing on ${agent.name}`,
              duration: TOAST_DURATIONS.SHORT,
            })
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [userAgents, userPoints, selectedAgentId, refuelAgent, addToast, handleFocusAgent])

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
              <Canvas gl={{ antialias: true, alpha: true }} className="w-full h-full">
                <BrainSceneMinimal
                  spaceClusters={currentSpaceClusters}
                  agentClusters={agentClustersLod0}
                  userAgents={userAgents}
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
            <TopDownView spaceClusters={currentSpaceClusters} userAgents={userAgents} />
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

        {/* Right Sidebar - Agent Management */}
        <div className="w-72 flex-shrink-0 border-l border-[var(--card-border)] bg-[var(--background-secondary)]">
          <AgentSidebar onFocusAgent={handleFocusAgent} />
        </div>
      </main>

      {/* Overlays */}
      <TranceModeOverlay isActive={tranceActive} endTime={tranceEndTime} />
      <HelpOverlay isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <DeploymentDialog
        isOpen={deploymentTarget !== null}
        onClose={() => setDeploymentTarget(null)}
        spaceCluster={deploymentTarget}
      />

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
