/**
 * Region Filtering Utilities
 *
 * Filters positions (synapses, ships, etc.) by brain region bounds.
 */

import { FUNCTIONAL_BRAIN_REGIONS, type BrainRegion } from '@/constants/brainRegions'

/**
 * Check if a position falls within a region's bounds.
 */
function isPositionInRegion(
  x: number,
  y: number,
  z: number,
  region: BrainRegion
): boolean {
  const b = region.bounds
  return (
    x >= b.xMin && x <= b.xMax &&
    y >= b.yMin && y <= b.yMax &&
    z >= b.zMin && z <= b.zMax
  )
}

/**
 * Filter items by region.
 * Returns all items if regionIndex is -1 (no selection).
 */
export function filterByRegion<T extends { positionX: number; positionY: number; positionZ: number }>(
  items: T[],
  regionIndex: number
): T[] {
  // No filtering when no region selected
  if (regionIndex < 0 || regionIndex >= FUNCTIONAL_BRAIN_REGIONS.length) {
    return items
  }

  const region = FUNCTIONAL_BRAIN_REGIONS[regionIndex]
  return items.filter(item =>
    isPositionInRegion(item.positionX, item.positionY, item.positionZ, region)
  )
}
