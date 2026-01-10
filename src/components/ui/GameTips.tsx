import * as React from 'react'
import { motion } from 'framer-motion'
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
} from 'lucide-react'

// Game tips for new players
const GAME_TIPS = [
  {
    id: 'fuel',
    icon: <Fuel className="w-5 h-5" />,
    title: 'Keep Fuel Topped Up',
    description: 'Agents burn fuel while exploring. Low fuel agents move slower and earn less. Refuel before they run dry!',
    color: 'amber',
  },
  {
    id: 'deploy',
    icon: <Rocket className="w-5 h-5" />,
    title: 'Deploy Smart',
    description: 'Deploy agents to regions with fewer explorers. Less competition means faster discoveries!',
    color: 'cyan',
  },
  {
    id: 'traits',
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Choose Traits Wisely',
    description: 'Each trait has trade-offs. Explorers find more spaces but burn more fuel. Mix traits for best results.',
    color: 'purple',
  },
  {
    id: 'loot',
    icon: <Trophy className="w-5 h-5" />,
    title: 'Rare Spaces = Big Rewards',
    description: 'Some spaces contain legendary rewards. Team discoveries split loot but find more spaces.',
    color: 'yellow',
  },
  {
    id: 'efficiency',
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Watch Your ROI',
    description: 'Track your fleet ROI. If it drops below 100%, you are losing points. Optimize or refuel!',
    color: 'green',
  },
  {
    id: 'hotkeys',
    icon: <Zap className="w-5 h-5" />,
    title: 'Use Keyboard Shortcuts',
    description: 'Press D to deploy all idle agents, R to refuel all, F to focus on selected agent.',
    color: 'blue',
  },
  {
    id: 'regions',
    icon: <Brain className="w-5 h-5" />,
    title: 'Explore All Regions',
    description: 'Different brain regions have different discovery densities. Spread your fleet for best coverage.',
    color: 'pink',
  },
  {
    id: 'community',
    icon: <Users className="w-5 h-5" />,
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
  className?: string
  autoRotate?: boolean
  rotateInterval?: number
}

export function TipBanner({ className, autoRotate = true, rotateInterval = 8000 }: TipBannerProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [isVisible, setIsVisible] = React.useState(true)

  // Auto-rotate tips
  React.useEffect(() => {
    if (!autoRotate || !isVisible) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % GAME_TIPS.length)
    }, rotateInterval)

    return () => clearInterval(interval)
  }, [autoRotate, rotateInterval, isVisible])

  const tip = GAME_TIPS[currentIndex]
  const styles = colorStyles[tip.color]

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-xl border',
        'p-4',
        styles.bg,
        styles.border,
        className
      )}
    >
      {/* Close button */}
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-[var(--space-2)] right-[var(--space-2)] p-[var(--space-1)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-primary)]/50 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-[var(--gap-items)] pr-[var(--space-6)]">
        <div className={cn('p-[var(--space-2)] rounded-lg', styles.bg, styles.icon)}>
          {tip.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
            <Lightbulb className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Tip</span>
          </div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-1)]">{tip.title}</h4>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{tip.description}</p>
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-[var(--space-2)] mt-[var(--gap-items)]">
        {GAME_TIPS.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              'w-[var(--space-2)] h-[var(--space-2)] rounded-full transition-all',
              index === currentIndex
                ? 'w-4 bg-[var(--text-primary)]'
                : 'bg-[var(--text-muted)]/50 hover:bg-[var(--text-muted)]'
            )}
          />
        ))}
      </div>
    </motion.div>
  )
}

// Full tips panel for help modal
interface TipsPanelProps {
  className?: string
}

export function TipsPanel({ className }: TipsPanelProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-[var(--gap-items)] mb-[var(--space-6)]">
        <div className="p-2.5 rounded-xl bg-[var(--brand-teal-1)]/10">
          <HelpCircle className="w-5 h-5 text-[var(--brand-teal-1)]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Game Tips</h3>
          <p className="text-sm text-[var(--text-muted)]">Master the neural network</p>
        </div>
      </div>

      <div className="grid gap-[var(--gap-items)]">
        {GAME_TIPS.map((tip) => {
          const styles = colorStyles[tip.color]
          return (
            <div
              key={tip.id}
              className={cn(
                'flex items-start rounded-xl border transition-all hover:scale-[1.01]',
                'gap-4 p-4',
                styles.bg,
                styles.border
              )}
            >
              <div className={cn('p-2.5 rounded-lg shrink-0', styles.bg, styles.icon)}>
                {tip.icon}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-1)]">{tip.title}</h4>
                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{tip.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Quick tip toast for contextual help
interface QuickTipProps {
  tipId: string
  onDismiss?: () => void
  className?: string
}

export function QuickTip({ tipId, onDismiss, className }: QuickTipProps) {
  const tip = GAME_TIPS.find((t) => t.id === tipId)
  if (!tip) return null

  const styles = colorStyles[tip.color]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        'flex items-start rounded-xl border shadow-lg',
        'gap-[var(--gap-items)] p-4',
        styles.bg,
        styles.border,
        className
      )}
    >
      <div className={cn('p-[var(--space-2)] rounded-lg shrink-0', styles.bg, styles.icon)}>
        {tip.icon}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-1)]">{tip.title}</h4>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{tip.description}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-[var(--space-1)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-primary)]/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  )
}

