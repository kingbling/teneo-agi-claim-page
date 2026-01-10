import { cn } from '@/lib/utils'

interface StreakCounterProps {
  streakDays: number
  bonusReward: number
  className?: string
}

export function StreakCounter({ streakDays, bonusReward, className }: StreakCounterProps) {
  if (streakDays === 0) return null

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-4',
        'bg-gradient-to-br from-[hsl(var(--accent))]/10 to-[hsl(var(--state-solving))]/10 border-[hsl(var(--accent))]/30',
        className
      )}
    >
      {/* Animated glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[hsl(var(--accent))]/20 to-[hsl(var(--state-solving))]/20 rounded-xl blur-lg opacity-75" />

      {/* Content */}
      <div className="relative">
        <div className="flex items-center gap-3">
          {/* Fire icon with animation */}
          <div className="relative">
            <div className="text-3xl animate-pulse">🔥</div>
            <div className="absolute inset-0 text-3xl animate-ping opacity-30">
              🔥
            </div>
          </div>

          {/* Text */}
          <div className="flex-1">
            <div className="text-lg font-bold text-[hsl(var(--accent))]">
              {streakDays} Day Streak!
            </div>
            <p className="text-sm text-muted-foreground">
              Login tomorrow for <span className="font-semibold text-[hsl(var(--state-solving))]">{bonusReward}</span> bonus AGI
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-3 pt-3 border-t border-[hsl(var(--accent))]/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Current streak</span>
            <span className="font-semibold text-[hsl(var(--accent))]">
              {streakDays} {streakDays === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
