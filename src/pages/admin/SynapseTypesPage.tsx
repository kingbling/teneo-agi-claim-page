/**
 * SynapseTypesPage - Admin management of synapse types
 */

import { onMount, createSignal, Show, For } from 'solid-js'
import { Plus, Trash2, Zap, Upload } from 'lucide-solid'
import { adminStore } from '@/stores/adminStore'
import type { AdminSynapseType } from '@/stores/adminStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatPoints } from '@/types/game'

export default function SynapseTypesPage() {
  const [showCreateForm, setShowCreateForm] = createSignal(false)
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [isSubmitting, setIsSubmitting] = createSignal(false)

  const defaultForm = () => ({
    name: '',
    displayName: '',
    colorR: 0.5,
    colorG: 0.7,
    colorB: 1.0,
    pointsRequired: 6000,
    agiRewardMin: 3,
    agiRewardMax: 10,
    sortOrder: 1,
  })

  const [formData, setFormData] = createSignal(defaultForm())

  onMount(() => {
    adminStore.fetchSynapseTypes()
  })

  const handleCreate = async (e: Event) => {
    e.preventDefault()
    setIsSubmitting(true)
    const success = await adminStore.createSynapseType(formData())
    if (success) {
      setShowCreateForm(false)
      setFormData(defaultForm())
      adminStore.fetchSynapseTypes()
    }
    setIsSubmitting(false)
  }

  const startEdit = (st: AdminSynapseType) => {
    setEditingId(st.id)
    setFormData({
      name: st.name,
      displayName: st.displayName,
      colorR: st.colorR,
      colorG: st.colorG,
      colorB: st.colorB,
      pointsRequired: st.pointsRequired,
      agiRewardMin: st.agiRewardMin,
      agiRewardMax: st.agiRewardMax,
      sortOrder: st.sortOrder,
    })
  }

  const handleUpdate = async (e: Event) => {
    e.preventDefault()
    const id = editingId()
    if (!id) return
    setIsSubmitting(true)
    const success = await adminStore.updateSynapseType(id, formData())
    if (success) {
      setEditingId(null)
      setFormData(defaultForm())
      adminStore.fetchSynapseTypes()
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (st: AdminSynapseType) => {
    if (st.synapseCount > 0) {
      alert(`Cannot delete: ${st.synapseCount} synapses of this type exist.`)
      return
    }
    const success = await adminStore.deleteSynapseType(st.id)
    if (success) adminStore.fetchSynapseTypes()
  }

  const handleModelUpload = async (typeId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.glb'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const success = await adminStore.uploadSynapseTypeModel(typeId, file)
      if (success) adminStore.fetchSynapseTypes()
    }
    input.click()
  }

  const colorSwatch = (r: number, g: number, b: number) => {
    const color = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
    return (
      <div
        class="w-6 h-6 rounded-full border border-white/20 flex-shrink-0"
        style={{ background: color }}
      />
    )
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
            placeholder="e.g. mythic"
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
            placeholder="e.g. Mythic"
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
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Color R (0-1)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            required
            value={formData().colorR}
            onInput={(e) => setFormData({ ...formData(), colorR: parseFloat(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Color G (0-1)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            required
            value={formData().colorG}
            onInput={(e) => setFormData({ ...formData(), colorG: parseFloat(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Color B (0-1)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            required
            value={formData().colorB}
            onInput={(e) => setFormData({ ...formData(), colorB: parseFloat(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Points Required</label>
          <input
            type="number"
            required
            min="1"
            value={formData().pointsRequired}
            onInput={(e) => setFormData({ ...formData(), pointsRequired: parseInt(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">AGI Reward Min</label>
          <input
            type="number"
            required
            min="0"
            value={formData().agiRewardMin}
            onInput={(e) => setFormData({ ...formData(), agiRewardMin: parseInt(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">AGI Reward Max</label>
          <input
            type="number"
            required
            min="0"
            value={formData().agiRewardMax}
            onInput={(e) => setFormData({ ...formData(), agiRewardMax: parseInt(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-[var(--text-tertiary)]">Preview:</span>
        {colorSwatch(formData().colorR, formData().colorG, formData().colorB)}
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
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Synapse Types</h1>
          <p class="text-[var(--text-secondary)] mt-1">Manage synapse type definitions</p>
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
            <CardTitle>Create New Synapse Type</CardTitle>
          </CardHeader>
          <CardContent>
            <FormFields onSubmit={handleCreate} submitLabel="Create Type" />
          </CardContent>
        </Card>
      </Show>

      {/* Type List */}
      <Show
        when={adminStore.synapseTypes.length > 0}
        fallback={
          <Card>
            <CardContent class="py-12 text-center">
              <Zap class="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
              <p class="text-[var(--text-secondary)]">No synapse types defined</p>
              <p class="text-sm text-[var(--text-tertiary)]">Create your first synapse type to get started</p>
            </CardContent>
          </Card>
        }
      >
        <div class="space-y-4">
          <For each={adminStore.synapseTypes}>
            {(st) => (
              <Show
                when={editingId() === st.id}
                fallback={
                  <Card>
                    <CardContent class="p-4">
                      <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                          {colorSwatch(st.colorR, st.colorG, st.colorB)}
                          <div>
                            <div class="flex items-center gap-2">
                              <h3 class="font-semibold text-[var(--text-primary)]">{st.displayName}</h3>
                              <span class="text-xs text-[var(--text-tertiary)] font-mono">{st.name}</span>
                              <span class="text-xs px-2 py-0.5 rounded bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                                #{st.sortOrder}
                              </span>
                            </div>
                            <p class="text-sm text-[var(--text-secondary)] mt-1">
                              {formatPoints(st.pointsRequired)} points &middot; {st.agiRewardMin}–{st.agiRewardMax} AGI &middot; {st.synapseCount.toLocaleString()} synapses
                            </p>
                            <Show when={st.modelFilename}>
                              <p class="text-xs text-[var(--text-tertiary)] mt-0.5">
                                Model: {st.modelFilename}
                              </p>
                            </Show>
                          </div>
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
                            disabled={st.synapseCount > 0}
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
