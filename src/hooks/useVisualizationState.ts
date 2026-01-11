import { useState, useMemo } from 'react'
import * as THREE from 'three'
import { useShipStore } from '@/stores/shipStore'
import type { ViewMode } from '@/types/agent'

/**
 * useVisualizationState - Manages 3D visualization state
 *
 * Masterplan 2026: Updated to use shipStore instead of agentStore
 * Handles view mode (3D/top-down), zoom info, zoom targets, and
 * LOD (level of detail) cluster selection based on camera distance.
 */
export function useVisualizationState() {
  const [viewMode, setViewMode] = useState<ViewMode>('3d')
  const [zoomInfo, setZoomInfo] = useState({ distance: 5, lod: 0 })
  const [zoomTarget, setZoomTarget] = useState<THREE.Vector3 | null>(null)

  const {
    synapseClustersLod0,
    synapseClustersLod1,
    synapseClustersLod2,
    shipClustersLod0,
  } = useShipStore()

  // Select appropriate LOD clusters based on zoom level
  // Falls back to LOD0 if requested LOD has no data (server may not send all LOD levels)
  const currentSpaceClusters = useMemo(() => {
    switch (zoomInfo.lod) {
      case 0: return synapseClustersLod0
      case 1: return synapseClustersLod1?.length > 0 ? synapseClustersLod1 : synapseClustersLod0
      case 2: return synapseClustersLod2?.length > 0 ? synapseClustersLod2 : synapseClustersLod0
      default: return synapseClustersLod0
    }
  }, [zoomInfo.lod, synapseClustersLod0, synapseClustersLod1, synapseClustersLod2])

  // Maps ship clusters to the old agentClusters format for compatibility
  const agentClustersLod0 = shipClustersLod0

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
