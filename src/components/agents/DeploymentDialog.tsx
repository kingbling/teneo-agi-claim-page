import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { useConfigStore } from '@/stores/configStore'
import type { SpaceCluster, AgentTrait, TraitType } from '@/types/agent'
import { TRAIT_EFFECTS } from '@/types/agent'
import { Button } from '@/components/ui/button'
import { Clock, Target, Rocket, Navigation, Gem, Star, Users, Crown, Sparkles, Trophy } from 'lucide-react'

const TRAIT_COLORS: Record<TraitType, string> = {
  explorer: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30',
  solver: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  swift: 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30',
  efficient: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  pioneer: 'bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/30',
  networker: 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30',
  beacon: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30',
  lucky: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  collaborative: 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30',
  trance: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30',
  staker: 'bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/30',
}

interface DeploymentDialogProps {
  isOpen: boolean
  onClose: () => void
  spaceCluster: SpaceCluster | null
}

export function DeploymentDialog({ isOpen, onClose, spaceCluster }: DeploymentDialogProps) {
  const { userAgents, deployAgent, createAgent, userPoints } = useAgentStore()
  const config = useConfigStore()
  const [deployingAgentId, setDeployingAgentId] = useState<string | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)

  // Create agent form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [selectedTraits, setSelectedTraits] = useState<AgentTrait[]>([])
  const [isCreating, setIsCreating] = useState(false)

  // Filter to only idle agents with fuel
  const availableAgents = userAgents.filter((a) => a.state === 'idle' && a.pointsBalance > 0)

  // Get selected agent
  const selectedAgent = useMemo(() => {
    return deployingAgentId ? userAgents.find(a => a.id === deployingAgentId) : null
  }, [deployingAgentId, userAgents])

  // Calculate travel estimates using config store
  const travelEstimates = useMemo(() => {
    if (!selectedAgent || !spaceCluster || !config.gameConfig) return null

    // Calculate distance from agent to space cluster
    const dx = spaceCluster.positionX - selectedAgent.positionX
    const dy = spaceCluster.positionY - selectedAgent.positionY
    const dz = spaceCluster.positionZ - selectedAgent.positionZ
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    // Get trait levels
    const swiftLevel = selectedAgent.traits.find(t => t.type === 'swift')?.level || 0
    const efficientLevel = selectedAgent.traits.find(t => t.type === 'efficient')?.level || 0

    // Use config store for calculations
    const travelTimeMs = config.calculateTravelTime(distance, swiftLevel)
    const travelTimeSeconds = travelTimeMs / 1000
    const effectiveBurnRate = config.calculateBurnRate(efficientLevel)
    const travelFuelCost = config.calculateTravelFuelCost(distance, swiftLevel, efficientLevel)

    // Estimate solving time (rough average)
    const avgSolveTimeSeconds = 60 // Placeholder, depends on probability

    // Total mission cost estimate
    const totalEstimatedCost = Math.ceil((travelTimeSeconds + avgSolveTimeSeconds) * effectiveBurnRate)

    // Check if agent has enough fuel
    const hasEnoughFuel = selectedAgent.pointsBalance >= travelFuelCost

    // Calculate baseline (no traits) for comparison
    const baseTravelTimeMs = config.calculateTravelTime(distance, 0)
    const baseTravelTimeSeconds = baseTravelTimeMs / 1000
    const baseTravelFuelCost = config.calculateTravelFuelCost(distance, 0, 0)
    const timeSavedSeconds = Math.ceil(baseTravelTimeSeconds - travelTimeSeconds)
    const fuelSaved = baseTravelFuelCost - travelFuelCost

    // Calculate trait bonuses for display
    const speedBonus = swiftLevel * config.getTraitMultiplier('swift', 'speedBonus')
    const burnReduction = efficientLevel * config.getTraitMultiplier('efficient', 'burnReduction')
    const speedBoostPercent = Math.round(speedBonus * 100)
    const burnReductionPercent = Math.round(burnReduction * 100)

    return {
      distance: distance.toFixed(2),
      travelTimeSeconds: Math.ceil(travelTimeSeconds),
      travelFuelCost,
      effectiveBurnRate: effectiveBurnRate.toFixed(2),
      totalEstimatedCost,
      hasEnoughFuel,
      agentFuel: Math.round(selectedAgent.pointsBalance),
      // Trait advantage comparisons
      baseTravelTimeSeconds: Math.ceil(baseTravelTimeSeconds),
      baseTravelFuelCost,
      timeSavedSeconds,
      fuelSaved,
      speedBoostPercent,
      burnReductionPercent,
      hasTraitAdvantage: speedBoostPercent > 0 || burnReductionPercent > 0,
    }
  }, [selectedAgent, spaceCluster])

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  // Calculate best agent recommendation
  const recommendedAgent = useMemo(() => {
    if (availableAgents.length <= 1 || !spaceCluster) return null

    let bestAgent: typeof availableAgents[0] | null = null
    let bestScore = -Infinity

    for (const agent of availableAgents) {
      // Calculate distance from home (0,0,0) to space cluster
      const dx = spaceCluster.positionX
      const dy = spaceCluster.positionY
      const dz = spaceCluster.positionZ
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // Calculate travel cost
      const swiftLevel = agent.traits.find(t => t.type === 'swift')?.level || 0
      const efficientLevel = agent.traits.find(t => t.type === 'efficient')?.level || 0
      const explorerLevel = agent.traits.find(t => t.type === 'explorer')?.level || 0

      const speedBoost = 1 + (swiftLevel * 0.20)
      const burnReduction = efficientLevel * 0.15
      const effectiveBurnRate = config.gameConfig!.rates.BASE_BURN_RATE * (1 - Math.min(burnReduction, 0.75))
      const travelTime = distance / (config.gameConfig!.rates.BASE_SPEED * speedBoost)
      const travelFuelCost = Math.ceil(travelTime * effectiveBurnRate)

      // Skip if not enough fuel
      if (agent.pointsBalance < travelFuelCost) continue

      // Calculate remaining fuel after travel
      const remainingFuel = agent.pointsBalance - travelFuelCost
      const exploreTime = remainingFuel / effectiveBurnRate

      // Score: weighted combination
      const discoveryRate = agent.spacesDiscovered > 0 && agent.distanceTraveled > 0
        ? agent.spacesDiscovered / agent.distanceTraveled
        : 0.1

      const score =
        exploreTime * 2 +
        swiftLevel * 15 +
        efficientLevel * 20 +
        explorerLevel * 25 +
        discoveryRate * 100

      if (score > bestScore) {
        bestScore = score
        bestAgent = agent
      }
    }

    return bestAgent
  }, [availableAgents, spaceCluster])

  // Calculate fleet rankings for selected agent
  const fleetRankings = useMemo(() => {
    if (!selectedAgent || userAgents.length <= 1) return null

    // Sort agents by different metrics
    const agentsSorted = [...userAgents]

    // Efficiency ranking (loot per fuel burned)
    const efficiencySorted = agentsSorted
      .filter(a => a.totalPointsBurned > 0)
      .sort((a, b) => (b.totalLoot / b.totalPointsBurned) - (a.totalLoot / a.totalPointsBurned))
    const efficiencyRank = efficiencySorted.findIndex(a => a.id === selectedAgent.id) + 1 || null
    const efficiencyValue = selectedAgent.totalPointsBurned > 0
      ? (selectedAgent.totalLoot / selectedAgent.totalPointsBurned).toFixed(1)
      : null

    // Discoveries ranking
    const discoveriesSorted = agentsSorted
      .filter(a => a.spacesDiscovered > 0)
      .sort((a, b) => b.spacesDiscovered - a.spacesDiscovered)
    const discoveriesRank = discoveriesSorted.findIndex(a => a.id === selectedAgent.id) + 1 || null

    // Loot ranking
    const lootSorted = agentsSorted
      .filter(a => a.totalLoot > 0)
      .sort((a, b) => b.totalLoot - a.totalLoot)
    const lootRank = lootSorted.findIndex(a => a.id === selectedAgent.id) + 1 || null

    // Only show if agent has some stats
    const hasStats = efficiencyRank || discoveriesRank || lootRank

    return hasStats ? {
      efficiency: efficiencyRank ? { rank: efficiencyRank, total: efficiencySorted.length, value: efficiencyValue } : null,
      discoveries: discoveriesRank ? { rank: discoveriesRank, total: discoveriesSorted.length, value: selectedAgent.spacesDiscovered } : null,
      loot: lootRank ? { rank: lootRank, total: lootSorted.length, value: selectedAgent.totalLoot } : null,
      fleetSize: userAgents.length,
    } : null
  }, [selectedAgent, userAgents])

  const allTraits: TraitType[] = ['explorer', 'solver', 'swift', 'efficient', 'pioneer', 'networker', 'beacon', 'lucky', 'collaborative', 'trance', 'staker']

  const toggleTrait = (type: TraitType) => {
    const existing = selectedTraits.find(t => t.type === type)
    if (existing) {
      setSelectedTraits(selectedTraits.filter(t => t.type !== type))
    } else if (selectedTraits.length < 3) {
      setSelectedTraits([...selectedTraits, { type, level: 1 }])
    }
  }

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return
    setIsCreating(true)
    const agent = await createAgent(newAgentName.trim(), selectedTraits)
    setIsCreating(false)
    if (agent) {
      setNewAgentName('')
      setSelectedTraits([])
      setShowCreateForm(false)
      setDeployingAgentId(agent.id)
    }
  }

  const handleDeploy = async () => {
    if (!deployingAgentId || !spaceCluster) return

    setIsDeploying(true)
    const success = await deployAgent(
      deployingAgentId,
      spaceCluster.positionX,
      spaceCluster.positionY,
      spaceCluster.positionZ
    )
    setIsDeploying(false)

    if (success) {
      setDeployingAgentId(null)
      onClose()
    }
  }

  if (!isOpen || !spaceCluster) return null

  const creationCost = config.calculateAgentCost(selectedTraits)
  const canAffordCreation = userPoints >= creationCost

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 rounded-2xl blur-lg" />

        <div className="relative bg-[var(--background-secondary)]/95 backdrop-blur-xl border border-[var(--card-border)] rounded-2xl p-8 w-full max-w-md shadow-2xl">
          {/* Header with icon */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center shadow-lg shadow-[var(--brand-teal-1)]/20">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Deploy Agent</h2>
              <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Send your agent to explore</p>
            </div>
          </div>

          {/* Space info */}
          <div className="rounded-xl bg-[var(--background-primary)]/80 border border-[var(--card-border)] mb-6 p-6">
            <div className="flex items-center text-base font-medium text-[var(--text-primary)]" style={{ gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <Target className="h-5 w-5" style={{ color: 'hsl(var(--accent))' }} />
              Target Space Cluster
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="px-5 py-3.5 rounded-xl bg-[var(--background-secondary)]/50">
                <div className="text-xl font-bold text-[var(--text-primary)] mb-1">{spaceCluster.spaceCount.toLocaleString()}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Total Spaces</div>
              </div>
              <div className="px-5 py-3.5 rounded-xl bg-[var(--background-secondary)]/50">
                <div className="text-xl font-bold mb-1 text-[hsl(var(--success))]">{spaceCluster.discoveredCount.toLocaleString()}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Discovered</div>
              </div>
              <div className="px-5 py-3.5 rounded-xl bg-[var(--background-secondary)]/50">
                <div className="text-xl font-bold mb-1 text-[hsl(var(--destructive))]">{spaceCluster.beingSolvedCount.toLocaleString()}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Being Solved</div>
              </div>
              <div className="px-5 py-3.5 rounded-xl bg-[var(--background-secondary)]/50">
                <div className="text-xl font-bold text-[var(--brand-teal-1)] mb-1">{Math.round(spaceCluster.avgLootPool)}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Avg AGI Loot</div>
              </div>
            </div>

            {/* Tier Breakdown */}
            {spaceCluster.tierCounts && (
              <div className="border-t border-[var(--card-border)]/50" style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)' }}>
                <div className="flex items-center" style={{ gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
                  <Gem className="h-4 w-4" style={{ color: 'hsl(var(--accent))' }} />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Space Tiers</span>
                </div>
                <div className="flex flex-wrap" style={{ gap: 'var(--spacing-xs)' }}>
                  {spaceCluster.tierCounts.common > 0 && (
                    <div className="flex items-center rounded-lg bg-[hsl(var(--secondary))]/10 border border-[hsl(var(--secondary))]/20" style={{ gap: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                      <Star className="h-3 w-3" style={{ color: 'hsl(var(--secondary))' }} />
                      <span className="text-xs font-medium" style={{ color: 'hsl(var(--secondary))' }}>{spaceCluster.tierCounts.common}</span>
                      <span className="text-[10px]" style={{ color: 'hsl(var(--secondary))' }}>Common</span>
                    </div>
                  )}
                  {spaceCluster.tierCounts.trait > 0 && (
                    <div className="flex items-center rounded-lg bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20" style={{ gap: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                      <Sparkles className="h-3 w-3" style={{ color: 'hsl(var(--primary))' }} />
                      <span className="text-xs font-medium" style={{ color: 'hsl(var(--primary))' }}>{spaceCluster.tierCounts.trait}</span>
                      <span className="text-[10px]" style={{ color: 'hsl(var(--primary))' }}>Trait</span>
                    </div>
                  )}
                  {spaceCluster.tierCounts.team > 0 && (
                    <div className="flex items-center rounded-lg bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/20" style={{ gap: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                      <Users className="h-3 w-3" style={{ color: 'hsl(var(--success))' }} />
                      <span className="text-xs font-medium" style={{ color: 'hsl(var(--success))' }}>{spaceCluster.tierCounts.team}</span>
                      <span className="text-[10px]" style={{ color: 'hsl(var(--success))' }}>Team</span>
                    </div>
                  )}
                  {spaceCluster.tierCounts.legendary > 0 && (
                    <div className="flex items-center rounded-lg bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/20" style={{ gap: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                      <Crown className="h-3 w-3" style={{ color: 'hsl(var(--accent))' }} />
                      <span className="text-xs font-medium" style={{ color: 'hsl(var(--accent))' }}>{spaceCluster.tierCounts.legendary}</span>
                      <span className="text-[10px]" style={{ color: 'hsl(var(--accent))' }}>Legendary</span>
                    </div>
                  )}
                  {spaceCluster.tierCounts.mythic > 0 && (
                    <div className="flex items-center rounded-lg bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/20" style={{ gap: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                      <Crown className="h-3 w-3" style={{ color: 'hsl(var(--success))' }} />
                      <span className="text-xs font-medium" style={{ color: 'hsl(var(--success))' }}>{spaceCluster.tierCounts.mythic}</span>
                      <span className="text-[10px]" style={{ color: 'hsl(var(--success))' }}>Mythic</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Agent selection */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label className="text-base font-medium text-[var(--text-primary)] block" style={{ marginBottom: 'var(--spacing-md)' }}>Select Agent</label>

            {availableAgents.length === 0 ? (
              showCreateForm ? (
                <div className="rounded-xl bg-[var(--background-primary)]/50 border border-[var(--card-border)]" style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {/* Name input */}
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="Enter agent name..."
                    className="w-full rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:border-[var(--brand-teal-1)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-teal-1)]/20 transition-all"
                    style={{ paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}
                  />

                  {/* Trait selection */}
                  <div className="grid grid-cols-2" style={{ gap: 'var(--spacing-sm)' }}>
                    {allTraits.map((type) => {
                      const isSelected = selectedTraits.some(t => t.type === type)
                      return (
                        <button
                          key={type}
                          onClick={() => toggleTrait(type)}
                          className={`
                            rounded-xl border text-left transition-all text-sm
                            ${isSelected
                              ? `${TRAIT_COLORS[type]} border-current`
                              : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:border-[var(--card-border-hover)] hover:bg-[var(--background-secondary)]/30'
                            }
                          `}
                          style={{ paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}
                        >
                          <div className="font-medium capitalize">{type}</div>
                          <div className="text-xs opacity-70 mt-0.5">{TRAIT_EFFECTS[type].effectPerLevel}</div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Cost Breakdown */}
                  <div className="border-t border-[var(--card-border)]/50" style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)' }}>
                    <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide" style={{ marginBottom: 'var(--spacing-xs)' }}>
                      Cost Breakdown
                    </div>
                    <div style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">Base creation</span>
                        <span className="text-[var(--text-primary)] font-medium">100 pts</span>
                      </div>
                      {selectedTraits.length > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)]">
                            Traits ({selectedTraits.length}×)
                          </span>
                          <span className="font-medium" style={{ color: 'hsl(var(--accent))' }}>
                            +{selectedTraits.reduce((sum, t) => sum + t.level * 50, 0)} pts
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm border-t border-[var(--card-border)]/30" style={{ paddingTop: 'var(--spacing-xs)' }}>
                        <span className="text-[var(--text-primary)] font-semibold">Total</span>
                        <span className={`font-bold ${canAffordCreation ? 'text-[var(--brand-teal-1)]' : ''}`} style={!canAffordCreation ? { color: 'hsl(var(--destructive))' } : undefined}>
                          {creationCost} pts
                        </span>
                      </div>
                    </div>
                    {!canAffordCreation && (
                      <div className="rounded-lg bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/20 text-[10px] flex items-center" style={{ marginBottom: 'var(--spacing-sm)', paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)', gap: 'var(--spacing-xs)', color: 'hsl(var(--destructive))' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
                        Need {creationCost - userPoints} more pts (balance: {userPoints})
                      </div>
                    )}
                    <div className="flex" style={{ gap: 'var(--spacing-sm)' }}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCreateForm(false)}
                        className="h-10 text-sm rounded-xl px-4"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateAgent}
                        disabled={!newAgentName.trim() || isCreating || !canAffordCreation}
                        className="flex-1 h-10 text-sm rounded-xl px-4"
                      >
                        {isCreating ? 'Creating...' : 'Create Agent'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center rounded-xl bg-[var(--background-primary)]/50 border border-dashed border-[var(--card-border)]" style={{ paddingTop: 'var(--spacing-lg)', paddingBottom: 'var(--spacing-lg)', paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)' }}>
                  <div className="w-14 h-14 mx-auto rounded-full bg-[var(--background-secondary)] flex items-center justify-center" style={{ marginBottom: 'var(--spacing-md)' }}>
                    <Rocket className="w-7 h-7 text-[var(--text-tertiary)]" />
                  </div>
                  <p className="text-[var(--text-secondary)] text-base" style={{ marginBottom: 'var(--spacing-md)' }}>No idle agents with fuel available</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCreateForm(true)}
                    className="rounded-xl h-10 px-4"
                  >
                    + Create Agent
                  </Button>
                </div>
              )
            ) : (
              <div className="max-h-64 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {availableAgents.map((agent) => {
                  // Calculate agent stats for comparison
                  const swiftLevel = agent.traits.find(t => t.type === 'swift')?.level || 0
                  const efficientLevel = agent.traits.find(t => t.type === 'efficient')?.level || 0
                  const explorerLevel = agent.traits.find(t => t.type === 'explorer')?.level || 0

                  const speedBoost = Math.round(swiftLevel * 60)
                  const efficiencyBoost = Math.round(efficientLevel * 50)
                  const rangeBoost = Math.round(explorerLevel * 40)

                  return (
                    <button
                      key={agent.id}
                      onClick={(e) => { e.stopPropagation(); setDeployingAgentId(agent.id); }}
                      className={`w-full rounded-xl border text-left transition-all ${
                        deployingAgentId === agent.id
                          ? 'border-[var(--brand-teal-1)]/50 bg-gradient-to-r from-[var(--brand-teal-1)]/10 to-transparent shadow-md shadow-[var(--brand-teal-1)]/10'
                          : 'border-[var(--card-border)] hover:border-[var(--card-border-hover)] hover:bg-[var(--background-primary)]/50'
                      }`}
                      style={{ paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center" style={{ gap: 'var(--spacing-sm)' }}>
                          <div className={`w-3 h-3 rounded-full ${deployingAgentId === agent.id ? 'bg-[var(--brand-teal-1)]' : recommendedAgent?.id === agent.id ? '' : ''}`} style={deployingAgentId === agent.id ? undefined : (recommendedAgent?.id === agent.id ? { backgroundColor: 'hsl(var(--success))' } : { backgroundColor: 'hsl(var(--secondary))' })} />
                          <span className="font-semibold text-base text-[var(--text-primary)]">{agent.name}</span>
                          {recommendedAgent?.id === agent.id && (
                            <span className="text-[9px] font-bold uppercase tracking-wide rounded-full bg-[hsl(var(--success))]/20 border border-[hsl(var(--success))]/30" style={{ paddingLeft: 'var(--spacing-xs)', paddingRight: 'var(--spacing-xs)', paddingTop: '2px', paddingBottom: '2px', color: 'hsl(var(--success))' }}>
                              Best
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-[var(--brand-teal-1)]">
                          {Math.round(agent.pointsBalance)} pts
                        </span>
                      </div>

                      {/* Quick stats comparison */}
                      <div className="flex items-center text-[10px]" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-xs)', marginLeft: 'var(--spacing-lg)' }}>
                        <span className={`flex items-center ${speedBoost > 0 ? '' : 'text-[var(--text-muted)]'}`} style={speedBoost > 0 ? { color: 'hsl(var(--primary))', gap: '4px' } : { gap: '4px' }}>
                          ⚡ {speedBoost > 0 ? `+${speedBoost}%` : '0%'}
                        </span>
                        <span className={`flex items-center ${efficiencyBoost > 0 ? '' : 'text-[var(--text-muted)]'}`} style={efficiencyBoost > 0 ? { color: 'hsl(var(--success))', gap: '4px' } : { gap: '4px' }}>
                          🔋 {efficiencyBoost > 0 ? `-${efficiencyBoost}%` : '0%'}
                        </span>
                        <span className={`flex items-center ${rangeBoost > 0 ? '' : 'text-[var(--text-muted)]'}`} style={rangeBoost > 0 ? { color: 'hsl(var(--accent))', gap: '4px' } : { gap: '4px' }}>
                          🔭 {rangeBoost > 0 ? `+${rangeBoost}%` : '0%'}
                        </span>
                        {agent.spacesDiscovered > 0 && (
                          <span className="flex items-center" style={{ color: 'hsl(var(--success))', gap: '4px' }}>
                            ✨ {agent.spacesDiscovered} found
                          </span>
                        )}
                      </div>

                      <div className="flex" style={{ gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', marginLeft: 'var(--spacing-lg)' }}>
                        {agent.traits.map((trait, i) => (
                          <span
                            key={i}
                            className={`text-xs rounded-full border ${TRAIT_COLORS[trait.type]}`}
                            style={{ paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}
                          >
                            {trait.type} Lv{trait.level}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Travel Estimates */}
          {travelEstimates && selectedAgent && (
            <div className="rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/5 to-transparent border border-[hsl(var(--primary))]/20" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
              <div className="flex items-center text-base font-medium text-[var(--text-primary)]" style={{ gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                <Clock className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
                Mission Estimates
              </div>

              {/* Distance Indicator */}
              <div className="rounded-xl bg-[var(--background-primary)]/40 border border-[var(--card-border)]" style={{ marginBottom: 'var(--spacing-md)', paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4" style={{ color: 'hsl(var(--primary))' }} />
                    <span className="text-sm text-[var(--text-secondary)]">Distance to Target</span>
                  </div>
                  <span className="font-bold text-[var(--text-primary)]">{travelEstimates.distance} units</span>
                </div>
                <div className="flex items-center" style={{ gap: 'var(--spacing-xs)' }}>
                  <div className="flex-1 h-2 rounded-full bg-[var(--background-secondary)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (parseFloat(travelEstimates.distance) / 3) * 100)}%`,
                        backgroundColor: parseFloat(travelEstimates.distance) < 0.5
                          ? 'hsl(var(--success))'
                          : parseFloat(travelEstimates.distance) < 1.0
                            ? 'hsl(var(--success))'
                            : parseFloat(travelEstimates.distance) < 2.0
                              ? 'hsl(var(--destructive))'
                              : 'hsl(var(--destructive))'
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-medium rounded-full"
                    style={{
                      paddingLeft: 'var(--spacing-xs)',
                      paddingRight: 'var(--spacing-xs)',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                      backgroundColor: parseFloat(travelEstimates.distance) < 0.5
                        ? 'hsl(var(--success))/0.1'
                        : parseFloat(travelEstimates.distance) < 1.0
                          ? 'hsl(var(--success))/0.1'
                          : parseFloat(travelEstimates.distance) < 2.0
                            ? 'hsl(var(--destructive))/0.1'
                            : 'hsl(var(--destructive))/0.1',
                      color: parseFloat(travelEstimates.distance) < 0.5
                        ? 'hsl(var(--success))'
                        : parseFloat(travelEstimates.distance) < 1.0
                          ? 'hsl(var(--success))'
                          : parseFloat(travelEstimates.distance) < 2.0
                            ? 'hsl(var(--destructive))'
                            : 'hsl(var(--destructive))'
                    }}
                  >
                    {parseFloat(travelEstimates.distance) < 0.5
                      ? 'Short'
                      : parseFloat(travelEstimates.distance) < 1.0
                        ? 'Medium'
                        : parseFloat(travelEstimates.distance) < 2.0
                          ? 'Long'
                          : 'Very Long'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 text-sm" style={{ gap: 'var(--spacing-md)' }}>
                <div className="flex flex-col rounded-xl bg-[var(--background-primary)]/30" style={{ paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}>
                  <span className="text-[var(--text-tertiary)]" style={{ marginBottom: 'var(--spacing-xs)' }}>Travel Time</span>
                  <span className="font-semibold text-base" style={{ color: 'hsl(var(--primary))' }}>{formatTime(travelEstimates.travelTimeSeconds)}</span>
                </div>
                <div className="flex flex-col rounded-xl bg-[var(--background-primary)]/30" style={{ paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}>
                  <span className="text-[var(--text-tertiary)]" style={{ marginBottom: 'var(--spacing-xs)' }}>Travel Cost</span>
                  <span className="font-semibold text-base" style={travelEstimates.hasEnoughFuel ? undefined : { color: 'hsl(var(--destructive))' }}>
                    {travelEstimates.travelFuelCost} pts
                  </span>
                </div>
                <div className="flex flex-col rounded-xl bg-[var(--background-primary)]/30" style={{ paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}>
                  <span className="text-[var(--text-tertiary)]" style={{ marginBottom: 'var(--spacing-xs)' }}>Burn Rate</span>
                  <span className="text-[var(--text-primary)] font-semibold text-base">{travelEstimates.effectiveBurnRate}/s</span>
                </div>
                <div className="flex flex-col rounded-xl bg-[var(--background-primary)]/30" style={{ paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}>
                  <span className="text-[var(--text-tertiary)]" style={{ marginBottom: 'var(--spacing-xs)' }}>Agent Fuel</span>
                  <span className="font-semibold text-base" style={{ color: travelEstimates.hasEnoughFuel ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}>
                    {travelEstimates.agentFuel} pts
                  </span>
                </div>
              </div>
              {!travelEstimates.hasEnoughFuel && (
                <div className="rounded-xl bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/20 text-sm" style={{ marginTop: 'var(--spacing-md)', paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)', color: 'hsl(var(--destructive))' }}>
                  Insufficient fuel! Need at least {travelEstimates.travelFuelCost} pts to reach destination.
                </div>
              )}

              {/* Estimated exploration time with current fuel */}
              {travelEstimates.hasEnoughFuel && (() => {
                const remainingFuel = travelEstimates.agentFuel - travelEstimates.travelFuelCost
                const exploreTime = Math.floor(remainingFuel / parseFloat(travelEstimates.effectiveBurnRate))
                const mins = Math.floor(exploreTime / 60)
                const secs = exploreTime % 60
                const isLowExploreTime = exploreTime < 60 // Less than 1 minute
                const isVeryLow = exploreTime < 30 // Less than 30 seconds

                return (
                  <div
                    className="rounded-xl"
                    style={{
                      marginTop: 'var(--spacing-md)',
                      paddingLeft: 'var(--spacing-md)',
                      paddingRight: 'var(--spacing-md)',
                      paddingTop: 'var(--spacing-sm)',
                      paddingBottom: 'var(--spacing-sm)',
                      backgroundColor: isVeryLow
                        ? 'hsl(var(--destructive))/0.1'
                        : isLowExploreTime
                          ? 'hsl(var(--success))/0.05'
                          : 'var(--brand-teal-1)/0.05',
                      border: isVeryLow
                        ? '1px solid hsl(var(--destructive))/0.3'
                        : isLowExploreTime
                          ? '1px solid hsl(var(--success))/0.2'
                          : '1px solid var(--brand-teal-1)/0.2'
                    }}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Est. Exploration Time</span>
                      <span
                        className="font-semibold"
                        style={{
                          color: isVeryLow
                            ? 'hsl(var(--destructive))'
                            : isLowExploreTime
                              ? 'hsl(var(--success))'
                              : 'var(--brand-teal-1)'
                        }}
                      >
                        {mins > 0 ? `~${mins}m ${secs}s` : `~${secs}s`}
                      </span>
                    </div>
                    {isVeryLow ? (
                      <div className="flex items-center text-[10px]" style={{ marginTop: 'var(--spacing-xs)', gap: 'var(--spacing-xs)', color: 'hsl(var(--destructive))' }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
                        Warning: Very short exploration time. Agent may exhaust fuel quickly!
                      </div>
                    ) : isLowExploreTime ? (
                      <div className="flex items-center text-[10px]" style={{ marginTop: 'var(--spacing-xs)', gap: 'var(--spacing-xs)', color: 'hsl(var(--success))' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--success))' }} />
                        Low fuel warning: Limited exploration time after arrival
                      </div>
                    ) : (
                      <div className="text-[10px] text-[var(--text-muted)]" style={{ marginTop: 'var(--spacing-xs)' }}>
                        After reaching destination, agent can explore for this duration
                      </div>
                    )}
                    {/* Estimated discoveries based on time */}
                    {exploreTime >= 30 && (
                      <div className="border-t border-[var(--card-border)]/30 flex items-center justify-between text-[10px]" style={{ marginTop: 'var(--spacing-xs)', paddingTop: 'var(--spacing-xs)' }}>
                        <span className="text-[var(--text-muted)]">Est. discoveries:</span>
                        <span className="font-medium" style={{ color: 'hsl(var(--success))' }}>
                          ~{Math.max(1, Math.floor(exploreTime / 45))} spaces
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Trait Advantage Comparison */}
              {travelEstimates.hasTraitAdvantage && (
                <div className="rounded-xl bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/20" style={{ marginTop: 'var(--spacing-md)', paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}>
                  <div className="flex items-center" style={{ gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--accent))' }}>Trait Advantage</span>
                    <span className="flex-1 h-px" style={{ backgroundColor: 'hsl(var(--accent))/0.2' }} />
                  </div>
                  <div className="grid grid-cols-2 text-sm" style={{ gap: 'var(--spacing-sm)' }}>
                    {travelEstimates.speedBoostPercent > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--primary))]/10" style={{ paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                        <span className="text-[var(--text-tertiary)] text-xs">Speed</span>
                        <span className="font-semibold" style={{ color: 'hsl(var(--primary))' }}>+{travelEstimates.speedBoostPercent}%</span>
                      </div>
                    )}
                    {travelEstimates.burnReductionPercent > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--success))]/10" style={{ paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                        <span className="text-[var(--text-tertiary)] text-xs">Efficiency</span>
                        <span className="font-semibold" style={{ color: 'hsl(var(--success))' }}>-{travelEstimates.burnReductionPercent}% burn</span>
                      </div>
                    )}
                  </div>
                  {(travelEstimates.timeSavedSeconds > 0 || travelEstimates.fuelSaved > 0) && (
                    <div className="border-t border-[hsl(var(--accent))]/20 flex items-center justify-between text-xs" style={{ marginTop: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)' }}>
                      <span className="text-[var(--text-muted)]">vs. baseline agent:</span>
                      <div className="flex items-center" style={{ gap: 'var(--spacing-sm)' }}>
                        {travelEstimates.timeSavedSeconds > 0 && (
                          <span className="font-medium" style={{ color: 'hsl(var(--primary))' }}>-{formatTime(travelEstimates.timeSavedSeconds)} travel</span>
                        )}
                        {travelEstimates.fuelSaved > 0 && (
                          <span className="font-medium" style={{ color: 'hsl(var(--success))' }}>-{travelEstimates.fuelSaved} pts</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fleet Ranking Comparison */}
              {fleetRankings && (
                <div className="rounded-xl bg-[hsl(var(--success))]/5 border border-[hsl(var(--success))]/20" style={{ marginTop: 'var(--spacing-md)', paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)' }}>
                  <div className="flex items-center" style={{ gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
                    <Trophy className="h-4 w-4" style={{ color: 'hsl(var(--success))' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--success))' }}>Fleet Rankings</span>
                    <span className="flex-1 h-px" style={{ backgroundColor: 'hsl(var(--success))/0.2' }} />
                    <span className="text-[10px] text-[var(--text-muted)]">{fleetRankings.fleetSize} agents</span>
                  </div>
                  <div className="grid grid-cols-3" style={{ gap: 'var(--spacing-xs)' }}>
                    {/* Efficiency Rank */}
                    <div className="rounded-lg bg-[var(--background-primary)]/40 text-center" style={{ paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                      {fleetRankings.efficiency ? (
                        <>
                          <div
                            className="text-sm font-bold"
                            style={{
                              color: fleetRankings.efficiency.rank === 1
                                ? 'hsl(var(--success))'
                                : fleetRankings.efficiency.rank <= 3
                                  ? 'hsl(var(--secondary))'
                                  : 'var(--text-secondary)'
                            }}
                          >
                            #{fleetRankings.efficiency.rank}
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)]">
                            {fleetRankings.efficiency.value}x eff
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-[var(--text-muted)]">—</div>
                          <div className="text-[9px] text-[var(--text-muted)]">No data</div>
                        </>
                      )}
                    </div>
                    {/* Discoveries Rank */}
                    <div className="rounded-lg bg-[var(--background-primary)]/40 text-center" style={{ paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                      {fleetRankings.discoveries ? (
                        <>
                          <div
                            className="text-sm font-bold"
                            style={{
                              color: fleetRankings.discoveries.rank === 1
                                ? 'hsl(var(--success))'
                                : fleetRankings.discoveries.rank <= 3
                                  ? 'hsl(var(--secondary))'
                                  : 'var(--text-secondary)'
                            }}
                          >
                            #{fleetRankings.discoveries.rank}
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)]">
                            {fleetRankings.discoveries.value} found
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-[var(--text-muted)]">—</div>
                          <div className="text-[9px] text-[var(--text-muted)]">No finds</div>
                        </>
                      )}
                    </div>
                    {/* Loot Rank */}
                    <div className="rounded-lg bg-[var(--background-primary)]/40 text-center" style={{ paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                      {fleetRankings.loot ? (
                        <>
                          <div
                            className="text-sm font-bold"
                            style={{
                              color: fleetRankings.loot.rank === 1
                                ? 'hsl(var(--success))'
                                : fleetRankings.loot.rank <= 3
                                  ? 'hsl(var(--secondary))'
                                  : 'var(--text-secondary)'
                            }}
                          >
                            #{fleetRankings.loot.rank}
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)]">
                            {fleetRankings.loot.value} AGI
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-[var(--text-muted)]">—</div>
                          <div className="text-[9px] text-[var(--text-muted)]">No loot</div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Top performer note */}
                  {(fleetRankings.efficiency?.rank === 1 || fleetRankings.discoveries?.rank === 1 || fleetRankings.loot?.rank === 1) && (
                    <div className="border-t border-[hsl(var(--success))]/20 text-[10px] flex items-center justify-center" style={{ marginTop: 'var(--spacing-xs)', paddingTop: 'var(--spacing-xs)', gap: 'var(--spacing-xs)', color: 'hsl(var(--success))' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--success))' }} />
                      Top performer in {[
                        fleetRankings.efficiency?.rank === 1 && 'efficiency',
                        fleetRankings.discoveries?.rank === 1 && 'discoveries',
                        fleetRankings.loot?.rank === 1 && 'loot'
                      ].filter(Boolean).join(' & ')}!
                    </div>
                  )}
                </div>
              )}

              {/* Mission Success Prediction */}
              {selectedAgent && travelEstimates && travelEstimates.hasEnoughFuel && (
                <div className="rounded-xl bg-gradient-to-r from-[hsl(var(--primary))]/5 to-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/20" style={{ marginTop: 'var(--spacing-md)', paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', paddingBottom: 'var(--spacing-md)' }}>
                  <div className="flex items-center" style={{ gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
                    <Target className="h-4 w-4" style={{ color: 'hsl(var(--primary))' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--primary))' }}>Mission Prediction</span>
                  </div>
                  {(() => {
                    // Calculate mission success score based on various factors
                    const remainingFuel = travelEstimates.agentFuel - travelEstimates.travelFuelCost
                    const exploreTime = Math.floor(remainingFuel / parseFloat(travelEstimates.effectiveBurnRate))

                    // Trait bonuses
                    const explorerLevel = selectedAgent.traits.find(t => t.type === 'explorer')?.level || 0
                    const efficientLevel = selectedAgent.traits.find(t => t.type === 'efficient')?.level || 0
                    const luckyLevel = selectedAgent.traits.find(t => t.type === 'lucky')?.level || 0

                    // Calculate predicted discoveries
                    const baseDiscoveryRate = 1 / 45 // 1 per 45 seconds base
                    const explorerBonus = 1 + explorerLevel * 0.4
                    const luckyBonus = 1 + luckyLevel * 0.15
                    const predictedDiscoveries = Math.max(1, Math.round(exploreTime * baseDiscoveryRate * explorerBonus * luckyBonus))

                    // Calculate predicted loot (rough estimate)
                    const avgLootPerDiscovery = spaceCluster?.avgLootPool || 30
                    const predictedLoot = Math.round(predictedDiscoveries * avgLootPerDiscovery * luckyBonus)

                    // Success score (0-100)
                    const fuelScore = Math.min(40, (exploreTime / 120) * 40)
                    const traitScore = Math.min(30, (explorerLevel + efficientLevel + luckyLevel) * 6)
                    const targetScore = Math.min(30, ((spaceCluster?.spaceCount || 0) - (spaceCluster?.discoveredCount || 0)) > 50 ? 30 : 15)
                    const successScore = Math.round(fuelScore + traitScore + targetScore)

                    const successLabel = successScore >= 80 ? 'Excellent' : successScore >= 60 ? 'Good' : successScore >= 40 ? 'Fair' : 'Risky'
                    const successColor = successScore >= 80 ? 'hsl(var(--success))' : successScore >= 60 ? 'hsl(var(--primary))' : successScore >= 40 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'
                    const successBg = successScore >= 80 ? 'hsl(var(--success))' : successScore >= 60 ? 'hsl(var(--primary))' : successScore >= 40 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'

                    return (
                      <>
                        {/* Success Score */}
                        <div className="flex items-center" style={{ gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                          <div className="flex-1 h-2 rounded-full bg-[var(--background-primary)] overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: successBg }}
                              initial={{ width: 0 }}
                              animate={{ width: `${successScore}%` }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            />
                          </div>
                          <span className="text-sm font-bold" style={{ color: successColor }}>
                            {successScore}%
                          </span>
                        </div>
                        <div className="text-center" style={{ marginBottom: 'var(--spacing-sm)' }}>
                          <span className="text-xs font-semibold" style={{ color: successColor }}>
                            {successLabel} Mission Outlook
                          </span>
                        </div>
                        {/* Predictions */}
                        <div className="grid grid-cols-2" style={{ gap: 'var(--spacing-xs)' }}>
                          <div className="rounded-lg bg-[var(--background-primary)]/40 text-center" style={{ paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                            <div className="text-sm font-bold" style={{ color: 'hsl(var(--success))' }}>~{predictedDiscoveries}</div>
                            <div className="text-[9px] text-[var(--text-muted)]">Est. Discoveries</div>
                          </div>
                          <div className="rounded-lg bg-[var(--background-primary)]/40 text-center" style={{ paddingLeft: 'var(--spacing-sm)', paddingRight: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)' }}>
                            <div className="text-sm font-bold text-[var(--brand-teal-1)]">~{predictedLoot}</div>
                            <div className="text-[9px] text-[var(--text-muted)]">Est. AGI Loot</div>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex" style={{ gap: 'var(--spacing-md)' }} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl text-base"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl text-base bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] hover:opacity-90 shadow-lg shadow-[var(--brand-teal-1)]/20"
              onClick={(e) => { e.stopPropagation(); handleDeploy(); }}
              disabled={!deployingAgentId || isDeploying || (travelEstimates !== null && !travelEstimates.hasEnoughFuel)}
            >
              {isDeploying ? 'Deploying...' : 'Deploy Agent'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
