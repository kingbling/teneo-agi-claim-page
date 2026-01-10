import { useBrainRegionStore } from '@/stores/brainRegionStore'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { cn } from '@/lib/utils'

interface RegionNavigatorProps {
  compact?: boolean
}

/**
 * RegionNavigator - Navigation buttons for brain regions
 *
 * Displays clickable buttons for each brain region. Clicking a button
 * selects that region and triggers camera navigation + highlighting.
 */
export function RegionNavigator({ compact = false }: RegionNavigatorProps) {
  const selectedRegionIndex = useBrainRegionStore((state) => state.selectedRegionIndex)
  const selectRegion = useBrainRegionStore((state) => state.selectRegion)
  const clearSelection = useBrainRegionStore((state) => state.clearSelection)

  const handleRegionClick = (index: number) => {
    if (selectedRegionIndex === index) {
      clearSelection()
    } else {
      selectRegion(index)
    }
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', compact ? 'justify-center' : 'justify-start')}>
      {FUNCTIONAL_BRAIN_REGIONS.map((region, index) => {
        const isSelected = selectedRegionIndex === index
        const rgbColor = `rgb(${Math.round(region.color.r * 255)}, ${Math.round(region.color.g * 255)}, ${Math.round(region.color.b * 255)})`

        return (
          <button
            key={region.id}
            onClick={() => handleRegionClick(index)}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-md transition-all duration-200',
              'border hover:scale-105 active:scale-95',
              isSelected
                ? 'border-white/50 shadow-lg'
                : 'border-white/20 hover:border-white/40'
            )}
            style={{
              backgroundColor: isSelected ? rgbColor : `rgba(${Math.round(region.color.r * 255)}, ${Math.round(region.color.g * 255)}, ${Math.round(region.color.b * 255)}, 0.3)`,
              color: isSelected ? '#fff' : rgbColor,
              boxShadow: isSelected ? `0 0 12px ${rgbColor}` : 'none',
            }}
            title={region.description}
          >
            {compact ? region.name.split(' ')[0] : region.name}
          </button>
        )
      })}

      {selectedRegionIndex >= 0 && (
        <button
          onClick={clearSelection}
          className="px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 border border-white/20 hover:border-white/40 bg-white/10 text-white/70 hover:text-white"
        >
          Clear
        </button>
      )}
    </div>
  )
}

/**
 * SelectedRegionInfo - Shows details about the currently selected region
 */
export function SelectedRegionInfo() {
  const getSelectedRegion = useBrainRegionStore((state) => state.getSelectedRegion)
  const region = getSelectedRegion()

  if (!region) return null

  const rgbColor = `rgb(${Math.round(region.color.r * 255)}, ${Math.round(region.color.g * 255)}, ${Math.round(region.color.b * 255)})`

  return (
    <div
      className="bg-[var(--background-primary)]/90 backdrop-blur-sm rounded-xl p-4 border"
      style={{ borderColor: `${rgbColor}50` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: rgbColor }}
        />
        <h3 className="text-sm font-semibold text-white">{region.name}</h3>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{region.description}</p>
    </div>
  )
}
