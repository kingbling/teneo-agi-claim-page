import { motion } from 'framer-motion'
import { Coins, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useClaimStore } from '@/stores/claimStore'
import { formatNumber } from '@/lib/utils'

export function PointsBalance() {
  const points = useClaimStore((state) => state.points)
  const pendingPoints = useClaimStore((state) => state.pendingPoints)

  return (
    <Card glow>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-[var(--brand-teal-1)]" />
          Your Points
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          key={points}
          initial={{ scale: 1.1, color: 'var(--brand-teal-1)' }}
          animate={{ scale: 1, color: 'var(--text-primary)' }}
          transition={{ duration: 0.3 }}
          className="text-4xl font-bold"
        >
          {formatNumber(points)}
        </motion.div>
        <div className="text-sm text-[var(--text-tertiary)]">AGI Points</div>

        {pendingPoints > 0 && (
          <div className="mt-3 flex items-center gap-1 text-sm text-[var(--brand-green-4)]">
            <TrendingUp className="h-3 w-3" />
            +{formatNumber(pendingPoints)} pending
          </div>
        )}
      </CardContent>
    </Card>
  )
}
