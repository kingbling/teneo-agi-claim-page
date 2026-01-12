import { createSignal, createEffect, onCleanup, Show, type JSX, type Component } from 'solid-js'
import { Portal } from 'solid-js/web'
import { HelpCircle, Zap, Sparkles, Fuel, Target, TrendingUp } from 'lucide-solid'

interface TooltipProps {
  content: JSX.Element
  children: JSX.Element
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  class?: string
  maxWidth?: number
}

export function Tooltip(props: TooltipProps) {
  const [isVisible, setIsVisible] = createSignal(false)
  const [coords, setCoords] = createSignal({ x: 0, y: 0 })
  let triggerRef: HTMLDivElement | undefined
  let timeoutRef: ReturnType<typeof setTimeout> | null = null

  const position = () => props.position ?? 'top'
  const delay = () => props.delay ?? 200
  const maxWidth = () => props.maxWidth ?? 280

  const updatePosition = () => {
    if (!triggerRef) return

    const rect = triggerRef.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    let x = rect.left + scrollX + rect.width / 2
    let y = rect.top + scrollY

    switch (position()) {
      case 'top':
        y = rect.top + scrollY - 10
        break
      case 'bottom':
        y = rect.bottom + scrollY + 10
        break
      case 'left':
        x = rect.left + scrollX - 10
        y = rect.top + scrollY + rect.height / 2
        break
      case 'right':
        x = rect.right + scrollX + 10
        y = rect.top + scrollY + rect.height / 2
        break
    }

    setCoords({ x, y })
  }

  const handleMouseEnter = () => {
    updatePosition()
    timeoutRef = setTimeout(() => {
      setIsVisible(true)
    }, delay())
  }

  const handleMouseLeave = () => {
    if (timeoutRef) {
      clearTimeout(timeoutRef)
    }
    setIsVisible(false)
  }

  onCleanup(() => {
    if (timeoutRef) {
      clearTimeout(timeoutRef)
    }
  })

  const getTransformOrigin = () => {
    switch (position()) {
      case 'top':
        return 'bottom center'
      case 'bottom':
        return 'top center'
      case 'left':
        return 'right center'
      case 'right':
        return 'left center'
    }
  }

  const getTransform = () => {
    switch (position()) {
      case 'top':
        return 'translate(-50%, -100%)'
      case 'bottom':
        return 'translate(-50%, 0)'
      case 'left':
        return 'translate(-100%, -50%)'
      case 'right':
        return 'translate(0, -50%)'
    }
  }

  const getArrowClass = () => {
    switch (position()) {
      case 'top':
        return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-b border-r'
      case 'bottom':
        return 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t border-l'
      case 'left':
        return 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-t border-r'
      case 'right':
        return 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-b border-l'
    }
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        class={`inline-flex ${props.class ?? ''}`}
      >
        {props.children}
      </div>

      <Show when={typeof document !== 'undefined'}>
        <Portal>
          <Show when={isVisible()}>
            <div
              class="pointer-events-none animate-in fade-in zoom-in-95 duration-150"
              style={{
                position: 'absolute',
                left: `${coords().x}px`,
                top: `${coords().y}px`,
                transform: getTransform(),
                'transform-origin': getTransformOrigin(),
                'max-width': `${maxWidth()}px`,
                'z-index': 70,
              }}
            >
              <div class="relative px-[var(--padding-4)] py-[var(--padding-3)] rounded-xl bg-[var(--background-secondary)]/98 backdrop-blur-xl border border-[var(--card-border)] shadow-2xl shadow-black/40">
                {/* Arrow */}
                <div
                  class={`absolute w-[var(--size-3)] h-[var(--size-3)] bg-[var(--background-secondary)] border-[var(--card-border)] transform rotate-45 ${getArrowClass()}`}
                />
                <div class="relative text-sm text-[var(--text-secondary)] leading-relaxed">{props.content}</div>
              </div>
            </div>
          </Show>
        </Portal>
      </Show>
    </>
  )
}

// Info tooltip trigger (small ? icon)
interface InfoTooltipProps {
  content: JSX.Element
  position?: 'top' | 'bottom' | 'left' | 'right'
  size?: 'sm' | 'default'
}

