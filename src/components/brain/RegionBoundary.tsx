/**
 * RegionBoundary - 3D wireframe bounding box for selected brain region
 */

import { createEffect, onCleanup } from 'solid-js'
import * as THREE from 'three'
import { useThree } from '@/three/hooks'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'

interface RegionBoundaryProps {
  selectedRegionIndex: number
}

export function RegionBoundary(props: RegionBoundaryProps) {
  const { scene } = useThree()

  let boxHelper: THREE.LineSegments | null = null
  let boxGeometry: THREE.EdgesGeometry | null = null
  let boxMaterial: THREE.LineBasicMaterial | null = null

  function cleanup() {
    const sceneObj = scene()
    if (boxHelper && sceneObj) {
      sceneObj.remove(boxHelper)
    }
    boxGeometry?.dispose()
    boxMaterial?.dispose()
    boxHelper = null
    boxGeometry = null
    boxMaterial = null
  }

  createEffect(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    const regionIndex = props.selectedRegionIndex

    // Clean up previous
    cleanup()

    // No region selected
    if (regionIndex < 0 || regionIndex >= FUNCTIONAL_BRAIN_REGIONS.length) return

    const region = FUNCTIONAL_BRAIN_REGIONS[regionIndex]
    const b = region.bounds

    // Create box geometry matching the bounding box
    const sizeX = b.xMax - b.xMin
    const sizeY = b.yMax - b.yMin
    const sizeZ = b.zMax - b.zMin
    const centerX = (b.xMin + b.xMax) / 2
    const centerY = (b.yMin + b.yMax) / 2
    const centerZ = (b.zMin + b.zMax) / 2

    const box = new THREE.BoxGeometry(sizeX, sizeY, sizeZ)
    boxGeometry = new THREE.EdgesGeometry(box)
    box.dispose()

    const color = new THREE.Color(region.color.r, region.color.g, region.color.b)
    boxMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
    })

    boxHelper = new THREE.LineSegments(boxGeometry, boxMaterial)
    boxHelper.position.set(centerX, centerY, centerZ)
    boxHelper.frustumCulled = false
    sceneObj.add(boxHelper)
  })

  onCleanup(cleanup)

  return null
}
