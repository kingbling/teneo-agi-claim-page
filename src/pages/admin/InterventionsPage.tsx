/**
 * InterventionsPage - Manual intervention tools
 */

import { createSignal, Show, For, onMount } from 'solid-js'
import { RefreshCw, Ship, Zap, AlertTriangle } from 'lucide-solid'
import { adminStore } from '@/stores/adminStore'
import { authStore } from '@/stores/authStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface StuckShip {
  id: string
  name: string
  ownerId: string
  ownerWallet: string
  state: string
  hoursDeployed: number
}

export default function InterventionsPage() {
  const [stuckShips, setStuckShips] = createSignal<StuckShip[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [message, setMessage] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null)

  const [resetShipId, setResetShipId] = createSignal('')
  const [completeSynapseId, setCompleteSynapseId] = createSignal('')

  onMount(() => {
    fetchStuckShips()
  })

  const fetchStuckShips = async () => {
    const response = await fetch(`${API_URL}/api/admin/agents/status/stuck?hours=12`, {
      headers: authStore.getAuthHeader(),
    })
    if (response.ok) {
      const data = await response.json()
      setStuckShips(data.agents)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleResetShip = async () => {
    if (!resetShipId()) return
    setIsLoading(true)
    const success = await adminStore.resetShip(resetShipId())
    if (success) {
      showMessage('success', `Ship ${resetShipId()} reset to idle`)
      setResetShipId('')
      fetchStuckShips()
    } else {
      showMessage('error', 'Failed to reset ship')
    }
    setIsLoading(false)
  }

  const handleCompleteSynapse = async () => {
    if (!completeSynapseId()) return
    setIsLoading(true)
    const success = await adminStore.completeSynapse(completeSynapseId())
    if (success) {
      showMessage('success', `Synapse ${completeSynapseId()} force completed`)
      setCompleteSynapseId('')
    } else {
      showMessage('error', 'Failed to complete synapse')
    }
    setIsLoading(false)
  }


  const handleQuickResetShip = async (shipId: string) => {
    const success = await adminStore.resetShip(shipId)
    if (success) {
      showMessage('success', `Ship reset to idle`)
      fetchStuckShips()
    }
  }

  return (
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">Interventions</h1>
        <p class="text-[var(--text-secondary)] mt-1">Manual system interventions</p>
      </div>

      {/* Message */}
      <Show when={message()}>
        <div
          class={`p-4 rounded-lg ${
            message()!.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-500'
              : 'bg-red-500/10 border border-red-500/20 text-red-500'
          }`}
        >
          {message()!.text}
        </div>
      </Show>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reset Ship */}
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Ship class="w-5 h-5" />
              Reset Ship
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <p class="text-sm text-[var(--text-secondary)]">
              Reset a ship to idle state, removing it from any synapse exploration.
            </p>
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="Ship ID"
                value={resetShipId()}
                onInput={(e) => setResetShipId(e.currentTarget.value)}
                class="flex-1 px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
              />
              <Button onClick={handleResetShip} disabled={isLoading() || !resetShipId()}>
                <RefreshCw class="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Complete Synapse */}
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Zap class="w-5 h-5" />
              Force Complete Synapse
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <p class="text-sm text-[var(--text-secondary)]">
              Force complete a synapse, distributing rewards to explorers.
            </p>
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="Synapse ID"
                value={completeSynapseId()}
                onInput={(e) => setCompleteSynapseId(e.currentTarget.value)}
                class="flex-1 px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
              />
              <Button onClick={handleCompleteSynapse} disabled={isLoading() || !completeSynapseId()}>
                <Zap class="w-4 h-4 mr-2" />
                Complete
              </Button>
            </div>
          </CardContent>
        </Card>


        {/* Stuck Ships */}
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <AlertTriangle class="w-5 h-5" />
              Stuck Ships ({stuckShips().length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Show
              when={stuckShips().length > 0}
              fallback={
                <p class="text-sm text-[var(--text-tertiary)]">No stuck ships detected</p>
              }
            >
              <div class="space-y-2 max-h-64 overflow-y-auto">
                <For each={stuckShips()}>
                  {(ship) => (
                    <div class="flex items-center justify-between p-3 rounded-lg bg-[var(--background-tertiary)]">
                      <div>
                        <p class="text-sm text-[var(--text-primary)] font-medium">{ship.name}</p>
                        <p class="text-xs text-[var(--text-tertiary)]">
                          {ship.state} for {ship.hoursDeployed}h
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleQuickResetShip(ship.id)}>
                        Reset
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
