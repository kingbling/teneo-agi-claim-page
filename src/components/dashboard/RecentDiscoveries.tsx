import { Card, CardContent } from '@/components/ui/card'
import { NoDiscoveriesEmpty } from '@/components/ui/EmptyState'
import type { SpaceDiscoveryEvent } from '@/types/agent'

export interface RecentDiscoveriesProps {
  discoveries: SpaceDiscoveryEvent[]
  showAll: boolean
  onToggleShowAll: () => void
  onDiscoveryClick: (discovery: SpaceDiscoveryEvent) => void
}

/**
 * RecentDiscoveries - List of recent space discoveries
 */
export function RecentDiscoveries({
  discoveries,
  showAll,
  onToggleShowAll,
  onDiscoveryClick,
}: RecentDiscoveriesProps) {
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">
        Recent Discoveries
      </h3>
      {discoveries.length === 0 ? (
        <NoDiscoveriesEmpty />
      ) : (
        <div className="space-y-3">
          {discoveries.slice(0, showAll ? undefined : 5).map((discovery) => {
            const totalLoot = discovery.lootDistribution.reduce((sum, d) => sum + d.amount, 0)
            return (
              <Card
                key={`${discovery.spaceId}-${discovery.timestamp}`}
                className="p-4 border-[var(--card-border)] hover:border-[var(--brand-teal-1)]/50 cursor-pointer transition-colors"
                onClick={() => onDiscoveryClick(discovery)}
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary)] font-mono">
                      {discovery.spaceId.slice(0, 12)}...
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(discovery.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">
                      {discovery.discoveredBy.length} discoverer{discovery.discoveredBy.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-sm font-bold text-[var(--brand-teal-1)]">
                      +{totalLoot} AGI
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {discoveries.length > 5 && (
            <button
              onClick={onToggleShowAll}
              className="w-full text-center text-sm text-[var(--brand-teal-1)] hover:underline"
            >
              {showAll ? 'Show less' : 'Show all'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
