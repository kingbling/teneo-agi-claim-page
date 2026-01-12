import { createSignal, createEffect, Show, For, type Component } from 'solid-js'
import { X, ChevronRight, ChevronLeft, Sparkles, Brain, Zap, Target, Fuel, Trophy } from 'lucide-solid'
import { Button } from '@/components/ui/button'

interface OnboardingGuideProps {
  onComplete: () => void
  userAgentsCount: number
}

const ONBOARDING_STEPS = [
  {
    title: "Welcome to TENEO Discovery",
    description: "You're about to explore the neural network and discover hidden spaces. Let's get you started with the basics!",
    icon: Sparkles,
    color: 'teal',
    tip: "This is an exploration game where you deploy agents to find undiscovered spaces.",
  },
  {
    title: "Create Your First Agent",
    description: "Agents are your explorers. Each agent can have unique traits that give them special abilities while exploring.",
    icon: Brain,
    color: 'purple',
    tip: "Click 'Create New Agent' in the left panel to build your first explorer.",
  },
  {
    title: "Deploy and Explore",
    description: "Once you have an agent, deploy them to the neural network. They'll autonomously search for undiscovered spaces.",
    icon: Target,
    color: 'blue',
    tip: "Use the Deploy button or press 'D' to send idle agents exploring.",
  },
  {
    title: "Earn Rewards",
    description: "When your agents discover new spaces, you earn AGI points! The rarer the discovery, the bigger the reward.",
    icon: Zap,
    color: 'yellow',
    tip: "Watch for golden notifications - those are your discoveries!",
  },
  {
    title: "Manage Fuel",
    description: "Agents consume fuel (points) while exploring. Keep them refueled to maximize their exploration time.",
    icon: Fuel,
    color: 'orange',
    tip: "Press 'R' to quickly refuel all agents that are running low.",
  },
  {
    title: "Climb the Ranks",
    description: "Compete with other explorers to discover the most spaces. Check region hotspots to find the best exploration opportunities!",
    icon: Trophy,
    color: 'green',
    tip: "Hot regions have more undiscovered spaces waiting for you!",
  },
]

const colorStyles = {
  teal: {
    bg: 'bg-[var(--brand-teal-1)]/10',
    border: 'border-[var(--brand-teal-1)]/30',
    text: 'text-[var(--brand-teal-1)]',
    glow: 'shadow-[var(--brand-teal-1)]/20',
  },
  purple: {
    bg: 'bg-[var(--secondary)]/10',
    border: 'border-[var(--secondary)]/30',
    text: 'text-[var(--secondary)]',
    glow: 'shadow-[var(--secondary)]/20',
  },
  blue: {
    bg: 'bg-[var(--brand-blue-2)]/10',
    border: 'border-[var(--brand-blue-2)]/30',
    text: 'text-[var(--brand-blue-2)]',
    glow: 'shadow-[var(--brand-blue-2)]/20',
  },
  yellow: {
    bg: 'bg-[var(--state-solving)]/10',
    border: 'border-[var(--state-solving)]/30',
    text: 'text-[var(--state-solving)]',
    glow: 'shadow-[var(--state-solving)]/20',
  },
  orange: {
    bg: 'bg-[var(--state-limping)]/10',
    border: 'border-[var(--state-limping)]/30',
    text: 'text-[var(--state-limping)]',
    glow: 'shadow-[var(--state-limping)]/20',
  },
  green: {
    bg: 'bg-[var(--brand-green-4)]/10',
    border: 'border-[var(--brand-green-4)]/30',
    text: 'text-[var(--brand-green-4)]',
    glow: 'shadow-[var(--brand-green-4)]/20',
  },
}

