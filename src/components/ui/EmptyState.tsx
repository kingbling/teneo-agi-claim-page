import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Rocket, Sparkles, Search, Target, Zap } from 'lucide-react'
import { Button } from './button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'default' | 'agents' | 'discoveries' | 'search' | 'deploy'
  size?: 'sm' | 'default' | 'lg'
}

const variantConfig = {
  default: {
    icon: Sparkles,
    gradient: 'from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20',
    iconColor: 'text-[var(--brand-teal-1)]',
    iconBg: 'bg-[var(--brand-teal-1)]/10',
  },
  agents: {
    icon: Rocket,
    gradient: 'from-[var(--tier-trait)]/20 to-[var(--tier-mythic)]/20',
    iconColor: 'text-[var(--tier-trait)]',
    iconBg: 'bg-[var(--tier-trait)]/10',
  },
  discoveries: {
    icon: Sparkles,
    gradient: 'from-[var(--state-solving)]/20 to-[var(--state-limping)]/20',
    iconColor: 'text-[var(--state-solving)]',
    iconBg: 'bg-[var(--state-solving)]/10',
  },
  search: {
    icon: Search,
    gradient: 'from-[var(--state-wandering)]/20 to-[var(--brand-blue-2)]/20',
    iconColor: 'text-[var(--state-wandering)]',
    iconBg: 'bg-[var(--state-wandering)]/10',
  },
  deploy: {
    icon: Target,
    gradient: 'from-[var(--brand-green-4)]/20 to-[var(--brand-green-2)]/20',
    iconColor: 'text-[var(--brand-green-4)]',
    iconBg: 'bg-[var(--brand-green-4)]/10',
  },
}

const sizeConfig = {
  sm: {
    container: 'py-[var(--space-8)] px-[var(--space-6)]',
    iconWrapper: 'w-14 h-14',
    icon: 'h-7 w-7',
    title: 'text-base',
    description: 'text-sm max-w-[var(--content-max-sm)]',
    button: 'h-10',
  },
  default: {
    container: 'py-[var(--space-12)] px-[var(--space-8)]',
    iconWrapper: 'w-20 h-20',
    icon: 'h-10 w-10',
    title: 'text-lg',
    description: 'text-base max-w-[var(--content-max-md)]',
    button: 'h-11',
  },
  lg: {
    container: 'py-[var(--space-16)] px-[var(--space-10)]',
    iconWrapper: 'w-24 h-24',
    icon: 'h-12 w-12',
    title: 'text-xl',
    description: 'text-base max-w-[var(--content-max-lg)]',
    button: 'h-12',
  },
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  size = 'default',
}: EmptyStateProps) {
  const config = variantConfig[variant]
  const sizes = sizeConfig[size]
  const Icon = icon || config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center justify-center text-center ${sizes.container}`}
    >
      {/* Animated icon with rings */}
      <div className="relative mb-[var(--space-6)]">
        {/* Pulse rings */}
        <motion.div
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${config.gradient} blur-xl`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Outer ring */}
        <motion.div
          className={`absolute -inset-[var(--space-3)] rounded-full border border-current ${config.iconColor} opacity-10`}
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Icon container */}
        <motion.div
          className={`relative ${sizes.iconWrapper} rounded-[var(--radius-2xl)] ${config.iconBg} border border-current/10 flex items-center justify-center shadow-lg`}
          animate={{ rotate: [0, 5, 0, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon className={`${sizes.icon} ${config.iconColor}`} />
        </motion.div>
      </div>

      {/* Title */}
      <h3 className={`font-bold text-[var(--text-primary)] mb-[var(--space-3)] ${sizes.title}`}>
        {title}
      </h3>

      {/* Description */}
      <p className={`text-[var(--text-tertiary)] leading-relaxed mb-[var(--space-6)] ${sizes.description}`}>
        {description}
      </p>

      {/* Action button */}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className={`gap-[var(--space-2)] ${sizes.button}`}
        >
          <Zap className="h-[var(--space-4)] w-[var(--space-4)]" />
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}

// Preset variants for common empty states
export function NoAgentsEmpty({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      variant="agents"
      title="No Agents Yet"
      description="Create your first agent to start exploring the neural network and earning rewards."
      actionLabel="Create Your First Agent"
      onAction={onCreate}
    />
  )
}

export function NoDiscoveriesEmpty() {
  return (
    <EmptyState
      variant="discoveries"
      title="No Discoveries Yet"
      description="Deploy your agents to explore the network. They'll find hidden spaces and earn you AGI rewards!"
    />
  )
}

export function NoSearchResultsEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      variant="search"
      title="No Results Found"
      description={`We couldn't find anything matching "${query}". Try adjusting your search or filters.`}
      size="sm"
    />
  )
}

export function NoIdleAgentsEmpty() {
  return (
    <EmptyState
      variant="deploy"
      title="All Agents Busy"
      description="All your agents are currently exploring. Wait for them to return or create a new agent."
      size="sm"
    />
  )
}
