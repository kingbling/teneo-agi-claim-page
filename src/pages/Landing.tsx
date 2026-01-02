import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Brain, Zap, Target, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { BrainScene } from '@/components/brain/BrainScene'

export function Landing() {
  const navigate = useNavigate()

  const handleEnterPortal = () => {
    navigate('/dashboard')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background-primary)]">
      {/* 3D Brain Background */}
      <div className="absolute inset-0 z-0">
        <BrainScene autoRotate interactive={false} />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-[var(--background-primary)]/50 to-[var(--background-primary)]" />

      {/* Content */}
      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-4">
        {/* Logo / Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 text-center"
        >
          <h1 className="mb-2 bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] bg-clip-text text-5xl font-bold text-transparent md:text-7xl">
            TENEO
          </h1>
          <p className="text-lg text-[var(--text-secondary)] md:text-xl">
            Journey to AGI
          </p>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-12 max-w-md text-center text-[var(--text-tertiary)]"
        >
          Connect synapses. Earn rewards. Build the future of artificial general intelligence.
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          <FeatureCard
            icon={<Brain className="h-6 w-6" />}
            title="Connect Synapses"
            description="Build neural pathways daily"
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Earn Rewards"
            description="AGI tokens, multipliers & more"
          />
          <FeatureCard
            icon={<Target className="h-6 w-6" />}
            title="Reach AGI"
            description="Complete the brain, achieve AGI"
          />
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Button
            size="xl"
            onClick={handleEnterPortal}
            className="group gap-2 text-lg"
          >
            Enter Portal
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-16 flex gap-12 text-center"
        >
          <Stat value="12.4M" label="Synapses Connected" />
          <Stat value="847K" label="Active Users" />
          <Stat value="23.5%" label="Progress to AGI" />
        </motion.div>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-background)]/50 p-6 backdrop-blur-sm">
      <div className="mb-2 text-[var(--brand-teal-1)]">{icon}</div>
      <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--text-tertiary)]">{description}</p>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-[var(--brand-teal-1)]">{value}</div>
      <div className="text-sm text-[var(--text-tertiary)]">{label}</div>
    </div>
  )
}