export const OnboardingGuide: Component<OnboardingGuideProps> = (props) => {
  const [currentStep, setCurrentStep] = createSignal(0)
  const [isVisible, setIsVisible] = createSignal(true)

  // Check if user has already seen onboarding
  createEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('teneo.hasSeenOnboarding')
    if (hasSeenOnboarding === 'true' || props.userAgentsCount > 0) {
      setIsVisible(false)
    }
  })

  const handleNext = () => {
    if (currentStep() < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep() > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleComplete = () => {
    localStorage.setItem('teneo.hasSeenOnboarding', 'true')
    setIsVisible(false)
    props.onComplete()
  }

  const handleSkip = () => {
    localStorage.setItem('teneo.hasSeenOnboarding', 'true')
    setIsVisible(false)
    props.onComplete()
  }

  const step = () => ONBOARDING_STEPS[currentStep()]
  const Icon = () => step().icon
  const colors = () => colorStyles[step().color as keyof typeof colorStyles]
  const progress = () => ((currentStep() + 1) / ONBOARDING_STEPS.length) * 100

  return (
    <Show when={isVisible()}>
      <div
        class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] px-[var(--space-4)] animate-in fade-in duration-300"
        onClick={(e) => e.target === e.currentTarget && handleSkip()}
      >
        <div class="relative w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          {/* Outer glow */}
          <div class="absolute -inset-[var(--space-2)] bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 rounded-[var(--radius-2xl)] blur-xl" />

          <div class="relative bg-[var(--background-secondary)] border border-[var(--card-border)] rounded-[var(--radius-xl)] shadow-2xl overflow-hidden">
            {/* Progress bar */}
            <div class="h-[var(--space-1)] bg-[var(--background-primary)]">
              <div
                class="h-full bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] transition-all duration-300"
                style={{ width: `${progress()}%` }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={handleSkip}
              class="absolute top-[var(--space-5)] right-[var(--space-5)] w-[var(--space-8)] h-[var(--space-8)] rounded-[var(--radius-md)] bg-[var(--background-primary)]/50 hover:bg-[var(--background-primary)] flex items-center justify-center transition-colors z-10"
            >
              <X class="h-[var(--space-5)] w-[var(--space-5)] text-[var(--text-muted)]" />
            </button>

            {/* Content */}
            <div class="p-[var(--space-8)] pt-[var(--space-6)]">
              {/* Step indicator */}
              <div class="flex items-center gap-[var(--space-2)] mb-[var(--space-6)]">
                <For each={ONBOARDING_STEPS}>
                  {(_, i) => (
                    <div
                      class={`h-[var(--space-2)] rounded-full transition-all duration-300 ${
                        i() === currentStep()
                          ? 'w-[var(--space-8)] bg-[var(--brand-teal-1)]'
                          : i() < currentStep()
                          ? 'w-[var(--space-4)] bg-[var(--brand-teal-1)]/50'
                          : 'w-[var(--space-4)] bg-[var(--background-tertiary)]'
                      }`}
                    />
                  )}
                </For>
              </div>

              {/* Icon */}
              <div class="mb-[var(--space-6)] animate-in zoom-in-50 spin-in-180 duration-500">
                <div
                  class={`inline-flex p-[var(--space-5)] rounded-[var(--radius-xl)] ${colors().bg} border ${colors().border} shadow-lg ${colors().glow}`}
                >
                  <Icon class={`h-[var(--space-10)] w-[var(--space-10)] ${colors().text}`} />
                </div>
              </div>

              {/* Title & Description */}
              <div class="animate-in slide-in-from-right-4 duration-300">
                <h2 class="text-2xl font-bold text-[var(--text-primary)] mb-[var(--space-3)]">{step().title}</h2>
                <p class="text-base text-[var(--text-secondary)] leading-relaxed mb-[var(--space-5)]">
                  {step().description}
                </p>

                {/* Tip box */}
                <div
                  class={`flex items-start gap-[var(--space-3)] px-[var(--space-5)] py-[var(--space-4)] rounded-[var(--radius-lg)] ${colors().bg} border ${colors().border}`}
                >
                  <Sparkles class={`h-[var(--space-5)] w-[var(--space-5)] ${colors().text} mt-[var(--space-1)] shrink-0`} />
                  <p class={`text-sm ${colors().text} font-medium leading-relaxed`}>{step().tip}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div class="px-[var(--space-8)] pb-[var(--space-8)] pt-[var(--space-2)] flex items-center justify-between gap-[var(--space-4)]">
              <Button variant="ghost" onClick={handlePrev} disabled={currentStep() === 0} class="gap-[var(--space-2)]">
                <ChevronLeft class="h-[var(--space-4)] w-[var(--space-4)]" />
                Back
              </Button>

              <div class="flex items-center gap-[var(--space-3)]">
                <button
                  onClick={handleSkip}
                  class="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors px-[var(--space-3)] py-[var(--space-2)]"
                >
                  Skip tour
                </button>
                <Button onClick={handleNext} class="gap-[var(--space-2)] px-[var(--space-6)]">
                  <Show
                    when={currentStep() === ONBOARDING_STEPS.length - 1}
                    fallback={
                      <>
                        Next
                        <ChevronRight class="h-[var(--space-4)] w-[var(--space-4)]" />
                      </>
                    }
                  >
                    Let's Go!
                  </Show>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
