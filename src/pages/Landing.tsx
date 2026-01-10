import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Brain, Zap, Target, ArrowRight, Sparkles, Users, Trophy } from 'lucide-react'
import { Button } from '@/components/ui'
import { LandingBrainScene } from '@/components/brain/LandingBrainScene'
import { useAgentStore } from '@/stores/agentStore'

export function Landing() {
  const navigate = useNavigate()
  const { connect, disconnect, fetchWorldState, discoveryProgress, isConnected } = useAgentStore()

  // Connect to server and fetch stats on mount
  useEffect(() => {
    connect()
    fetchWorldState()

    return () => {
      disconnect()
    }
  }, [connect, disconnect, fetchWorldState])

  const handleEnterDiscovery = () => {
    navigate('/discovery')
  }

  const discoveryPercent = discoveryProgress.total > 0
    ? ((discoveryProgress.discovered / discoveryProgress.total) * 100).toFixed(1)
    : '0'

  return (
    <div className="relative min-h-screen bg-[var(--background-primary)]">
      {/* 3D Brain Background */}
      <div className="absolute inset-0 z-0">
        <LandingBrainScene />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-[var(--background-primary)]/60 to-[var(--background-primary)]" />

      {/* Connection Status Badge */}
      <div className="absolute top-6 right-6 z-20">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border ${
            isConnected
              ? 'bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30 text-[hsl(var(--success))]'
              : 'bg-[hsl(var(--destructive))]/10 border-[hsl(var(--destructive))]/30 text-[hsl(var(--destructive))]'
          }`}
        >
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--destructive))]'}`} />
            {isConnected && (
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[hsl(var(--success))] animate-ping opacity-50" />
            )}
          </div>
          <span className="text-sm font-medium">{isConnected ? 'Live Network' : 'Connecting...'}</span>
        </motion.div>
      </div>

      {/* Content */}
      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        {/* Logo / Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-4 text-center"
        >
          {/* Animated Logo Icon */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mb-6 inline-flex"
          >
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] rounded-3xl blur-2xl opacity-30" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center shadow-2xl shadow-[var(--brand-teal-1)]/30">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
          </motion.div>

          <h1 className="mb-2 bg-gradient-to-r from-[var(--brand-teal-1)] via-[var(--brand-teal-2)] to-[var(--brand-blue-2)] bg-clip-text text-5xl font-extrabold text-transparent md:text-8xl tracking-tight">
            TENEO
          </h1>
          <p className="text-sm text-[var(--text-muted)] font-medium tracking-widest uppercase">
            Discovery Portal
          </p>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-6 max-w-lg text-center text-lg text-[var(--text-secondary)] leading-relaxed"
        >
          Deploy intelligent agents to explore the neural network.
          <span className="text-[var(--brand-teal-1)]"> Discover hidden spaces.</span>
          <span className="text-[hsl(var(--accent))]"> Earn AGI rewards.</span>
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 w-full max-w-3xl"
        >
          <FeatureCard
            icon={<Brain className="h-7 w-7" />}
            title="Deploy Agents"
            description="Create and customize agents with unique traits to explore the network"
            color="teal"
          />
          <FeatureCard
            icon={<Zap className="h-7 w-7" />}
            title="Discover & Earn"
            description="Find undiscovered spaces and earn AGI tokens as rewards"
            color="yellow"
          />
          <FeatureCard
            icon={<Target className="h-7 w-7" />}
            title="Reach AGI"
            description="Help the community reach 100% neural network exploration"
            color="purple"
          />
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mb-4"
        >
          <Button
            size="xl"
            onClick={handleEnterDiscovery}
            className="group gap-2 text-lg px-6 py-3 rounded-2xl shadow-2xl shadow-[var(--brand-teal-1)]/30 hover:shadow-[var(--brand-teal-1)]/50 transition-all"
          >
            <span>Start Exploring</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1.5" />
          </Button>
        </motion.div>

        {/* Live Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="flex flex-wrap justify-center gap-4 md:gap-4"
        >
          <Stat
            value={discoveryProgress.total > 0 ? `${(discoveryProgress.total / 1000).toFixed(0)}K` : '1M+'}
            label="Total Spaces"
            icon={<Brain className="h-4 w-4" />}
            color="teal"
          />
          <Stat
            value={discoveryProgress.beingSolved.toLocaleString()}
            label="Being Solved"
            icon={<Zap className="h-4 w-4" />}
            color="yellow"
            pulse
          />
          <Stat
            value={`${discoveryPercent}%`}
            label="Discovered"
            icon={<Trophy className="h-4 w-4" />}
            color="green"
          />
        </motion.div>

        {/* Community Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]"
        >
          <Users className="h-4 w-4" />
          <span>Join the community of explorers discovering the neural network</span>
        </motion.div>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: 'teal' | 'yellow' | 'purple'
}) {
  const colorStyles = {
    teal: {
      icon: 'text-[var(--brand-teal-1)]',
      bg: 'bg-[var(--brand-teal-1)]/10',
      border: 'border-[var(--brand-teal-1)]/20 hover:border-[var(--brand-teal-1)]/40',
      glow: 'group-hover:shadow-[var(--brand-teal-1)]/20',
      stepBg: 'bg-[var(--brand-teal-1)]/20',
      stepText: 'text-[var(--brand-teal-1)]',
    },
    yellow: {
      icon: 'text-[hsl(var(--accent))]',
      bg: 'bg-[hsl(var(--accent))]/10',
      border: 'border-[hsl(var(--accent))]/20 hover:border-[hsl(var(--accent))]/40',
      glow: 'group-hover:shadow-[hsl(var(--accent))]/20',
      stepBg: 'bg-[hsl(var(--accent))]/20',
      stepText: 'text-[hsl(var(--accent))]',
    },
    purple: {
      icon: 'text-[hsl(var(--secondary))]',
      bg: 'bg-[hsl(var(--secondary))]/10',
      border: 'border-[hsl(var(--secondary))]/20 hover:border-[hsl(var(--secondary))]/40',
      glow: 'group-hover:shadow-[hsl(var(--secondary))]/20',
      stepBg: 'bg-[hsl(var(--secondary))]/20',
      stepText: 'text-[hsl(var(--secondary))]',
    },
  }

  const styles = colorStyles[color]

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`group relative flex flex-col items-center gap-4 rounded-2xl border ${styles.border} bg-[var(--card-background)]/60 p-6 backdrop-blur-md transition-all duration-300 hover:shadow-xl ${styles.glow}`}
    >
      {/* Icon */}
      <div className={`p-4 rounded-xl ${styles.bg} ${styles.icon} transition-transform group-hover:scale-110 shadow-lg`}>
        {icon}
      </div>

      {/* Content */}
      <div className="text-center space-y-2">
        <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm text-[var(--text-tertiary)] leading-relaxed max-w-[200px]">{description}</p>
      </div>
    </motion.div>
  )
}

function Stat({
  value,
  label,
  icon,
  color,
  pulse,
}: {
  value: string
  label: string
  icon: React.ReactNode
  color: 'teal' | 'yellow' | 'green'
  pulse?: boolean
}) {
  const colorStyles = {
    teal: {
      container: 'text-[var(--brand-teal-1)] border-[var(--brand-teal-1)]/20 bg-[var(--brand-teal-1)]/5',
      iconBg: 'bg-[var(--brand-teal-1)]/15',
    },
    yellow: {
      container: 'text-[hsl(var(--accent))] border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent))]/5',
      iconBg: 'bg-[hsl(var(--accent))]/15',
    },
    green: {
      container: 'text-[hsl(var(--success))] border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5',
      iconBg: 'bg-[hsl(var(--success))]/15',
    },
  }

  const styles = colorStyles[color]

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      className={`relative p-4 rounded-xl border backdrop-blur-md text-center min-w-[150px] ${styles.container}`}
    >
      {pulse && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--accent))] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[hsl(var(--accent))]"></span>
          </span>
        </div>
      )}
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className={`p-2 rounded-lg ${styles.iconBg}`}>
          {icon}
        </div>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
      </div>
      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</div>
    </motion.div>
  )
}
