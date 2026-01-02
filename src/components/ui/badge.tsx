import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--brand-teal-1)]/20 text-[var(--brand-teal-1)]',
        secondary: 'bg-[var(--background-tertiary)] text-[var(--text-secondary)]',
        success: 'bg-[var(--brand-green-4)]/20 text-[var(--brand-green-4)]',
        warning: 'bg-[var(--rarity-legendary)]/20 text-[var(--rarity-legendary)]',
        destructive: 'bg-[var(--brand-red-4)]/20 text-[var(--brand-red-4)]',
        outline: 'border border-[var(--card-border)] text-[var(--text-secondary)]',
        // Rarity variants
        common: 'bg-[var(--rarity-common)]/20 text-[var(--rarity-common)]',
        uncommon: 'bg-[var(--rarity-uncommon)]/20 text-[var(--rarity-uncommon)]',
        rare: 'bg-[var(--rarity-rare)]/20 text-[var(--rarity-rare)]',
        legendary: 'bg-[var(--rarity-legendary)]/20 text-[var(--rarity-legendary)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
