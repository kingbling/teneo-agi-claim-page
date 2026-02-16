/**
 * BrainMinimap - 2D top-down minimap showing brain regions and camera position
 */

import { type Component, createMemo, For, Show } from 'solid-js'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { configStore } from '@/stores/configStore'

interface BrainMinimapProps {
  // Camera position in world space (x, y, z)
  cameraPosition: { x: number; y: number; z: number }
  // Camera target in world space
  cameraTarget: { x: number; y: number; z: number }
  // Current selected region index (-1 for none)
  selectedRegionIndex: number
  // Callback when clicking on the minimap to navigate
  onNavigate?: (x: number, y: number, z: number) => void
  // Show/hide the minimap
  isExpanded?: boolean
  onToggle?: () => void
}

// Map 3D brain coordinates to 2D minimap (top-down view)
// Brain bounds approximately: x: -1 to 1, y: -0.6 to 0.8, z: -1 to 1
function worldToMinimap(x: number, y: number, z: number, size: number): { x: number; y: number } {
  // Top-down view: use X and Z, ignore Y (height)
  // Normalize to 0-1 range, then scale to minimap size
  const normalizedX = (x + 1) / 2  // -1 to 1 -> 0 to 1
  const normalizedZ = (z + 1) / 2  // -1 to 1 -> 0 to 1

  return {
    x: normalizedX * size,
    y: (1 - normalizedZ) * size,  // Flip Z for correct orientation
  }
}

// Get region center in minimap coordinates
function getRegionCenter(bounds: { xMin: number; xMax: number; zMin: number; zMax: number }, size: number) {
  const centerX = (bounds.xMin + bounds.xMax) / 2
  const centerZ = (bounds.zMin + bounds.zMax) / 2
  return worldToMinimap(centerX, 0, centerZ, size)
}

// Get region size in minimap
function getRegionSize(bounds: { xMin: number; xMax: number; zMin: number; zMax: number }, size: number) {
  const width = ((bounds.xMax - bounds.xMin) / 2) * size
  const height = ((bounds.zMax - bounds.zMin) / 2) * size
  return { width: Math.max(8, width), height: Math.max(8, height) }
}

export const BrainMinimap: Component<BrainMinimapProps> = (props) => {
  const MINIMAP_SIZE = 140

  // Camera position on minimap
  const cameraOnMap = createMemo(() => {
    const pos = props.cameraPosition
    return worldToMinimap(pos.x, pos.y, pos.z, MINIMAP_SIZE)
  })

  // Camera direction angle (for indicator)
  const cameraAngle = createMemo(() => {
    const pos = props.cameraPosition
    const target = props.cameraTarget
    const dx = target.x - pos.x
    const dz = target.z - pos.z
    return Math.atan2(dz, dx) * (180 / Math.PI) + 90
  })

  // Handle minimap click to navigate
  const handleClick = (e: MouseEvent) => {
    if (!props.onNavigate) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Convert minimap coords back to world coords
    const worldX = (x / MINIMAP_SIZE) * 2 - 1
    const worldZ = (1 - y / MINIMAP_SIZE) * 2 - 1

    props.onNavigate(worldX, 0.2, worldZ)
  }

  return (
    <div class="pointer-events-auto">
      {/* Toggle button */}
      <button
        onClick={props.onToggle}
        class="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700 hover:border-gray-500 transition-colors"
      >
        <span class="text-sm">🗺️</span>
        <span class="text-sm text-gray-300">Map</span>
        <span class="text-xs text-gray-500">{props.isExpanded ? '▼' : '▶'}</span>
      </button>

      {/* Expanded minimap */}
      <Show when={props.isExpanded}>
        <div class="mt-2 p-2 rounded-lg bg-black/80 backdrop-blur-sm border border-gray-700">
          <div
            class="relative rounded overflow-hidden cursor-crosshair"
            style={{ width: `${MINIMAP_SIZE}px`, height: `${MINIMAP_SIZE}px` }}
            onClick={handleClick}
          >
            {/* Background - dark brain shape approximation */}
            <div class="absolute inset-0 bg-gray-900 rounded-full opacity-50" />

            {/* Brain outline (ellipse) */}
            <svg
              class="absolute inset-0"
              viewBox={`0 0 ${MINIMAP_SIZE} ${MINIMAP_SIZE}`}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Brain outline */}
              <ellipse
                cx={MINIMAP_SIZE / 2}
                cy={MINIMAP_SIZE / 2}
                rx={MINIMAP_SIZE / 2 - 4}
                ry={MINIMAP_SIZE / 2 - 4}
                fill="none"
                stroke="rgba(100, 116, 139, 0.4)"
                stroke-width="1"
              />

              {/* Region markers (enabled only) */}
              <For each={FUNCTIONAL_BRAIN_REGIONS}>
                {(region, index) => {
                  const enabledIds = () => new Set(configStore.enabledRegions.map((n: string) => n.replace(/_/g, '-')))
                  const isEnabled = () => enabledIds().has(region.id)
                  const center = getRegionCenter(region.bounds, MINIMAP_SIZE)
                  const size = getRegionSize(region.bounds, MINIMAP_SIZE)
                  const isSelected = index() === props.selectedRegionIndex
                  const color = `rgb(${Math.round(region.color.r * 255)}, ${Math.round(region.color.g * 255)}, ${Math.round(region.color.b * 255)})`

                  return (
                    <Show when={isEnabled()}>
                      <g>
                        {/* Region area (subtle) */}
                        <ellipse
                          cx={center.x}
                          cy={center.y}
                          rx={size.width / 2}
                          ry={size.height / 2}
                          fill={color}
                          fill-opacity={isSelected ? 0.5 : 0.15}
                          stroke={isSelected ? color : 'transparent'}
                          stroke-width={isSelected ? 2 : 0}
                        />
                        {/* Region center dot */}
                        <circle
                          cx={center.x}
                          cy={center.y}
                          r={isSelected ? 4 : 2}
                          fill={color}
                          fill-opacity={isSelected ? 1 : 0.6}
                        />
                      </g>
                    </Show>
                  )
                }}
              </For>

              {/* Camera position indicator */}
              <g transform={`translate(${cameraOnMap().x}, ${cameraOnMap().y})`}>
                {/* Camera cone/FOV indicator */}
                <g transform={`rotate(${cameraAngle()})`}>
                  {/* View direction triangle */}
                  <polygon
                    points="0,-12 -5,4 5,4"
                    fill="rgba(20, 184, 166, 0.6)"
                    stroke="rgb(20, 184, 166)"
                    stroke-width="1"
                  />
                </g>
                {/* Camera center dot */}
                <circle
                  r="4"
                  fill="rgb(20, 184, 166)"
                  stroke="white"
                  stroke-width="1.5"
                />
              </g>
            </svg>

            {/* Legend */}
            <div class="absolute bottom-1 left-1 text-[8px] text-gray-500">
              Click to navigate
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default BrainMinimap
