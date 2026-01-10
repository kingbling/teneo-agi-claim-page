import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { DiscoveryDashboard } from './pages/DiscoveryDashboard'
import { useConfigStore } from './stores/configStore'

function App() {
  const { fetchConfig, isLoaded, error } = useConfigStore()

  // Fetch game configuration on startup
  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Show loading state while config is being fetched
  if (!isLoaded && !error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading game configuration...</div>
      </div>
    )
  }

  // Show error state if config fetch failed
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-500 text-xl">
          Failed to load game configuration: {error}
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/discovery" element={<DiscoveryDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
