import { createSignal, createEffect, onCleanup, Show, For, type JSX } from 'solid-js'
import { cn } from '@/lib/utils'
import {
  Lightbulb,
  X,
  ChevronRight,
  Rocket,
  Fuel,
  Sparkles,
  Trophy,
  Zap,
  Brain,
  Users,
  TrendingUp,
  HelpCircle,
} from 'lucide-solid'

// Game tips for new players
const GAME_TIPS = [
  {
    id: 'fuel',
    icon: () => <Fuel class="w-5 h-5" />,
    title: 'Keep Fuel Topped Up',
    description: 'Agents burn fuel while exploring. Low fuel agents move slower and earn less. Refuel before they run dry!',
    color: 'amber',
  },
  {
    id: 'deploy',
    icon: () => <Rocket class="w-5 h-5" />,
    title: 'Deploy Smart',
    description: 'Deploy agents to regions with fewer explorers. Less competition means faster discoveries!',
    color: 'cyan',
  },
  {
    id: 'traits',
    icon: () => <Sparkles class="w-5 h-5" />,
    title: 'Choose Traits Wisely',
    description: 'Each trait has trade-offs. Explorers find more spaces but burn more fuel. Mix traits for best results.',
    color: 'purple',
  },
  {
    id: 'loot',
    icon: () => <Trophy class="w-5 h-5" />,
    title: 'Rare Spaces = Big Rewards',
    description: 'Some spaces contain legendary rewards. Team discoveries split loot but find more spaces.',
    color: 'yellow',
  },
  {
    id: 'efficiency',
    icon: () => <TrendingUp class="w-5 h-5" />,
    title: 'Watch Your ROI',
    description: 'Track your fleet ROI. If it drops below 100%, you are losing points. Optimize or refuel!',
    color: 'green',
  },
  {
    id: 'hotkeys',
    icon: () => <Zap class="w-5 h-5" />,
    title: 'Use Keyboard Shortcuts',
    description: 'Press D to deploy all idle agents, R to refuel all, F to focus on selected agent.',
    color: 'blue',
  },
  {
    id: 'regions',
    icon: () => <Brain class="w-5 h-5" />,
    title: 'Explore All Regions',
    description: 'Different brain regions have different discovery densities. Spread your fleet for best coverage.',
    color: 'pink',
  },
  {
    id: 'community',
    icon: () => <Users class="w-5 h-5" />,
    title: 'Team Up for Mythics',
    description: 'Mythic spaces need multiple agents solving at once. Coordinate with other players for massive rewards!',
    color: 'teal',
  },
]

const colorStyles: Record<string, { bg: string; border: string; icon: string }> = {
  amber: { bg: 'bg-[var(--tier-legendary)]/10', border: 'border-[var(--tier-legendary)]/25', icon: 'text-[var(--tier-legendary)]' },
  cyan: { bg: 'bg-[var(--state-wandering)]/10', border: 'border-[var(--state-wandering)]/25', icon: 'text-[var(--state-wandering)]' },
  purple: { bg: 'bg-[var(--tier-trait)]/10', border: 'border-[var(--tier-trait)]/25', icon: 'text-[var(--tier-trait)]' },
  yellow: { bg: 'bg-[var(--state-solving)]/10', border: 'border-[var(--state-solving)]/25', icon: 'text-[var(--state-solving)]' },
  green: { bg: 'bg-[var(--brand-green-4)]/10', border: 'border-[var(--brand-green-4)]/25', icon: 'text-[var(--brand-green-4)]' },
  blue: { bg: 'bg-[var(--brand-blue-2)]/10', border: 'border-[var(--brand-blue-2)]/25', icon: 'text-[var(--brand-blue-2)]' },
  pink: { bg: 'bg-[var(--tier-mythic)]/10', border: 'border-[var(--tier-mythic)]/25', icon: 'text-[var(--tier-mythic)]' },
  teal: { bg: 'bg-[var(--brand-teal-1)]/10', border: 'border-[var(--brand-teal-1)]/25', icon: 'text-[var(--brand-teal-1)]' },
}

// Rotating tip banner for sidebar/header
interface TipBannerProps {
  class?: string
  autoRotate?: boolean
  rotateInterval?: number
}

