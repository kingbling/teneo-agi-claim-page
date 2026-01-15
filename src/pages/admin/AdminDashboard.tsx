/**
 * AdminDashboard - Overview page with key stats
 */

import { onMount, Show, For } from 'solid-js'
import { Users, Database, Ship, TrendingUp } from 'lucide-solid'
import { adminStore } from '@/stores/adminStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function AdminDashboard() {
  onMount(() => {
    adminStore.fetchAnalytics()
  })

  const stats = () => [
    {
      label: 'Total Users',
      value: adminStore.analytics?.users.total ?? 0,
      subtext: `${adminStore.analytics?.users.active24h ?? 0} active today`,
      icon: Users,
      color: 'var(--brand-teal-1)',
    },
    {
      label: 'Synapses Discovered',
      value: adminStore.analytics?.spaces.discovered ?? 0,
      subtext: `${adminStore.analytics?.spaces.discoveryRate ?? 0}% complete`,
      icon: Database,
      color: 'hsl(var(--success))',
    },
    {
      label: 'Ships Deployed',
      value: adminStore.analytics?.ships.deployed ?? 0,
      subtext: `${adminStore.analytics?.ships.idle ?? 0} idle`,
      icon: Ship,
      color: 'hsl(var(--accent))',
    },
    {
      label: 'Total Synapses',
      value: adminStore.analytics?.spaces.total ?? 0,
      subtext: `${adminStore.analytics?.spaces.inProgress ?? 0} in progress`,
      icon: TrendingUp,
      color: 'hsl(var(--tier-mythic))',
    },
  ]

  return (
    <div class="space-y-8">
      {/* Header */}
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p class="text-[var(--text-secondary)] mt-1">System overview and key metrics</p>
      </div>

      {/* Loading state */}
      <Show when={adminStore.isLoading}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <For each={[1, 2, 3, 4]}>
            {() => (
              <Card>
                <CardContent class="p-6">
                  <div class="h-4 w-24 bg-[var(--background-tertiary)] rounded animate-pulse mb-2" />
                  <div class="h-8 w-16 bg-[var(--background-tertiary)] rounded animate-pulse" />
                </CardContent>
              </Card>
            )}
          </For>
        </div>
      </Show>

      {/* Stats Grid */}
      <Show when={!adminStore.isLoading && adminStore.analytics}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <For each={stats()}>
            {(stat) => (
              <Card>
                <CardContent class="p-6">
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="text-sm text-[var(--text-secondary)]">{stat.label}</p>
                      <p class="text-3xl font-bold text-[var(--text-primary)] mt-1">
                        {stat.value.toLocaleString()}
                      </p>
                      <p class="text-xs text-[var(--text-tertiary)] mt-1">{stat.subtext}</p>
                    </div>
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${stat.color}20` }}
                    >
                      <stat.icon class="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </For>
        </div>
      </Show>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/admin/users"
              class="p-4 rounded-lg border border-[var(--card-border)] hover:bg-[var(--background-tertiary)] transition-colors text-center"
            >
              <Users class="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)]" />
              <span class="text-sm text-[var(--text-primary)]">Manage Users</span>
            </a>
            <a
              href="/admin/data"
              class="p-4 rounded-lg border border-[var(--card-border)] hover:bg-[var(--background-tertiary)] transition-colors text-center"
            >
              <Database class="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)]" />
              <span class="text-sm text-[var(--text-primary)]">Browse Data</span>
            </a>
            <a
              href="/admin/interventions"
              class="p-4 rounded-lg border border-[var(--card-border)] hover:bg-[var(--background-tertiary)] transition-colors text-center"
            >
              <Ship class="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)]" />
              <span class="text-sm text-[var(--text-primary)]">Interventions</span>
            </a>
            <a
              href="/admin/events"
              class="p-4 rounded-lg border border-[var(--card-border)] hover:bg-[var(--background-tertiary)] transition-colors text-center"
            >
              <TrendingUp class="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)]" />
              <span class="text-sm text-[var(--text-primary)]">Live Events</span>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      <Show when={adminStore.error}>
        <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p class="text-red-500">Error: {adminStore.error}</p>
        </div>
      </Show>
    </div>
  )
}
