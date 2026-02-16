import type { JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  class?: string
  style?: JSX.CSSProperties
}

export function Skeleton(props: SkeletonProps) {
  const [local, others] = splitProps(props, ['class', 'style'])

  return (
    <div
      class={cn(
        'animate-pulse bg-gradient-to-r from-[var(--background-tertiary)] via-[var(--background-secondary)] to-[var(--background-tertiary)] bg-[length:200%_100%]',
        local.class
      )}
      style={{
        animation: 'shimmer 1.5s ease-in-out infinite',
        'border-radius': 'var(--radius-md)',
        ...local.style,
      }}
      {...others}
    />
  )
}
