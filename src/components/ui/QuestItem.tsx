import { cn } from '@/lib/utils'
import { Check, Target, Flame, Sparkles } from 'lucide-react'

interface QuestItemProps {
  id: string
  title: string
  description: string
  progress: number
  target: number
  reward: number
  completed: boolean
  icon?: 'target' | 'flame' | 'sparkles' | 'default'
  className?: string
}

const questIcons = {
  target: Target,
  flame: Flame,
  sparkles: Sparkles,
  default: Target,
}

export function QuestItem({
  title,
  description,
  progress,
  target,
  reward,
  completed,
  icon = 'default',
  className,
}: QuestItemProps) {
  const progressPercent = Math.min(100, Math.round((progress / target) * 100))
  const Icon = questIcons[icon]

  return (
    <div
      className={cn(
        'relative rounded-lg border-2 p-3 transition-all',
        completed
          ? 'bg-gradient-to-br from-[hsl(var(--success))]/10 to-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30'
          : 'bg-muted/30 border-border/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            completed
              ? 'bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success))] shadow-lg shadow-[hsl(var(--success))]/25'
              : 'bg-muted'
          )}
        >
          {completed ? (
            <Check className="w-5 h-5 text-white" />
          ) : (
            <Icon className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn(
              'font-semibold text-sm leading-tight',
              completed ? 'text-[hsl(var(--success))]' : 'text-foreground'
            )}>
              {title}
            </h4>
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap',
              completed
                ? 'bg-[hsl(var(--success))]/20 border border-[hsl(var(--success))]/30 text-[hsl(var(--success))]'
                : 'bg-[hsl(var(--state-solving))]/20 border border-[hsl(var(--state-solving))]/30 text-[hsl(var(--state-solving))]'
            )}>
              <span>+</span>
              <span>{reward}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {!completed && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold tabular-nums">
              {progress} / {target}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progressPercent >= 100
                  ? 'bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--success))]'
                  : 'bg-gradient-to-r from-[hsl(var(--state-solving))] to-[hsl(var(--accent))]'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed Badge */}
      {completed && (
        <div className="mt-3 pt-3 border-t border-[hsl(var(--success))]/20">
          <div className="flex items-center gap-2 text-xs">
            <Check className="w-4 h-4 text-[hsl(var(--success))]" />
            <span className="font-semibold text-[hsl(var(--success))]">Quest Complete!</span>
          </div>
        </div>
      )}
    </div>
  )
}
