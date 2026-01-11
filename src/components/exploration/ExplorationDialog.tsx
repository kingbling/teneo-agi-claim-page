import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, Zap, Users, Clock, Gift, Ship as ShipIcon, AlertTriangle } from 'lucide-react'
import { useExplorationStore, getSpendingRateOptions } from '@/stores/explorationStore'
import { useShipStore } from '@/stores/shipStore'
import { useUserStore } from '@/stores/userStore'
import { SYNAPSE_CONFIG, type SynapseType, formatPoints, formatETA, getSynapseTypeLabel } from '@/types/game'
import { cn } from '@/lib/utils'

// Synapse type colors
const SYNAPSE_TYPE_STYLES: Record<SynapseType, { bg: string; text: string; border: string }> = {
  minor: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  complex: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  deep: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
  core: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  rare: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  legendary: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  unique: { bg: 'bg-amber-400/10', text: 'text-amber-300', border: 'border-amber-400/30' },
}

/**
 * ExplorationDialog - Modal for starting synapse exploration
 * Masterplan 2026: Choose ship, set spending rate, see rewards
 */
export function ExplorationDialog() {
  const {
    explorationDialog,
    closeExplorationDialog,
    setDialogShip,
    setDialogSpendingRate,
    confirmStartExploration,
    canExplore,
  } = useExplorationStore()

  const { userShips } = useShipStore()
  useUserStore()

  const { isOpen, synapse, selectedShipId, spendingRate, isStarting, error } = explorationDialog

  if (!isOpen || !synapse) return null

  const synapseType = synapse.synapseType as SynapseType
  const config = SYNAPSE_CONFIG[synapseType]
  const styles = SYNAPSE_TYPE_STYLES[synapseType]
  const spendingRateOptions = getSpendingRateOptions(synapseType)
  const isLottery = config.distribution === 'lottery'
  const canExploreResult = canExplore(synapse)

  // Get idle ships
  const idleShips = userShips.filter(s => s.state === 'idle')

  // Calculate ETA based on current spending rate and explorers
  const pointsRemaining = synapse.pointsRequired - synapse.pointsAccumulated
  const totalPointsPerMin = (synapse.explorerCount * 100) + spendingRate // Estimate
  const etaMinutes = Math.ceil(pointsRemaining / totalPointsPerMin)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={closeExplorationDialog}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-[var(--background-secondary)] rounded-2xl border border-[var(--card-border)]/30 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className={cn('p-6 border-b border-[var(--card-border)]/20', styles.bg)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('p-3 rounded-xl', styles.bg, styles.border, 'border')}>
                  <Brain className={cn('h-6 w-6', styles.text)} />
                </div>
                <div>
                  <h2 className={cn('text-xl font-bold', styles.text)}>
                    {getSynapseTypeLabel(synapseType)} Synapse
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {synapse.region} - {synapse.zone}
                  </p>
                </div>
              </div>
              <button
                onClick={closeExplorationDialog}
                className="p-2 rounded-lg hover:bg-[var(--background-primary)] transition-colors"
              >
                <X className="h-5 w-5 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Synapse Info */}
            <div className="grid grid-cols-3 gap-4">
              <InfoCard
                icon={<Clock className="h-4 w-4" />}
                label="Est. Time"
                value={formatETA(etaMinutes)}
              />
              <InfoCard
                icon={<Users className="h-4 w-4" />}
                label="Explorers"
                value={`${synapse.explorerCount}${config.maxExplorers !== -1 ? `/${config.maxExplorers}` : ''}`}
              />
              <InfoCard
                icon={<Gift className="h-4 w-4" />}
                label="Reward"
                value={formatPoints(config.agiReward)}
                highlight
              />
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--text-muted)]">Progress</span>
                <span className="font-medium">
                  {formatPoints(synapse.pointsAccumulated)} / {formatPoints(synapse.pointsRequired)}
                </span>
              </div>
              <div className="h-3 rounded-full bg-[var(--background-primary)] overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', styles.bg.replace('/10', ''))}
                  style={{ width: `${(synapse.pointsAccumulated / synapse.pointsRequired) * 100}%` }}
                />
              </div>
            </div>

            {/* Reward Info */}
            <div className={cn(
              'p-4 rounded-xl border',
              isLottery ? 'bg-purple-500/10 border-purple-500/30' : 'bg-green-500/10 border-green-500/30'
            )}>
              <div className="flex items-start gap-3">
                <Gift className={cn('h-5 w-5 mt-0.5', isLottery ? 'text-purple-400' : 'text-green-400')} />
                <div>
                  <p className={cn('font-semibold', isLottery ? 'text-purple-400' : 'text-green-400')}>
                    {isLottery ? 'Lottery Distribution' : 'Fair Share Distribution'}
                  </p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {isLottery
                      ? 'Winner takes all! Your odds are based on your contribution percentage. Non-winners receive lottery tickets.'
                      : 'Rewards are split proportionally based on points contributed.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Ship Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
                Select Ship
              </label>
              {idleShips.length === 0 ? (
                <div className="p-4 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20 text-center">
                  <ShipIcon className="h-8 w-8 mx-auto text-[var(--text-muted)]/30 mb-2" />
                  <p className="text-sm text-[var(--text-muted)]">No idle ships available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {idleShips.map((ship) => (
                    <button
                      key={ship.id}
                      onClick={() => setDialogShip(ship.id)}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all',
                        selectedShipId === ship.id
                          ? 'bg-[var(--brand-teal-1)]/10 border-[var(--brand-teal-1)]/40'
                          : 'bg-[var(--background-primary)] border-[var(--card-border)]/20 hover:border-[var(--card-border)]/40'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ShipIcon className={cn(
                          'h-4 w-4',
                          selectedShipId === ship.id ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'
                        )} />
                        <span className={cn(
                          'font-medium text-sm',
                          selectedShipId === ship.id ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
                        )}>
                          {ship.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Spending Rate */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
                Spending Rate
              </label>
              <div className="flex flex-wrap gap-2">
                {spendingRateOptions.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setDialogSpendingRate(rate)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      spendingRate === rate
                        ? 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/40'
                        : 'bg-[var(--background-primary)] text-[var(--text-muted)] border border-[var(--card-border)]/20 hover:border-[var(--card-border)]/40'
                    )}
                  >
                    {rate} pts/min
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Max for {getSynapseTypeLabel(synapseType)}: {config.maxPerMin} pts/min
              </p>
            </div>

            {/* Error */}
            {(error || !canExploreResult.canExplore) && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                <p className="text-sm text-red-400">
                  {error || canExploreResult.reason}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[var(--card-border)]/20 bg-[var(--background-primary)]/50">
            <div className="flex gap-3">
              <button
                onClick={closeExplorationDialog}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--background-secondary)] border border-[var(--card-border)]/20 text-[var(--text-muted)] font-medium hover:bg-[var(--background-secondary)]/80 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                onClick={confirmStartExploration}
                disabled={!selectedShipId || !canExploreResult.canExplore || isStarting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex-1 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                  selectedShipId && canExploreResult.canExplore
                    ? 'bg-gradient-to-r from-[var(--brand-teal-1)] to-[hsl(var(--accent))] text-white shadow-lg shadow-[var(--brand-teal-1)]/20'
                    : 'bg-[var(--background-secondary)] text-[var(--text-muted)] cursor-not-allowed'
                )}
              >
                {isStarting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Zap className="h-4 w-4" />
                    </motion.div>
                    Starting...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Start Exploration
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Info card component
function InfoCard({
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
    <div className="p-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)]/20">
      <div className="flex items-center gap-2 mb-1">
        <span className={highlight ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-muted)]'}>
          {icon}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <p className={cn(
        'font-bold',
        highlight ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
      )}>
        {value}
      </p>
    </div>
  )
}
