import { motion } from 'framer-motion'
import { Brain, Check, Lock, Sparkles, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Progress } from '@/components/ui'
import { useClaimStore } from '@/stores/claimStore'

export function JourneyProgress() {
  const user = useClaimStore((state) => state.user)
  const globalStats = useClaimStore((state) => state.globalStats)
  const regionProgress = useClaimStore((state) => state.regionProgress)
  const totalPassiveBonus = useClaimStore((state) => state.totalPassiveBonus)

  if (!user) return null

  const totalSynapses = globalStats?.totalSynapses ?? 0

  // Find next region to unlock
  const nextRegion = regionProgress.find((r) => !r.isUnlocked)
  const overallProgress = nextRegion
    ? Math.min(100, (totalSynapses / nextRegion.unlockThreshold) * 100)
    : 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--brand-teal-1)]" />
          Neural Network Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Global synapse count */}
        <div className="mb-4 rounded-lg bg-[var(--background-tertiary)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Network Synapses</span>
            <motion.span
              key={totalSynapses}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-lg font-bold text-[var(--brand-teal-1)]"
            >
              {totalSynapses.toLocaleString()}
            </motion.span>
          </div>
          {nextRegion && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--text-tertiary)]">
                  Next unlock: {nextRegion.name}
                </span>
                <span className="text-[var(--text-tertiary)]">
                  {nextRegion.synapsesRemaining} more needed
                </span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}
        </div>

        {/* Passive bonus display */}
        {totalPassiveBonus > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--brand-green-4)]/30 bg-[var(--brand-green-4)]/10 p-2">
            <TrendingUp className="h-4 w-4 text-[var(--brand-green-4)]" />
            <span className="text-sm text-[var(--text-primary)]">
              Active Bonus: <span className="font-bold text-[var(--brand-green-4)]">+{totalPassiveBonus}%</span> to all earnings
            </span>
          </div>
        )}

        {/* Region unlock progress */}
        <div className="space-y-2">
          {regionProgress.map((region, index) => {
            const isUnlocked = region.isUnlocked
            const isCurrent = !isUnlocked && (index === 0 || regionProgress[index - 1].isUnlocked)
            const progress = isUnlocked ? 100 : region.progressPercent

            return (
              <motion.div
                key={region.id}
                initial={false}
                animate={{
                  opacity: isUnlocked || isCurrent ? 1 : 0.5,
                }}
                className={`flex items-center gap-3 rounded-lg p-2 ${
                  isCurrent ? 'bg-[var(--background-tertiary)]' : ''
                } ${isUnlocked ? 'border border-[var(--brand-teal-1)]/20' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    isUnlocked
                      ? 'bg-[var(--brand-teal-1)]'
                      : isCurrent
                        ? 'bg-[var(--brand-teal-1)]/30'
                        : 'bg-[var(--background-tertiary)]'
                  }`}
                >
                  {isUnlocked ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : isCurrent ? (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <Sparkles className="h-4 w-4 text-[var(--brand-teal-1)]" />
                    </motion.div>
                  ) : (
                    <Lock className="h-4 w-4 text-[var(--text-tertiary)]" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isUnlocked || isCurrent
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-tertiary)]'
                      }`}
                    >
                      {region.name}
                    </span>
                    {isUnlocked && region.passiveBonusPercent > 0 && (
                      <span className="rounded bg-[var(--brand-green-4)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-green-4)]">
                        +{region.passiveBonusPercent}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    <span>{region.rewardMultiplier}x rewards</span>
                    {!isUnlocked && <span>• {region.unlockThreshold} synapses</span>}
                  </div>
                </div>
                {isCurrent && (
                  <div className="w-16">
                    <Progress value={progress} className="h-1.5" />
                  </div>
                )}
                {isUnlocked && (
                  <div className="text-xs font-medium text-[var(--brand-teal-1)]">ACTIVE</div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* User contribution */}
        <div className="mt-4 border-t border-[var(--card-border)] pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-tertiary)]">Your contribution</span>
            <span className="font-medium text-[var(--text-primary)]">
              {user.synapsesConnected} synapses
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
