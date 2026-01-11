import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Users, Sparkles, Ticket, ChevronRight } from 'lucide-react'
import {
  useRewardStore,
  selectCurrentLotteryAnimation,
  selectIsAnimatingLottery,
  type LotteryParticipant,
} from '@/stores/rewardStore'
import { formatPoints, getSynapseTypeLabel, type SynapseType } from '@/types/game'
import { cn } from '@/lib/utils'

// Synapse type colors for the wheel
const SYNAPSE_TYPE_COLORS: Record<SynapseType, string> = {
  minor: '#60A5FA',    // blue-400
  complex: '#A78BFA',  // purple-400
  deep: '#2DD4BF',     // teal-400
  core: '#FBBF24',     // yellow-400
  rare: '#F87171',     // red-400
  legendary: '#F472B6', // pink-400
  unique: '#FCD34D',   // amber-300
}

// Participant segment colors
const SEGMENT_COLORS = [
  '#60A5FA', // blue
  '#34D399', // green
  '#FBBF24', // yellow
  '#F472B6', // pink
  '#A78BFA', // purple
  '#F87171', // red
  '#2DD4BF', // teal
  '#FB923C', // orange
]

interface WheelSegment {
  participant: LotteryParticipant
  startAngle: number
  endAngle: number
  color: string
}

/**
 * LotteryWheel - Visual wheel for lottery draws
 * Animates the winner selection with spinning wheel effect
 */
