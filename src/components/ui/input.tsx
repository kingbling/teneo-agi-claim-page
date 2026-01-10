import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, AlertCircle } from 'lucide-react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  success?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  showCharCount?: boolean
  maxLength?: number
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, hint, error, success, leftIcon, rightIcon, disabled, showCharCount, maxLength, value, ...props }, ref) => {
    const id = React.useId()
    const charCount = typeof value === 'string' ? value.length : 0

    return (
      <div className="w-full space-y-[var(--space-2)]">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-[var(--text-secondary)] mb-[var(--space-3)]"
          >
            {label}
            {props.required && <span className="text-[var(--status-error)] ml-[var(--space-1)]">*</span>}
          </label>
        )}

        <div className="relative group">
          {leftIcon && (
            <div className="absolute left-[var(--space-4)] top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none transition-colors group-focus-within:text-[var(--brand-teal-1)]">
              {leftIcon}
            </div>
          )}

          <input
            id={id}
            type={type}
            value={value}
            maxLength={maxLength}
            className={cn(
              // Base styles
              'flex h-[var(--input-height)] w-full rounded-xl border bg-[var(--background-primary)] text-[var(--text-primary)] text-base',
              // Padding - adjust for icons
              leftIcon ? 'pl-[var(--space-12)]' : 'pl-[var(--space-5)]',
              rightIcon || success || error ? 'pr-[var(--space-12)]' : 'pr-[var(--space-5)]',
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
              success && 'border-[var(--status-success)]/50 focus:border-[var(--status-success)] focus:ring-[var(--status-success)]/15',
              // Error state
              error && 'border-[var(--status-error)]/50 focus:border-[var(--status-error)] focus:ring-[var(--status-error)]/15',
              // Disabled state
              disabled && 'opacity-50 cursor-not-allowed bg-[var(--background-secondary)]',
              className
            )}
            ref={ref}
            disabled={disabled}
            {...props}
          />

          {/* Right side icons */}
          <div className="absolute right-[var(--space-4)] top-1/2 -translate-y-1/2 flex items-center gap-[var(--space-2)]">
            {success && !error && (
              <div className="p-[var(--space-1)] rounded-full bg-[var(--status-success)]/20">
                <Check className="h-[var(--icon-sm)] w-[var(--icon-sm)] text-[var(--status-success)]" />
              </div>
            )}
            {error && (
              <div className="p-[var(--space-1)] rounded-full bg-[var(--status-error)]/20">
                <AlertCircle className="h-[var(--icon-sm)] w-[var(--icon-sm)] text-[var(--status-error)]" />
              </div>
            )}
            {rightIcon && !success && !error && (
              <div className="text-[var(--text-muted)]">
                {rightIcon}
              </div>
            )}
          </div>
        </div>

        {/* Helper text row */}
        <div className="flex items-center justify-between mt-[var(--space-2\.5)] min-h-[var(--space-5)]">
          <div className="flex-1">
            {error && (
              <p className="text-sm text-[var(--status-error)] font-medium flex items-center gap-[var(--space-1\.5)]">
                <AlertCircle className="h-[var(--icon-xs)] w-[var(--icon-xs)]" />
                {error}
              </p>
            )}
            {success && !error && (
              <p className="text-sm text-[var(--status-success)] font-medium flex items-center gap-[var(--space-1\.5)]">
                <Check className="h-[var(--icon-xs)] w-[var(--icon-xs)]" />
                {success}
              </p>
            )}
            {hint && !error && !success && (
              <p className="text-sm text-[var(--text-muted)]">
                {hint}
              </p>
            )}
          </div>
          {showCharCount && maxLength && (
            <span className={cn(
              'text-xs font-medium tabular-nums ml-[var(--space-3)]',
              charCount >= maxLength ? 'text-[var(--status-error)]' : 'text-[var(--text-muted)]'
            )}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    )
  }
)
Input.displayName = 'Input'

