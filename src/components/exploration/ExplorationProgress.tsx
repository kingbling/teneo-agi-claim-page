import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, Users, Clock, Zap, Gift, LogOut, TrendingUp } from 'lucide-react'
import { useExplorationStore } from '@/stores/explorationStore'
import { SYNAPSE_CONFIG, type SynapseType, formatPoints, formatETA, getSynapseTypeLabel } from '@/types/game'
import { cn } from '@/lib/utils'

// Synapse type colors
const SYNAPSE_TYPE_STYLES: Record<SynapseType, { bg: string; text: string; gradient: string }> = {
  minor: { bg: 'bg-blue-500', text: 'text-blue-400', gradient: 'from-blue-500 to-blue-600' },
  complex: { bg: 'bg-purple-500', text: 'text-purple-400', gradient: 'from-purple-500 to-purple-600' },
  deep: { bg: 'bg-teal-500', text: 'text-teal-400', gradient: 'from-teal-500 to-teal-600' },
  core: { bg: 'bg-yellow-500', text: 'text-yellow-400', gradient: 'from-yellow-500 to-yellow-600' },
  rare: { bg: 'bg-red-500', text: 'text-red-400', gradient: 'from-red-500 to-red-600' },
  legendary: { bg: 'bg-pink-500', text: 'text-pink-400', gradient: 'from-pink-500 to-pink-600' },
  unique: { bg: 'bg-amber-400', text: 'text-amber-300', gradient: 'from-amber-400 to-amber-500' },
}

/**
 * ExplorationProgress - Shows active synapse exploration status
 * Masterplan 2026: Progress bar, collaborators, ETA, rewards
 */
