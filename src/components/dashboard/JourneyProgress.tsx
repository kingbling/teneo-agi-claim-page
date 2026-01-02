import { motion } from 'framer-motion'
import { Brain, Check, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Progress } from '@/components/ui'
import { useClaimStore } from '@/stores/claimStore'
import { MILESTONES } from '@/services/mock/mockData'

export function JourneyProgress() {
  const user = useClaimStore((state) => state.user)

  if (!user) return null

  const progress = user.journeyProgress
  const totalSynapses = 200
  const connectedSynapses = user.synapsesConnected

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--brand-teal-1)]" />
          Journey to AGI
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="mb-2">
          <Progress value={progress} className="h-3" />
        </div>

        {/* Stats */}
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-[var(--text-tertiary)]">
            {connectedSynapses} / {totalSynapses} Synapses
          </span>
          <motion.span
            key={progress}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="font-semibold text-[var(--brand-teal-1)]"
          >
            {progress.toFixed(1)}%
          </motion.span>
        </div>

        {/* Milestones */}
        <div className="space-y-2">
          {MILESTONES.map((milestone, index) => {
            const isAchieved = progress >= milestone.progress
            const isCurrent =
              progress < milestone.progress &&
              (index === 0 || progress >= MILESTONES[index - 1].progress)

            return (
              <div
                key={milestone.id}
                className={`flex items-center gap-3 rounded-lg p-2 ${
                  isCurrent ? 'bg-[var(--background-tertiary)]' : ''
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isAchieved
                      ? 'bg-[var(--brand-green-4)]'
                      : isCurrent
                      ? 'bg-[var(--brand-teal-1)]'
                      : 'bg-[var(--background-tertiary)]'
                  }`}
                >
                  {isAchieved ? (
                    <Check className="h-3 w-3 text-white" />
                  ) : isCurrent ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  ) : (
                    <Lock className="h-3 w-3 text-[var(--text-tertiary)]" />
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${
                      isAchieved || isCurrent
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    {milestone.name}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {milestone.reward}
                  </div>
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {milestone.progress}%
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
