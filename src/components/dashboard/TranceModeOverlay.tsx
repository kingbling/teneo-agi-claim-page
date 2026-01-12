import { Show, For, createMemo } from 'solid-js'
import { Sparkles } from 'lucide-solid'

export interface TranceModeOverlayProps {
  isActive: boolean
  endTime: number | null
}

/**
 * TranceModeOverlay - Displays the 20x slowdown trance mode effect
 *
 * Extracted from DiscoveryDashboard, this component shows the
 * trance mode overlay with timer and visual effects.
 */
export function TranceModeOverlay(props: TranceModeOverlayProps) {
  const tranceRemainingMs = createMemo(() => props.endTime ? Math.max(0, props.endTime - Date.now()) : 0)
  const tranceRemainingSeconds = createMemo(() => Math.ceil(tranceRemainingMs() / 1000))
  const progressWidth = createMemo(() => `${(tranceRemainingMs() / 8000) * 100}%`)

  const particles = [0, 1, 2, 3, 4, 5]

  return (
    <Show when={props.isActive}>
      <div class="fixed inset-0 pointer-events-none z-[90] trance-fade-in">
        {/* Layered vignette for depth */}
        <div class="absolute inset-0 bg-gradient-radial from-transparent via-[hsl(var(--tier-mythic))]/20 to-[hsl(var(--tier-mythic))]/50" />
        <div class="absolute inset-0 bg-gradient-radial from-transparent to-[hsl(var(--tier-trait))]/30" />

        {/* Trance indicator - centered card */}
        <div class="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center">
          {/* Outer glow */}
          <div class="absolute -inset-8 bg-[hsl(var(--tier-mythic))]/10 rounded-3xl blur-2xl trance-glow-pulse" />

          {/* Card */}
          <div class="relative">
            {/* Animated border glow */}
            <div class="absolute -inset-px rounded-2xl bg-gradient-to-r from-[hsl(var(--tier-mythic))]/50 via-[hsl(var(--tier-trait))]/50 to-[hsl(var(--tier-mythic))]/50 trance-border-animate" />

            <div class="relative px-8 py-5 rounded-2xl bg-[var(--background-primary)]/90 backdrop-blur-xl border border-[hsl(var(--tier-mythic))]/30">
              {/* Trance icon with pulse */}
              <div class="flex items-center justify-center gap-3 mb-3">
                <div class="relative trance-icon-shake">
                  <Sparkles class="h-6 w-6 text-[hsl(var(--tier-mythic))]" />
                  <div class="absolute inset-0 trance-icon-pulse">
                    <Sparkles class="h-6 w-6 text-[hsl(var(--tier-mythic))]" />
                  </div>
                </div>
                <span class="text-[hsl(var(--tier-mythic))]/80 font-bold text-lg tracking-widest uppercase">
                  Trance Mode
                </span>
              </div>

              {/* Timer bar */}
              <div class="w-48 h-2 rounded-full bg-[hsl(var(--tier-mythic))]/50 overflow-hidden mb-3">
                <div
                  class="h-full bg-gradient-to-r from-[hsl(var(--tier-mythic))] to-[hsl(var(--tier-trait))] transition-[width] duration-100"
                  style={{ width: progressWidth() }}
                />
              </div>

              {/* Stats */}
              <div class="flex items-center justify-between text-xs">
                <span class="text-[hsl(var(--tier-mythic))]/70 font-medium">
                  20x Slowdown Active
                </span>
                <span class="text-[hsl(var(--tier-mythic))] font-bold tabular-nums">
                  {tranceRemainingSeconds()}s
                </span>
              </div>

              {/* Auto-continue hint */}
              <div class="mt-3 pt-3 border-t border-[hsl(var(--tier-mythic))]/20 text-center">
                <span class="text-[10px] text-[hsl(var(--tier-mythic))]/60 font-medium trance-text-pulse">
                  Auto-deploying when trance ends...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Corner accents */}
        <div class="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-[hsl(var(--tier-mythic))]/30 rounded-tl-3xl ml-4 mt-4 trance-corner-pulse" />
        <div class="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-[hsl(var(--tier-mythic))]/30 rounded-tr-3xl mr-4 mt-4 trance-corner-pulse delay-500" />
        <div class="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-[hsl(var(--tier-mythic))]/30 rounded-bl-3xl ml-4 mb-4 trance-corner-pulse delay-1000" />
        <div class="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-[hsl(var(--tier-mythic))]/30 rounded-br-3xl mr-4 mb-4 trance-corner-pulse delay-1500" />

        {/* Floating particles */}
        <For each={particles}>
          {(i) => (
            <div
              class="absolute w-1 h-1 rounded-full bg-[hsl(var(--tier-mythic))] trance-particle"
              style={{
                left: `${20 + (i * 12)}%`,
                top: '80%',
                '--particle-x': `${Math.sin(i) * 30}px`,
                'animation-delay': `${i * 0.3}s`,
                'animation-duration': `${4 + i * 0.5}s`,
              }}
            />
          )}
        </For>
      </div>
    </Show>
  )
}
