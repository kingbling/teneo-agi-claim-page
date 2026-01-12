import { cn } from '@/lib/utils'
import { Trophy, Star, Lock } from 'lucide-solid'
import { Show, type Component } from 'solid-js'
import type { JSX } from 'solid-js'

interface AchievementCardProps {
  id: string
  title: string
  description: string
  icon: string
  progress: number
  total: number
  unlocked: boolean
  reward: number
  class?: string
}

export const AchievementCard: Component<AchievementCardProps> = (props) => {
  const progressPercent = () => Math.min(100, Math.round((props.progress / props.total) * 100))

  return (
    <div
      class={cn(
        'relative rounded-xl border-2 p-4 transition-all',
        props.unlocked
          ? 'bg-gradient-to-br from-[hsl(var(--accent))]/10 to-[hsl(var(--state-solving))]/10 border-[hsl(var(--accent))]/30'
          : 'bg-muted/30 border-border/50 opacity-75',
        props.class
      )}
    >
      {/* Header */}
      <div class="flex items-start gap-3 mb-3">
        {/* Icon */}
        <div
          class={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
            props.unlocked
              ? 'bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--state-solving))] shadow-lg shadow-[hsl(var(--accent))]/25'
              : 'bg-muted'
          )}
        >
          <Show
            when={props.unlocked}
            fallback={<Lock class="w-6 h-6 text-muted-foreground" />}
          >
            {props.icon}
          </Show>
        </div>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <h4 class={cn(
              'font-bold text-sm leading-tight',
              props.unlocked ? 'text-[hsl(var(--accent))]' : 'text-muted-foreground'
            )}>
              {props.title}
            </h4>
            <Show when={props.unlocked}>
              <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--accent))]/20 border border-[hsl(var(--accent))]/30">
                <Star class="w-3 h-3 text-[hsl(var(--accent))] fill-current" />
                <span class="text-xs font-bold text-[hsl(var(--accent))]">+{props.reward}</span>
              </div>
            </Show>
          </div>
          <p class="text-xs text-muted-foreground mt-1">{props.description}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <Show when={!props.unlocked}>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">Progress</span>
            <span class="font-semibold tabular-nums">
              {props.progress} / {props.total}
            </span>
          </div>
          <div class="h-2 rounded-full bg-muted overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--state-solving))] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent()}%` }}
            />
          </div>
        </div>
      </Show>

      {/* Unlocked Badge */}
      <Show when={props.unlocked}>
        <div class="mt-3 pt-3 border-t border-[hsl(var(--accent))]/20">
          <div class="flex items-center gap-2 text-xs">
            <Trophy class="w-4 h-4 text-[hsl(var(--accent))]" />
            <span class="font-semibold text-[hsl(var(--accent))]">Achievement Unlocked!</span>
          </div>
        </div>
      </Show>
    </div>
  )
}
