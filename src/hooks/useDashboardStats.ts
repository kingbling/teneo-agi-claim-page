import { createMemo } from 'solid-js'
import { shipStore } from '@/stores/shipStore'
import { userStore } from '@/stores/userStore'

/**
 * useDashboardStats - Computes dashboard statistics from stores
 *
 * Masterplan 2026: Updated to use shipStore and userStore
 * Extracts and memoizes computed stats to avoid
 * recalculating on every render. Used by DashboardHeader and other components.
 */
export function useDashboardStats() {
  const stats = createMemo(() => {
    // Safeguard: ensure userShips is always an array
    const ships = Array.isArray(shipStore.userShips) ? shipStore.userShips : []
    const discoveryProgress = shipStore.discoveryProgress

    const discoveryPercent = discoveryProgress.total > 0
      ? ((discoveryProgress.discovered / discoveryProgress.total) * 100).toFixed(2)
      : '0'

    const activeShips = ships.filter(s => s.state !== 'idle').length
    const totalShips = ships.length
    const totalLoot = ships.reduce((sum, s) => sum + s.totalAgiEarned, 0)
    const hasIdleShips = ships.some(s => s.state === 'idle')

    return {
      discoveryPercent,
      activeShips,
      totalShips,
      totalLoot,
      hasIdleShips,
      userPoints: userStore.userPoints,
      totalAgiEarned: userStore.totalAgiEarned,
      // Backwards compatibility aliases
      activeAgents: activeShips,
      totalAgents: totalShips,
      hasIdleAgents: hasIdleShips,
    }
  })

  return stats
}