export function ExplorationProgress() {
  // Granular selectors for state - prevents re-renders when unrelated state changes
  const activeSynapse = useExplorationStore(state => state.activeSynapse)
  const collaborators = useExplorationStore(state => state.collaborators)
  const isLoadingCollaborators = useExplorationStore(state => state.isLoadingCollaborators)
  const recentSpendingRates = useExplorationStore(state => state.recentSpendingRates)

  // Actions don't cause re-renders, but still use selectors for consistency
  const getSynapseProgress = useExplorationStore(state => state.getSynapseProgress)
  const getMyContributionPercent = useExplorationStore(state => state.getMyContributionPercent)
  const getEstimatedReward = useExplorationStore(state => state.getEstimatedReward)
  const leaveCurrentExploration = useExplorationStore(state => state.leaveCurrentExploration)
  const refreshActiveSynapse = useExplorationStore(state => state.refreshActiveSynapse)
  const refreshCollaborators = useExplorationStore(state => state.refreshCollaborators)
  const updateSpendingRate = useExplorationStore(state => state.updateSpendingRate)

  // Refresh data periodically
  useEffect(() => {
    if (!activeSynapse) return

    const interval = setInterval(() => {
      refreshActiveSynapse()
      refreshCollaborators()
    }, 5000) // Every 5 seconds

    return () => clearInterval(interval)
  }, [activeSynapse, refreshActiveSynapse, refreshCollaborators])

  if (!activeSynapse) return null

  const synapseType = activeSynapse.synapseType as SynapseType
  const config = SYNAPSE_CONFIG[synapseType]
  const styles = SYNAPSE_TYPE_STYLES[synapseType]
  const progress = getSynapseProgress()
  const myContribution = getMyContributionPercent()
  const estimatedReward = getEstimatedReward()
  const isLottery = config.distribution === 'lottery'

  // Find my explorer entry
  const myExplorer = collaborators.find(c => c.isCurrentUser)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]/30 overflow-hidden"
    >
      {/* Header */}
      <div className={cn('p-4 bg-gradient-to-r', styles.gradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-white" />
            <div>
              <h3 className="font-bold text-white">
                {getSynapseTypeLabel(synapseType)} Synapse
              </h3>
              <p className="text-sm text-white/70">
                {activeSynapse.region} - {activeSynapse.zone}
              </p>
            </div>
          </div>
          <button
            onClick={leaveCurrentExploration}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Leave exploration"
          >
            <LogOut className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-4 space-y-4">
        {/* Main Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--text-muted)]">Exploration Progress</span>
            <span className="font-bold text-[var(--text-primary)]">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-4 rounded-full bg-[var(--background-primary)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className={cn('h-full rounded-full bg-gradient-to-r', styles.gradient)}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>{formatPoints(activeSynapse.pointsAccumulated)}</span>
            <span>{formatPoints(activeSynapse.pointsRequired)}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="ETA"
            value={activeSynapse.currentEtaMinutes ? formatETA(activeSynapse.currentEtaMinutes) : '—'}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Explorers"
            value={`${activeSynapse.explorerCount}`}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="My Share"
            value={`${myContribution.toFixed(1)}%`}
            highlight
          />
        </div>

        {/* Spending Rate Control */}
        {myExplorer && (
          <div className="p-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[hsl(var(--accent))]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">My Spending Rate</span>
              </div>
              <span className="text-sm font-bold text-[hsl(var(--accent))]">
                {myExplorer.pointsPerMinute} pts/min
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSpendingRates.slice(0, 4).map((rate) => (
                <button
                  key={rate}
                  onClick={() => updateSpendingRate(rate)}
                  disabled={rate === myExplorer.pointsPerMinute}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    rate === myExplorer.pointsPerMinute
                      ? 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/40'
                      : 'bg-[var(--background-secondary)] text-[var(--text-muted)] hover:bg-[var(--background-secondary)]/80'
                  )}
                >
                  {rate}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reward Preview */}
        <div className={cn(
          'p-4 rounded-xl border',
          isLottery ? 'bg-purple-500/10 border-purple-500/30' : 'bg-green-500/10 border-green-500/30'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className={cn('h-5 w-5', isLottery ? 'text-purple-400' : 'text-green-400')} />
              <span className={cn('font-semibold', isLottery ? 'text-purple-400' : 'text-green-400')}>
                {isLottery ? 'Potential Reward' : 'Estimated Reward'}
              </span>
            </div>
            <div className="text-right">
              <p className={cn('font-bold', isLottery ? 'text-purple-400' : 'text-green-400')}>
                {formatPoints(estimatedReward.agi)} AGI
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                +{formatPoints(estimatedReward.brainXp)} XP
              </p>
            </div>
          </div>
          {isLottery && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Win chance: ~{myContribution.toFixed(1)}% based on contribution
            </p>
          )}
        </div>

        {/* Collaborators */}
        <div>
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--text-muted)]" />
            Collaborators ({collaborators.length})
          </h4>
          {isLoadingCollaborators ? (
            <div className="text-center py-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block"
              >
                <Zap className="h-5 w-5 text-[var(--text-muted)]" />
              </motion.div>
            </div>
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">
              You're the first explorer!
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {collaborators.map((collab) => (
                <div
                  key={collab.shipId}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg',
                    collab.isCurrentUser
                      ? 'bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30'
                      : 'bg-[var(--background-primary)]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      collab.isCurrentUser ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--text-muted)]'
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      collab.isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
                    )}>
                      {collab.shipName}
                      {collab.isCurrentUser && ' (You)'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {collab.contributionPercent.toFixed(1)}%
                    </span>
                    <span className="text-xs text-[var(--text-muted)] ml-2">
                      {collab.pointsPerMinute}/min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Stat card component
function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="p-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
      <div className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2',
        highlight ? 'bg-[var(--brand-teal-1)]/20 text-[var(--brand-teal-1)]' : 'bg-[var(--background-secondary)] text-[var(--text-muted)]'
      )}>
        {icon}
      </div>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className={cn(
        'font-bold',
        highlight ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
      )}>
        {value}
      </p>
    </div>
  )
}
