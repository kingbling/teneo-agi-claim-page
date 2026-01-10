import type { ViewMode } from '@/types/agent'

export interface ViewModeToggleProps {
  viewMode: ViewMode
  onViewChange: (mode: ViewMode) => void
}

/**
 * ViewModeToggle - Toggle buttons for 3D/Top-Down view modes
 */
export function ViewModeToggle({ viewMode, onViewChange }: ViewModeToggleProps) {
  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2">
      <button
        onClick={() => onViewChange('3d')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          viewMode === '3d'
            ? 'bg-[var(--brand-teal-1)] text-[var(--background-primary)]'
            : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--background-primary)]'
        }`}
      >
        3D View
      </button>
      <button
        onClick={() => onViewChange('topdown')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          viewMode === 'topdown'
            ? 'bg-[var(--brand-teal-1)] text-[var(--background-primary)]'
            : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--background-primary)]'
        }`}
      >
        Top-Down
      </button>
    </div>
  )
}
