import { createSignal, createMemo, createEffect, onCleanup, Show, For, type Component } from 'solid-js'
import { Trophy, Users, Sparkles, Ticket, ChevronRight } from 'lucide-solid'
import {
  rewardStore,
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
export const LotteryWheel: Component = () => {
  const currentLotteryAnimation = () => rewardStore.currentLotteryAnimation
  const isAnimating = () => rewardStore.isAnimatingLottery

  const [rotation, setRotation] = createSignal(0)
  const [phase, setPhase] = createSignal<'idle' | 'spinning' | 'slowing' | 'winner'>('idle')

  // Calculate wheel segments based on participant contributions
  const segments = createMemo<WheelSegment[]>(() => {
    const lottery = currentLotteryAnimation()
    if (!lottery) return []

    const participants = lottery.participants
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
  })

  // Find winner segment angle for final rotation
  const winnerAngle = createMemo(() => {
    const lottery = currentLotteryAnimation()
    if (!lottery) return 0

    const winnerSegment = segments().find(
      (s) => s.participant.userId === lottery.winnerId
    )

    if (!winnerSegment) return 0

    // Target the middle of the winner's segment
    const targetAngle = (winnerSegment.startAngle + winnerSegment.endAngle) / 2
    // We want the pointer at top (270 degrees) to point at the winner
    return 270 - targetAngle
  })

  // Animation sequence
  createEffect(() => {
    const lottery = currentLotteryAnimation()
    if (isAnimating() && lottery && phase() === 'idle') {
      // Start spinning
      setPhase('spinning')

      // Phase 1: Fast spinning (2 seconds)
      const timer1 = setTimeout(() => {
        setPhase('slowing')
        // Add multiple full rotations plus final position
        setRotation(360 * 8 + winnerAngle())
      }, 100)

      // Phase 2: Show winner (after spin completes)
      const timer2 = setTimeout(() => {
        setPhase('winner')
      }, 6000)

      // Phase 3: Cleanup
      const timer3 = setTimeout(() => {
        setPhase('idle')
        setRotation(0)
        rewardStore.endLotteryAnimation()
      }, 10000)

      onCleanup(() => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      })
    }
  })

  const lottery = () => currentLotteryAnimation()

  return (
    <Show when={lottery()}>
      {(lotteryData) => {
        const synapseTypeColor = () => SYNAPSE_TYPE_COLORS[lotteryData().synapseType]

        return (
          <Show when={isAnimating()}>
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
              <div class="relative flex flex-col items-center gap-8 p-8">
                {/* Header */}
                <div class="text-center animate-slide-in-down">
                  <h2 class="text-2xl font-bold text-white mb-2">
                    {getSynapseTypeLabel(lotteryData().synapseType)} Synapse Lottery
                  </h2>
                  <div class="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                    <Users class="h-4 w-4" />
                    <span>{lotteryData().participants.length} participants</span>
                  </div>
                </div>

                {/* Wheel Container */}
                <div class="relative">
                  {/* Pointer */}
                  <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                    <div
                      class={cn(
                        'w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-white',
                        phase() === 'winner' && 'animate-pulse'
                      )}
                    />
                  </div>

                  {/* Wheel */}
                  <div
                    class="relative w-72 h-72 transition-transform"
                    style={{
                      transform: `rotate(${rotation()}deg)`,
                      'transition-duration': phase() === 'slowing' ? '5s' : '0s',
                      'transition-timing-function': phase() === 'slowing' ? 'cubic-bezier(0.2, 0.8, 0.4, 1)' : 'linear',
                    }}
                  >
                    <svg viewBox="0 0 200 200" class="w-full h-full">
                      {/* Wheel segments */}
                      <For each={segments()}>
                        {(segment, index) => {
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
                            <g>
                              <path
                                d={pathD}
                                fill={segment.color}
                                stroke="rgba(0,0,0,0.2)"
                                stroke-width="0.5"
                                class={cn(
                                  phase() === 'winner' &&
                                    segment.participant.isWinner &&
                                    'animate-pulse'
                                )}
                              />
                              {/* Only show label if segment is large enough */}
                              <Show when={segment.endAngle - segment.startAngle > 20}>
                                <text
                                  x={labelX}
                                  y={labelY}
                                  text-anchor="middle"
                                  dominant-baseline="middle"
                                  fill="white"
                                  font-size="8"
                                  font-weight="bold"
                                  class="pointer-events-none"
                                >
                                  {segment.participant.contributionPercent.toFixed(0)}%
                                </text>
                              </Show>
                            </g>
                          )
                        }}
                      </For>

                      {/* Center circle */}
                      <circle cx="100" cy="100" r="20" fill="var(--background-secondary)" stroke="white" stroke-width="2" />
                      <text x="100" y="104" text-anchor="middle" fill="white" font-size="10" font-weight="bold">
                        AGI
                      </text>
                    </svg>
                  </div>

                  {/* Glow effect during spin */}
                  <Show when={phase() !== 'idle'}>
                    <div
                      class="absolute inset-0 rounded-full animate-pulse"
                      style={{
                        background: `radial-gradient(circle, ${synapseTypeColor()}40 0%, transparent 70%)`,
                      }}
                    />
                  </Show>
                </div>

                {/* Participant List */}
                <div class="w-full max-w-sm bg-[var(--background-secondary)] rounded-xl p-4">
                  <h3 class="text-sm font-medium text-[var(--text-muted)] mb-3">
                    Participants
                  </h3>
                  <div class="space-y-2 max-h-40 overflow-y-auto">
                    <For each={lotteryData().participants}>
                      {(participant, index) => (
                        <div
                          class={cn(
                            'flex items-center justify-between p-2 rounded-lg animate-slide-in-left',
                            participant.isCurrentUser && 'bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/30',
                            phase() === 'winner' && participant.isWinner && 'bg-amber-500/20 border border-amber-500/40'
                          )}
                          style={{ 'animation-delay': `${index() * 50}ms` }}
                        >
                          <div class="flex items-center gap-2">
                            <div
                              class="w-3 h-3 rounded-full"
                              style={{ 'background-color': SEGMENT_COLORS[index() % SEGMENT_COLORS.length] }}
                            />
                            <span class={cn(
                              'text-sm font-medium',
                              participant.isCurrentUser ? 'text-[var(--brand-teal-1)]' : 'text-[var(--text-primary)]'
                            )}>
                              {participant.shipName}
                              {participant.isCurrentUser && ' (You)'}
                            </span>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="text-sm text-[var(--text-muted)]">
                              {participant.contributionPercent.toFixed(1)}%
                            </span>
                            <Show when={phase() === 'winner' && participant.isWinner}>
                              <Trophy class="h-4 w-4 text-amber-400" />
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                {/* Winner Announcement */}
                <Show when={phase() === 'winner'}>
                  <div
                    class={cn(
                      'absolute inset-0 flex items-center justify-center',
                      'bg-black/60 backdrop-blur-sm rounded-3xl',
                      'animate-scale-in'
                    )}
                  >
                    <div class="text-center p-8">
                      {/* Sparkles animation */}
                      <div class="absolute inset-0 flex items-center justify-center animate-spin-slow">
                        <Sparkles class="h-32 w-32 text-amber-400/20" />
                      </div>

                      <div class="animate-pulse">
                        <Trophy class="h-16 w-16 text-amber-400 mx-auto mb-4" />
                      </div>

                      <h3 class="text-xl font-bold text-white mb-2">
                        {lotteryData().userWon ? 'You Won!' : `${lotteryData().winnerName} Wins!`}
                      </h3>

                      <div class="flex flex-col items-center gap-2">
                        <p class="text-2xl font-bold text-amber-400">
                          {formatPoints(lotteryData().agiReward)} AGI
                        </p>
                        <p class="text-sm text-[var(--text-muted)]">
                          +{formatPoints(lotteryData().xpReward)} XP
                        </p>
                      </div>

                      <Show when={!lotteryData().userWon && lotteryData().userConsolationTickets > 0}>
                        <div class="mt-4 flex items-center justify-center gap-2 text-purple-400 animate-fade-in-up">
                          <Ticket class="h-4 w-4" />
                          <span class="text-sm">
                            Consolation: +{lotteryData().userConsolationTickets} Lottery Ticket{lotteryData().userConsolationTickets > 1 ? 's' : ''}
                          </span>
                        </div>
                      </Show>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        )
      }}
    </Show>
  )
}

/**
 * LotteryOddsDisplay - Shows user's odds based on contribution
 */
interface LotteryOddsDisplayProps {
  contributionPercent: number
  totalParticipants: number
  class?: string
}

export const LotteryOddsDisplay: Component<LotteryOddsDisplayProps> = (props) => {
  return (
    <div class={cn(
      'p-4 rounded-xl bg-purple-500/10 border border-purple-500/30',
      props.class
    )}>
      <div class="flex items-center gap-2 mb-3">
        <Ticket class="h-5 w-5 text-purple-400" />
        <span class="font-semibold text-purple-400">Lottery Odds</span>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-sm text-[var(--text-muted)]">Your Contribution</span>
          <span class="font-bold text-[var(--text-primary)]">{props.contributionPercent.toFixed(1)}%</span>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-sm text-[var(--text-muted)]">Win Chance</span>
          <span class="font-bold text-purple-400">~{props.contributionPercent.toFixed(1)}%</span>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-sm text-[var(--text-muted)]">Participants</span>
          <span class="font-medium text-[var(--text-primary)]">
            <Users class="h-3.5 w-3.5 inline mr-1" />
            {props.totalParticipants}
          </span>
        </div>
      </div>

      <p class="text-xs text-[var(--text-muted)] mt-3">
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
  class?: string
}

export const LotteryMiniPreview: Component<LotteryMiniPreviewProps> = (props) => {
  return (
    <button
      onClick={props.onClick}
      class={cn(
        'w-full p-3 rounded-xl bg-purple-500/10 border border-purple-500/30',
        'hover:bg-purple-500/20 transition-colors text-left',
        props.class
      )}
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Ticket class="h-4 w-4 text-purple-400" />
          <span class="text-sm font-medium text-purple-400">Lottery</span>
        </div>
        <ChevronRight class="h-4 w-4 text-[var(--text-muted)]" />
      </div>

      <div class="mt-2 flex justify-between items-baseline">
        <span class="text-lg font-bold text-[var(--text-primary)]">
          {formatPoints(props.agiReward)} AGI
        </span>
        <span class="text-xs text-[var(--text-muted)]">
          ~{props.contributionPercent.toFixed(1)}% odds
        </span>
      </div>
    </button>
  )
}
