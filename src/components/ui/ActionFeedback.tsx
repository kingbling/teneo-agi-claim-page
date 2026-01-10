import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Loader2, Sparkles, Rocket, Zap, Fuel } from 'lucide-react'
import { useEffect } from 'react'

// Success celebration animation
interface SuccessCelebrationProps {
  show: boolean
  message: string
  onComplete?: () => void
}

export function SuccessCelebration({ show, message, onComplete }: SuccessCelebrationProps) {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 2000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -20 }}
          className="fixed inset-0 flex items-center justify-center z-[200] pointer-events-none"
        >
          <div className="relative">
            {/* Glow effect */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.5, 1] }}
              transition={{ duration: 0.5 }}
              className="absolute bg-[var(--synapse-connected)]/20 rounded-full blur-2xl"
              style={{ inset: 'var(--space-8)' }}
            />

            {/* Main card */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="relative bg-[var(--background-secondary)] border border-[var(--synapse-connected)]/30 shadow-2xl shadow-[var(--synapse-connected)]/20"
              style={{
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-6) var(--space-8)'
              }}
            >
              <div className="flex flex-col items-center" style={{ gap: 'var(--space-4)' }}>
                {/* Animated checkmark */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="rounded-full bg-[var(--synapse-connected)]/20 flex items-center justify-center"
                  style={{ width: 'var(--space-16)', height: 'var(--space-16)' }}
                >
                  <Check className="text-[var(--synapse-connected)]" style={{ width: 'var(--space-8)', height: 'var(--space-8)' }} />
                </motion.div>

                {/* Message */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg font-semibold text-[var(--text-primary)] text-center"
                >
                  {message}
                </motion.p>

                {/* Sparkles decoration */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0],
                      x: Math.cos((i * Math.PI * 2) / 6) * 60,
                      y: Math.sin((i * Math.PI * 2) / 6) * 60,
                    }}
                    transition={{
                      delay: 0.3 + i * 0.05,
                      duration: 0.8,
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <Sparkles className="text-[var(--rarity-legendary)]" style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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

export function InlineFeedback({
  status,
  loadingText = 'Processing...',
  successText = 'Success!',
  errorText = 'Error occurred',
  onReset
}: InlineFeedbackProps) {
  useEffect(() => {
    if ((status === 'success' || status === 'error') && onReset) {
      const timer = setTimeout(onReset, 2000)
      return () => clearTimeout(timer)
    }
  }, [status, onReset])

  const variants = {
    idle: { opacity: 0, height: 0 },
    loading: { opacity: 1, height: 'auto' },
    success: { opacity: 1, height: 'auto' },
    error: { opacity: 1, height: 'auto' },
  }

  const statusConfig = {
    loading: {
      icon: Loader2,
      text: loadingText,
      color: 'text-[var(--brand-blue-2)]',
      bg: 'bg-[var(--brand-blue-2)]/10',
      border: 'border-[var(--brand-blue-2)]/20',
      animate: true,
    },
    success: {
      icon: Check,
      text: successText,
      color: 'text-[var(--synapse-connected)]',
      bg: 'bg-[var(--synapse-connected)]/10',
      border: 'border-[var(--synapse-connected)]/20',
      animate: false,
    },
    error: {
      icon: X,
      text: errorText,
      color: 'text-[var(--brand-red-4)]',
      bg: 'bg-[var(--brand-red-4)]/10',
      border: 'border-[var(--brand-red-4)]/20',
      animate: false,
    },
  }

  if (status === 'idle') return null

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <motion.div
      initial="idle"
      animate={status}
      variants={variants}
      className="overflow-hidden"
    >
      <div
        className={`flex items-center ${config.bg} border ${config.border}`}
        style={{
          gap: 'var(--gap-items-sm)',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-xl)',
          marginTop: 'var(--space-3)'
        }}
      >
        <Icon className={`${config.color} ${config.animate ? 'animate-spin' : ''}`} style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
        <span className={`text-sm font-medium ${config.color}`}>{config.text}</span>
      </div>
    </motion.div>
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

export function ActionNotification({ show, type, message, onDismiss }: ActionNotificationProps) {
  const config = actionConfig[type]
  const Icon = config.icon

  useEffect(() => {
    if (show) {
      const timer = setTimeout(onDismiss, 3000)
      return () => clearTimeout(timer)
    }
  }, [show, onDismiss])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          className="fixed left-1/2 z-[100]"
          style={{ bottom: 'var(--space-24)' }}
        >
          <div className="relative">
            {/* Glow */}
            <div className={`absolute bg-gradient-to-r ${config.gradient} blur-xl opacity-50`} style={{ inset: 'calc(-1 * var(--space-2))', borderRadius: 'var(--radius-2xl)' }} />

            <div
              className="relative flex items-center bg-[var(--background-secondary)]/95 backdrop-blur-xl border border-[var(--card-border)] shadow-2xl"
              style={{
                gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-5)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                className={`${config.iconBg} flex items-center justify-center`}
                style={{ width: 'var(--space-10)', height: 'var(--space-10)', borderRadius: 'var(--radius-xl)' }}
              >
                <Icon className={config.iconColor} style={{ width: 'var(--space-5)', height: 'var(--space-5)' }} />
              </motion.div>

              {/* Message */}
              <p className="text-sm font-medium text-[var(--text-primary)]" style={{ paddingRight: 'var(--space-2)' }}>
                {message}
              </p>

              {/* Close button */}
              <button
                onClick={onDismiss}
                className="hover:bg-[var(--background-primary)] transition-colors"
                style={{ padding: 'var(--space-1)', borderRadius: 'var(--radius-lg)' }}
              >
                <X className="text-[var(--text-muted)]" style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Loading button state wrapper
interface LoadingButtonWrapperProps {
  isLoading: boolean
  children: React.ReactNode
  loadingText?: string
}

export function LoadingButtonWrapper({ isLoading, children, loadingText = 'Loading...' }: LoadingButtonWrapperProps) {
  if (isLoading) {
    return (
      <div
        className="flex items-center bg-[var(--background-secondary)] border border-[var(--card-border)]"
        style={{
          gap: 'var(--gap-items-sm)',
          padding: 'var(--space-2) var(--space-5)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <Loader2 className="animate-spin text-[var(--brand-teal-1)]" style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
        <span className="text-sm text-[var(--text-secondary)]">{loadingText}</span>
      </div>
    )
  }

  return <>{children}</>
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

export function PulseIndicator({ color = 'teal', size = 'default' }: PulseIndicatorProps) {
  return (
    <span className="relative flex">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColors[color]} opacity-75`} />
      <span className={`relative inline-flex rounded-full ${pulseColors[color]} ${pulseSizes[size]}`} />
    </span>
  )
}
