/**
 * DataPage - Browse spaces and agents with tabs
 */

import { onMount, createSignal, Show } from 'solid-js'
import { Search } from 'lucide-solid'
import { adminStore, AdminSpace, AdminAgent } from '@/stores/adminStore'
import { DataTable, Column } from '@/components/admin/DataTable'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Tab = 'spaces' | 'agents'

export default function DataPage() {
  const [activeTab, setActiveTab] = createSignal<Tab>('spaces')
  const [spaceSearch, setSpaceSearch] = createSignal('')
  const [agentSearch, setAgentSearch] = createSignal('')
  const [spaceStateFilter, setSpaceStateFilter] = createSignal('')
  const [agentStateFilter, setAgentStateFilter] = createSignal('')
  const [typeFilter, setTypeFilter] = createSignal('')

  onMount(() => {
    adminStore.fetchSpaces()
    adminStore.fetchAgents()
  })

  const fetchSpaces = (page = 1) => {
    adminStore.fetchSpaces({
      page,
      search: spaceSearch(),
      state: spaceStateFilter(),
      synapseType: typeFilter(),
    })
  }

  const fetchAgents = (page = 1) => {
    adminStore.fetchAgents({
      page,
      search: agentSearch(),
      state: agentStateFilter(),
    })
  }

  const spaceColumns: Column<AdminSpace>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (s) => <span class="font-mono text-xs">{s.id.slice(0, 8)}...</span>,
    },
    {
      key: 'synapseType',
      label: 'Type',
      render: (s) => <Badge variant="outline" class="capitalize">{s.synapseType}</Badge>,
    },
    {
      key: 'state',
      label: 'State',
      render: (s) => (
        <Badge variant={s.state === 'discovered' ? 'success' : s.state === 'being_solved' ? 'warning' : 'secondary'}>
          {s.state}
        </Badge>
      ),
    },
    {
      key: 'progress',
      label: 'Progress',
      align: 'right',
      render: (s) => <span>{s.progress}%</span>,
    },
    {
      key: 'agiReward',
      label: 'AGI Reward',
      align: 'right',
      render: (s) => <span>{s.agiReward.toLocaleString()}</span>,
    },
  ]

  const agentColumns: Column<AdminAgent>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (a) => <span class="font-medium">{a.name}</span>,
    },
    {
      key: 'ownerId',
      label: 'Owner',
      render: (a) => <span class="font-mono text-xs">{a.ownerId.slice(0, 8)}...</span>,
    },
    {
      key: 'state',
      label: 'State',
      render: (a) => (
        <Badge variant={a.state === 'idle' ? 'secondary' : a.state === 'solving' ? 'success' : 'warning'}>
          {a.state}
        </Badge>
      ),
    },
    {
      key: 'spacesDiscovered',
      label: 'Discoveries',
      align: 'right',
      render: (a) => <span>{a.spacesDiscovered}</span>,
    },
    {
      key: 'totalAgiEarned',
      label: 'AGI Earned',
      align: 'right',
      render: (a) => <span>{a.totalAgiEarned.toLocaleString()}</span>,
    },
  ]

  return (
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">Game Data</h1>
        <p class="text-[var(--text-secondary)] mt-1">Browse spaces and agents</p>
      </div>

      {/* Tabs */}
      <div class="flex gap-2 border-b border-[var(--card-border)]">
        <button
          class={`px-4 py-2 font-medium transition-colors ${
            activeTab() === 'spaces'
              ? 'text-[var(--brand-teal-1)] border-b-2 border-[var(--brand-teal-1)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          onClick={() => setActiveTab('spaces')}
        >
          Spaces ({adminStore.spacesPagination.total.toLocaleString()})
        </button>
        <button
          class={`px-4 py-2 font-medium transition-colors ${
            activeTab() === 'agents'
              ? 'text-[var(--brand-teal-1)] border-b-2 border-[var(--brand-teal-1)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          onClick={() => setActiveTab('agents')}
        >
          Agents ({adminStore.agentsPagination.total.toLocaleString()})
        </button>
      </div>

      {/* Spaces Tab */}
      <Show when={activeTab() === 'spaces'}>
        <Card>
          <CardContent class="p-4">
            <div class="flex flex-wrap gap-4">
              <div class="flex-1 min-w-[200px] relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  placeholder="Search by ID..."
                  value={spaceSearch()}
                  onInput={(e) => setSpaceSearch(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchSpaces()}
                  class="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <select
                value={spaceStateFilter()}
                onChange={(e) => { setSpaceStateFilter(e.currentTarget.value); fetchSpaces() }}
                class="px-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
              >
                <option value="">All States</option>
                <option value="undiscovered">Undiscovered</option>
                <option value="being_solved">Being Solved</option>
                <option value="discovered">Discovered</option>
              </select>
              <select
                value={typeFilter()}
                onChange={(e) => { setTypeFilter(e.currentTarget.value); fetchSpaces() }}
                class="px-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
              >
                <option value="">All Types</option>
                <option value="minor">Minor</option>
                <option value="complex">Complex</option>
                <option value="deep">Deep</option>
                <option value="core">Core</option>
                <option value="rare">Rare</option>
                <option value="legendary">Legendary</option>
                <option value="unique">Unique</option>
              </select>
            </div>
          </CardContent>
        </Card>
        <DataTable
          data={adminStore.spaces}
          columns={spaceColumns}
          keyExtractor={(s) => s.id}
          isLoading={adminStore.isLoading}
          pagination={{
            ...adminStore.spacesPagination,
            onPageChange: fetchSpaces,
          }}
          emptyMessage="No spaces found"
        />
      </Show>

      {/* Agents Tab */}
      <Show when={activeTab() === 'agents'}>
        <Card>
          <CardContent class="p-4">
            <div class="flex flex-wrap gap-4">
              <div class="flex-1 min-w-[200px] relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={agentSearch()}
                  onInput={(e) => setAgentSearch(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAgents()}
                  class="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <select
                value={agentStateFilter()}
                onChange={(e) => { setAgentStateFilter(e.currentTarget.value); fetchAgents() }}
                class="px-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
              >
                <option value="">All States</option>
                <option value="idle">Idle</option>
                <option value="solving">Solving</option>
                <option value="traveling">Traveling</option>
              </select>
            </div>
          </CardContent>
        </Card>
        <DataTable
          data={adminStore.agents}
          columns={agentColumns}
          keyExtractor={(a) => a.id}
          isLoading={adminStore.isLoading}
          pagination={{
            ...adminStore.agentsPagination,
            onPageChange: fetchAgents,
          }}
          emptyMessage="No agents found"
        />
      </Show>
    </div>
  )
}
