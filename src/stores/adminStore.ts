/**
 * Admin Store
 *
 * Manages admin-specific state and API calls for the admin interface.
 */

import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'
import { authStore } from './authStore'
import { API_URL } from '@/constants/api'

// Types
export interface AdminUser {
  id: string
  wallet: string
  tier: string
  userLevel: number
  usdcSpent: number
  points: number
  agenticBalance: number
  totalAgiEarned: number
  totalTeneoEarned: number
  maxShips: number
  isAdmin: boolean
  bannedAt: number | null
  banReason: string | null
  createdAt: number
}

export interface AdminAnalytics {
  users: {
    total: number
    new24h: number
    new7d: number
    active24h: number
    active7d: number
    banned: number
  }
  spaces: {
    total: number
    discovered: number
    inProgress: number
    discoveryRate: string
  }
  ships: {
    total: number
    idle: number
    deployed: number
  }
}

export interface AdminSpace {
  id: string
  state: string
  synapseType: string
  position: { x: number; y: number; z: number }
  pointsRequired: number
  pointsAccumulated: number
  progress: string
  agiReward: number
  discoveredAt: number | null
}

export interface AdminAgent {
  id: string
  ownerId: string
  name: string
  state: string
  position: { x: number; y: number; z: number }
  currentSpaceId: string | null
  targetSpaceId: string | null
  autopilotEnabled: boolean
  spacesDiscovered: number
  totalAgiEarned: number
  createdAt: number
  deployedAt: number | null
}

export interface AdminEvent {
  id: string
  name: string
  description: string | null
  eventType: string
  multiplier: number
  isActive: boolean
  startTime: number
  endTime: number
  createdAt: number
  status: string
}

export interface AdminSynapseType {
  id: string
  name: string
  displayName: string
  colorR: number
  colorG: number
  colorB: number
  etaMinutesMin: number
  etaMinutesMax: number
  maxPointsPerMin: number
  agiRewardMin: number
  agiRewardMax: number
  modelFilename: string | null
  sortOrder: number
  synapseCount: number
  totalAgi: number
  createdAt: number
  updatedAt: number
}

export interface AdminBrainPart {
  id: string
  name: string
  displayName: string
  description: string
  centerX: number
  centerY: number
  centerZ: number
  radius: number
  colorR: number
  colorG: number
  colorB: number
  isEnabled: boolean
  sortOrder: number
  synapseCount: number
  createdAt: number
  updatedAt: number
}

