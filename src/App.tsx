import { Show, onMount } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { Landing } from './pages/Landing'
import { DiscoveryDashboard } from './pages/DiscoveryDashboard'
import { configStore } from './stores/configStore'
import { authStore } from './stores/authStore'
import { userStore } from './stores/userStore'

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
        </Router>
      </Show>
    </QueryClientProvider>
  )
}

export default App
