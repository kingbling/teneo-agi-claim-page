import { Show, For, type JSX } from 'solid-js'
import { X, Rocket, BarChart3, Settings, Brain, Zap } from 'lucide-solid'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  activeTab: 'home' | 'agents' | 'stats' | 'settings'
  onTabChange: (tab: 'home' | 'agents' | 'stats' | 'settings') => void
  agentCount?: number
  points?: number
}

const tabs = [
  { id: 'home', label: 'Explore', icon: Brain },
  { id: 'agents', label: 'Agents', icon: Rocket },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export function MobileNav(props: MobileNavProps) {
  const agentCount = () => props.agentCount ?? 0
  const points = () => props.points ?? 0

  return (
    <>
      {/* Bottom Navigation Bar - only visible on mobile */}
      <nav class="fixed bottom-0 left-0 right-0 z-[40] md:hidden">
        {/* Gradient border on top */}
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

        <div class="bg-card/95 backdrop-blur-xl border-t border-border/50 pb-safe">
          <div class="flex items-center justify-around p-2">
            <For each={tabs}>
              {(tab) => {
                const Icon = tab.icon
                const isActive = () => props.activeTab === tab.id

                return (
                  <button
                    onClick={() => props.onTabChange(tab.id)}
                    class={cn(
                      'relative flex flex-col items-center min-w-[72px] transition-all active:scale-95',
                      'gap-1 px-4 py-3 rounded-2xl',
                      isActive()
                        ? 'text-[var(--brand-teal-1)]'
                        : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
                    )}
                  >
                    {/* Active indicator */}
                    <Show when={isActive()}>
                      <div class="absolute inset-0 bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/20 rounded-2xl transition-all" />
                    </Show>

                    {/* Badge for agents tab */}
                    <Show when={tab.id === 'agents' && agentCount() > 0}>
                      <span
                        class="absolute flex items-center justify-center font-bold text-white rounded-full shadow-lg shadow-[hsl(var(--state-solving))]/30 bg-[hsl(var(--state-solving))]"
                        style={{
                          top: '-4px',
                          right: '-4px',
                          'min-width': '20px',
                          height: '20px',
                          padding: '0 4px',
                          'font-size': '10px',
                        }}
                      >
                        {agentCount()}
                      </span>
                    </Show>

                    <Icon class={cn('relative z-10 w-6 h-6 transition-transform', isActive() && 'scale-110')} />
                    <span class="font-semibold relative z-10 text-xs">{tab.label}</span>
                  </button>
                )
              }}
            </For>
          </div>
        </div>
      </nav>

      {/* Points display for mobile - floating above nav */}
      <div class="fixed z-40 md:hidden bottom-24 right-4">
        <div class="flex items-center bg-card/95 backdrop-blur-xl border border-border shadow-xl gap-2 px-5 py-3 rounded-2xl animate-in fade-in zoom-in-95 duration-300 hover:scale-105 active:scale-95 transition-transform">
          <div class="bg-[var(--brand-teal-1)]/15 p-1.5 rounded-lg">
            <Zap class="w-4 h-4 text-[var(--brand-teal-1)]" />
          </div>
          <div class="flex items-baseline gap-1">
            <span class="text-base font-bold text-[var(--brand-teal-1)] tabular-nums">
              {points().toLocaleString()}
            </span>
            <span class="text-xs text-muted-foreground font-medium">pts</span>
          </div>
        </div>
      </div>
    </>
  )
}

// Mobile slide-out panel
interface MobilePanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: JSX.Element
}

export function MobilePanel(props: MobilePanelProps) {
  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div
        onClick={props.onClose}
        class="fixed inset-0 backdrop-blur-sm z-[40] md:hidden bg-background/60 animate-in fade-in duration-200"
      />

      {/* Panel */}
      <div class="fixed inset-y-0 left-0 w-[85vw] max-w-sm bg-card border-r border-border z-[40] md:hidden overflow-hidden animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-border p-4 px-5">
          <h2 class="text-lg font-bold text-foreground">{props.title}</h2>
          <button onClick={props.onClose} class="hover:bg-muted transition-colors p-2 rounded-lg">
            <X class="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div class="overflow-y-auto" style={{ height: 'calc(100% - 65px)' }}>
          {props.children}
        </div>
      </div>
    </Show>
  )
}

// Quick action floating button for mobile
interface QuickActionButtonProps {
  onClick: () => void
  icon: JSX.Element
  label: string
  variant?: 'primary' | 'secondary'
}

export function QuickActionButton(props: QuickActionButtonProps) {
  const variant = () => props.variant ?? 'primary'

  return (
    <button
      onClick={props.onClick}
      class={cn(
        'fixed z-40 md:hidden flex items-center gap-2 px-6 py-4 rounded-2xl shadow-xl transition-all active:shadow-lg bottom-24 left-4 text-sm font-bold',
        'hover:scale-105 active:scale-90',
        variant() === 'primary'
          ? 'bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] text-white shadow-[var(--brand-teal-1)]/40 active:shadow-[var(--brand-teal-1)]/20'
          : 'bg-card/95 backdrop-blur-xl border border-border text-foreground shadow-black/20'
      )}
    >
      <span class="w-5 h-5">{props.icon}</span>
      {props.label}
    </button>
  )
}
