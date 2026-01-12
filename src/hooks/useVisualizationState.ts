import { createSignal, createMemo } from 'solid-js'
import * as THREE from 'three'
import { shipStore } from '@/stores/shipStore'
import type { ViewMode } from '@/types/agent'

/**
 * useVisualizationState - Manages 3D visualization state
 *
 * Masterplan 2026: Updated to use shipStore instead of agentStore
 * Handles view mode (3D/top-down), zoom info, zoom targets, and
 * LOD (level of detail) cluster selection based on camera distance.
 */
export function useVisualizationState() {
  const [viewMode, setViewMode] = createSignal<ViewMode>('3d')
  const [zoomInfo, setZoomInfo] = createSignal({ distance: 5, lod: 0 })
  const [zoomTarget, setZoomTarget] = createSignal<THREE.Vector3 | null>(null)

  // Select appropriate LOD clusters based on zoom level
  // Falls back to LOD0 if requested LOD has no data (server may not send all LOD levels)
  const currentSpaceClusters = createMemo(() => {
    const lod = zoomInfo().lod
    const lod0 = shipStore.synapseClustersLod0
    const lod1 = shipStore.synapseClustersLod1
    const lod2 = shipStore.synapseClustersLod2

    switch (lod) {
      case 0: return lod0
      case 1: return lod1?.length > 0 ? lod1 : lod0
      case 2: return lod2?.length > 0 ? lod2 : lod0
      default: return lod0
    }
  })

  // Maps ship clusters to the old agentClusters format for compatibility
  const agentClustersLod0 = createMemo(() => shipStore.shipClustersLod0)

  return {
    viewMode,
    setViewMode,
    zoomInfo,
    setZoomInfo,
    zoomTarget,
    setZoomTarget,
    currentSpaceClusters,
    agentClustersLod0,
  }
}
