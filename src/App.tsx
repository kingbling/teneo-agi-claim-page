import { Show, onMount, createEffect, lazy, Suspense } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import type { RouteSectionProps } from '@solidjs/router'
import { Landing } from './pages/Landing'
import { DiscoveryDashboard } from './pages/DiscoveryDashboard'
import { configStore } from './stores/configStore'
import { authStore } from './stores/authStore'
import { userStore } from './stores/userStore'
import { shipStore } from './stores/shipStore'

// Admin pages (lazy loaded)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage'))
const UserDetailPage = lazy(() => import('./pages/admin/UserDetailPage'))
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'))
const DataPage = lazy(() => import('./pages/admin/DataPage'))
const InterventionsPage = lazy(() => import('./pages/admin/InterventionsPage'))
const EventsPage = lazy(() => import('./pages/admin/EventsPage'))
const LogsPage = lazy(() => import('./pages/admin/LogsPage'))
const SynapseTypesPage = lazy(() => import('./pages/admin/SynapseTypesPage'))
const BrainPartsPage = lazy(() => import('./pages/admin/BrainPartsPage'))
const ShipTypesPage = lazy(() => import('./pages/admin/ShipTypesPage'))

// Admin components
import { AdminGuard } from './components/admin/AdminGuard'
import { AdminLayout } from './components/admin/AdminLayout'

function AdminShell(props: RouteSectionProps) {
  return (
    <AdminGuard>
      <AdminLayout>
        <Suspense fallback={<div class="p-8">Loading...</div>}>
          {props.children}
        </Suspense>
      </AdminLayout>
    </AdminGuard>
  )
}

/**
 * Attempt auto-login with stored token and wallet address
 */
async function tryAutoLogin(walletAddress: string) {
  const isValid = await authStore.verifyToken()
  if (isValid) {
    await userStore.loginUser(walletAddress)
  }
}

function App() {
  // Track previous wallet address to detect changes
  let previousWalletAddress: string | null = null

  // Clear ship state when wallet disconnects or changes
  createEffect(() => {
    const currentAddress = authStore.walletAddress
    const isAuthenticated = authStore.isAuthenticated

    // If wallet disconnected or changed, clear ship state
    if (previousWalletAddress && (!currentAddress || currentAddress !== previousWalletAddress)) {
      shipStore.clearUserShips()
    }

    // Also clear if auth is lost
    if (!isAuthenticated && previousWalletAddress) {
      shipStore.clearUserShips()
    }

    previousWalletAddress = currentAddress
  })

  // Initialize auth and game configuration on startup
  onMount(async () => {
    // Fetch game configuration
    configStore.fetchConfig()

    // Set up callback for when wallet reconnects after init
    authStore.setOnWalletReconnected((address) => {
      tryAutoLogin(address)
    })

    // Initialize auth store (watches wallet connection, restores token)
    const { token, walletAddress } = await authStore.init()

    // Auto-login if both token and wallet are available immediately
    if (token && walletAddress) {
      await tryAutoLogin(walletAddress)
    }
  })

  return (
      <Show
        when={configStore.isLoaded}
        fallback={
          <Show
            when={configStore.error}
            fallback={
              <div class="min-h-screen bg-black flex items-center justify-center">
                <div class="text-white text-xl">Loading game configuration...</div>
              </div>
            }
          >
            <div class="min-h-screen bg-black flex items-center justify-center">
              <div class="text-red-500 text-xl">
                Failed to load game configuration: {configStore.error}
              </div>
            </div>
          </Show>
        }
      >
        <Router>
          <Route path="/" component={Landing} />
          <Route path="/discovery" component={DiscoveryDashboard} />

          {/* Admin routes - nested under shared shell so AdminGuard + AdminLayout stay mounted */}
          <Route path="/admin" component={AdminShell}>
            <Route path="/" component={AdminDashboard} />
            <Route path="/users" component={UsersPage} />
            <Route path="/users/:id" component={UserDetailPage} />
            <Route path="/analytics" component={AnalyticsPage} />
            <Route path="/data" component={DataPage} />
            <Route path="/interventions" component={InterventionsPage} />
            <Route path="/events" component={EventsPage} />
            <Route path="/synapse-types" component={SynapseTypesPage} />
            <Route path="/brain-parts" component={BrainPartsPage} />
            <Route path="/ship-types" component={ShipTypesPage} />
            <Route path="/logs" component={LogsPage} />
          </Route>
        </Router>
      </Show>
  )
}

export default App
/* Force reload: 1770028275 */
