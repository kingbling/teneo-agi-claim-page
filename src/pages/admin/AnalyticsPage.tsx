/**
 * AnalyticsPage - Charts and detailed metrics
 */

import { onMount, createSignal, Show, For } from 'solid-js'
import { adminStore } from '@/stores/adminStore'
import { authStore } from '@/stores/authStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface EconomyData {
  circulation: {
    totalPoints: number
    totalAgentic: number
    totalAgi: number
    totalTeneo: number
    totalUsdcSpent: number
  }
  averages: {
    points: number
    agi: number
  }
  levelDistribution: Array<{ level: number; count: number }>
}

interface SynapseTypeData {
  synapseTypes: Array<{
    type: string
    total: number
    discovered: number
    inProgress: number
    completionRate: string
    avgProgress: number
    totalAgiRewards: number
  }>
}

export default function AnalyticsPage() {
  const [economy, setEconomy] = createSignal<EconomyData | null>(null)
  const [synapseTypes, setSynapseTypes] = createSignal<SynapseTypeData | null>(null)
  const [isLoading, setIsLoading] = createSignal(true)

  onMount(async () => {
    const headers = authStore.getAuthHeader()

    const [economyRes, synapseRes] = await Promise.all([
      fetch(`${API_URL}/api/admin/analytics/economy`, { headers }),
      fetch(`${API_URL}/api/admin/analytics/synapse-types`, { headers }),
    ])

    if (economyRes.ok) setEconomy(await economyRes.json())
    if (synapseRes.ok) setSynapseTypes(await synapseRes.json())

    setIsLoading(false)
  })

  return (
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
        <p class="text-[var(--text-secondary)] mt-1">Detailed metrics and insights</p>
      </div>

      <Show when={isLoading()}>
        <div class="animate-pulse space-y-6">
          <div class="h-48 bg-[var(--background-tertiary)] rounded-lg" />
          <div class="h-48 bg-[var(--background-tertiary)] rounded-lg" />
        </div>
      </Show>

      <Show when={!isLoading()}>
        {/* Economy Overview */}
        <Show when={economy()}>
          <Card>
            <CardHeader>
              <CardTitle>Token Economy</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div>
                  <p class="text-xs text-[var(--text-tertiary)]">Total Points</p>
                  <p class="text-2xl font-bold text-[var(--text-primary)]">
                    {economy()!.circulation.totalPoints.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-[var(--text-tertiary)]">Total AGI</p>
                  <p class="text-2xl font-bold text-[var(--text-primary)]">
                    {economy()!.circulation.totalAgi.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-[var(--text-tertiary)]">Total Agentic</p>
                  <p class="text-2xl font-bold text-[var(--text-primary)]">
                    {economy()!.circulation.totalAgentic.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-[var(--text-tertiary)]">Total USDC Spent</p>
                  <p class="text-2xl font-bold text-[var(--text-primary)]">
                    ${economy()!.circulation.totalUsdcSpent.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-[var(--text-tertiary)]">Avg AGI per User</p>
                  <p class="text-2xl font-bold text-[var(--text-primary)]">
                    {economy()!.averages.agi.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Level Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>User Level Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="flex items-end gap-4 h-32">
                <For each={economy()!.levelDistribution}>
                  {(level) => {
                    const maxCount = Math.max(...economy()!.levelDistribution.map(l => l.count))
                    const height = maxCount > 0 ? (level.count / maxCount * 100) : 0
                    return (
                      <div class="flex-1 flex flex-col items-center">
                        <div
                          class="w-full bg-[var(--brand-teal-1)] rounded-t"
                          style={{ height: `${height}%`, 'min-height': level.count > 0 ? '4px' : '0' }}
                        />
                        <p class="text-xs text-[var(--text-tertiary)] mt-2">Level {level.level}</p>
                        <p class="text-sm text-[var(--text-primary)]">{level.count.toLocaleString()}</p>
                      </div>
                    )
                  }}
                </For>
              </div>
            </CardContent>
          </Card>
        </Show>

        {/* Synapse Type Breakdown */}
        <Show when={synapseTypes()}>
          <Card>
            <CardHeader>
              <CardTitle>Synapse Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="text-left text-xs text-[var(--text-tertiary)] border-b border-[var(--card-border)]">
                      <th class="pb-2">Type</th>
                      <th class="pb-2 text-right">Total</th>
                      <th class="pb-2 text-right">Discovered</th>
                      <th class="pb-2 text-right">In Progress</th>
                      <th class="pb-2 text-right">Completion</th>
                      <th class="pb-2 text-right">Total AGI Rewards</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={synapseTypes()!.synapseTypes}>
                      {(st) => (
                        <tr class="border-b border-[var(--card-border)]/50">
                          <td class="py-3 capitalize text-[var(--text-primary)]">{st.type}</td>
                          <td class="py-3 text-right text-[var(--text-secondary)]">{st.total.toLocaleString()}</td>
                          <td class="py-3 text-right text-[var(--text-secondary)]">{st.discovered.toLocaleString()}</td>
                          <td class="py-3 text-right text-[var(--text-secondary)]">{st.inProgress.toLocaleString()}</td>
                          <td class="py-3 text-right text-[var(--text-secondary)]">{st.completionRate}%</td>
                          <td class="py-3 text-right text-[var(--text-secondary)]">{st.totalAgiRewards.toLocaleString()}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </Show>
      </Show>
    </div>
  )
}
