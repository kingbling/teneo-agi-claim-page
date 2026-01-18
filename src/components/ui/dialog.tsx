import { type JSX, type ParentProps, splitProps } from 'solid-js'
import { Dialog as DialogPrimitive } from '@kobalte/core/dialog'
import { X } from 'lucide-solid'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.CloseButton

type DialogOverlayProps = JSX.HTMLAttributes<HTMLDivElement>

function DialogOverlay(props: DialogOverlayProps) {
  const [local, others] = splitProps(props, ['class'])

  return (
    <DialogPrimitive.Overlay
      class={cn(
        'fixed inset-0 z-[50] bg-black/80 backdrop-blur-sm data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0',
        local.class
      )}
      {...others}
    />
  )
}

// Dialog content base styles broken into logical groups
const dialogContentStyles = [
  // Positioning
  'fixed left-[50%] top-[50%] z-[50]',
  'translate-x-[-50%] translate-y-[-50%]',
  // Sizing
  'grid w-full max-w-lg gap-6',
  // Appearance
  'border border-[var(--card-border)]',
  'bg-[var(--background-secondary)]',
  'p-6 rounded-2xl',
  'shadow-2xl shadow-black/40',
  // Animation base
  'duration-200',
  'data-[expanded]:animate-in data-[closed]:animate-out',
  // Fade animations
  'data-[closed]:fade-out-0 data-[expanded]:fade-in-0',
  // Zoom animations
  'data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95',
  // Slide animations
  'data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%]',
  'data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%]',
].join(' ')

type DialogContentProps = ParentProps<JSX.HTMLAttributes<HTMLDivElement>>

function DialogContent(props: DialogContentProps) {
  const [local, others] = splitProps(props, ['class', 'children'])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        class={cn(dialogContentStyles, local.class)}
        {...others}
      >
        {local.children}
        <DialogPrimitive.CloseButton
          class={cn(
            'absolute right-6 top-6 w-12 h-12 rounded-xl',
            'flex items-center justify-center opacity-70',
            'ring-offset-[var(--background-primary)] transition-all',
            'hover:opacity-100 hover:bg-[var(--background-tertiary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-1)] focus:ring-offset-2',
            'disabled:pointer-events-none'
          )}
        >
          <X class="h-6 w-6" />
          <span class="sr-only">Close</span>
        </DialogPrimitive.CloseButton>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

type DialogHeaderProps = JSX.HTMLAttributes<HTMLDivElement>

function DialogHeader(props: DialogHeaderProps) {
  const [local, others] = splitProps(props, ['class'])

  return (
    <div
      class={cn(
        'flex flex-col space-y-2 text-center sm:text-left',
        local.class
      )}
      {...others}
    />
  )
}

type DialogFooterProps = JSX.HTMLAttributes<HTMLDivElement>

function DialogFooter(props: DialogFooterProps) {
  const [local, others] = splitProps(props, ['class'])

  return (
    <div
      class={cn(
        'flex flex-col-reverse gap-6 sm:flex-row sm:justify-end pt-6 mt-4 border-t border-[var(--card-border)]/50',
        local.class
      )}
      {...others}
    />
  )
}

type DialogTitleProps = JSX.HTMLAttributes<HTMLHeadingElement>

function DialogTitle(props: DialogTitleProps) {
  const [local, others] = splitProps(props, ['class'])

  return (
    <DialogPrimitive.Title
      class={cn(
        'text-2xl font-bold leading-tight tracking-tight text-[var(--text-primary)]',
        local.class
      )}
      {...others}
    />
  )
}

type DialogDescriptionProps = JSX.HTMLAttributes<HTMLParagraphElement>

function DialogDescription(props: DialogDescriptionProps) {
  const [local, others] = splitProps(props, ['class'])

  return (
    <DialogPrimitive.Description
      class={cn('text-sm text-[var(--text-tertiary)] leading-relaxed mt-1', local.class)}
      {...others}
    />
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
