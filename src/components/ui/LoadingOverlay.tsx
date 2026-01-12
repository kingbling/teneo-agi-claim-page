import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js'
import { Loader2, Sparkles } from 'lucide-solid'

interface LoadingOverlayProps {
  message?: string
  showTips?: boolean
}

const LOADING_TIPS = [
  'Agents explore the neural network to find undiscovered spaces',
  'Higher level traits give better bonuses to your agents',
  'Deploy multiple agents to explore faster',
  'Use keyboard shortcuts: D to deploy, R to refuel',
  'Refuel agents before they run out of points',
  'Double-click an agent card to focus the camera on it',
  'Region hotspots show you the best areas to explore',
  'Watch for discovery notifications to track your progress',
]

export function LoadingOverlay(props: LoadingOverlayProps) {
  const message = () => props.message ?? 'Loading...'
  const showTips = () => props.showTips ?? true
  const [tipIndex, setTipIndex] = createSignal(0)

  // Rotate tips every 4 seconds
  createEffect(() => {
    if (!showTips()) return
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length)
    }, 4000)
    onCleanup(() => clearInterval(interval))
  })

  return (
    <div class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300">
      <div class="relative animate-in zoom-in-95 duration-200">
        {/* Outer glow */}
        <div class="absolute -inset-[var(--space-6)] bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 rounded-[var(--radius-2xl)] blur-2xl" />

        <div class="relative bg-[var(--background-secondary)]/95 backdrop-blur-xl border border-[var(--card-border)] rounded-[var(--radius-xl)] p-[var(--space-8)] shadow-2xl max-w-sm">
          <div class="flex flex-col items-center gap-[var(--space-6)]">
            {/* Animated spinner with glow */}
            <div class="relative">
              <div class="absolute -inset-[var(--space-3)] bg-[var(--brand-teal-1)]/20 rounded-full blur-lg animate-pulse" />
              <div class="relative animate-spin">
                <Loader2 class="h-14 w-14 text-[var(--brand-teal-1)]" />
              </div>
            </div>

            {/* Message */}
            <div class="text-center">
              <p class="text-xl font-bold text-[var(--text-primary)] mb-[var(--space-3)]">{message()}</p>
              <div class="flex items-center justify-center gap-[var(--space-2)]">
                <For each={[0, 1, 2]}>
                  {(i) => (
                    <span
                      class="w-[var(--space-2)] h-[var(--space-2)] rounded-full bg-[var(--brand-teal-1)] animate-pulse"
                      style={{
                        'animation-delay': `${i * 150}ms`,
                      }}
                    />
                  )}
                </For>
              </div>
            </div>

            {/* Tips section */}
            <Show when={showTips()}>
              <div class="mt-[var(--space-2)] px-[var(--space-5)] py-[var(--space-4)] rounded-[var(--radius-xl)] bg-[var(--background-primary)]/50 border border-[var(--card-border)]/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div class="flex items-start gap-[var(--space-3)]">
                  <Sparkles class="h-[var(--space-4)] w-[var(--space-4)] text-[var(--tier-legendary)] mt-[var(--space-1)] shrink-0" />
                  <p class="text-sm text-[var(--text-secondary)] leading-relaxed">{LOADING_TIPS[tipIndex()]}</p>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
