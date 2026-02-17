import { type Component, createSignal, onMount, Show } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { Ship, SynapseCluster, Synapse } from '@/stores/shipStore'
import { SYNAPSE_COLORS, getSynapseTypeLabel, formatPoints } from '@/types/game'
import { userStore, configStore } from '@/stores'
import { getDominantSynapseType } from '@/utils/synapseUtils'
import { log, fmt } from '@/utils/logger'

interface ExplorePromptProps {
  cluster: SynapseCluster
  synapse: Synapse | null  // Full synapse details (fetched async)
  worldPosition: THREE.Vector3
  ship: Ship
  onConfirm: () => void
  onCancel: () => void
}

export const ExplorePrompt: Component<ExplorePromptProps> = (props) => {
  const { gl } = useThree()
  const [screenPos, setScreenPos] = createSignal<{ x: number; y: number } | null>(null)
  const [isVisible, setIsVisible] = createSignal(false)

  // Log when prompt is shown
  onMount(() => {
    log.brain.info('ExplorePrompt shown - ship:', fmt.shortId(props.ship.id), '→ synapse:', fmt.shortId(props.synapse?.id))
    requestAnimationFrame(() => setIsVisible(true))
  })

  // Project 3D world position to screen coordinates each frame
  useFrame(({ camera: cam }) => {
    const pos = props.worldPosition.clone()
    pos.project(cam)

    const renderer = gl()
    if (renderer) {
      const rect = renderer.domElement.getBoundingClientRect()
      const x = (pos.x * 0.5 + 0.5) * rect.width + rect.left
      const y = (-pos.y * 0.5 + 0.5) * rect.height + rect.top
      setScreenPos({ x, y })
    }
  })

  // Get synapse type info
  const dominantType = () => getDominantSynapseType(props.cluster.typeCounts)
  const typeConfig = () => configStore.getSynapseType(dominantType())
  const typeColor = () => SYNAPSE_COLORS[dominantType()]?.rgb || { r: 0.5, g: 0.7, b: 1.0 }

  // No level gating
  const isLocked = () => false

  // Default points per minute
  const pointsPerMin = () => {
    const tc = typeConfig()
    if (!tc) return 50
    return Math.floor(tc.maxPointsPerMin / 2)
  }

  return (
    <Show when={screenPos()}>
      <div
        class="fixed pointer-events-auto transition-all duration-200"
        style={{
          left: `${screenPos()!.x}px`,
          top: `${screenPos()!.y}px`,
          transform: 'translate(-50%, -120%)',
          opacity: isVisible() ? 1 : 0,
          'z-index': 'var(--z-toast, 80)',
        }}
      >
        <div class="bg-gray-900/95 backdrop-blur-sm border border-teal-500/60 rounded-xl p-4 min-w-[240px] shadow-lg shadow-teal-500/20">
          {/* Header */}
          <div class="flex items-center gap-2 mb-3">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: `rgba(${Math.round(typeColor().r * 255)}, ${Math.round(typeColor().g * 255)}, ${Math.round(typeColor().b * 255)}, 0.2)`,
                border: `2px solid rgba(${Math.round(typeColor().r * 255)}, ${Math.round(typeColor().g * 255)}, ${Math.round(typeColor().b * 255)}, 0.6)`,
              }}
            >
              <span class="text-lg">&#129504;</span>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">{getSynapseTypeLabel(dominantType())} Synapse</h3>
              <p class="text-xs text-gray-400">{props.cluster.synapseCount} synapses in cluster</p>
            </div>
          </div>

          {/* Info grid */}
          <div class="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div class="p-2 rounded bg-gray-800/50 border border-gray-700">
              <p class="text-gray-400">Points/min</p>
              <p class="font-bold text-cyan-400">{formatPoints(pointsPerMin())}</p>
            </div>
            <div class="p-2 rounded bg-gray-800/50 border border-gray-700">
              <p class="text-gray-400">Reward</p>
              <p class="font-bold text-amber-400">{typeConfig()?.agiRewardMin}–{typeConfig()?.agiRewardMax} AGI</p>
            </div>
          </div>

          {/* Ship info */}
          <div class="text-xs text-gray-400 mb-3">
            Traveling: <span class="text-teal-400 font-medium">{props.ship.name}</span>
          </div>

          {/* Lock warning */}
          <Show when={isLocked()}>
            <div class="p-2 rounded bg-red-900/30 border border-red-500/30 mb-3 text-xs text-red-400">
              Locked
            </div>
          </Show>

          {/* Buttons */}
          <div class="flex gap-2">
            <button
              class="flex-1 py-2 px-3 bg-teal-500 hover:bg-teal-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              disabled={isLocked()}
              onClick={props.onConfirm}
            >
              Explore
            </button>
            <button
              class="flex-1 py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              onClick={props.onCancel}
            >
              Cancel
            </button>
          </div>

          {/* Arrow pointing down to synapse */}
          <div
            class="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full"
            style={{
              width: 0,
              height: 0,
              'border-left': '8px solid transparent',
              'border-right': '8px solid transparent',
              'border-top': '8px solid rgba(20, 184, 166, 0.6)',
            }}
          />
        </div>
      </div>
    </Show>
  )
}