// Textarea variant
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  success?: string
  showCharCount?: boolean
  maxLength?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, success, disabled, showCharCount, maxLength, value, ...props }, ref) => {
    const id = React.useId()
    const charCount = typeof value === 'string' ? value.length : 0

    return (
      <div className="w-full space-y-[var(--space-2)]">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-[var(--text-secondary)] mb-[var(--space-3)]"
          >
            {label}
            {props.required && <span className="text-[var(--status-error)] ml-[var(--space-1)]">*</span>}
          </label>
        )}

        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          className={cn(
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
            success && 'border-[var(--status-success)]/50 focus:border-[var(--status-success)] focus:ring-[var(--status-success)]/15',
            // Error state
            error && 'border-[var(--status-error)]/50 focus:border-[var(--status-error)] focus:ring-[var(--status-error)]/15',
            // Disabled state
            disabled && 'opacity-50 cursor-not-allowed bg-[var(--background-secondary)]',
            className
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />

        {/* Helper text row */}
        <div className="flex items-center justify-between mt-[var(--space-2\.5)] min-h-[var(--space-5)]">
          <div className="flex-1">
            {error && (
              <p className="text-sm text-[var(--status-error)] font-medium flex items-center gap-[var(--space-1\.5)]">
                <AlertCircle className="h-[var(--icon-xs)] w-[var(--icon-xs)]" />
                {error}
              </p>
            )}
            {success && !error && (
              <p className="text-sm text-[var(--status-success)] font-medium flex items-center gap-[var(--space-1\.5)]">
                <Check className="h-[var(--icon-xs)] w-[var(--icon-xs)]" />
                {success}
              </p>
            )}
            {hint && !error && !success && (
              <p className="text-sm text-[var(--text-muted)]">
                {hint}
              </p>
            )}
          </div>
          {showCharCount && maxLength && (
            <span className={cn(
              'text-xs font-medium tabular-nums ml-[var(--space-3)]',
              charCount >= maxLength ? 'text-[var(--status-error)]' : 'text-[var(--text-muted)]'
            )}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// Select variant
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, options, placeholder, disabled, ...props }, ref) => {
    const id = React.useId()

    return (
      <div className="w-full space-y-[var(--space-2)]">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-[var(--text-secondary)] mb-[var(--space-3)]"
          >
            {label}
            {props.required && <span className="text-[var(--status-error)] ml-[var(--space-1)]">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            id={id}
            className={cn(
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
              error && 'border-[var(--status-error)]/50 focus:border-[var(--status-error)] focus:ring-[var(--status-error)]/15',
              // Disabled state
              disabled && 'opacity-50 cursor-not-allowed bg-[var(--background-secondary)]',
              className
            )}
            ref={ref}
            disabled={disabled}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Custom dropdown arrow */}
          <div className="absolute right-[var(--space-4)] top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="h-[var(--icon-md)] w-[var(--icon-md)] text-[var(--text-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {(hint || error) && (
          <p className={cn(
            'mt-[var(--space-2\.5)] text-sm',
            error ? 'text-[var(--status-error)] font-medium' : 'text-[var(--text-muted)]'
          )}>
            {error || hint}
          </p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'

// Checkbox component
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, disabled, ...props }, ref) => {
    const id = React.useId()

    return (
      <div className={cn('flex items-start gap-[var(--space-4)]', disabled && 'opacity-50')}>
        <div className="relative flex items-center justify-center mt-[var(--space-0\.5)]">
          <input
            id={id}
            type="checkbox"
            ref={ref}
            disabled={disabled}
            className={cn(
              'peer h-[var(--checkbox-size)] w-[var(--checkbox-size)] rounded-lg border-2 border-[var(--card-border)] bg-[var(--background-primary)]',
              'transition-all duration-200',
              'checked:bg-[var(--brand-teal-1)] checked:border-[var(--brand-teal-1)]',
              'hover:border-[var(--card-border-hover)]',
              'focus:outline-none focus:ring-[var(--space-4)] focus:ring-[var(--brand-teal-1)]/15',
              'cursor-pointer disabled:cursor-not-allowed',
              'appearance-none',
              className
            )}
            {...props}
          />
          {/* Checkmark icon */}
          <Check className="absolute h-[var(--icon-sm)] w-[var(--icon-sm)] text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
        </div>
        {(label || description) && (
          <label htmlFor={id} className="cursor-pointer select-none">
            {label && (
              <span className="block text-base font-medium text-[var(--text-primary)]">
                {label}
              </span>
            )}
            {description && (
              <span className="block text-sm text-[var(--text-muted)] mt-[var(--space-1)]">
                {description}
              </span>
            )}
          </label>
        )}
      </div>
    )
  }
)
Checkbox.displayName = 'Checkbox'

// Radio button component
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, disabled, ...props }, ref) => {
    const id = React.useId()

    return (
      <div className={cn('flex items-start gap-[var(--space-4)]', disabled && 'opacity-50')}>
        <div className="relative flex items-center justify-center mt-[var(--space-0\.5)]">
          <input
            id={id}
            type="radio"
            ref={ref}
            disabled={disabled}
            className={cn(
              'peer h-[var(--checkbox-size)] w-[var(--checkbox-size)] rounded-full border-2 border-[var(--card-border)] bg-[var(--background-primary)]',
              'transition-all duration-200',
              'checked:border-[var(--brand-teal-1)]',
              'hover:border-[var(--card-border-hover)]',
              'focus:outline-none focus:ring-[var(--space-4)] focus:ring-[var(--brand-teal-1)]/15',
              'cursor-pointer disabled:cursor-not-allowed',
              'appearance-none',
              className
            )}
            {...props}
          />
          {/* Radio dot */}
          <div className="absolute h-[var(--radio-dot-size)] w-[var(--radio-dot-size)] rounded-full bg-[var(--brand-teal-1)] pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
        </div>
        {(label || description) && (
          <label htmlFor={id} className="cursor-pointer select-none">
            {label && (
              <span className="block text-base font-medium text-[var(--text-primary)]">
                {label}
              </span>
            )}
            {description && (
              <span className="block text-sm text-[var(--text-muted)] mt-[var(--space-1)]">
                {description}
              </span>
            )}
          </label>
        )}
      </div>
    )
  }
)
Radio.displayName = 'Radio'

// Form field wrapper for consistent spacing
interface FormFieldProps {
  children: React.ReactNode
  className?: string
}

const FormField = ({ children, className }: FormFieldProps) => (
  <div className={cn('space-y-[var(--space-6)]', className)}>
    {children}
  </div>
)
FormField.displayName = 'FormField'

// Form group for related fields
interface FormGroupProps {
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
}

const FormGroup = ({ children, title, description, className }: FormGroupProps) => (
  <div className={cn('space-y-[var(--space-5)]', className)}>
    {(title || description) && (
      <div className="space-y-[var(--space-1\.5)] pb-[var(--space-2)] border-b border-[var(--card-border)]/50">
        {title && (
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
        )}
        {description && (
          <p className="text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
    )}
    <div className="space-y-[var(--space-5)]">
      {children}
    </div>
  </div>
)
FormGroup.displayName = 'FormGroup'

export { Input, Textarea, Select, Checkbox, Radio, FormField, FormGroup }