export function TipBanner(props: TipBannerProps) {
  const [currentIndex, setCurrentIndex] = createSignal(0)
  const [isVisible, setIsVisible] = createSignal(true)

  // Auto-rotate tips
  createEffect(() => {
    const autoRotate = props.autoRotate ?? true
    const rotateInterval = props.rotateInterval ?? 8000
    if (!autoRotate || !isVisible()) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % GAME_TIPS.length)
    }, rotateInterval)

    onCleanup(() => clearInterval(interval))
  })

  const tip = () => GAME_TIPS[currentIndex()]
  const styles = () => colorStyles[tip().color]

  return (
    <Show when={isVisible()}>
      <div
        class={cn(
          'relative rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300',
          'p-4',
          styles().bg,
          styles().border,
          props.class
        )}
      >
        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          class="absolute top-[var(--space-2)] right-[var(--space-2)] p-[var(--space-1)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-primary)]/50 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>

        <div class="flex items-start gap-[var(--gap-items)] pr-[var(--space-6)]">
          <div class={cn('p-[var(--space-2)] rounded-lg', styles().bg, styles().icon)}>
            {tip().icon()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
              <Lightbulb class="w-3 h-3 text-[var(--text-muted)]" />
              <span class="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Tip</span>
            </div>
            <h4 class="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-1)]">{tip().title}</h4>
            <p class="text-xs text-[var(--text-tertiary)] leading-relaxed">{tip().description}</p>
          </div>
        </div>

        {/* Navigation dots */}
        <div class="flex items-center justify-center gap-[var(--space-2)] mt-[var(--gap-items)]">
          <For each={GAME_TIPS}>
            {(_, index) => (
              <button
                onClick={() => setCurrentIndex(index())}
                class={cn(
                  'h-[var(--space-2)] rounded-full transition-all',
                  index() === currentIndex()
                    ? 'w-4 bg-[var(--text-primary)]'
                    : 'w-[var(--space-2)] bg-[var(--text-muted)]/50 hover:bg-[var(--text-muted)]'
                )}
              />
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}

// Full tips panel for help modal
interface TipsPanelProps {
  class?: string
}

export function TipsPanel(props: TipsPanelProps) {
  return (
    <div class={cn('space-y-4', props.class)}>
      <div class="flex items-center gap-[var(--gap-items)] mb-[var(--space-6)]">
        <div class="p-2.5 rounded-xl bg-[var(--brand-teal-1)]/10">
          <HelpCircle class="w-5 h-5 text-[var(--brand-teal-1)]" />
        </div>
        <div>
          <h3 class="text-lg font-bold text-[var(--text-primary)]">Game Tips</h3>
          <p class="text-sm text-[var(--text-muted)]">Master the neural network</p>
        </div>
      </div>

      <div class="grid gap-[var(--gap-items)]">
        <For each={GAME_TIPS}>
          {(tip) => {
            const styles = colorStyles[tip.color]
            return (
              <div
                class={cn(
                  'flex items-start rounded-xl border transition-all hover:scale-[1.01]',
                  'gap-4 p-4',
                  styles.bg,
                  styles.border
                )}
              >
                <div class={cn('p-2.5 rounded-lg shrink-0', styles.bg, styles.icon)}>
                  {tip.icon()}
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-1)]">{tip.title}</h4>
                  <p class="text-sm text-[var(--text-tertiary)] leading-relaxed">{tip.description}</p>
                </div>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

// Quick tip toast for contextual help
interface QuickTipProps {
  tipId: string
  onDismiss?: () => void
  class?: string
}

export function QuickTip(props: QuickTipProps) {
  const tip = () => GAME_TIPS.find((t) => t.id === props.tipId)

  return (
    <Show when={tip()}>
      {(tipData) => {
        const styles = () => colorStyles[tipData().color]
        return (
          <div
            class={cn(
              'flex items-start rounded-xl border shadow-lg animate-in slide-in-from-right duration-300',
              'gap-[var(--gap-items)] p-4',
              styles().bg,
              styles().border,
              props.class
            )}
          >
            <div class={cn('p-[var(--space-2)] rounded-lg shrink-0', styles().bg, styles().icon)}>
              {tipData().icon()}
            </div>
            <div class="flex-1">
              <h4 class="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-1)]">{tipData().title}</h4>
              <p class="text-xs text-[var(--text-tertiary)] leading-relaxed">{tipData().description}</p>
            </div>
            <Show when={props.onDismiss}>
              <button
                onClick={props.onDismiss}
                class="p-[var(--space-1)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-primary)]/50 transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </Show>
          </div>
        )
      }}
    </Show>
  )
}

// Onboarding checklist for new players
interface OnboardingChecklistProps {
  completedSteps?: string[]
  onStepClick?: (stepId: string) => void
  class?: string
}

const ONBOARDING_STEPS = [
  { id: 'login', title: 'Connect Wallet', description: 'Link your wallet to start playing' },
  { id: 'create-agent', title: 'Create Your First Agent', description: 'Build an exploration bot' },
  { id: 'add-fuel', title: 'Add Fuel', description: 'Give your agent points to burn' },
  { id: 'deploy', title: 'Deploy to Network', description: 'Send your agent exploring' },
  { id: 'discover', title: 'Make a Discovery', description: 'Find your first space' },
]

export function OnboardingChecklist(props: OnboardingChecklistProps) {
  const completedSteps = () => props.completedSteps ?? []
  const completedCount = () => completedSteps().length
  const totalSteps = ONBOARDING_STEPS.length
  const progress = () => (completedCount() / totalSteps) * 100

  return (
    <div class={cn('space-y-4', props.class)}>
      {/* Header */}
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold text-[var(--text-primary)]">Getting Started</h4>
        <span class="text-xs font-medium text-[var(--text-muted)]">
          {completedCount()}/{totalSteps} complete
        </span>
      </div>

      {/* Progress bar */}
      <div class="h-[var(--space-2)] rounded-full bg-[var(--background-tertiary)] overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] transition-all duration-500"
          style={{ width: `${progress()}%` }}
        />
      </div>

      {/* Steps */}
      <div class="space-y-[var(--space-2)]">
        <For each={ONBOARDING_STEPS}>
          {(step, index) => {
            const isCompleted = () => completedSteps().includes(step.id)
            const isNext = () => !isCompleted() && completedSteps().length === index()

            return (
              <button
                onClick={() => props.onStepClick?.(step.id)}
                disabled={!isNext() && !isCompleted()}
                class={cn(
                  'w-full flex items-center rounded-xl text-left transition-all',
                  'gap-[var(--gap-items)] p-[var(--gap-items)]',
                  isCompleted()
                    ? 'bg-[var(--brand-green-4)]/10 border border-[var(--brand-green-4)]/20'
                    : isNext()
                    ? 'bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30 hover:bg-[var(--brand-teal-1)]/15 cursor-pointer'
                    : 'bg-[var(--background-primary)]/50 border border-transparent opacity-50'
                )}
              >
                {/* Step number/check */}
                <div
                  class={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    isCompleted()
                      ? 'bg-[var(--brand-green-4)] text-white'
                      : isNext()
                      ? 'bg-[var(--brand-teal-1)] text-[var(--brand-neutral-1)]'
                      : 'bg-[var(--background-tertiary)] text-[var(--text-muted)]'
                  )}
                >
                  {isCompleted() ? '✓' : index() + 1}
                </div>

                {/* Content */}
                <div class="flex-1">
                  <span
                    class={cn(
                      'text-sm font-medium block',
                      isCompleted()
                        ? 'text-[var(--brand-green-4)]'
                        : isNext()
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)]'
                    )}
                  >
                    {step.title}
                  </span>
                  <span class="text-xs text-[var(--text-tertiary)]">{step.description}</span>
                </div>

                {/* Arrow for next step */}
                <Show when={isNext()}>
                  <ChevronRight class="w-4 h-4 text-[var(--brand-teal-1)]" />
                </Show>
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}

// Floating help button
interface FloatingHelpButtonProps {
  onClick?: () => void
  class?: string
}

export function FloatingHelpButton(props: FloatingHelpButtonProps) {
  return (
    <button
      onClick={props.onClick}
      class={cn(
        'fixed z-50',
        'bottom-[var(--space-6)] right-[var(--space-6)]',
        'w-14 h-14 rounded-full',
        'bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)]',
        'text-white shadow-lg shadow-[var(--brand-teal-1)]/30',
        'flex items-center justify-center',
        'hover:shadow-xl hover:shadow-[var(--brand-teal-1)]/40 hover:scale-110 active:scale-95 transition-all',
        props.class
      )}
    >
      <HelpCircle class="w-6 h-6" />
    </button>
  )
}

// Keyboard shortcuts reference
export function KeyboardShortcutsReference(props: { class?: string }) {
  const shortcuts = [
    { key: 'D', description: 'Deploy all idle agents' },
    { key: 'R', description: 'Refuel all low agents' },
    { key: 'Shift+R', description: 'Refuel selected agent' },
    { key: 'F', description: 'Focus camera on selected' },
    { key: '?', description: 'Show help' },
  ]

  return (
    <div class={cn('space-y-[var(--gap-items)]', props.class)}>
      <h4 class="text-sm font-semibold text-[var(--text-primary)] mb-[var(--gap-items)]">Keyboard Shortcuts</h4>
      <div class="space-y-[var(--space-2)]">
        <For each={shortcuts}>
          {(shortcut) => (
            <div class="flex items-center justify-between">
              <span class="text-sm text-[var(--text-tertiary)]">{shortcut.description}</span>
              <kbd class="hotkey-hint">{shortcut.key}</kbd>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

export { GAME_TIPS }
