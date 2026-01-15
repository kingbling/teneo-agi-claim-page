import { createUniqueId, Show, splitProps, type JSX, type Component } from 'solid-js'
import { cn } from '@/lib/utils'
import { Check, AlertCircle } from 'lucide-solid'

export interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'class'> {
  label?: string
  hint?: string
  error?: string
  success?: string
  leftIcon?: JSX.Element
  rightIcon?: JSX.Element
  showCharCount?: boolean
  maxLength?: number
  class?: string
}

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, [
    'class', 'type', 'label', 'hint', 'error', 'success', 'leftIcon', 'rightIcon', 'disabled', 'showCharCount', 'maxLength', 'value', 'required'
  ])

  const id = createUniqueId()
  const charCount = () => typeof local.value === 'string' ? local.value.length : 0

  return (
    <div class="w-full space-y-[var(--space-2)]">
      <Show when={local.label}>
        <label
          for={id}
          class="block text-sm font-semibold text-[var(--text-secondary)] mb-[var(--space-3)]"
        >
          {local.label}
          <Show when={local.required}>
            <span class="text-[var(--status-error)] ml-[var(--space-1)]">*</span>
          </Show>
        </label>
      </Show>

      <div class="relative group">
        <Show when={local.leftIcon}>
          <div class="absolute left-[var(--space-4)] top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none transition-colors group-focus-within:text-[var(--brand-teal-1)]">
            {local.leftIcon}
          </div>
        </Show>

        <input
          id={id}
          type={local.type}
          value={local.value}
          maxLength={local.maxLength}
          disabled={local.disabled}
          required={local.required}
          class={cn(
            // Base styles
            'flex h-[var(--input-height)] w-full rounded-xl border bg-[var(--background-primary)] text-[var(--text-primary)] text-base',
            // Padding - adjust for icons
            local.leftIcon ? 'pl-[var(--space-12)]' : 'pl-[var(--space-5)]',
            local.rightIcon || local.success || local.error ? 'pr-[var(--space-12)]' : 'pr-[var(--space-5)]',
            'py-[var(--space-4)]',
            // Border and focus
            'border-[var(--card-border)]',
            'transition-all duration-200',
            'placeholder:text-[var(--text-muted)]',
            // Focus state
            'focus:outline-none focus:border-[var(--brand-teal-1)] focus:ring-[var(--space-4)] focus:ring-[var(--brand-teal-1)]/15',
            // Hover state
            'hover:border-[var(--card-border-hover)]',
            // Success state
            local.success && 'border-[var(--status-success)]/50 focus:border-[var(--status-success)] focus:ring-[var(--status-success)]/15',
            // Error state
            local.error && 'border-[var(--status-error)]/50 focus:border-[var(--status-error)] focus:ring-[var(--status-error)]/15',
            // Disabled state
            local.disabled && 'opacity-50 cursor-not-allowed bg-[var(--background-secondary)]',
            local.class
          )}
          {...rest}
        />

        {/* Right side icons */}
        <div class="absolute right-[var(--space-4)] top-1/2 -translate-y-1/2 flex items-center gap-[var(--space-2)]">
          <Show when={local.success && !local.error}>
            <div class="p-[var(--space-1)] rounded-full bg-[var(--status-success)]/20">
              <Check class="h-[var(--icon-sm)] w-[var(--icon-sm)] text-[var(--status-success)]" />
            </div>
          </Show>
          <Show when={local.error}>
            <div class="p-[var(--space-1)] rounded-full bg-[var(--status-error)]/20">
              <AlertCircle class="h-[var(--icon-sm)] w-[var(--icon-sm)] text-[var(--status-error)]" />
            </div>
          </Show>
          <Show when={local.rightIcon && !local.success && !local.error}>
            <div class="text-[var(--text-muted)]">
              {local.rightIcon}
            </div>
          </Show>
        </div>
      </div>

      {/* Helper text row */}
      <div class="flex items-center justify-between mt-[var(--space-2\.5)] min-h-[var(--space-5)]">
        <div class="flex-1">
          <Show when={local.error}>
            <p class="text-sm text-[var(--status-error)] font-medium flex items-center gap-[var(--space-1\.5)]">
              <AlertCircle class="h-[var(--icon-xs)] w-[var(--icon-xs)]" />
              {local.error}
            </p>
          </Show>
          <Show when={local.success && !local.error}>
            <p class="text-sm text-[var(--status-success)] font-medium flex items-center gap-[var(--space-1\.5)]">
              <Check class="h-[var(--icon-xs)] w-[var(--icon-xs)]" />
              {local.success}
            </p>
          </Show>
          <Show when={local.hint && !local.error && !local.success}>
            <p class="text-sm text-[var(--text-muted)]">
              {local.hint}
            </p>
          </Show>
        </div>
        <Show when={local.showCharCount && local.maxLength}>
          <span class={cn(
            'text-xs font-medium tabular-nums ml-[var(--space-3)]',
            charCount() >= (local.maxLength ?? 0) ? 'text-[var(--status-error)]' : 'text-[var(--text-muted)]'
          )}>
            {charCount()}/{local.maxLength}
          </span>
        </Show>
      </div>
    </div>
  )
}
