/**
 * AdminLayout - Layout with sidebar navigation for admin pages
 */

import { For } from 'solid-js'
import type { ParentComponent } from 'solid-js'
import { A, useLocation } from '@solidjs/router'
import {
  Home,
  Users,
  BarChart3,
  Database,
  Wrench,
  Calendar,
  Shapes,
  Brain,
  Rocket,
  Terminal,
  ArrowLeft,
} from 'lucide-solid'

interface NavItem {
  path: string
  icon: typeof Home
  label: string
}

const navItems: NavItem[] = [
  { path: '/admin', icon: Home, label: 'Overview' },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/admin/data', icon: Database, label: 'Game Data' },
  { path: '/admin/interventions', icon: Wrench, label: 'Interventions' },
  { path: '/admin/events', icon: Calendar, label: 'Events' },
  { path: '/admin/synapse-types', icon: Shapes, label: 'Synapse Types' },
  { path: '/admin/brain-parts', icon: Brain, label: 'Brain Parts' },
  { path: '/admin/ship-types', icon: Rocket, label: 'Ship Types' },
  { path: '/admin/logs', icon: Terminal, label: 'Server Logs' },
]

export const AdminLayout: ParentComponent = (props) => {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div class="min-h-screen bg-[var(--background-primary)] flex">
      {/* Sidebar */}
      <aside class="w-64 bg-[var(--background-secondary)] border-r border-[var(--card-border)] flex flex-col flex-shrink-0">
        {/* Header */}
        <div class="p-6 border-b border-[var(--card-border)]">
          <h1 class="text-xl font-bold text-[var(--text-primary)]">Admin Panel</h1>
          <p class="text-xs text-[var(--text-tertiary)] mt-1">Teneo Management</p>
        </div>

        {/* Navigation */}
        <nav class="flex-1 p-4 space-y-1">
          <For each={navItems}>
            {(item) => (
              <A
                href={item.path}
                class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
                classList={{
                  'bg-[var(--brand-teal-1)]/10 text-[var(--brand-teal-1)]': isActive(item.path),
                  'text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]': !isActive(item.path),
                }}
              >
                <item.icon class="w-5 h-5" />
                <span class="font-medium">{item.label}</span>
              </A>
            )}
          </For>
        </nav>

        {/* Footer */}
        <div class="p-4 border-t border-[var(--card-border)]">
          <A
            href="/discovery"
            class="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft class="w-4 h-4" />
            Back to Discovery
          </A>
        </div>
      </aside>

      {/* Main Content */}
      <main class="flex-1 overflow-auto">
        <div class="p-8">
          {props.children}
        </div>
      </main>
    </div>
  )
}