export interface AdminShipType {
  id: string
  name: string
  displayName: string
  description: string
  creationCost: number
  speedMultiplier: number
  solveSpeedMultiplier: number
  fuelCapacity: number
  detectionRadius: number
  modelFilename: string | null
  isActive: boolean
  sortOrder: number
  agentCount: number
  createdAt: number
  updatedAt: number
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AdminState {
  isAdmin: boolean
  isLoadingUsers: boolean
  isLoadingAnalytics: boolean
  isLoadingSpaces: boolean
  isLoadingAgents: boolean
  isLoadingEvents: boolean
  error: string | null

  // Users
  users: AdminUser[]
  usersPagination: Pagination
  selectedUser: AdminUser | null

  // Analytics
  analytics: AdminAnalytics | null

  // Spaces
  spaces: AdminSpace[]
  spacesPagination: Pagination

  // Agents
  agents: AdminAgent[]
  agentsPagination: Pagination

  // Events
  events: AdminEvent[]

  // Brain Parts
  brainParts: AdminBrainPart[]
  isLoadingBrainParts: boolean

  // Synapse Types
  synapseTypes: AdminSynapseType[]
  isLoadingSynapseTypes: boolean

  // Ship Types
  shipTypes: AdminShipType[]
  isLoadingShipTypes: boolean
}

const initialState: AdminState = {
  isAdmin: false,
  isLoadingUsers: false,
  isLoadingAnalytics: false,
  isLoadingSpaces: false,
  isLoadingAgents: false,
  isLoadingEvents: false,
  isLoadingBrainParts: false,
  isLoadingSynapseTypes: false,
  error: null,

  users: [],
  usersPagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
  selectedUser: null,

  analytics: null,

  spaces: [],
  spacesPagination: { page: 1, limit: 50, total: 0, totalPages: 0 },

  agents: [],
  agentsPagination: { page: 1, limit: 50, total: 0, totalPages: 0 },

  events: [],

  brainParts: [],

  synapseTypes: [],

  shipTypes: [],
  isLoadingShipTypes: false,
}

function createAdminStore() {
  const [state, setState] = createStore<AdminState>({ ...initialState })

  // Helper for API calls
  async function apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string }> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...authStore.getAuthHeader(),
          ...options.headers,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { error: errorData.error || `HTTP ${response.status}` }
      }

      const data = await response.json()
      return { data }
    } catch (err) {
      return { error: (err as Error).message || 'Network error' }
    }
  }

  // Admin access check (cached — reset() clears it)
  async function checkAdminAccess(): Promise<boolean> {
    if (state.isAdmin) return true
    const { data, error } = await apiCall<{ isAdmin: boolean }>('/api/admin/check')
    const isAdmin = !error && data?.isAdmin === true
    setState({ isAdmin })
    return isAdmin
  }

  // Users
  async function fetchUsers(params: {
    page?: number
    limit?: number
    search?: string
    filter?: string
    sortBy?: string
    sortOrder?: string
  } = {}): Promise<void> {
    setState({ isLoadingUsers: true, error: null })

    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.filter) query.set('filter', params.filter)
    if (params.sortBy) query.set('sortBy', params.sortBy)
    if (params.sortOrder) query.set('sortOrder', params.sortOrder)

    const { data, error } = await apiCall<{ users: AdminUser[]; pagination: Pagination }>(
      `/api/admin/users?${query.toString()}`
    )

    if (error) {
      setState({ isLoadingUsers: false, error })
    } else if (data) {
      setState({
        users: data.users,
        usersPagination: data.pagination,
        isLoadingUsers: false,
      })
    }
  }

  async function fetchUser(userId: string): Promise<AdminUser | null> {
    const { data, error } = await apiCall<{ user: AdminUser }>(`/api/admin/users/${userId}`)
    if (error || !data) return null
    setState({ selectedUser: data.user })
    return data.user
  }

  async function updateUser(
    userId: string,
    updates: Partial<{ points: number; agenticBalance: number; userLevel: number; maxShips: number; tier: string }>
  ): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return !error
  }

  async function banUser(userId: string, reason?: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    return !error
  }

  async function unbanUser(userId: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/users/${userId}/unban`, {
      method: 'POST',
    })
    return !error
  }

  async function grantTokens(
    userId: string,
    tokenType: 'points' | 'agi' | 'agentic' | 'teneo',
    amount: number
  ): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/users/${userId}/grant`, {
      method: 'POST',
      body: JSON.stringify({ tokenType, amount }),
    })
    return !error
  }

  // Analytics
  async function fetchAnalytics(): Promise<void> {
    setState({ isLoadingAnalytics: true, error: null })

    const { data, error } = await apiCall<AdminAnalytics>('/api/admin/analytics/overview')

    if (error) {
      setState({ isLoadingAnalytics: false, error })
    } else if (data) {
      setState({ analytics: data, isLoadingAnalytics: false })
    }
  }

  // Spaces
  async function fetchSpaces(params: {
    page?: number
    limit?: number
    search?: string
    state?: string
    synapseType?: string
    sortBy?: string
    sortOrder?: string
  } = {}): Promise<void> {
    setState({ isLoadingSpaces: true, error: null })

    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.state) query.set('state', params.state)
    if (params.synapseType) query.set('synapseType', params.synapseType)
    if (params.sortBy) query.set('sortBy', params.sortBy)
    if (params.sortOrder) query.set('sortOrder', params.sortOrder)

    const { data, error } = await apiCall<{ spaces: AdminSpace[]; pagination: Pagination }>(
      `/api/admin/spaces?${query.toString()}`
    )

    if (error) {
      setState({ isLoadingSpaces: false, error })
    } else if (data) {
      setState({
        spaces: data.spaces,
        spacesPagination: data.pagination,
        isLoadingSpaces: false,
      })
    }
  }

  // Agents
  async function fetchAgents(params: {
    page?: number
    limit?: number
    search?: string
    state?: string
    ownerId?: string
    sortBy?: string
    sortOrder?: string
  } = {}): Promise<void> {
    setState({ isLoadingAgents: true, error: null })

    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.state) query.set('state', params.state)
    if (params.ownerId) query.set('ownerId', params.ownerId)
    if (params.sortBy) query.set('sortBy', params.sortBy)
    if (params.sortOrder) query.set('sortOrder', params.sortOrder)

    const { data, error } = await apiCall<{ agents: AdminAgent[]; pagination: Pagination }>(
      `/api/admin/agents?${query.toString()}`
    )

    if (error) {
      setState({ isLoadingAgents: false, error })
    } else if (data) {
      setState({
        agents: data.agents,
        agentsPagination: data.pagination,
        isLoadingAgents: false,
      })
    }
  }

  // Interventions
  async function resetShip(shipId: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/interventions/reset-ship/${shipId}`, {
      method: 'POST',
    })
    return !error
  }

  async function completeSynapse(synapseId: string, distributeRewards = true): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/interventions/complete-synapse/${synapseId}`, {
      method: 'POST',
      body: JSON.stringify({ distributeRewards }),
    })
    return !error
  }


  // Events
  async function fetchEvents(includeExpired = false): Promise<void> {
    setState({ isLoadingEvents: true, error: null })

    const query = includeExpired ? '?includeExpired=true' : ''
    const { data, error } = await apiCall<{ events: AdminEvent[] }>(`/api/admin/events${query}`)

    if (error) {
      setState({ isLoadingEvents: false, error })
    } else if (data) {
      setState({ events: data.events, isLoadingEvents: false })
    }
  }

  async function createEvent(event: {
    name: string
    description?: string
    eventType: string
    multiplier: number
    startTime: number
    endTime: number
    isActive?: boolean
  }): Promise<boolean> {
    const { error } = await apiCall('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(event),
    })
    return !error
  }

  async function deleteEvent(eventId: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/events/${eventId}`, {
      method: 'DELETE',
    })
    return !error
  }

  async function activateEvent(eventId: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/events/${eventId}/activate`, {
      method: 'POST',
    })
    return !error
  }

  async function deactivateEvent(eventId: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/events/${eventId}/deactivate`, {
      method: 'POST',
    })
    return !error
  }

  // Synapse Types
  async function fetchSynapseTypes(): Promise<void> {
    setState({ isLoadingSynapseTypes: true, error: null })
    const { data, error } = await apiCall<{ synapseTypes: AdminSynapseType[] }>('/api/admin/synapse-types')
    if (error) {
      setState({ isLoadingSynapseTypes: false, error })
    } else if (data) {
      setState({ synapseTypes: data.synapseTypes, isLoadingSynapseTypes: false })
    }
  }

  async function createSynapseType(st: {
    name: string
    displayName: string
    colorR: number
    colorG: number
    colorB: number
    etaMinutesMin: number
    etaMinutesMax: number
    maxPointsPerMin: number
    agiRewardMin: number
    agiRewardMax: number
    sortOrder: number
  }): Promise<boolean> {
    const { error } = await apiCall('/api/admin/synapse-types', {
      method: 'POST',
      body: JSON.stringify(st),
    })
    return !error
  }

  async function updateSynapseType(id: string, updates: Record<string, unknown>): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/synapse-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return !error
  }

  async function deleteSynapseType(id: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/synapse-types/${id}`, {
      method: 'DELETE',
    })
    return !error
  }

  async function uploadSynapseTypeModel(typeId: string, file: File): Promise<boolean> {
    const formData = new FormData()
    formData.append('model', file)
    try {
      const response = await fetch(`${API_URL}/api/admin/synapse-types/${typeId}/model`, {
        method: 'POST',
        headers: authStore.getAuthHeader(),
        body: formData,
      })
      return response.ok
    } catch {
      return false
    }
  }

  async function wipeSynapses(): Promise<boolean> {
    const { error } = await apiCall('/api/admin/brain-parts/wipe', { method: 'POST' })
    return !error
  }

  // Brain Parts
  async function fetchBrainParts(): Promise<void> {
    setState({ isLoadingBrainParts: true, error: null })
    const { data, error } = await apiCall<{ brainParts: AdminBrainPart[] }>('/api/admin/brain-parts')
    if (error) {
      setState({ isLoadingBrainParts: false, error })
    } else if (data) {
      setState({ brainParts: data.brainParts, isLoadingBrainParts: false })
    }
  }

  async function createBrainPart(bp: {
    name: string
    displayName: string
    description: string
    centerX: number
    centerY: number
    centerZ: number
    radius: number
    colorR: number
    colorG: number
    colorB: number
    isEnabled?: boolean
    sortOrder: number
  }): Promise<boolean> {
    const { error } = await apiCall('/api/admin/brain-parts', {
      method: 'POST',
      body: JSON.stringify(bp),
    })
    return !error
  }

  async function updateBrainPart(id: string, updates: Record<string, unknown>): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/brain-parts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return !error
  }

  async function deleteBrainPart(id: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/brain-parts/${id}`, {
      method: 'DELETE',
    })
    return !error
  }

  async function toggleBrainPart(id: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/brain-parts/${id}/toggle`, {
      method: 'POST',
    })
    return !error
  }

  async function generateSynapsesForBrainPart(
    brainPartId: string,
    synapseTypeId: string,
    count: number
  ): Promise<{ generated?: number; error?: string }> {
    const { data, error } = await apiCall<{ generated: number; totalForPart: number }>(
      `/api/admin/brain-parts/${brainPartId}/generate`,
      { method: 'POST', body: JSON.stringify({ synapseTypeId, count }) }
    )
    if (error) return { error }
    return { generated: data?.generated }
  }

  // Ship Types
  async function fetchShipTypes(): Promise<void> {
    setState({ isLoadingShipTypes: true, error: null })
    const { data, error } = await apiCall<{ shipTypes: AdminShipType[] }>('/api/admin/ship-types')
    if (error) {
      setState({ isLoadingShipTypes: false, error })
    } else if (data) {
      setState({ shipTypes: data.shipTypes, isLoadingShipTypes: false })
    }
  }

  async function createShipType(st: {
    name: string
    displayName: string
    description: string
    creationCost: number
    speedMultiplier: number
    solveSpeedMultiplier: number
    fuelCapacity: number
    detectionRadius: number
    isActive?: boolean
    sortOrder: number
  }): Promise<boolean> {
    const { error } = await apiCall('/api/admin/ship-types', {
      method: 'POST',
      body: JSON.stringify(st),
    })
    return !error
  }

  async function updateShipType(id: string, updates: Record<string, unknown>): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/ship-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return !error
  }

  async function deleteShipType(id: string): Promise<boolean> {
    const { error } = await apiCall(`/api/admin/ship-types/${id}`, {
      method: 'DELETE',
    })
    return !error
  }

  async function uploadShipTypeModel(typeId: string, file: File): Promise<boolean> {
    const formData = new FormData()
    formData.append('model', file)
    try {
      const response = await fetch(`${API_URL}/api/admin/ship-types/${typeId}/model`, {
        method: 'POST',
        headers: authStore.getAuthHeader(),
        body: formData,
      })
      return response.ok
    } catch {
      return false
    }
  }

  // Reset store
  function reset() {
    setState({ ...initialState })
  }

  return {
    // State (reactive getters)
    get isAdmin() { return state.isAdmin },
    get isLoadingUsers() { return state.isLoadingUsers },
    get isLoadingAnalytics() { return state.isLoadingAnalytics },
    get isLoadingSpaces() { return state.isLoadingSpaces },
    get isLoadingAgents() { return state.isLoadingAgents },
    get isLoadingEvents() { return state.isLoadingEvents },
    get error() { return state.error },

    get users() { return state.users },
    get usersPagination() { return state.usersPagination },
    get selectedUser() { return state.selectedUser },

    get analytics() { return state.analytics },

    get spaces() { return state.spaces },
    get spacesPagination() { return state.spacesPagination },

    get agents() { return state.agents },
    get agentsPagination() { return state.agentsPagination },

    get events() { return state.events },

    get brainParts() { return state.brainParts },
    get isLoadingBrainParts() { return state.isLoadingBrainParts },

    get synapseTypes() { return state.synapseTypes },
    get isLoadingSynapseTypes() { return state.isLoadingSynapseTypes },

    get shipTypes() { return state.shipTypes },
    get isLoadingShipTypes() { return state.isLoadingShipTypes },

    // Actions
    checkAdminAccess,
    reset,

    // Users
    fetchUsers,
    fetchUser,
    updateUser,
    banUser,
    unbanUser,
    grantTokens,

    // Analytics
    fetchAnalytics,

    // Spaces
    fetchSpaces,

    // Agents
    fetchAgents,

    // Interventions
    resetShip,
    completeSynapse,

    // Events
    fetchEvents,
    createEvent,
    deleteEvent,
    activateEvent,
    deactivateEvent,

    // Brain Parts
    fetchBrainParts,
    createBrainPart,
    updateBrainPart,
    deleteBrainPart,
    toggleBrainPart,
    generateSynapsesForBrainPart,
    wipeSynapses,

    // Synapse Types
    fetchSynapseTypes,
    createSynapseType,
    updateSynapseType,
    deleteSynapseType,
    uploadSynapseTypeModel,

    // Ship Types
    fetchShipTypes,
    createShipType,
    updateShipType,
    deleteShipType,
    uploadShipTypeModel,
  }
}

export const adminStore = createRoot(createAdminStore)
