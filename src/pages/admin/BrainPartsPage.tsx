/**
 * BrainPartsPage - Admin management of brain parts (regions) and synapse generation
 */

import { onMount, createSignal, Show, For } from 'solid-js'
import { Plus, Zap, Power, RefreshCw, Pencil } from 'lucide-solid'
import { adminStore } from '@/stores/adminStore'
import type { AdminBrainPart } from '@/stores/adminStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function BrainPartsPage() {
  const [showCreateForm, setShowCreateForm] = createSignal(false)
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [generateDialogId, setGenerateDialogId] = createSignal<string | null>(null)
  const [generateTypeId, setGenerateTypeId] = createSignal('')
  const [generateCount, setGenerateCount] = createSignal(10000)
  const [generateResult, setGenerateResult] = createSignal<string | null>(null)

  const defaultForm = () => ({
    name: '',
    displayName: '',
    description: '',
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    radius: 0.3,
    colorR: 0.5,
    colorG: 0.7,
    colorB: 1.0,
    sortOrder: 0,
  })

  const [formData, setFormData] = createSignal(defaultForm())

  onMount(() => {
    adminStore.fetchBrainParts()
    adminStore.fetchSynapseTypes()
  })

  const handleCreate = async (e: Event) => {
    e.preventDefault()
    setIsSubmitting(true)
    const success = await adminStore.createBrainPart(formData())
    if (success) {
      setShowCreateForm(false)
      setFormData(defaultForm())
      adminStore.fetchBrainParts()
    }
    setIsSubmitting(false)
  }

  const startEdit = (bp: AdminBrainPart) => {
    setEditingId(bp.id)
    setFormData({
      name: bp.name,
      displayName: bp.displayName,
      description: bp.description,
      centerX: bp.centerX,
      centerY: bp.centerY,
      centerZ: bp.centerZ,
      radius: bp.radius,
      colorR: bp.colorR,
      colorG: bp.colorG,
      colorB: bp.colorB,
      sortOrder: bp.sortOrder,
    })
  }

  const handleUpdate = async (e: Event) => {
    e.preventDefault()
    const id = editingId()
    if (!id) return
    setIsSubmitting(true)
    const success = await adminStore.updateBrainPart(id, formData())
    if (success) {
      setEditingId(null)
      setFormData(defaultForm())
      adminStore.fetchBrainParts()
    }
    setIsSubmitting(false)
  }

  const handleToggle = async (bp: AdminBrainPart) => {
    const success = await adminStore.toggleBrainPart(bp.id)
    if (success) adminStore.fetchBrainParts()
  }

  const handleGenerate = async () => {
    const partId = generateDialogId()
    const typeId = generateTypeId()
    if (!partId || !typeId) return
    setIsSubmitting(true)
    setGenerateResult(null)
    const result = await adminStore.generateSynapsesForBrainPart(partId, typeId, generateCount())
    if (result.error) {
      setGenerateResult(`Error: ${result.error}`)
    } else {
      setGenerateResult(`Generated ${result.generated?.toLocaleString()} synapses`)
      adminStore.fetchBrainParts()
    }
    setIsSubmitting(false)
  }

  const handleWipe = async () => {
    const success = await adminStore.wipeSynapses()
    if (success) {
      adminStore.fetchBrainParts()
    }
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
            placeholder="e.g. frontal_lobe"
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
            placeholder="e.g. Frontal Lobe"
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
            placeholder="e.g. Executive function, decision making"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Center X</label>
          <input
            type="number"
            step="0.01"
            required
            value={formData().centerX}
            onInput={(e) => setFormData({ ...formData(), centerX: parseFloat(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Center Y</label>
          <input
            type="number"
            step="0.01"
            required
            value={formData().centerY}
            onInput={(e) => setFormData({ ...formData(), centerY: parseFloat(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Center Z</label>
          <input
            type="number"
            step="0.01"
            required
            value={formData().centerZ}
            onInput={(e) => setFormData({ ...formData(), centerZ: parseFloat(e.currentTarget.value) || 0 })}
            class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Radius</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={formData().radius}
            onInput={(e) => setFormData({ ...formData(), radius: parseFloat(e.currentTarget.value) || 0.3 })}
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
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Brain Parts</h1>
          <p class="text-[var(--text-secondary)] mt-1">Manage brain regions and generate synapses</p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" onClick={handleWipe}>
            <RefreshCw class="w-4 h-4 mr-2" />
            Wipe All Synapses
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus class="w-4 h-4 mr-2" />
            New Part
          </Button>
        </div>
      </div>

      {/* Create Form */}
      <Show when={showCreateForm()}>
        <Card>
          <CardHeader>
            <CardTitle>Create New Brain Part</CardTitle>
          </CardHeader>
          <CardContent>
            <FormFields onSubmit={handleCreate} submitLabel="Create Part" />
          </CardContent>
        </Card>
      </Show>

      {/* Generate Dialog */}
      <Show when={generateDialogId()}>
        <Card>
          <CardHeader>
            <CardTitle>
              Generate Synapses in {adminStore.brainParts.find(bp => bp.id === generateDialogId())?.displayName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div>
                <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Synapse Type</label>
                <select
                  value={generateTypeId()}
                  onChange={(e) => setGenerateTypeId(e.currentTarget.value)}
                  class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                >
                  <option value="">Select a synapse type...</option>
                  <For each={adminStore.synapseTypes}>
                    {(st) => <option value={st.id}>{st.displayName} ({st.name})</option>}
                  </For>
                </select>
              </div>
              <div>
                <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Count (1 - 100,000)</label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={generateCount()}
                  onInput={(e) => setGenerateCount(parseInt(e.currentTarget.value) || 1000)}
                  class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                />
              </div>
              <Show when={generateResult()}>
                <p class="text-sm text-[var(--text-secondary)]">{generateResult()}</p>
              </Show>
              <div class="flex gap-2">
                <Button onClick={handleGenerate} disabled={isSubmitting() || !generateTypeId()}>
                  {isSubmitting() ? 'Generating...' : 'Generate'}
                </Button>
                <Button variant="outline" onClick={() => { setGenerateDialogId(null); setGenerateResult(null); setGenerateTypeId('') }}>
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Show>

      {/* Parts List */}
      <Show when={adminStore.isLoadingBrainParts}>
        <Card>
          <CardContent class="py-12 text-center">
            <div class="w-8 h-8 mx-auto mb-4 border-2 border-[var(--brand-teal-1)] border-t-transparent rounded-full animate-spin" />
            <p class="text-[var(--text-secondary)]">Loading brain parts...</p>
          </CardContent>
        </Card>
      </Show>
      <Show
        when={!adminStore.isLoadingBrainParts && adminStore.brainParts.length > 0}
        fallback={
          <Show when={!adminStore.isLoadingBrainParts}>
            <Card>
              <CardContent class="py-12 text-center">
                <Zap class="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
                <p class="text-[var(--text-secondary)]">No brain parts defined</p>
                <p class="text-sm text-[var(--text-tertiary)]">Create your first brain part to get started</p>
              </CardContent>
            </Card>
          </Show>
        }
      >
        <div class="space-y-4">
          <For each={adminStore.brainParts}>
            {(bp) => (
              <Show
                when={editingId() === bp.id}
                fallback={
                  <Card>
                    <CardContent class="p-4">
                      <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                          {colorSwatch(bp.colorR, bp.colorG, bp.colorB)}
                          <div>
                            <div class="flex items-center gap-2">
                              <h3 class="font-semibold text-[var(--text-primary)]">{bp.displayName}</h3>
                              <span class="text-xs text-[var(--text-tertiary)] font-mono">{bp.name}</span>
                              <span
                                class="text-xs px-2 py-0.5 rounded"
                                classList={{
                                  'bg-green-500/20 text-green-400': bp.isEnabled,
                                  'bg-[var(--background-tertiary)] text-[var(--text-tertiary)]': !bp.isEnabled,
                                }}
                              >
                                {bp.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                              <span class="text-xs px-2 py-0.5 rounded bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                                #{bp.sortOrder}
                              </span>
                            </div>
                            <Show when={bp.description}>
                              <p class="text-sm text-[var(--text-secondary)] mt-0.5">{bp.description}</p>
                            </Show>
                            <p class="text-xs text-[var(--text-tertiary)] mt-1">
                              Center: ({bp.centerX.toFixed(2)}, {bp.centerY.toFixed(2)}, {bp.centerZ.toFixed(2)}) &middot; Radius: {bp.radius.toFixed(2)} &middot; {bp.synapseCount.toLocaleString()} synapses
                            </p>
                          </div>
                        </div>
                        <div class="flex gap-2">
                          <Button
                            size="sm"
                            variant={bp.isEnabled ? 'outline' : 'default'}
                            onClick={() => handleToggle(bp)}
                          >
                            <Power class="w-4 h-4 mr-1" /> {bp.isEnabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setGenerateDialogId(bp.id)}>
                            <Zap class="w-4 h-4 mr-1" /> Generate
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => startEdit(bp)}>
                            <Pencil class="w-4 h-4 mr-1" /> Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Edit: {bp.displayName}</CardTitle>
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
