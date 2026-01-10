import { useMemo } from 'react'
import { useAgentStore } from '@/stores/agentStore'

/**
 * useDashboardStats - Computes dashboard statistics from agent store
 *
 * Extracts and memoizes computed stats from the agent store to avoid
 * recalculating on every render. Used by DashboardHeader and other components.
 */
export function useDashboardStats() {
  const { userAgents, discoveryProgress, userPoints } = useAgentStore()

  return useMemo(() => {
    const discoveryPercent = discoveryProgress.total > 0
      ? ((discoveryProgress.discovered / discoveryProgress.total) * 100).toFixed(2)
      : '0'

    const activeAgents = userAgents.filter(a => a.state !== 'idle').length
    const totalAgents = userAgents.length
    const totalLoot = userAgents.reduce((sum, a) => sum + a.totalLoot, 0)
    const hasIdleAgents = userAgents.some(a => a.state === 'idle' && a.pointsBalance > 0)

    return {
      discoveryPercent,
      activeAgents,
      totalAgents,
      totalLoot,
      hasIdleAgents,
      userPoints,
    }
  }, [userAgents, discoveryProgress, userPoints])
}
