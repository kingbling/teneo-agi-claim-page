/**
 * UsersPage - User management with search, filter, and actions
 */

import { onMount, createSignal, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Search, Ban, CheckCircle } from 'lucide-solid'
import { adminStore, AdminUser } from '@/stores/adminStore'
import { DataTable, Column } from '@/components/admin/DataTable'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function UsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = createSignal('')
  const [filter, setFilter] = createSignal('all')
  const [sortBy, setSortBy] = createSignal('created_at')
  const [sortOrder, setSortOrder] = createSignal<'ASC' | 'DESC'>('DESC')

  onMount(() => {
    fetchData()
  })

  const fetchData = (page = 1) => {
    adminStore.fetchUsers({
      page,
      search: search(),
      filter: filter(),
      sortBy: sortBy(),
      sortOrder: sortOrder(),
    })
  }

  const handleSearch = (e: Event) => {
    e.preventDefault()
    fetchData()
  }

  const handleSort = (column: string) => {
    if (sortBy() === column) {
      setSortOrder(sortOrder() === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortBy(column)
      setSortOrder('DESC')
    }
    fetchData()
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'wallet',
      label: 'Wallet',
      sortable: true,
      render: (user) => (
        <span class="font-mono text-xs">
          {user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}
        </span>
      ),
    },
    {
      key: 'userLevel',
      label: 'Level',
      sortable: true,
      width: '80px',
      align: 'center',
      render: (user) => (
        <Badge variant="outline">{user.userLevel}</Badge>
      ),
    },
    {
      key: 'points',
      label: 'Points',
      sortable: true,
      align: 'right',
      render: (user) => (
        <span>{user.points.toLocaleString()}</span>
      ),
    },
    {
      key: 'totalAgiEarned',
      label: 'AGI Earned',
      sortable: true,
      align: 'right',
      render: (user) => (
        <span>{user.totalAgiEarned.toLocaleString()}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (user) => (
        <span class="text-[var(--text-tertiary)]">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      align: 'center',
      render: (user) => (
        <Show
          when={user.bannedAt}
          fallback={
            <Show when={user.isAdmin} fallback={<span class="text-[var(--text-tertiary)]">-</span>}>
              <Badge variant="default">Admin</Badge>
            </Show>
          }
        >
          <Badge variant="destructive">Banned</Badge>
        </Show>
      ),
    },
  ]

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Users</h1>
          <p class="text-[var(--text-secondary)] mt-1">
            {adminStore.usersPagination.total.toLocaleString()} total users
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent class="p-4">
          <div class="flex flex-wrap gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} class="flex-1 min-w-[200px]">
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  placeholder="Search by wallet..."
                  value={search()}
                  onInput={(e) => setSearch(e.currentTarget.value)}
                  class="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-1)]/50"
                />
              </div>
            </form>

            {/* Filter buttons */}
            <div class="flex gap-2">
              <button
                class={`px-4 py-2 rounded-lg border transition-colors ${
                  filter() === 'all'
                    ? 'border-[var(--brand-teal-1)] bg-[var(--brand-teal-1)]/10 text-[var(--brand-teal-1)]'
                    : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]'
                }`}
                onClick={() => { setFilter('all'); fetchData() }}
              >
                All
              </button>
              <button
                class={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                  filter() === 'admin'
                    ? 'border-[var(--brand-teal-1)] bg-[var(--brand-teal-1)]/10 text-[var(--brand-teal-1)]'
                    : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]'
                }`}
                onClick={() => { setFilter('admin'); fetchData() }}
              >
                <CheckCircle class="w-4 h-4" />
                Admins
              </button>
              <button
                class={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                  filter() === 'banned'
                    ? 'border-red-500 bg-red-500/10 text-red-500'
                    : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]'
                }`}
                onClick={() => { setFilter('banned'); fetchData() }}
              >
                <Ban class="w-4 h-4" />
                Banned
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <DataTable
        data={adminStore.users}
        columns={columns}
        keyExtractor={(user) => user.id}
        onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
        isLoading={adminStore.isLoading}
        sortBy={sortBy()}
        sortOrder={sortOrder()}
        onSort={handleSort}
        pagination={{
          ...adminStore.usersPagination,
          onPageChange: fetchData,
        }}
        emptyMessage="No users found"
      />
    </div>
  )
}
