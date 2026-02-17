/**
 * ShipTypesPage - Admin management of ship types
 */

import { onMount, createSignal, Show, For } from 'solid-js'
import { Plus, Trash2, Rocket, Upload } from 'lucide-solid'
import { adminStore } from '@/stores/adminStore'
import type { AdminShipType } from '@/stores/adminStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ShipTypesPage() {
  const [showCreateForm, setShowCreateForm] = createSignal(false)
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [isSubmitting, setIsSubmitting] = createSignal(false)

  const defaultForm = () => ({
    name: '',
    displayName: '',
    description: '',
    creationCost: 0,
    speedMultiplier: 1.0,
    solveSpeedMultiplier: 1.0,
    fuelCapacity: 100,
    detectionRadius: 2.0,
    isActive: true,
    sortOrder: 1,
  })

  const [formData, setFormData] = createSignal(defaultForm())

  onMount(() => {
    adminStore.fetchShipTypes()
  })

  const handleCreate = async (e: Event) => {
    e.preventDefault()
    setIsSubmitting(true)
    const success = await adminStore.createShipType(formData())
    if (success) {
      setShowCreateForm(false)
      setFormData(defaultForm())
      adminStore.fetchShipTypes()
    }
    setIsSubmitting(false)
  }

  const startEdit = (st: AdminShipType) => {
    setEditingId(st.id)
    setFormData({
      name: st.name,
      displayName: st.displayName,
      description: st.description,
      creationCost: st.creationCost,
      speedMultiplier: st.speedMultiplier,
      solveSpeedMultiplier: st.solveSpeedMultiplier,
      fuelCapacity: st.fuelCapacity,
      detectionRadius: st.detectionRadius,
      isActive: st.isActive,
      sortOrder: st.sortOrder,
    })
  }

  const handleUpdate = async (e: Event) => {
    e.preventDefault()
    const id = editingId()
    if (!id) return
    setIsSubmitting(true)
    const success = await adminStore.updateShipType(id, formData())
    if (success) {
      setEditingId(null)
      setFormData(defaultForm())
      adminStore.fetchShipTypes()
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (st: AdminShipType) => {
    if (st.agentCount > 0) {
      alert(`Cannot delete: ${st.agentCount} ships of this type exist.`)
      return
    }
    const success = await adminStore.deleteShipType(st.id)
    if (success) adminStore.fetchShipTypes()
  }

  const handleModelUpload = async (typeId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.glb'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const success = await adminStore.uploadShipTypeModel(typeId, file)
      if (success) adminStore.fetchShipTypes()
    }
    input.click()
  }

  const FormFields = (props: { onSubmit: (e: Event) => void; submitLabel: string }) => (
    <form onSubmit={props.onSubmit} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Name (slug)</label>
          <input
            type="text"
            required
            value={formData().name}
            onInput={(e) => setFormData({ ...formData(), name: e.currentTarget.value })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
            placeholder="e.g. axon"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Display Name</label>
          <input
            type="text"
            required
            value={formData().displayName}
            onInput={(e) => setFormData({ ...formData(), displayName: e.currentTarget.value })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
            placeholder="e.g. Axon"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Sort Order</label>
          <input
            type="number"
            required
            min="0"
            value={formData().sortOrder}
            onInput={(e) => setFormData({ ...formData(), sortOrder: parseInt(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div class="md:col-span-3">
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Description</label>
          <input
            type="text"
            value={formData().description}
            onInput={(e) => setFormData({ ...formData(), description: e.currentTarget.value })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
            placeholder="Short description of ship type"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Creation Cost (pts)</label>
          <input
            type="number"
            required
            min="0"
            value={formData().creationCost}
            onInput={(e) => setFormData({ ...formData(), creationCost: parseInt(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Speed Multiplier</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            required
            value={formData().speedMultiplier}
            onInput={(e) => setFormData({ ...formData(), speedMultiplier: parseFloat(e.currentTarget.value) || 1.0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Solve Speed Multiplier</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            required
            value={formData().solveSpeedMultiplier}
            onInput={(e) => setFormData({ ...formData(), solveSpeedMultiplier: parseFloat(e.currentTarget.value) || 1.0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Fuel Capacity</label>
          <input
            type="number"
            required
            min="1"
            value={formData().fuelCapacity}
            onInput={(e) => setFormData({ ...formData(), fuelCapacity: parseInt(e.currentTarget.value) || 100 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Detection Radius</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            required
            value={formData().detectionRadius}
            onInput={(e) => setFormData({ ...formData(), detectionRadius: parseFloat(e.currentTarget.value) || 2.0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div class="flex items-end">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData().isActive}
              onChange={(e) => setFormData({ ...formData(), isActive: e.currentTarget.checked })}
              class="rounded border-[var(--card-border)]"
            />
            <span class="text-sm text-[var(--text-secondary)]">Active</span>
          </label>
        </div>
      </div>
      <div class="flex gap-2">
        <Button type="submit" disabled={isSubmitting()}>
          {isSubmitting() ? 'Saving...' : props.submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => { setShowCreateForm(false); setEditingId(null); setFormData(defaultForm()) }}>
          Cancel
        </Button>
      </div>
    </form>
  )

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Ship Types</h1>
          <p class="text-[var(--text-secondary)] mt-1">Manage ship types, specs, and creation costs</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus class="w-4 h-4 mr-2" />
          New Type
        </Button>
      </div>

      {/* Create Form */}
      <Show when={showCreateForm()}>
        <Card>
          <CardHeader>
            <CardTitle>Create New Ship Type</CardTitle>
          </CardHeader>
          <CardContent>
            <FormFields onSubmit={handleCreate} submitLabel="Create Type" />
          </CardContent>
        </Card>
      </Show>

      {/* Type List */}
      <Show when={adminStore.isLoadingShipTypes}>
        <Card>
          <CardContent class="py-12 text-center">
            <div class="w-8 h-8 mx-auto mb-4 border-2 border-[var(--brand-teal-1)] border-t-transparent rounded-full animate-spin" />
            <p class="text-[var(--text-secondary)]">Loading ship types...</p>
          </CardContent>
        </Card>
      </Show>
      <Show
        when={!adminStore.isLoadingShipTypes && adminStore.shipTypes.length > 0}
        fallback={
          <Show when={!adminStore.isLoadingShipTypes}>
            <Card>
              <CardContent class="py-12 text-center">
                <Rocket class="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
                <p class="text-[var(--text-secondary)]">No ship types defined</p>
                <p class="text-sm text-[var(--text-tertiary)]">Create your first ship type to get started</p>
              </CardContent>
            </Card>
          </Show>
        }
      >
        <div class="space-y-4">
          <For each={adminStore.shipTypes}>
            {(st) => (
              <Show
                when={editingId() === st.id}
                fallback={
                  <Card>
                    <CardContent class="p-4">
                      <div class="flex items-start justify-between">
                        <div>
                          <div class="flex items-center gap-2">
                            <h3 class="font-semibold text-[var(--text-primary)]">{st.displayName}</h3>
                            <span class="text-xs text-[var(--text-tertiary)] font-mono">{st.name}</span>
                            <span class="text-xs px-2 py-0.5 rounded bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                              #{st.sortOrder}
                            </span>
                            <Show when={!st.isActive}>
                              <span class="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400">
                                Inactive
                              </span>
                            </Show>
                          </div>
                          <Show when={st.description}>
                            <p class="text-sm text-[var(--text-tertiary)] mt-0.5">{st.description}</p>
                          </Show>
                          <p class="text-sm text-[var(--text-secondary)] mt-1">
                            {st.creationCost === 0 ? 'FREE' : `${st.creationCost} pts`}
                            {' · '}Speed {st.speedMultiplier}x
                            {' · '}Solve {st.solveSpeedMultiplier}x
                            {' · '}Fuel {st.fuelCapacity}
                            {' · '}Detect {st.detectionRadius}
                            {' · '}{st.agentCount} ships
                          </p>
                          <Show when={st.modelFilename}>
                            <p class="text-xs text-[var(--text-tertiary)] mt-0.5">
                              Model: {st.modelFilename}
                            </p>
                          </Show>
                        </div>
                        <div class="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleModelUpload(st.id)}>
                            <Upload class="w-4 h-4 mr-1" /> GLB
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => startEdit(st)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(st)}
                            disabled={st.agentCount > 0}
                          >
                            <Trash2 class="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Edit: {st.displayName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormFields onSubmit={handleUpdate} submitLabel="Save Changes" />
                  </CardContent>
                </Card>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
