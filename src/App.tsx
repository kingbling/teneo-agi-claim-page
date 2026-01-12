import { createEffect, Show, onMount } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { Landing } from './pages/Landing'
import { DiscoveryDashboard } from './pages/DiscoveryDashboard'
import { configStore } from './stores/configStore'

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

function App() {
  // Fetch game configuration on startup
  onMount(() => {
    configStore.fetchConfig()
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
