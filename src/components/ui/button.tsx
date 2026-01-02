import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--brand-teal-1)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-primary)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--brand-teal-1)] text-[var(--brand-neutral-1)] hover:bg-[var(--brand-teal-2)] shadow-lg shadow-[var(--brand-teal-1)]/20',
        secondary:
          'bg-[var(--background-secondary)] text-[var(--text-primary)] border border-[var(--card-border)] hover:bg-[var(--background-tertiary)]',
        outline:
          'border border-[var(--brand-teal-1)] text-[var(--brand-teal-1)] hover:bg-[var(--brand-teal-1)]/10',
        ghost:
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)]',
        destructive:
          'bg-[var(--brand-red-4)] text-white hover:bg-[var(--brand-red-2)]',
        link: 'text-[var(--brand-teal-1)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10',
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
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
