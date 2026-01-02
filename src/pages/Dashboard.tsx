import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useClaimStore } from '@/stores/claimStore'
import { BrainScene } from '@/components/brain/BrainScene'
import { PointsBalance } from '@/components/dashboard/PointsBalance'
import { SynapseTimer } from '@/components/dashboard/SynapseTimer'
import { JourneyProgress } from '@/components/dashboard/JourneyProgress'
import { HowToEarn } from '@/components/dashboard/HowToEarn'
import { ConnectedAccounts } from '@/components/dashboard/ConnectedAccounts'
import { SynapseRevealDialog } from '@/components/claim/SynapseRevealDialog'

export function Dashboard() {
  const initializeStore = useClaimStore((state) => state.initializeStore)
  const user = useClaimStore((state) => state.user)

  useEffect(() => {
    initializeStore()
  }, [initializeStore])

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-[var(--text-tertiary)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[var(--background-primary)]">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--card-border)] bg-[var(--background-primary)]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] bg-clip-text text-2xl font-bold text-transparent">
              TENEO
            </span>
            <span className="text-sm text-[var(--text-tertiary)]">Claim Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--text-secondary)]">
              {user.connections.wallet.address}
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex min-h-screen pt-16">
        {/* Left Sidebar - Dashboard Cards */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed bottom-0 left-0 top-16 z-40 w-72 overflow-y-auto border-r border-[var(--card-border)] bg-[var(--background-secondary)]/80 p-3 backdrop-blur-md"
        >
          <div className="flex flex-col gap-3">
            <PointsBalance />
            <SynapseTimer />
            <JourneyProgress />
          </div>
        </motion.aside>

        {/* Center - 3D Brain Visualization */}
        <main className="ml-72 mr-72 flex-1 bg-[var(--background-primary)]">
          <div className="h-[calc(100vh-4rem)]">
            <BrainScene autoRotate interactive />
          </div>
        </main>

        {/* Right Sidebar - Info & Accounts */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed bottom-0 right-0 top-16 z-40 w-72 overflow-y-auto border-l border-[var(--card-border)] bg-[var(--background-secondary)]/80 p-3 backdrop-blur-md"
        >
          <div className="flex flex-col gap-3">
            <HowToEarn />
            <ConnectedAccounts />
          </div>
        </motion.aside>
      </div>

      {/* Synapse Reveal Dialog */}
      <SynapseRevealDialog />
    </div>
  )
}
