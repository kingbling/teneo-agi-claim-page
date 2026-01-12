import type { ViewMode } from '@/types/agent'

export interface ViewModeToggleProps {
  viewMode: ViewMode
  onViewChange: (mode: ViewMode) => void
}

/**
 * ViewModeToggle - Toggle buttons for 3D/Top-Down view modes
 */
export function ViewModeToggle(props: ViewModeToggleProps) {
  return (
    <div class="absolute bottom-6 right-6 flex flex-col gap-2">
      <button
        onClick={() => props.onViewChange('3d')}
        class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          props.viewMode === '3d'
            ? 'bg-[var(--brand-teal-1)] text-[var(--background-primary)]'
            : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--background-primary)]'
        }`}
      >
        3D View
      </button>
      <button
        onClick={() => props.onViewChange('topdown')}
        class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          props.viewMode === 'topdown'
            ? 'bg-[var(--brand-teal-1)] text-[var(--background-primary)]'
            : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--background-primary)]'
        }`}
      >
        Top-Down
      </button>
    </div>
  )
}
