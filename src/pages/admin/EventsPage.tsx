/**
 * EventsPage - Live events management
 */

import { onMount, createSignal, Show, For } from 'solid-js'
import { Plus, Calendar, Trash2, Play, Pause } from 'lucide-solid'
import { adminStore, AdminEvent } from '@/stores/adminStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function EventsPage() {
  const [showCreateForm, setShowCreateForm] = createSignal(false)
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [formData, setFormData] = createSignal({
    name: '',
    description: '',
    eventType: 'points_boost',
    multiplier: 1.5,
    startTime: '',
    endTime: '',
  })

  onMount(() => {
    adminStore.fetchEvents(true)
  })

  const handleCreate = async (e: Event) => {
    e.preventDefault()
    setIsSubmitting(true)

    const data = formData()
    const success = await adminStore.createEvent({
      name: data.name,
      description: data.description || undefined,
      eventType: data.eventType,
      multiplier: data.multiplier,
      startTime: new Date(data.startTime).getTime(),
      endTime: new Date(data.endTime).getTime(),
      isActive: true,
    })

    if (success) {
      setShowCreateForm(false)
      setFormData({
        name: '',
        description: '',
        eventType: 'points_boost',
        multiplier: 1.5,
        startTime: '',
        endTime: '',
      })
      adminStore.fetchEvents(true)
    }

    setIsSubmitting(false)
  }

  const handleToggle = async (event: AdminEvent) => {
    if (event.isActive) {
      await adminStore.deactivateEvent(event.id)
    } else {
      await adminStore.activateEvent(event.id)
    }
    adminStore.fetchEvents(true)
  }

  const handleDelete = async (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      await adminStore.deleteEvent(eventId)
      adminStore.fetchEvents(true)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>
      case 'upcoming':
        return <Badge variant="warning">Upcoming</Badge>
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>
      default:
        return <Badge variant="outline">Inactive</Badge>
    }
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Live Events</h1>
          <p class="text-[var(--text-secondary)] mt-1">Manage temporary bonus events</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus class="w-4 h-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Create Form */}
      <Show when={showCreateForm()}>
        <Card>
          <CardHeader>
            <CardTitle>Create New Event</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Name</label>
                  <input
                    type="text"
                    required
                    value={formData().name}
                    onInput={(e) => setFormData({ ...formData(), name: e.currentTarget.value })}
                    class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Event Type</label>
                  <select
                    value={formData().eventType}
                    onChange={(e) => setFormData({ ...formData(), eventType: e.currentTarget.value })}
                    class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                  >
                    <option value="points_boost">Points Boost</option>
                    <option value="agi_boost">AGI Boost</option>
                    <option value="discovery_boost">Discovery Boost</option>
                    <option value="global_boost">Global Boost</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={formData().multiplier}
                    onInput={(e) => setFormData({ ...formData(), multiplier: parseFloat(e.currentTarget.value) || 1 })}
                    class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Description</label>
                  <input
                    type="text"
                    value={formData().description}
                    onInput={(e) => setFormData({ ...formData(), description: e.currentTarget.value })}
                    class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)] mb-1 block">Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData().startTime}
                    onInput={(e) => setFormData({ ...formData(), startTime: e.currentTarget.value })}
                    class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label class="text-xs text-[var(--text-tertiary)] mb-1 block">End Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData().endTime}
                    onInput={(e) => setFormData({ ...formData(), endTime: e.currentTarget.value })}
                    class="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background-primary)] text-[var(--text-primary)]"
                  />
                </div>
              </div>
              <div class="flex gap-2">
                <Button type="submit" disabled={isSubmitting()}>
                  {isSubmitting() ? 'Creating...' : 'Create Event'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Show>

      {/* Events List */}
      <Show
        when={adminStore.events.length > 0}
        fallback={
          <Card>
            <CardContent class="py-12 text-center">
              <Calendar class="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
              <p class="text-[var(--text-secondary)]">No events yet</p>
              <p class="text-sm text-[var(--text-tertiary)]">Create your first event to get started</p>
            </CardContent>
          </Card>
        }
      >
        <div class="space-y-4">
          <For each={adminStore.events}>
            {(event) => (
              <Card>
                <CardContent class="p-4">
                  <div class="flex items-start justify-between">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <h3 class="font-semibold text-[var(--text-primary)]">{event.name}</h3>
                        {statusBadge(event.status)}
                      </div>
                      <p class="text-sm text-[var(--text-secondary)]">
                        {event.eventType.replace('_', ' ')} &middot; {event.multiplier}x multiplier
                      </p>
                      <Show when={event.description}>
                        <p class="text-sm text-[var(--text-tertiary)]">{event.description}</p>
                      </Show>
                      <p class="text-xs text-[var(--text-tertiary)]">
                        {new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()}
                      </p>
                    </div>
                    <div class="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggle(event)}
                      >
                        {event.isActive ? (
                          <><Pause class="w-4 h-4 mr-1" /> Pause</>
                        ) : (
                          <><Play class="w-4 h-4 mr-1" /> Activate</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(event.id)}
                      >
                        <Trash2 class="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
