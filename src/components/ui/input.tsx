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

// Textarea variant
export interface TextareaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'class'> {
  label?: string
  hint?: string
  error?: string
  success?: string
  showCharCount?: boolean
  maxLength?: number
  class?: string
}

export function Textarea(props: TextareaProps) {
  const [local, rest] = splitProps(props, [
    'class', 'label', 'hint', 'error', 'success', 'disabled', 'showCharCount', 'maxLength', 'value', 'required'
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

      <textarea
        id={id}
        value={local.value}
        maxLength={local.maxLength}
        disabled={local.disabled}
        required={local.required}
        class={cn(
          // Base styles
          'flex min-h-[var(--textarea-min-height)] w-full rounded-xl border bg-[var(--background-primary)] text-[var(--text-primary)] text-base',
          'px-[var(--space-5)] py-[var(--space-4)]',
          // Border and focus
          'border-[var(--card-border)]',
          'transition-all duration-200',
          'placeholder:text-[var(--text-muted)]',
          // Focus state
          'focus:outline-none focus:border-[var(--brand-teal-1)] focus:ring-[var(--space-4)] focus:ring-[var(--brand-teal-1)]/15',
          // Hover state
          'hover:border-[var(--card-border-hover)]',
          // Resize
          'resize-none',
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

// Select variant
export interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, 'class'> {
  label?: string
  hint?: string
  error?: string
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
  class?: string
}

export function Select(props: SelectProps) {
  const [local, rest] = splitProps(props, [
    'class', 'label', 'hint', 'error', 'options', 'placeholder', 'disabled', 'required'
  ])

  const id = createUniqueId()

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

      <div class="relative">
        <select
          id={id}
          disabled={local.disabled}
          required={local.required}
          class={cn(
            // Base styles
            'flex h-[var(--input-height)] w-full rounded-xl border bg-[var(--background-primary)] text-[var(--text-primary)] text-base appearance-none',
            'px-[var(--space-5)] py-[var(--space-4)] pr-[var(--space-12)]',
            // Border and focus
            'border-[var(--card-border)]',
            'transition-all duration-200',
            // Focus state
            'focus:outline-none focus:border-[var(--brand-teal-1)] focus:ring-[var(--space-4)] focus:ring-[var(--brand-teal-1)]/15',
            // Hover state
            'hover:border-[var(--card-border-hover)]',
            // Cursor
            'cursor-pointer',
            // Error state
            local.error && 'border-[var(--status-error)]/50 focus:border-[var(--status-error)] focus:ring-[var(--status-error)]/15',
            // Disabled state
            local.disabled && 'opacity-50 cursor-not-allowed bg-[var(--background-secondary)]',
            local.class
          )}
          {...rest}
        >
          <Show when={local.placeholder}>
            <option value="" disabled>
              {local.placeholder}
            </option>
          </Show>
          {local.options.map((option) => (
            <option value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Custom dropdown arrow */}
        <div class="absolute right-[var(--space-4)] top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            class="h-[var(--icon-md)] w-[var(--icon-md)] text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <Show when={local.hint || local.error}>
        <p class={cn(
          'mt-[var(--space-2\.5)] text-sm',
          local.error ? 'text-[var(--status-error)] font-medium' : 'text-[var(--text-muted)]'
        )}>
          {local.error || local.hint}
        </p>
      </Show>
    </div>
  )
}

// Checkbox component
export interface CheckboxProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'class'> {
  label?: string
  description?: string
  class?: string
}

export function Checkbox(props: CheckboxProps) {
  const [local, rest] = splitProps(props, ['class', 'label', 'description', 'disabled'])
  const id = createUniqueId()

  return (
    <div class={cn('flex items-start gap-[var(--space-4)]', local.disabled && 'opacity-50')}>
      <div class="relative flex items-center justify-center mt-[var(--space-0\.5)]">
        <input
          id={id}
          type="checkbox"
          disabled={local.disabled}
          class={cn(
            'peer h-[var(--checkbox-size)] w-[var(--checkbox-size)] rounded-lg border-2 border-[var(--card-border)] bg-[var(--background-primary)]',
            'transition-all duration-200',
            'checked:bg-[var(--brand-teal-1)] checked:border-[var(--brand-teal-1)]',
            'hover:border-[var(--card-border-hover)]',
            'focus:outline-none focus:ring-[var(--space-4)] focus:ring-[var(--brand-teal-1)]/15',
            'cursor-pointer disabled:cursor-not-allowed',
            'appearance-none',
            local.class
          )}
          {...rest}
        />
        {/* Checkmark icon */}
        <Check class="absolute h-[var(--icon-sm)] w-[var(--icon-sm)] text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
      </div>
      <Show when={local.label || local.description}>
        <label for={id} class="cursor-pointer select-none">
          <Show when={local.label}>
            <span class="block text-base font-medium text-[var(--text-primary)]">
              {local.label}
            </span>
          </Show>
          <Show when={local.description}>
            <span class="block text-sm text-[var(--text-muted)] mt-[var(--space-1)]">
              {local.description}
            </span>
          </Show>
        </label>
      </Show>
    </div>
  )
}

// Radio button component
export interface RadioProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'class'> {
  label?: string
  description?: string
  class?: string
}

export function Radio(props: RadioProps) {
  const [local, rest] = splitProps(props, ['class', 'label', 'description', 'disabled'])
  const id = createUniqueId()

  return (
    <div class={cn('flex items-start gap-[var(--space-4)]', local.disabled && 'opacity-50')}>
      <div class="relative flex items-center justify-center mt-[var(--space-0\.5)]">
        <input
          id={id}
          type="radio"
          disabled={local.disabled}
          class={cn(
            'peer h-[var(--checkbox-size)] w-[var(--checkbox-size)] rounded-full border-2 border-[var(--card-border)] bg-[var(--background-primary)]',
            'transition-all duration-200',
            'checked:border-[var(--brand-teal-1)]',
            'hover:border-[var(--card-border-hover)]',
            'focus:outline-none focus:ring-[var(--space-4)] focus:ring-[var(--brand-teal-1)]/15',
            'cursor-pointer disabled:cursor-not-allowed',
            'appearance-none',
            local.class
          )}
          {...rest}
        />
        {/* Radio dot */}
        <div class="absolute h-[var(--radio-dot-size)] w-[var(--radio-dot-size)] rounded-full bg-[var(--brand-teal-1)] pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
      </div>
      <Show when={local.label || local.description}>
        <label for={id} class="cursor-pointer select-none">
          <Show when={local.label}>
            <span class="block text-base font-medium text-[var(--text-primary)]">
              {local.label}
            </span>
          </Show>
          <Show when={local.description}>
            <span class="block text-sm text-[var(--text-muted)] mt-[var(--space-1)]">
              {local.description}
            </span>
          </Show>
        </label>
      </Show>
    </div>
  )
}

// Form field wrapper for consistent spacing
interface FormFieldProps {
  children: JSX.Element
  class?: string
}

export function FormField(props: FormFieldProps) {
  return (
    <div class={cn('space-y-[var(--space-6)]', props.class)}>
      {props.children}
    </div>
  )
}

// Form group for related fields
interface FormGroupProps {
  children: JSX.Element
  title?: string
  description?: string
  class?: string
}

export function FormGroup(props: FormGroupProps) {
  return (
    <div class={cn('space-y-[var(--space-5)]', props.class)}>
      <Show when={props.title || props.description}>
        <div class="space-y-[var(--space-1\.5)] pb-[var(--space-2)] border-b border-[var(--card-border)]/50">
          <Show when={props.title}>
            <h3 class="text-lg font-bold text-[var(--text-primary)]">{props.title}</h3>
          </Show>
          <Show when={props.description}>
            <p class="text-sm text-[var(--text-muted)]">{props.description}</p>
          </Show>
        </div>
      </Show>
      <div class="space-y-[var(--space-5)]">
        {props.children}
      </div>
    </div>
  )
}
