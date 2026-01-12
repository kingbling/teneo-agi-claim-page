import { cn } from '@/lib/utils'
import { Check, Target, Flame, Sparkles } from 'lucide-solid'
import { Show, type Component } from 'solid-js'
import type { JSX } from 'solid-js'

interface QuestItemProps {
  id: string
  title: string
  description: string
  progress: number
  target: number
  reward: number
  completed: boolean
  icon?: 'target' | 'flame' | 'sparkles' | 'default'
  class?: string
}

const questIcons = {
  target: Target,
  flame: Flame,
  sparkles: Sparkles,
  default: Target,
}

export const QuestItem: Component<QuestItemProps> = (props) => {
  const progressPercent = () => Math.min(100, Math.round((props.progress / props.target) * 100))
  const Icon = () => questIcons[props.icon || 'default']

  return (
    <div
      class={cn(
        'relative rounded-lg border-2 p-3 transition-all',
        props.completed
          ? 'bg-gradient-to-br from-[hsl(var(--success))]/10 to-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30'
          : 'bg-muted/30 border-border/50',
        props.class
      )}
    >
      {/* Header */}
      <div class="flex items-start gap-3">
        {/* Icon */}
        <div
          class={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            props.completed
              ? 'bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success))] shadow-lg shadow-[hsl(var(--success))]/25'
              : 'bg-muted'
          )}
        >
          <Show
            when={props.completed}
            fallback={<Icon class="w-5 h-5 text-muted-foreground" />}
          >
            <Check class="w-5 h-5 text-white" />
          </Show>
        </div>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <h4 class={cn(
              'font-semibold text-sm leading-tight',
              props.completed ? 'text-[hsl(var(--success))]' : 'text-foreground'
            )}>
              {props.title}
            </h4>
            <div class={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap',
              props.completed
                ? 'bg-[hsl(var(--success))]/20 border border-[hsl(var(--success))]/30 text-[hsl(var(--success))]'
                : 'bg-[hsl(var(--state-solving))]/20 border border-[hsl(var(--state-solving))]/30 text-[hsl(var(--state-solving))]'
            )}>
              <span>+</span>
              <span>{props.reward}</span>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">{props.description}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <Show when={!props.completed}>
        <div class="mt-3 space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">Progress</span>
            <span class="font-semibold tabular-nums">
              {props.progress} / {props.target}
            </span>
          </div>
          <div class="h-2 rounded-full bg-muted overflow-hidden">
            <div
              class={cn(
                'h-full rounded-full transition-all duration-500',
                progressPercent() >= 100
                  ? 'bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--success))]'
                  : 'bg-gradient-to-r from-[hsl(var(--state-solving))] to-[hsl(var(--accent))]'
              )}
              style={{ width: `${progressPercent()}%` }}
            />
          </div>
        </div>
      </Show>

      {/* Completed Badge */}
      <Show when={props.completed}>
        <div class="mt-3 pt-3 border-t border-[hsl(var(--success))]/20">
          <div class="flex items-center gap-2 text-xs">
            <Check class="w-4 h-4 text-[hsl(var(--success))]" />
            <span class="font-semibold text-[hsl(var(--success))]">Quest Complete!</span>
          </div>
        </div>
      </Show>
    </div>
  )
}
