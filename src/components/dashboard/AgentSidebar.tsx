import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { Plus, Rocket, Fuel } from 'lucide-react'
import { useAgentStore } from '@/stores/agentStore'
import { CreateAgentDialog } from '@/components/agents/CreateAgentDialog'
import { AgentListItem } from './AgentListItem'
import { Progress } from '@/components/ui/progress'
import type { AgentTrait } from '@/types/agent'

interface AgentSidebarProps {
  onFocusAgent?: (x: number, y: number, z: number) => void
}

export function AgentSidebar({ onFocusAgent: _onFocusAgent }: AgentSidebarProps) {
  const {
    userAgents,
    userPoints,
    selectedAgentId,
    discoveryProgress,
    deployingAgentIds,
    selectAgent,
    createAgent,
    refuelAgent,
    deployRandomly,
  } = useAgentStore()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isBatchDeploying, setIsBatchDeploying] = useState(false)
  const [isRefuelingAll, setIsRefuelingAll] = useState(false)

  // Agents ready to deploy
  const idleAgentsWithFuel = useMemo(
    () => userAgents.filter(a => a.state === 'idle' && a.pointsBalance > 0),
    [userAgents]
  )

  // Agents needing fuel
  const agentsNeedingFuel = useMemo(
    () => userAgents.filter(a => a.pointsBalance < 100),
    [userAgents]
  )

  const discoveryPercent = discoveryProgress.total > 0
    ? (discoveryProgress.discovered / discoveryProgress.total) * 100
    : 0

  const handleCreateAgent = async (name: string, traits: AgentTrait[]) => {
    const agent = await createAgent(name, traits)
    if (agent && agent.pointsBalance > 0) {
      await deployRandomly(agent.id)
    }
  }

  const handleBatchDeploy = async () => {
    if (isBatchDeploying || idleAgentsWithFuel.length === 0) return
    setIsBatchDeploying(true)
    await Promise.all(idleAgentsWithFuel.map(agent => deployRandomly(agent.id)))
    setIsBatchDeploying(false)
  }

  const handleRefuelAll = async () => {
    if (isRefuelingAll || agentsNeedingFuel.length === 0 || userPoints < 100) return
    setIsRefuelingAll(true)
    const perAgent = Math.min(500, Math.floor(userPoints / agentsNeedingFuel.length))
    if (perAgent > 0) {
      await Promise.all(agentsNeedingFuel.map(agent => refuelAgent(agent.id, perAgent)))
    }
    setIsRefuelingAll(false)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--card-border)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Points</span>
          <span className="text-lg font-bold text-[var(--brand-teal-1)] tabular-nums">
            {userPoints.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--text-muted)]">Network</span>
          <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
            {discoveryPercent.toFixed(2)}%
          </span>
        </div>
        <Progress value={discoveryPercent} className="h-1" />
      </div>

      {/* Create Agent Button */}
      <div className="p-4 border-b border-[var(--card-border)]">
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--brand-teal-1)] text-white font-medium text-sm hover:bg-[var(--brand-teal-1)]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Agent
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Agents
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {userAgents.length}
            </span>
          </div>

          {userAgents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-muted)] mb-2">No agents yet</p>
              <p className="text-xs text-[var(--text-muted)]">
                Create an agent to start exploring
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {userAgents.map(agent => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgentId === agent.id}
                  isDeploying={deployingAgentIds.has(agent.id)}
                  userPoints={userPoints}
                  onSelect={() => selectAgent(selectedAgentId === agent.id ? null : agent.id)}
                  onDeploy={() => deployRandomly(agent.id)}
                  onRefuel={(amount) => refuelAgent(agent.id, amount)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {(idleAgentsWithFuel.length > 0 || (agentsNeedingFuel.length > 0 && userPoints >= 100)) && (
        <div className="p-4 border-t border-[var(--card-border)] space-y-2">
          {idleAgentsWithFuel.length > 0 && (
            <button
              onClick={handleBatchDeploy}
              disabled={isBatchDeploying}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--card-border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--background-primary)] disabled:opacity-50 transition-colors"
            >
              <Rocket className="w-3.5 h-3.5" />
              {isBatchDeploying ? 'Deploying...' : `Deploy All (${idleAgentsWithFuel.length})`}
            </button>
          )}
          {agentsNeedingFuel.length > 0 && userPoints >= 100 && (
            <button
              onClick={handleRefuelAll}
              disabled={isRefuelingAll}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--card-border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--background-primary)] disabled:opacity-50 transition-colors"
            >
              <Fuel className="w-3.5 h-3.5" />
              {isRefuelingAll ? 'Refueling...' : `Refuel All (${agentsNeedingFuel.length})`}
            </button>
          )}
        </div>
      )}

      {/* Create Agent Dialog */}
      {createPortal(
        <AnimatePresence>
          {isCreateDialogOpen && (
            <CreateAgentDialog
              isOpen={isCreateDialogOpen}
              onClose={() => setIsCreateDialogOpen(false)}
              onCreate={handleCreateAgent}
              userPoints={userPoints}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
