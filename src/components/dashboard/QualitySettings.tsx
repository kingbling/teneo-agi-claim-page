/**
 * QualitySettings - Panel for adjusting visual quality settings
 */

import { type Component, Show } from 'solid-js'

export type QualityPreset = 'low' | 'medium' | 'high' | 'auto'

interface QualitySettingsProps {
  // Current quality preset
  preset: QualityPreset
  onPresetChange: (preset: QualityPreset) => void
  // Post-processing toggle
  postProcessingEnabled: boolean
  onPostProcessingChange: (enabled: boolean) => void
  // Current FPS (if available)
  currentFps?: number
  // Show/hide toggle
  isExpanded?: boolean
  onToggle?: () => void
}

const PRESET_DESCRIPTIONS: Record<QualityPreset, string> = {
  low: '25K particles, no bloom',
  medium: '50K particles, subtle bloom',
  high: '80K particles, full effects',
  auto: 'Adjusts based on FPS',
}

export const QualitySettings: Component<QualitySettingsProps> = (props) => {
  return (
    <div class="pointer-events-auto">
      {/* Toggle button */}
      <button
        onClick={props.onToggle}
        class="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-700 hover:border-gray-500 transition-colors"
      >
        <span class="text-sm">⚙️</span>
        <span class="text-sm text-gray-300">Quality</span>
        <span class="text-xs text-gray-500">{props.isExpanded ? '▼' : '▶'}</span>
      </button>

      {/* Expanded panel */}
      <Show when={props.isExpanded}>
        <div class="mt-2 p-3 rounded-lg bg-black/80 backdrop-blur-sm border border-gray-700 w-52">
          <div class="text-xs text-gray-400 mb-3">Visual Quality</div>

          {/* Preset selector */}
          <div class="space-y-1 mb-4">
            {(['low', 'medium', 'high', 'auto'] as QualityPreset[]).map((preset) => (
              <button
                onClick={() => props.onPresetChange(preset)}
                class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                classList={{
                  'bg-teal-500/20 border border-teal-500/40': props.preset === preset,
                  'hover:bg-white/5': props.preset !== preset,
                }}
              >
                <div
                  class="w-2 h-2 rounded-full"
                  classList={{
                    'bg-teal-400': props.preset === preset,
                    'bg-gray-600': props.preset !== preset,
                  }}
                />
                <div class="flex-1">
                  <span
                    class="text-xs capitalize"
                    classList={{
                      'text-white font-medium': props.preset === preset,
                      'text-gray-300': props.preset !== preset,
                    }}
                  >
                    {preset}
                  </span>
                  <p class="text-[10px] text-gray-500">{PRESET_DESCRIPTIONS[preset]}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Post-processing toggle */}
          <div class="border-t border-gray-700 pt-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={props.postProcessingEnabled}
                onChange={(e) => props.onPostProcessingChange(e.currentTarget.checked)}
                class="w-4 h-4 rounded border-gray-600 bg-gray-800 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
              />
              <div>
                <span class="text-xs text-gray-300">Post-processing</span>
                <p class="text-[10px] text-gray-500">Bloom & vignette effects</p>
              </div>
            </label>
          </div>

          {/* FPS display */}
          <Show when={props.currentFps !== undefined}>
            <div class="border-t border-gray-700 pt-3 mt-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Current FPS</span>
                <span
                  class="text-sm font-mono font-bold"
                  classList={{
                    'text-green-400': (props.currentFps ?? 0) >= 55,
                    'text-yellow-400': (props.currentFps ?? 0) >= 30 && (props.currentFps ?? 0) < 55,
                    'text-red-400': (props.currentFps ?? 0) < 30,
                  }}
                >
                  {props.currentFps?.toFixed(0) ?? '--'}
                </span>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default QualitySettings