export function InfoTooltip(props: InfoTooltipProps) {
  const position = () => props.position ?? 'top'
  const size = () => props.size ?? 'default'
  const iconSize = () => (size() === 'sm' ? 'h-[var(--size-3)] w-[var(--size-3)]' : 'h-[var(--size-4)] w-[var(--size-4)]')

  return (
    <Tooltip content={props.content} position={position()}>
      <button
        type="button"
        class="inline-flex items-center justify-center p-[var(--padding-1)] rounded-full hover:bg-[var(--background-primary)] transition-colors"
      >
        <HelpCircle class={`${iconSize()} text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors`} />
      </button>
    </Tooltip>
  )
}

// Stat card with built-in tooltip
interface StatCardTooltipProps {
  icon: JSX.Element
  label: string
  value: string | number
  suffix?: string
  tooltipContent?: JSX.Element
  color?: string
  colorClass?: string
  class?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function StatCardWithTooltip(props: StatCardTooltipProps) {
  const color = () => props.color ?? 'var(--brand-teal-1)'
  const colorClass = () => props.colorClass ?? 'text-[var(--brand-teal-1)]'

  return (
    <div
      class={`group relative px-[var(--padding-5)] py-[var(--padding-4)] rounded-xl bg-[var(--background-primary)]/60 border border-transparent hover:border-[${color()}]/20 transition-all duration-200 cursor-default hover:scale-[1.02] hover:-translate-y-0.5 ${props.class ?? ''}`}
    >
      {/* Hover glow */}
      <div
        class="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(135deg, ${color()}10, transparent)` }}
      />

      <div class="relative flex items-start justify-between gap-[var(--gap-3)]">
        <div class="flex items-center gap-[var(--gap-3)]">
          <div
            class="w-[var(--size-9)] h-[var(--size-9)] rounded-lg flex items-center justify-center"
            style={{ background: `${color()}20` }}
          >
            {props.icon}
          </div>
          <div>
            <div class="flex items-center gap-[var(--gap-1)] mb-[var(--margin-1)]">
              <span class="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">{props.label}</span>
              <Show when={props.tooltipContent}>
                <InfoTooltip content={props.tooltipContent!} size="sm" />
              </Show>
            </div>
            <div class="flex items-baseline gap-[var(--gap-1)]">
              <span class={`text-xl font-bold tabular-nums ${colorClass()}`}>
                {typeof props.value === 'number' ? props.value.toLocaleString() : props.value}
              </span>
              <Show when={props.suffix}>
                <span class="text-xs text-[var(--text-muted)]">{props.suffix}</span>
              </Show>
            </div>
          </div>
        </div>

        <Show when={props.trend && props.trendValue}>
          <div
            class={`flex items-center gap-[var(--gap-1)] px-[var(--padding-2)] py-[var(--padding-1)] rounded-md text-xs font-medium ${
              props.trend === 'up'
                ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]'
                : props.trend === 'down'
                ? 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]'
                : 'bg-[var(--background-secondary)] text-[var(--text-muted)]'
            }`}
          >
            {props.trend === 'up' ? '↑' : props.trend === 'down' ? '↓' : '→'}
            {props.trendValue}
          </div>
        </Show>
      </div>
    </div>
  )
}

// Helpful tooltips for common game concepts
export const GAME_TOOLTIPS = {
  fuel: (
    <div class="space-y-[var(--gap-2)]">
      <div class="flex items-center gap-[var(--gap-2)] text-[hsl(var(--accent))] font-semibold">
        <Fuel class="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Agent Fuel</span>
      </div>
      <p class="text-[var(--text-tertiary)]">
        Fuel powers your agent's exploration. When fuel runs out, the agent returns home and becomes idle.
      </p>
      <div class="pt-[var(--padding-2)] border-t border-[var(--card-border)]">
        <span class="text-xs text-[hsl(var(--success))]">Tip: Keep agents above 200 pts to avoid interruptions</span>
      </div>
    </div>
  ),

  loot: (
    <div class="space-y-[var(--gap-2)]">
      <div class="flex items-center gap-[var(--gap-2)] text-[hsl(var(--accent))] font-semibold">
        <Sparkles class="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>AGI Loot</span>
      </div>
      <p class="text-[var(--text-tertiary)]">AGI tokens earned from discovering spaces. Rarer spaces reward more AGI!</p>
      <div class="pt-[var(--padding-2)] border-t border-[var(--card-border)] space-y-[var(--gap-1)] text-xs text-[var(--text-muted)]">
        <div class="flex justify-between">
          <span>Common</span>
          <span class="text-[hsl(var(--success))]">1-50 AGI</span>
        </div>
        <div class="flex justify-between">
          <span>Rare</span>
          <span class="text-[hsl(var(--primary))]">50-100 AGI</span>
        </div>
        <div class="flex justify-between">
          <span>Legendary</span>
          <span class="text-[hsl(var(--secondary))]">100-200 AGI</span>
        </div>
        <div class="flex justify-between">
          <span>Mythic</span>
          <span class="text-[hsl(var(--accent))]">200+ AGI</span>
        </div>
      </div>
    </div>
  ),

  efficiency: (
    <div class="space-y-[var(--gap-2)]">
      <div class="flex items-center gap-[var(--gap-2)] text-[hsl(var(--success))] font-semibold">
        <TrendingUp class="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Fleet Efficiency</span>
      </div>
      <p class="text-[var(--text-tertiary)]">Ratio of AGI earned to points spent. Higher is better!</p>
      <div class="pt-[var(--padding-2)] border-t border-[var(--card-border)] space-y-[var(--gap-1)] text-xs text-[var(--text-muted)]">
        <div class="flex justify-between">
          <span>{'< 0.5x'}</span>
          <span class="text-[hsl(var(--destructive))]">Learning</span>
        </div>
        <div class="flex justify-between">
          <span>0.5x - 1x</span>
          <span class="text-[hsl(var(--accent))]">Fair</span>
        </div>
        <div class="flex justify-between">
          <span>1x - 1.5x</span>
          <span class="text-[hsl(var(--success))]">Good</span>
        </div>
        <div class="flex justify-between">
          <span>{'> 1.5x'}</span>
          <span class="text-[hsl(var(--success))]">Excellent</span>
        </div>
      </div>
    </div>
  ),

  discovery: (
    <div class="space-y-[var(--gap-2)]">
      <div class="flex items-center gap-[var(--gap-2)] text-[var(--brand-teal-1)] font-semibold">
        <Target class="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Global Discovery</span>
      </div>
      <p class="text-[var(--text-tertiary)]">
        Percentage of all spaces in the neural network that have been discovered by all players.
      </p>
      <div class="pt-[var(--padding-2)] border-t border-[var(--card-border)]">
        <span class="text-xs text-[var(--text-muted)]">Race with others to discover rare undiscovered spaces!</span>
      </div>
    </div>
  ),

  deployAgent: (
    <div class="space-y-[var(--gap-2)]">
      <div class="flex items-center gap-[var(--gap-2)] text-[hsl(var(--accent))] font-semibold">
        <Zap class="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Deploy Agent</span>
      </div>
      <p class="text-[var(--text-tertiary)]">
        Send your idle agent to explore the network. Agents automatically search for undiscovered spaces.
      </p>
      <div class="pt-[var(--padding-2)] border-t border-[var(--card-border)]">
        <span class="text-xs text-[hsl(var(--success))]">Keyboard: Press D to deploy all idle agents</span>
      </div>
    </div>
  ),

  traits: (
    <div class="space-y-[var(--gap-2)]">
      <div class="flex items-center gap-[var(--gap-2)] text-[hsl(var(--secondary))] font-semibold">
        <Sparkles class="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Agent Traits</span>
      </div>
      <p class="text-[var(--text-tertiary)]">
        Special abilities that modify how your agent explores. Each trait has unique bonuses!
      </p>
      <div class="pt-[var(--padding-2)] border-t border-[var(--card-border)] text-xs text-[var(--text-muted)]">
        <div>
          <span class="text-[hsl(var(--secondary))]">Explorer:</span> +Discovery range
        </div>
        <div>
          <span class="text-[hsl(var(--accent))]">Solver:</span> Faster solving
        </div>
        <div>
          <span class="text-[hsl(var(--primary))]">Swift:</span> +Movement speed
        </div>
        <div>
          <span class="text-[hsl(var(--success))]">Efficient:</span> Less fuel burn
        </div>
      </div>
    </div>
  ),

  roi: (
    <div class="space-y-[var(--gap-2)]">
      <div class="flex items-center gap-[var(--gap-2)] text-[hsl(var(--success))] font-semibold">
        <TrendingUp class="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Return on Investment</span>
      </div>
      <p class="text-[var(--text-tertiary)]">
        Shows how much AGI you've earned compared to points spent. 100% = break even.
      </p>
      <div class="pt-[var(--padding-2)] border-t border-[var(--card-border)]">
        <span class="text-xs text-[var(--text-muted)]">Goal: Get above 100% to be profitable</span>
      </div>
    </div>
  ),
}
