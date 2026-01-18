/**
 * UserDetailPage - View and edit individual user
 */

import { onMount, createSignal, Show } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { ArrowLeft, Save, Ban, CheckCircle, Gift } from 'lucide-solid'
import { adminStore } from '@/stores/adminStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function UserDetailPage() {
  const params = useParams()
  const navigate = useNavigate()

  const [isEditing, setIsEditing] = createSignal(false)
  const [isSaving, setIsSaving] = createSignal(false)
  const [editData, setEditData] = createSignal({
    points: 0,
    agenticBalance: 0,
    userLevel: 1,
    maxShips: 1,
  })

  // Grant tokens state
  const [grantType, setGrantType] = createSignal<'points' | 'agi' | 'agentic' | 'teneo'>('points')
  const [grantAmount, setGrantAmount] = createSignal(0)
  const [isGranting, setIsGranting] = createSignal(false)

  onMount(async () => {
    const user = await adminStore.fetchUser(params.id)
    if (user) {
      setEditData({
        points: user.points,
        agenticBalance: user.agenticBalance,
        userLevel: user.userLevel,
        maxShips: user.maxShips,
      })
    }
  })

  const user = () => adminStore.selectedUser

  const handleSave = async () => {
    if (!user()) return
    setIsSaving(true)
    const success = await adminStore.updateUser(user()!.id, editData())
    if (success) {
      await adminStore.fetchUser(params.id)
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  const handleBan = async () => {
    if (!user()) return
    const reason = prompt('Enter ban reason (optional):')
    if (reason !== null) {
      await adminStore.banUser(user()!.id, reason || undefined)
      await adminStore.fetchUser(params.id)
    }
  }

  const handleUnban = async () => {
    if (!user()) return
    await adminStore.unbanUser(user()!.id)
    await adminStore.fetchUser(params.id)
  }

  const handleGrant = async () => {
    if (!user() || grantAmount() <= 0) return
    setIsGranting(true)
    await adminStore.grantTokens(user()!.id, grantType(), grantAmount())
    await adminStore.fetchUser(params.id)
    setGrantAmount(0)
    setIsGranting(false)
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/users')}
          class="p-2 rounded-lg hover:bg-[var(--background-tertiary)] transition-colors"
        >
          <ArrowLeft class="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">User Details</h1>
          <Show when={user()}>
            <p class="text-[var(--text-secondary)] font-mono text-sm mt-1">{user()!.wallet}</p>
          </Show>
        </div>
        <Show when={user()}>
          <div class="flex gap-2">
            <Show when={!user()!.bannedAt}>
              <Button variant="destructive" size="sm" onClick={handleBan}>
                <Ban class="w-4 h-4 mr-2" />
                Ban User
              </Button>
            </Show>
            <Show when={user()!.bannedAt}>
              <Button variant="success" size="sm" onClick={handleUnban}>
                <CheckCircle class="w-4 h-4 mr-2" />
                Unban User
              </Button>
            </Show>
          </div>
        </Show>
      </div>

      <Show when={user()} fallback={<div class="animate-pulse">Loading...</div>}>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Info */}
          <Card>
            <CardHeader class="flex flex-row items-center justify-between">
              <CardTitle>User Information</CardTitle>
              <Show when={!isEditing()}>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              </Show>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-[var(--text-tertiary)]">Tier</label>
                  <p class="text-[var(--text-primary)]">{user()!.tier}</p>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)]">User Level</label>
                  <Show
                    when={isEditing()}
                    fallback={<p class="text-[var(--text-primary)]">{user()!.userLevel}</p>}
                  >
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={editData().userLevel}
                      onInput={(e) => setEditData({ ...editData(), userLevel: parseInt(e.currentTarget.value) || 1 })}
                      class="w-full px-3 py-1 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                    />
                  </Show>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)]">Points</label>
                  <Show
                    when={isEditing()}
                    fallback={<p class="text-[var(--text-primary)]">{user()!.points.toLocaleString()}</p>}
                  >
                    <input
                      type="number"
                      min="0"
                      value={editData().points}
                      onInput={(e) => setEditData({ ...editData(), points: parseInt(e.currentTarget.value) || 0 })}
                      class="w-full px-3 py-1 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                    />
                  </Show>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)]">Agentic Balance</label>
                  <Show
                    when={isEditing()}
                    fallback={<p class="text-[var(--text-primary)]">{user()!.agenticBalance.toLocaleString()}</p>}
                  >
                    <input
                      type="number"
                      min="0"
                      value={editData().agenticBalance}
                      onInput={(e) => setEditData({ ...editData(), agenticBalance: parseInt(e.currentTarget.value) || 0 })}
                      class="w-full px-3 py-1 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                    />
                  </Show>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)]">Max Ships</label>
                  <Show
                    when={isEditing()}
                    fallback={<p class="text-[var(--text-primary)]">{user()!.maxShips}</p>}
                  >
                    <input
                      type="number"
                      min="1"
                      value={editData().maxShips}
                      onInput={(e) => setEditData({ ...editData(), maxShips: parseInt(e.currentTarget.value) || 1 })}
                      class="w-full px-3 py-1 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                    />
                  </Show>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)]">Total AGI Earned</label>
                  <p class="text-[var(--text-primary)]">{user()!.totalAgiEarned.toLocaleString()}</p>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)]">USDC Spent</label>
                  <p class="text-[var(--text-primary)]">${user()!.usdcSpent.toFixed(2)}</p>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)]">Joined</label>
                  <p class="text-[var(--text-primary)]">{new Date(user()!.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <Show when={isEditing()}>
                <div class="flex gap-2 pt-4 border-t border-[var(--card-border)]">
                  <Button onClick={handleSave} disabled={isSaving()}>
                    <Save class="w-4 h-4 mr-2" />
                    {isSaving() ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </Show>

              {/* Status badges */}
              <div class="flex gap-2 pt-4 border-t border-[var(--card-border)]">
                <Show when={user()!.isAdmin}>
                  <Badge variant="default">Admin</Badge>
                </Show>
                <Show when={user()!.bannedAt}>
                  <Badge variant="destructive">Banned: {user()!.banReason || 'No reason'}</Badge>
                </Show>
              </div>
            </CardContent>
          </Card>

          {/* Grant Tokens */}
          <Card>
            <CardHeader>
              <CardTitle>Grant Tokens</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Token Type</label>
                  <select
                    value={grantType()}
                    onChange={(e) => setGrantType(e.currentTarget.value as 'points' | 'agi' | 'agentic' | 'teneo')}
                    class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                  >
                    <option value="points">Points</option>
                    <option value="agi">AGI</option>
                    <option value="agentic">Agentic</option>
                    <option value="teneo">Teneo</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Amount</label>
                  <input
                    type="number"
                    min="1"
                    value={grantAmount()}
                    onInput={(e) => setGrantAmount(parseInt(e.currentTarget.value) || 0)}
                    class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                  />
                </div>
              </div>
              <Button onClick={handleGrant} disabled={isGranting() || grantAmount() <= 0}>
                <Gift class="w-4 h-4 mr-2" />
                {isGranting() ? 'Granting...' : `Grant ${grantAmount().toLocaleString()} ${grantType()}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </Show>
    </div>
  )
}
