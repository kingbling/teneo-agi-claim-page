import { type JSX, type ParentProps, splitProps, createSignal, createEffect } from 'solid-js'
import { Tabs as TabsPrimitive } from '@kobalte/core/tabs'
import { cn } from '@/lib/utils'

interface TabsProps extends ParentProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  class?: string
}

function Tabs(props: TabsProps) {
  const [local, others] = splitProps(props, ['defaultValue', 'value', 'onValueChange', 'class', 'children'])

  return (
    <TabsPrimitive
      defaultValue={local.defaultValue ?? 'overview'}
      value={local.value}
      onChange={local.onValueChange}
      class={local.class}
      {...others}
    >
      {local.children}
    </TabsPrimitive>
  )
}

interface TabsListProps extends ParentProps {
  class?: string
}

function TabsList(props: TabsListProps) {
  const [local, others] = splitProps(props, ['class', 'children'])

  return (
    <TabsPrimitive.List
      class={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1',
        local.class
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.List>
  )
}

interface TabsTriggerProps extends ParentProps {
  value: string
  class?: string
}

function TabsTrigger(props: TabsTriggerProps) {
  const [local, others] = splitProps(props, ['value', 'class', 'children'])

  return (
    <TabsPrimitive.Trigger
      value={local.value}
      class={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm',
        'text-muted-foreground hover:text-foreground',
        local.class
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.Trigger>
  )
}

interface TabsContentProps extends ParentProps {
  value: string
  class?: string
}

function TabsContent(props: TabsContentProps) {
  const [local, others] = splitProps(props, ['value', 'class', 'children'])

  return (
    <TabsPrimitive.Content
      value={local.value}
      class={cn('mt-4', local.class)}
      {...others}
    >
      {local.children}
    </TabsPrimitive.Content>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
