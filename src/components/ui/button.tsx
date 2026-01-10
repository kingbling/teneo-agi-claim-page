import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold text-base outline-none transition-all duration-200 select-none active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--brand-teal-1)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-primary)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--brand-teal-1)] text-[var(--brand-neutral-1)] hover:bg-[var(--brand-teal-2)] shadow-md shadow-[var(--brand-teal-1)]/25 hover:shadow-lg hover:shadow-[var(--brand-teal-1)]/30 hover:-translate-y-0.5',
        secondary:
          'bg-[var(--background-secondary)] text-[var(--text-primary)] border border-[var(--card-border)] hover:bg-[var(--background-tertiary)] hover:border-[var(--card-border-hover)]',
        outline:
          'border-2 border-[var(--brand-teal-1)] text-[var(--brand-teal-1)] hover:bg-[var(--brand-teal-1)]/10 hover:shadow-md hover:shadow-[var(--brand-teal-1)]/15',
        ghost:
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)]',
        destructive:
          'bg-[var(--brand-red-4)] text-white hover:bg-[var(--brand-red-2)] shadow-md shadow-[var(--brand-red-4)]/25',
        link: 'text-[var(--brand-teal-1)] underline-offset-4 hover:underline p-0 h-auto',
        success:
          'bg-[var(--brand-green-4)] text-white hover:bg-[var(--brand-green-2)] shadow-md shadow-[var(--brand-green-4)]/25',
        warning:
          'bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--state-solving))] shadow-md shadow-[hsl(var(--accent))]/25',
        // Soft variants for less prominent actions
        'soft-primary':
          'bg-[var(--brand-teal-1)]/10 text-[var(--brand-teal-1)] hover:bg-[var(--brand-teal-1)]/20 border border-[var(--brand-teal-1)]/20',
        'soft-secondary':
          'bg-[var(--background-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--background-secondary)] hover:text-[var(--text-primary)]',
        'soft-danger':
          'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/20 border border-[hsl(var(--destructive))]/20',
        'soft-success':
          'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20 border border-[hsl(var(--success))]/20',
        'soft-warning':
          'bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/20 border border-[hsl(var(--accent))]/20',
      },
      size: {
        default: 'h-11 px-5 py-2.5 text-base [&_svg]:size-5',
        sm: 'h-9 px-4 py-2 text-sm rounded-lg gap-1.5 [&_svg]:size-4',
        lg: 'h-13 px-8 py-3 text-lg [&_svg]:size-6',
        xl: 'h-14 px-10 py-4 text-xl rounded-2xl [&_svg]:size-6',
        icon: 'h-11 w-11 p-0 [&_svg]:size-5',
        'icon-sm': 'h-9 w-9 p-0 rounded-lg [&_svg]:size-4',
        'icon-lg': 'h-13 w-13 p-0 [&_svg]:size-6',
        'icon-xs': 'h-8 w-8 p-0 rounded-lg [&_svg]:size-4',
        // Mobile-friendly sizes with larger touch targets
        'touch': 'h-13 px-6 py-3 min-w-[140px] [&_svg]:size-5',
        'touch-sm': 'h-11 px-5 py-2.5 min-w-[120px] [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  loadingText,
  leftIcon,
  rightIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(
        buttonVariants({ variant, size }),
        loading && 'cursor-wait',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin size-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {loadingText && <span>{loadingText}</span>}
        </>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </Comp>
  )
}

// Icon button helper for common actions
interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: React.ReactNode
  'aria-label': string
}

function IconButton({ icon, className, size = 'icon', ...props }: IconButtonProps) {
  return (
    <Button
      size={size}
      className={cn('p-0', className)}
      {...props}
    >
      {icon}
    </Button>
  )
}

// Button group for related actions
interface ButtonGroupProps {
  children: React.ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
  spacing?: 'none' | 'sm' | 'default'
}

function ButtonGroup({
  children,
  className,
  orientation = 'horizontal',
  spacing = 'default',
}: ButtonGroupProps) {
  const spacingClasses = {
    none: 'gap-0',
    sm: 'gap-1',
    default: 'gap-2',
  }

  // For connected buttons (spacing: none), adjust border radius
  const connectedClasses = spacing === 'none' && orientation === 'horizontal'
    ? '[&>*:first-child]:rounded-r-none [&>*:last-child]:rounded-l-none [&>*:not(:first-child):not(:last-child)]:rounded-none [&>*:not(:first-child)]:border-l-0'
    : spacing === 'none' && orientation === 'vertical'
    ? '[&>*:first-child]:rounded-b-none [&>*:last-child]:rounded-t-none [&>*:not(:first-child):not(:last-child)]:rounded-none [&>*:not(:first-child)]:border-t-0'
    : ''

  return (
    <div
      className={cn(
        'inline-flex',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        spacingClasses[spacing],
        connectedClasses,
        className
      )}
    >
      {children}
    </div>
  )
}

export { Button, IconButton, ButtonGroup, buttonVariants }
