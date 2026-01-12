import { createSignal, createEffect, onCleanup, Show, For, type JSX } from 'solid-js'
import { Check, X, Loader2, Sparkles, Rocket, Zap, Fuel } from 'lucide-solid'

// Success celebration animation
interface SuccessCelebrationProps {
  show: boolean
  message: string
  onComplete?: () => void
}

export function SuccessCelebration(props: SuccessCelebrationProps) {
  const [isVisible, setIsVisible] = createSignal(false)

  createEffect(() => {
    if (props.show) {
      requestAnimationFrame(() => setIsVisible(true))
      if (props.onComplete) {
        const timer = setTimeout(props.onComplete, 2000)
        onCleanup(() => clearTimeout(timer))
      }
    } else {
      setIsVisible(false)
    }
  })

  return (
    <Show when={props.show}>
      <div
        class="fixed inset-0 flex items-center justify-center z-[200] pointer-events-none"
      >
        <div
          class="relative transition-all duration-300 ease-out"
          classList={{
            'opacity-0 scale-50 translate-y-5': !isVisible(),
            'opacity-100 scale-100 translate-y-0': isVisible(),
          }}
        >
          {/* Glow effect */}
          <div
            class="absolute bg-[var(--synapse-connected)]/20 rounded-full blur-2xl transition-transform duration-500"
            classList={{
              'scale-0': !isVisible(),
              'scale-100': isVisible(),
            }}
            style={{ inset: 'var(--space-8)' }}
          />

          {/* Main card */}
          <div
            class="relative bg-[var(--background-secondary)] border border-[var(--synapse-connected)]/30 shadow-2xl shadow-[var(--synapse-connected)]/20 transition-transform duration-300"
            classList={{
              'scale-0': !isVisible(),
              'scale-100': isVisible(),
            }}
            style={{
              "border-radius": 'var(--radius-2xl)',
              padding: 'var(--space-6) var(--space-8)'
            }}
          >
            <div class="flex flex-col items-center" style={{ gap: 'var(--space-4)' }}>
              {/* Animated checkmark */}
              <div
                class="rounded-full bg-[var(--synapse-connected)]/20 flex items-center justify-center transition-transform duration-300 delay-200"
                classList={{
                  'scale-0': !isVisible(),
                  'scale-100': isVisible(),
                }}
                style={{ width: 'var(--space-16)', height: 'var(--space-16)' }}
              >
                <Check class="text-[var(--synapse-connected)]" style={{ width: 'var(--space-8)', height: 'var(--space-8)' }} />
              </div>

              {/* Message */}
              <p
                class="text-lg font-semibold text-[var(--text-primary)] text-center transition-all duration-300 delay-400"
                classList={{
                  'opacity-0 translate-y-2.5': !isVisible(),
                  'opacity-100 translate-y-0': isVisible(),
                }}
              >
                {props.message}
              </p>

              {/* Sparkles decoration */}
              <For each={[...Array(6).keys()]}>
                {(i) => (
                  <div
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-800"
                    classList={{
                      'scale-0 opacity-0': !isVisible(),
                      'opacity-0': isVisible(),
                    }}
                    style={{
                      transform: isVisible()
                        ? `translate(calc(-50% + ${Math.cos((i * Math.PI * 2) / 6) * 60}px), calc(-50% + ${Math.sin((i * Math.PI * 2) / 6) * 60}px))`
                        : 'translate(-50%, -50%)',
                      "transition-delay": `${300 + i * 50}ms`,
                      animation: isVisible() ? `sparkle-burst 0.8s ease-out ${0.3 + i * 0.05}s forwards` : 'none',
                    }}
                  >
                    <Sparkles class="text-[var(--rarity-legendary)]" style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}

// Inline action feedback (for buttons/forms)
interface InlineFeedbackProps {
  status: 'idle' | 'loading' | 'success' | 'error'
  loadingText?: string
  successText?: string
  errorText?: string
  onReset?: () => void
}

export function InlineFeedback(props: InlineFeedbackProps) {
  createEffect(() => {
    if ((props.status === 'success' || props.status === 'error') && props.onReset) {
      const timer = setTimeout(props.onReset, 2000)
      onCleanup(() => clearTimeout(timer))
    }
  })

  const statusConfig = {
    loading: {
      icon: Loader2,
      text: () => props.loadingText ?? 'Processing...',
      color: 'text-[var(--brand-blue-2)]',
      bg: 'bg-[var(--brand-blue-2)]/10',
      border: 'border-[var(--brand-blue-2)]/20',
      animate: true,
    },
    success: {
      icon: Check,
      text: () => props.successText ?? 'Success!',
      color: 'text-[var(--synapse-connected)]',
      bg: 'bg-[var(--synapse-connected)]/10',
      border: 'border-[var(--synapse-connected)]/20',
      animate: false,
    },
    error: {
      icon: X,
      text: () => props.errorText ?? 'Error occurred',
      color: 'text-[var(--brand-red-4)]',
      bg: 'bg-[var(--brand-red-4)]/10',
      border: 'border-[var(--brand-red-4)]/20',
      animate: false,
    },
  }

  return (
    <Show when={props.status !== 'idle'}>
      {(() => {
        const config = statusConfig[props.status as keyof typeof statusConfig]
        const Icon = config.icon
        return (
          <div class="overflow-hidden animate-[slideDown_200ms_ease-out]">
            <div
              class={`flex items-center ${config.bg} border ${config.border}`}
              style={{
                gap: 'var(--gap-items-sm)',
                padding: 'var(--space-3) var(--space-4)',
                "border-radius": 'var(--radius-xl)',
                "margin-top": 'var(--space-3)'
              }}
            >
              <Icon
                class={`${config.color} ${config.animate ? 'animate-spin' : ''}`}
                style={{ width: 'var(--space-4)', height: 'var(--space-4)' }}
              />
              <span class={`text-sm font-medium ${config.color}`}>{config.text()}</span>
            </div>
          </div>
        )
      })()}
    </Show>
  )
}

// Floating action notification
interface ActionNotificationProps {
  show: boolean
  type: 'deploy' | 'refuel' | 'create' | 'discover'
  message: string
  onDismiss: () => void
}

const actionConfig = {
  deploy: {
    icon: Rocket,
    gradient: 'from-[var(--state-limping)]/20 to-[var(--state-solving)]/20',
    iconColor: 'text-[var(--state-limping)]',
    iconBg: 'bg-[var(--state-limping)]/20',
  },
  refuel: {
    icon: Fuel,
    gradient: 'from-[var(--synapse-connected)]/20 to-[var(--brand-green-2)]/20',
    iconColor: 'text-[var(--synapse-connected)]',
    iconBg: 'bg-[var(--synapse-connected)]/20',
  },
  create: {
    icon: Sparkles,
    gradient: 'from-[var(--tier-trait)]/20 to-[var(--tier-mythic)]/20',
    iconColor: 'text-[var(--tier-trait)]',
    iconBg: 'bg-[var(--tier-trait)]/20',
  },
  discover: {
    icon: Zap,
    gradient: 'from-[var(--state-solving)]/20 to-[var(--rarity-legendary)]/20',
    iconColor: 'text-[var(--state-solving)]',
    iconBg: 'bg-[var(--state-solving)]/20',
  },
}

export function ActionNotification(props: ActionNotificationProps) {
  const [isVisible, setIsVisible] = createSignal(false)

  createEffect(() => {
    if (props.show) {
      requestAnimationFrame(() => setIsVisible(true))
      const timer = setTimeout(props.onDismiss, 3000)
      onCleanup(() => clearTimeout(timer))
    } else {
      setIsVisible(false)
    }
  })

  const config = () => actionConfig[props.type]
  const Icon = () => config().icon

  return (
    <Show when={props.show}>
      <div
        class="fixed left-1/2 z-[100] transition-all duration-300 ease-out"
        style={{ bottom: 'var(--space-24)' }}
        classList={{
          'opacity-0 translate-y-[50px] -translate-x-1/2': !isVisible(),
          'opacity-100 translate-y-0 -translate-x-1/2': isVisible(),
        }}
      >
        <div class="relative">
          {/* Glow */}
          <div
            class={`absolute bg-gradient-to-r ${config().gradient} blur-xl opacity-50`}
            style={{ inset: 'calc(-1 * var(--space-2))', "border-radius": 'var(--radius-2xl)' }}
          />

          <div
            class="relative flex items-center bg-[var(--background-secondary)]/95 backdrop-blur-xl border border-[var(--card-border)] shadow-2xl"
            style={{
              gap: 'var(--space-4)',
              padding: 'var(--space-4) var(--space-5)',
              "border-radius": 'var(--radius-xl)'
            }}
          >
            {/* Icon */}
            <div
              class={`${config().iconBg} flex items-center justify-center transition-transform duration-300 delay-100`}
              classList={{
                'scale-0': !isVisible(),
                'scale-100': isVisible(),
              }}
              style={{ width: 'var(--space-10)', height: 'var(--space-10)', "border-radius": 'var(--radius-xl)' }}
            >
              <Icon class={config().iconColor} style={{ width: 'var(--space-5)', height: 'var(--space-5)' }} />
            </div>

            {/* Message */}
            <p class="text-sm font-medium text-[var(--text-primary)]" style={{ "padding-right": 'var(--space-2)' }}>
              {props.message}
            </p>

            {/* Close button */}
            <button
              onClick={props.onDismiss}
              class="hover:bg-[var(--background-primary)] transition-colors"
              style={{ padding: 'var(--space-1)', "border-radius": 'var(--radius-lg)' }}
            >
              <X class="text-[var(--text-muted)]" style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}

// Loading button state wrapper
interface LoadingButtonWrapperProps {
  isLoading: boolean
  children: JSX.Element
  loadingText?: string
}

export function LoadingButtonWrapper(props: LoadingButtonWrapperProps) {
  return (
    <Show
      when={!props.isLoading}
      fallback={
        <div
          class="flex items-center bg-[var(--background-secondary)] border border-[var(--card-border)]"
          style={{
            gap: 'var(--gap-items-sm)',
            padding: 'var(--space-2) var(--space-5)',
            "border-radius": 'var(--radius-xl)'
          }}
        >
          <Loader2 class="animate-spin text-[var(--brand-teal-1)]" style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
          <span class="text-sm text-[var(--text-secondary)]">{props.loadingText ?? 'Loading...'}</span>
        </div>
      }
    >
      {props.children}
    </Show>
  )
}

// Pulse indicator for live elements
interface PulseIndicatorProps {
  color?: 'teal' | 'green' | 'yellow' | 'red' | 'purple'
  size?: 'sm' | 'default' | 'lg'
}

const pulseColors = {
  teal: 'bg-[var(--brand-teal-1)]',
  green: 'bg-[var(--synapse-connected)]',
  yellow: 'bg-[var(--state-solving)]',
  red: 'bg-[var(--state-exhausted)]',
  purple: 'bg-[var(--tier-trait)]',
}

const pulseSizes = {
  sm: 'w-2 h-2',
  default: 'w-3 h-3',
  lg: 'w-4 h-4',
}

export function PulseIndicator(props: PulseIndicatorProps) {
  const color = () => props.color ?? 'teal'
  const size = () => props.size ?? 'default'

  return (
    <span class="relative flex">
      <span class={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColors[color()]} opacity-75`} />
      <span class={`relative inline-flex rounded-full ${pulseColors[color()]} ${pulseSizes[size()]}`} />
    </span>
  )
}
