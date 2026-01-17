import { Show, onMount, createEffect, lazy, Suspense } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
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

// Admin components
import { AdminGuard } from './components/admin/AdminGuard'
import { AdminLayout } from './components/admin/AdminLayout'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

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
    <QueryClientProvider client={queryClient}>
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

          {/* Admin routes - wrapped with guard and layout */}
          <Route path="/admin" component={() => (
            <AdminGuard>
              <AdminLayout>
                <Suspense fallback={<div class="p-8">Loading...</div>}>
                  <AdminDashboard />
                </Suspense>
              </AdminLayout>
            </AdminGuard>
          )} />
          <Route path="/admin/users" component={() => (
            <AdminGuard>
              <AdminLayout>
                <Suspense fallback={<div class="p-8">Loading...</div>}>
                  <UsersPage />
                </Suspense>
              </AdminLayout>
            </AdminGuard>
          )} />
          <Route path="/admin/users/:id" component={() => (
            <AdminGuard>
              <AdminLayout>
                <Suspense fallback={<div class="p-8">Loading...</div>}>
                  <UserDetailPage />
                </Suspense>
              </AdminLayout>
            </AdminGuard>
          )} />
          <Route path="/admin/analytics" component={() => (
            <AdminGuard>
              <AdminLayout>
                <Suspense fallback={<div class="p-8">Loading...</div>}>
                  <AnalyticsPage />
                </Suspense>
              </AdminLayout>
            </AdminGuard>
          )} />
          <Route path="/admin/data" component={() => (
            <AdminGuard>
              <AdminLayout>
                <Suspense fallback={<div class="p-8">Loading...</div>}>
                  <DataPage />
                </Suspense>
              </AdminLayout>
            </AdminGuard>
          )} />
          <Route path="/admin/interventions" component={() => (
            <AdminGuard>
              <AdminLayout>
                <Suspense fallback={<div class="p-8">Loading...</div>}>
                  <InterventionsPage />
                </Suspense>
              </AdminLayout>
            </AdminGuard>
          )} />
          <Route path="/admin/events" component={() => (
            <AdminGuard>
              <AdminLayout>
                <Suspense fallback={<div class="p-8">Loading...</div>}>
                  <EventsPage />
                </Suspense>
              </AdminLayout>
            </AdminGuard>
          )} />
          <Route path="/admin/logs" component={() => (
            <AdminGuard>
              <AdminLayout>
                <Suspense fallback={<div class="p-8">Loading...</div>}>
                  <LogsPage />
                </Suspense>
              </AdminLayout>
            </AdminGuard>
          )} />
        </Router>
      </Show>
    </QueryClientProvider>
  )
}

export default App
