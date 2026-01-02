import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { useClaimStore } from '@/stores/claimStore'
import { formatTime } from '@/lib/utils'
import { getSynapseCost } from '@/services/mock/mockData'

export function SynapseTimer() {
  const isSynapseReady = useClaimStore((state) => state.isSynapseReady)
  const nextSynapseAt = useClaimStore((state) => state.nextSynapseAt)
  const user = useClaimStore((state) => state.user)
  const openReveal = useClaimStore((state) => state.openReveal)

  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (isSynapseReady || !nextSynapseAt) {
      setTimeLeft(0)
      return
    }

    const updateTimer = () => {
      const now = new Date()
      const diff = Math.max(0, Math.floor((nextSynapseAt.getTime() - now.getTime()) / 1000))
      setTimeLeft(diff)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [isSynapseReady, nextSynapseAt])

  const cost = user ? getSynapseCost(user.synapsesConnected) : 0
  const progress = isSynapseReady ? 100 : Math.max(0, 100 - (timeLeft / (24 * 60 * 60)) * 100)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--brand-teal-1)]" />
          Next Synapse
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Circular Progress */}
        <div className="relative mx-auto mb-4 h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--background-tertiary)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--brand-teal-1)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
              animate={{
                strokeDashoffset: 2 * Math.PI * 45 * (1 - progress / 100),
              }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isSynapseReady ? (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-center"
              >
                <Zap className="mx-auto h-6 w-6 text-[var(--brand-teal-1)]" />
                <span className="text-sm font-semibold text-[var(--brand-teal-1)]">
                  Ready!
                </span>
              </motion.div>
            ) : (
              <span className="font-mono text-lg font-bold">
                {formatTime(timeLeft)}
              </span>
            )}
          </div>
        </div>

        {/* Cost display */}
        <div className="mb-3 text-center text-sm text-[var(--text-tertiary)]">
          Cost: <span className="text-[var(--text-secondary)]">{cost} points</span>
        </div>

        {/* Connect Button */}
        <Button
          className="w-full"
          disabled={!isSynapseReady}
          onClick={openReveal}
        >
          {isSynapseReady ? (
            <>
              <Zap className="h-4 w-4" />
              Connect Synapse
            </>
          ) : (
            'Charging...'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