export function LotteryWheel() {
  const currentLotteryAnimation = useRewardStore(selectCurrentLotteryAnimation)
  const isAnimating = useRewardStore(selectIsAnimatingLottery)
  const endLotteryAnimation = useRewardStore((state) => state.endLotteryAnimation)

  const [rotation, setRotation] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'slowing' | 'winner'>('idle')

  // Calculate wheel segments based on participant contributions
  const segments = useMemo<WheelSegment[]>(() => {
    if (!currentLotteryAnimation) return []

    const participants = currentLotteryAnimation.participants
    let currentAngle = 0

    return participants.map((participant, index) => {
      const segmentAngle = (participant.contributionPercent / 100) * 360
      const segment: WheelSegment = {
        participant,
        startAngle: currentAngle,
        endAngle: currentAngle + segmentAngle,
        color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
      }
      currentAngle += segmentAngle
      return segment
    })
  }, [currentLotteryAnimation])

  // Find winner segment angle for final rotation
  const winnerAngle = useMemo(() => {
    if (!currentLotteryAnimation) return 0

    const winnerSegment = segments.find(
      (s) => s.participant.userId === currentLotteryAnimation.winnerId
    )

    if (!winnerSegment) return 0

    // Target the middle of the winner's segment
    const targetAngle = (winnerSegment.startAngle + winnerSegment.endAngle) / 2
    // We want the pointer at top (270 degrees) to point at the winner
    return 270 - targetAngle
  }, [currentLotteryAnimation, segments])

  // Animation sequence
  useEffect(() => {
    if (isAnimating && currentLotteryAnimation && phase === 'idle') {
      // Start spinning
      setPhase('spinning')

      // Phase 1: Fast spinning (2 seconds)
      setTimeout(() => {
        setPhase('slowing')
        // Add multiple full rotations plus final position
        setRotation(360 * 8 + winnerAngle)
      }, 100)

      // Phase 2: Show winner (after spin completes)
      setTimeout(() => {
        setPhase('winner')
      }, 6000)

      // Phase 3: Cleanup
      setTimeout(() => {
        setPhase('idle')
        setRotation(0)
        endLotteryAnimation()
      }, 10000)
    }
  }, [isAnimating, currentLotteryAnimation, phase, winnerAngle, endLotteryAnimation])

  if (!currentLotteryAnimation) {
    return null
  }

  const synapseTypeColor = SYNAPSE_TYPE_COLORS[currentLotteryAnimation.synapseType]

  return (
    <AnimatePresence>
      {isAnimating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <div className="relative flex flex-col items-center gap-8 p-8">
            {/* Header */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center"
            >
              <h2 className="text-2xl font-bold text-white mb-2">
                {getSynapseTypeLabel(currentLotteryAnimation.synapseType)} Synapse Lottery
              </h2>
              <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                <Users className="h-4 w-4" />
                <span>{currentLotteryAnimation.participants.length} participants</span>
              </div>
            </motion.div>

            {/* Wheel Container */}
            <div className="relative">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                <motion.div
                  animate={phase === 'winner' ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-white"
                />
              </div>

              {/* Wheel */}
              <motion.div
                animate={{ rotate: rotation }}
                transition={{
                  duration: phase === 'slowing' ? 5 : 0,
                  ease: phase === 'slowing' ? [0.2, 0.8, 0.4, 1] : 'linear',
                }}
                className="relative w-72 h-72"
              >
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {/* Wheel segments */}
                  {segments.map((segment, index) => {
                    const startRad = (segment.startAngle - 90) * (Math.PI / 180)
                    const endRad = (segment.endAngle - 90) * (Math.PI / 180)

                    const x1 = 100 + 90 * Math.cos(startRad)
                    const y1 = 100 + 90 * Math.sin(startRad)
                    const x2 = 100 + 90 * Math.cos(endRad)
                    const y2 = 100 + 90 * Math.sin(endRad)

                    const largeArc = segment.endAngle - segment.startAngle > 180 ? 1 : 0

                    const pathD = `M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`

                    const midAngle = ((segment.startAngle + segment.endAngle) / 2 - 90) * (Math.PI / 180)
                    const labelX = 100 + 60 * Math.cos(midAngle)
                    const labelY = 100 + 60 * Math.sin(midAngle)

                    return (
                      <g key={index}>
                        <path
                          d={pathD}
                          fill={segment.color}
                          stroke="rgba(0,0,0,0.2)"
                          strokeWidth="0.5"
                          className={cn(
                            phase === 'winner' &&
                              segment.participant.isWinner &&
                              'animate-pulse'
                          )}
                        />
                        {/* Only show label if segment is large enough */}
                        {segment.endAngle - segment.startAngle > 20 && (
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontSize="8"
                            fontWeight="bold"
                            className="pointer-events-none"
                          >
                            {segment.participant.contributionPercent.toFixed(0)}%
                          </text>
                        )}
                      </g>
                    )
                  })}

                  {/* Center circle */}
                  <circle cx="100" cy="100" r="20" fill="var(--background-secondary)" stroke="white" strokeWidth="2" />
                  <text x="100" y="104" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                    AGI
                  </text>
                </svg>
              </motion.div>

              {/* Glow effect during spin */}
              {phase !== 'idle' && (
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${synapseTypeColor}40 0%, transparent 70%)`,
                  }}
                />
              )}
            </div>

            {/* Participant List */}
            <div className="w-full max-w-sm bg-[var(--background-secondary)] rounded-xl p-4">
              <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">
                Participants
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {currentLotteryAnimation.participants.map((participant, index) => (
                  <motion.div
                    key={participant.userId}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg',
                      participant.isCurrentUser && 'bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30',
                      phase === 'winner' && participant.isWinner && 'bg-amber-500/20 border border-amber-500/40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                      />
                      <span className={cn(
                        'text-sm font-medium',
                        participant.isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
                      )}>
                        {participant.shipName}
                        {participant.isCurrentUser && ' (You)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">
                        {participant.contributionPercent.toFixed(1)}%
                      </span>
                      {phase === 'winner' && participant.isWinner && (
                        <Trophy className="h-4 w-4 text-amber-400" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Winner Announcement */}
            <AnimatePresence>
              {phase === 'winner' && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className={cn(
                    'absolute inset-0 flex items-center justify-center',
                    'bg-black/60 backdrop-blur-sm rounded-3xl'
                  )}
                >
                  <div className="text-center p-8">
                    {/* Sparkles animation */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Sparkles className="h-32 w-32 text-amber-400/20" />
                    </motion.div>

                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    >
                      <Trophy className="h-16 w-16 text-amber-400 mx-auto mb-4" />
                    </motion.div>

                    <h3 className="text-xl font-bold text-white mb-2">
                      {currentLotteryAnimation.userWon ? 'You Won!' : `${currentLotteryAnimation.winnerName} Wins!`}
                    </h3>

                    <div className="flex flex-col items-center gap-2">
                      <p className="text-2xl font-bold text-amber-400">
                        {formatPoints(currentLotteryAnimation.agiReward)} AGI
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        +{formatPoints(currentLotteryAnimation.xpReward)} XP
                      </p>
                    </div>

                    {!currentLotteryAnimation.userWon && currentLotteryAnimation.userConsolationTickets > 0 && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-4 flex items-center justify-center gap-2 text-purple-400"
                      >
                        <Ticket className="h-4 w-4" />
                        <span className="text-sm">
                          Consolation: +{currentLotteryAnimation.userConsolationTickets} Lottery Ticket{currentLotteryAnimation.userConsolationTickets > 1 ? 's' : ''}
                        </span>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * LotteryOddsDisplay - Shows user's odds based on contribution
 */
interface LotteryOddsDisplayProps {
  contributionPercent: number
  totalParticipants: number
  className?: string
}

export function LotteryOddsDisplay({
  contributionPercent,
  totalParticipants,
  className,
}: LotteryOddsDisplayProps) {
  return (
    <div className={cn(
      'p-4 rounded-xl bg-purple-500/10 border border-purple-500/30',
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Ticket className="h-5 w-5 text-purple-400" />
        <span className="font-semibold text-purple-400">Lottery Odds</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[var(--text-muted)]">Your Contribution</span>
          <span className="font-bold text-[var(--text-primary)]">{contributionPercent.toFixed(1)}%</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-[var(--text-muted)]">Win Chance</span>
          <span className="font-bold text-purple-400">~{contributionPercent.toFixed(1)}%</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-[var(--text-muted)]">Participants</span>
          <span className="font-medium text-[var(--text-primary)]">
            <Users className="h-3.5 w-3.5 inline mr-1" />
            {totalParticipants}
          </span>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] mt-3">
        Higher contribution = better odds of winning the full reward.
        Losers receive lottery tickets as consolation.
      </p>
    </div>
  )
}

/**
 * LotteryMiniPreview - Compact lottery preview for sidebar
 */
interface LotteryMiniPreviewProps {
  synapseType: SynapseType
  agiReward: number
  contributionPercent: number
  onClick?: () => void
  className?: string
}

export function LotteryMiniPreview({
  synapseType: _synapseType,
  agiReward,
  contributionPercent,
  onClick,
  className,
}: LotteryMiniPreviewProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-xl bg-purple-500/10 border border-purple-500/30',
        'hover:bg-purple-500/20 transition-colors text-left',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-400">Lottery</span>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
      </div>

      <div className="mt-2 flex justify-between items-baseline">
        <span className="text-lg font-bold text-[var(--text-primary)]">
          {formatPoints(agiReward)} AGI
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          ~{contributionPercent.toFixed(1)}% odds
        </span>
      </div>
    </button>
  )
}
