import { cn } from '@/lib/utils'
import { Trophy, Star, Lock } from 'lucide-react'

interface AchievementCardProps {
  id: string
  title: string
  description: string
  icon: string
  progress: number
  total: number
  unlocked: boolean
  reward: number
  className?: string
}

export function AchievementCard({
  title,
  description,
  icon,
  progress,
  total,
  unlocked,
  reward,
  className,
}: AchievementCardProps) {
  const progressPercent = Math.min(100, Math.round((progress / total) * 100))

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-4 transition-all',
        unlocked
          ? 'bg-gradient-to-br from-[hsl(var(--accent))]/10 to-[hsl(var(--state-solving))]/10 border-[hsl(var(--accent))]/30'
          : 'bg-muted/30 border-border/50 opacity-75',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Icon */}
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
            unlocked
              ? 'bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--state-solving))] shadow-lg shadow-[hsl(var(--accent))]/25'
              : 'bg-muted'
          )}
        >
          {unlocked ? icon : <Lock className="w-6 h-6 text-muted-foreground" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn(
              'font-bold text-sm leading-tight',
              unlocked ? 'text-[hsl(var(--accent))]' : 'text-muted-foreground'
            )}>
              {title}
            </h4>
            {unlocked && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--accent))]/20 border border-[hsl(var(--accent))]/30">
                <Star className="w-3 h-3 text-[hsl(var(--accent))] fill-current" />
                <span className="text-xs font-bold text-[hsl(var(--accent))]">+{reward}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {!unlocked && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold tabular-nums">
              {progress} / {total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--state-solving))] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Unlocked Badge */}
      {unlocked && (
        <div className="mt-3 pt-3 border-t border-[hsl(var(--accent))]/20">
          <div className="flex items-center gap-2 text-xs">
            <Trophy className="w-4 h-4 text-[hsl(var(--accent))]" />
            <span className="font-semibold text-[hsl(var(--accent))]">Achievement Unlocked!</span>
          </div>
        </div>
      )}
    </div>
  )
}