// Onboarding checklist for new players
interface OnboardingChecklistProps {
  completedSteps?: string[]
  onStepClick?: (stepId: string) => void
  className?: string
}

const ONBOARDING_STEPS = [
  { id: 'login', title: 'Connect Wallet', description: 'Link your wallet to start playing' },
  { id: 'create-agent', title: 'Create Your First Agent', description: 'Build an exploration bot' },
  { id: 'add-fuel', title: 'Add Fuel', description: 'Give your agent points to burn' },
  { id: 'deploy', title: 'Deploy to Network', description: 'Send your agent exploring' },
  { id: 'discover', title: 'Make a Discovery', description: 'Find your first space' },
]

export function OnboardingChecklist({
  completedSteps = [],
  onStepClick,
  className,
}: OnboardingChecklistProps) {
  const completedCount = completedSteps.length
  const totalSteps = ONBOARDING_STEPS.length
  const progress = (completedCount / totalSteps) * 100

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Getting Started</h4>
        <span className="text-xs font-medium text-[var(--text-muted)]">
          {completedCount}/{totalSteps} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-[var(--space-2)] rounded-full bg-[var(--background-tertiary)] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-[var(--space-2)]">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id)
          const isNext = !isCompleted && completedSteps.length === index

          return (
            <button
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              disabled={!isNext && !isCompleted}
              className={cn(
                'w-full flex items-center rounded-xl text-left transition-all',
                'gap-[var(--gap-items)] p-[var(--gap-items)]',
                isCompleted
                  ? 'bg-[var(--brand-green-4)]/10 border border-[var(--brand-green-4)]/20'
                  : isNext
                  ? 'bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30 hover:bg-[var(--brand-teal-1)]/15 cursor-pointer'
                  : 'bg-[var(--background-primary)]/50 border border-transparent opacity-50'
              )}
            >
              {/* Step number/check */}
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                  isCompleted
                    ? 'bg-[var(--brand-green-4)] text-white'
                    : isNext
                    ? 'bg-[var(--brand-teal-1)] text-[var(--brand-neutral-1)]'
                    : 'bg-[var(--background-tertiary)] text-[var(--text-muted)]'
                )}
              >
                {isCompleted ? '✓' : index + 1}
              </div>

              {/* Content */}
              <div className="flex-1">
                <span
                  className={cn(
                    'text-sm font-medium block',
                    isCompleted
                      ? 'text-[var(--brand-green-4)]'
                      : isNext
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)]'
                  )}
                >
                  {step.title}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">{step.description}</span>
              </div>

              {/* Arrow for next step */}
              {isNext && <ChevronRight className="w-4 h-4 text-[var(--brand-teal-1)]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Floating help button
interface FloatingHelpButtonProps {
  onClick?: () => void
  className?: string
}

export function FloatingHelpButton({ onClick, className }: FloatingHelpButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'fixed z-50',
        'bottom-[var(--space-6)] right-[var(--space-6)]',
        'w-14 h-14 rounded-full',
        'bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)]',
        'text-white shadow-lg shadow-[var(--brand-teal-1)]/30',
        'flex items-center justify-center',
        'hover:shadow-xl hover:shadow-[var(--brand-teal-1)]/40 transition-shadow',
        className
      )}
    >
      <HelpCircle className="w-6 h-6" />
    </motion.button>
  )
}

// Keyboard shortcuts reference
export function KeyboardShortcutsReference({ className }: { className?: string }) {
  const shortcuts = [
    { key: 'D', description: 'Deploy all idle agents' },
    { key: 'R', description: 'Refuel all low agents' },
    { key: 'Shift+R', description: 'Refuel selected agent' },
    { key: 'F', description: 'Focus camera on selected' },
    { key: '?', description: 'Show help' },
  ]

  return (
    <div className={cn('space-y-[var(--gap-items)]', className)}>
      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--gap-items)]">Keyboard Shortcuts</h4>
      <div className="space-y-[var(--space-2)]">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.key} className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-tertiary)]">{shortcut.description}</span>
            <kbd className="hotkey-hint">{shortcut.key}</kbd>
          </div>
        ))}
      </div>
    </div>
  )
}

export { GAME_TIPS }
