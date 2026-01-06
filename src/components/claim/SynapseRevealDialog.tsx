import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Zap, Star, Key, Brain, Sparkles, Check } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { useClaimStore } from '@/stores/claimStore'
import type { Reward, Rarity, RevealPhase } from '@/types'

export function SynapseRevealDialog() {
  const isRevealOpen = useClaimStore((state) => state.isRevealOpen)
  const revealPhase = useClaimStore((state) => state.revealPhase)
  const currentRewards = useClaimStore((state) => state.currentRewards)
  const closeReveal = useClaimStore((state) => state.closeReveal)
  const connectSynapse = useClaimStore((state) => state.connectSynapse)
  const completeReveal = useClaimStore((state) => state.completeReveal)

  useEffect(() => {
    if (isRevealOpen && revealPhase === 'idle') {
      connectSynapse()
    }
  }, [isRevealOpen, revealPhase, connectSynapse])

  const handleComplete = () => {
    completeReveal()
  }

  if (!isRevealOpen) return null

  return (
    <AnimatePresence>
      {isRevealOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-4 pb-24"
        >
          {/* HUD Panel - bottom center */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="pointer-events-auto w-full max-w-sm rounded-xl border border-[var(--card-border)] bg-[var(--background-secondary)]/95 shadow-2xl backdrop-blur-md"
          >
            {/* Phase Progress */}
            <div className="border-b border-[var(--card-border)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <PhaseStatus phase={revealPhase} />
              </div>

              {/* Phase Steps */}
              <div className="flex items-center gap-1">
                {(['locating', 'connecting', 'activating', 'complete'] as RevealPhase[]).map(
                  (phase, i) => {
                    const phases: RevealPhase[] = ['locating', 'connecting', 'activating', 'complete']
                    const currentIdx = phases.indexOf(revealPhase)
                    const isActive = i <= currentIdx && revealPhase !== 'idle'
                    const isCurrent = phase === revealPhase

                    return (
                      <div key={phase} className="flex flex-1 items-center">
                        <motion.div
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            isActive ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--background-tertiary)]'
                          }`}
                          animate={isCurrent ? { opacity: [0.5, 1, 0.5] } : {}}
                          transition={isCurrent ? { repeat: Infinity, duration: 1 } : {}}
                        />
                        {i < 3 && <div className="w-1" />}
                      </div>
                    )
                  }
                )}
              </div>
            </div>

            {/* Content - Rewards or Status */}
            <div className="p-4">
              <AnimatePresence mode="wait">
                {revealPhase === 'complete' && currentRewards ? (
                  <motion.div
                    key="rewards"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    <div className="mb-3 text-center text-xs font-medium text-[var(--text-secondary)]">
                      REWARDS UNLOCKED
                    </div>
                    {currentRewards.map((reward, index) => (
                      <motion.div
                        key={reward.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <RewardCard reward={reward} />
                      </motion.div>
                    ))}
                    <Button onClick={handleComplete} className="mt-4 w-full">
                      Continue
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center py-4"
                  >
                    <div className="text-center">
                      <motion.div
                        animate={{ rotate: revealPhase === 'locating' ? 360 : 0 }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className="mx-auto mb-2 h-8 w-8"
                      >
                        {revealPhase === 'locating' && (
                          <Brain className="h-8 w-8 text-[var(--brand-teal-1)]" />
                        )}
                        {revealPhase === 'connecting' && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                          >
                            <Sparkles className="h-8 w-8 text-[var(--brand-teal-1)]" />
                          </motion.div>
                        )}
                        {revealPhase === 'activating' && (
                          <motion.div
                            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                            transition={{ repeat: Infinity, duration: 0.4 }}
                          >
                            <Zap className="h-8 w-8 text-[var(--brand-teal-1)]" />
                          </motion.div>
                        )}
                      </motion.div>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Watch the brain for your new synapse...
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PhaseStatus({ phase }: { phase: RevealPhase }) {
  const getPhaseInfo = () => {
    switch (phase) {
      case 'locating':
        return { text: 'Locating Neural Region...', icon: Brain }
      case 'connecting':
        return { text: 'Forming Connection...', icon: Sparkles }
      case 'activating':
        return { text: 'Synapse Activating!', icon: Zap }
      case 'complete':
        return { text: 'Neural Link Established', icon: Check }
      default:
        return { text: 'Initializing...', icon: Brain }
    }
  }

  const { text, icon: Icon } = getPhaseInfo()

  return (
    <motion.div
      key={phase}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2"
    >
      <Icon className="h-4 w-4 text-[var(--brand-teal-1)]" />
      <span className="text-sm font-medium text-[var(--text-primary)]">{text}</span>
    </motion.div>
  )
}

function RewardCard({ reward }: { reward: Reward }) {
  const rarityColors: Record<Rarity, string> = {
    common: 'border-[var(--rarity-common)]/50',
    uncommon: 'border-[var(--rarity-uncommon)]/50',
    rare: 'border-[var(--rarity-rare)]/50',
    legendary: 'border-[var(--rarity-legendary)]/50',
  }

  const rarityBg: Record<Rarity, string> = {
    common: 'bg-[var(--rarity-common)]/5',
    uncommon: 'bg-[var(--rarity-uncommon)]/5',
    rare: 'bg-[var(--rarity-rare)]/5',
    legendary: 'bg-[var(--rarity-legendary)]/10',
  }

  const getRewardIcon = () => {
    const iconClass = 'h-4 w-4'
    switch (reward.type) {
      case 'AGI_TOKENS':
        return <Coins className={`${iconClass} text-[var(--rarity-common)]`} />
      case 'MULTIPLIER':
        return <Zap className={`${iconClass} text-[var(--rarity-uncommon)]`} />
      case 'STAKING_BOOST':
        return <Star className={`${iconClass} text-[var(--rarity-rare)]`} />
      case 'NEURAL_KEY':
        return <Key className={`${iconClass} text-[var(--rarity-legendary)]`} />
    }
  }

  const getRewardText = () => {
    switch (reward.type) {
      case 'AGI_TOKENS':
        return `${reward.amount} AGI`
      case 'MULTIPLIER':
        return `${reward.value}x Multiplier`
      case 'STAKING_BOOST':
        return `Tier ${reward.tier} Staking`
      case 'NEURAL_KEY':
        return `${reward.keyType.charAt(0).toUpperCase() + reward.keyType.slice(1)} Key`
    }
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${rarityColors[reward.rarity]} ${rarityBg[reward.rarity]}`}
    >
      <div className="rounded-md bg-[var(--background-tertiary)] p-1.5">{getRewardIcon()}</div>
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--text-primary)]">{getRewardText()}</div>
      </div>
      <Badge variant={reward.rarity} className="text-[10px] capitalize">
        {reward.rarity}
      </Badge>
    </div>
  )
}
