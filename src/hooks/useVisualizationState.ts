import { useState, useMemo } from 'react'
import * as THREE from 'three'
import { useAgentStore } from '@/stores/agentStore'
import type { ViewMode } from '@/types/agent'

/**
 * useVisualizationState - Manages 3D visualization state
 *
 * Handles view mode (3D/top-down), zoom info, zoom targets, and
 * LOD (level of detail) cluster selection based on camera distance.
 */
export function useVisualizationState() {
  const [viewMode, setViewMode] = useState<ViewMode>('3d')
  const [zoomInfo, setZoomInfo] = useState({ distance: 5, lod: 0 })
  const [zoomTarget, setZoomTarget] = useState<THREE.Vector3 | null>(null)

  const {
    spaceClustersLod0,
    spaceClustersLod1,
    spaceClustersLod2,
    agentClustersLod0,
  } = useAgentStore()

  // Select appropriate LOD clusters based on zoom level
  const currentSpaceClusters = useMemo(() => {
    switch (zoomInfo.lod) {
      case 0: return spaceClustersLod0
      case 1: return spaceClustersLod1
      case 2: return spaceClustersLod2
      default: return spaceClustersLod0
    }
  }, [zoomInfo.lod, spaceClustersLod0, spaceClustersLod1, spaceClustersLod2])

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
