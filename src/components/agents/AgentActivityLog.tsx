import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Search, Navigation, Sparkles, Home, Fuel, Wrench, AlertTriangle, Trophy } from 'lucide-react'
import type { Agent, AgentState } from '@/types/agent'

interface ActivityEvent {
  id: string
  agentId: string
  agentName: string
  type: 'state_change' | 'discovery' | 'fuel_low' | 'deployed' | 'exhausted' | 'repaired' | 'milestone'
  message: string
  timestamp: number
  color: string
  icon: typeof Activity
}

interface AgentActivityLogProps {
  agents: Agent[]
  maxEvents?: number
}

const STATE_MESSAGES: Record<AgentState, string> = {
  idle: 'is now idle',
  solving: 'is solving a space',
  deploying: 'is deploying to target region',
  wandering: 'is wandering and exploring',
  limping_home: 'is low on fuel, limping home',
  exhausted: 'has exhausted fuel and needs repair',
}

const STATE_COLORS: Record<AgentState, string> = {
  idle: 'text-[var(--state-idle)]',
  solving: 'text-[var(--state-solving)]',
  deploying: 'text-[var(--tier-trait)]',
  wandering: 'text-[var(--tier-team)]',
  limping_home: 'text-[var(--state-limping)]',
  exhausted: 'text-[var(--state-exhausted)]',
}

const STATE_ICONS: Record<AgentState, typeof Activity> = {
  idle: Home,
  solving: Sparkles,
  deploying: Navigation,
  wandering: Search,
  limping_home: Home,
  exhausted: Home,
}

export function AgentActivityLog({ agents, maxEvents = 20 }: AgentActivityLogProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const prevAgentsRef = useRef<Map<string, Agent>>(new Map())

  // Track agent state changes
  useEffect(() => {
    const prevAgents = prevAgentsRef.current
    const newEvents: ActivityEvent[] = []

    agents.forEach((agent) => {
      const prevAgent = prevAgents.get(agent.id)

      if (prevAgent) {
        // State changed
        if (prevAgent.state !== agent.state) {
          newEvents.push({
            id: `${agent.id}-${Date.now()}-state`,
            agentId: agent.id,
            agentName: agent.name,
            type: 'state_change',
            message: STATE_MESSAGES[agent.state],
            timestamp: Date.now(),
            color: STATE_COLORS[agent.state],
            icon: STATE_ICONS[agent.state],
          })
        }

        // Discovery happened (spacesDiscovered increased)
        if (agent.spacesDiscovered > prevAgent.spacesDiscovered) {
          const discovered = agent.spacesDiscovered - prevAgent.spacesDiscovered
          newEvents.push({
            id: `${agent.id}-${Date.now()}-discovery`,
            agentId: agent.id,
            agentName: agent.name,
            type: 'discovery',
            message: `discovered ${discovered} space${discovered > 1 ? 's' : ''}!`,
            timestamp: Date.now(),
            color: 'text-[var(--state-solving)]',
            icon: Sparkles,
          })
        }

        // Fuel low warning
        if (prevAgent.pointsBalance >= 100 && agent.pointsBalance < 100 && agent.state !== 'idle') {
          newEvents.push({
            id: `${agent.id}-${Date.now()}-fuel`,
            agentId: agent.id,
            agentName: agent.name,
            type: 'fuel_low',
            message: 'fuel critically low!',
            timestamp: Date.now(),
            color: 'text-[var(--state-exhausted)]',
            icon: Fuel,
          })
        }

        // Exhausted (needsRepair became true)
        if (!prevAgent.needsRepair && agent.needsRepair) {
          newEvents.push({
            id: `${agent.id}-${Date.now()}-exhausted`,
            agentId: agent.id,
            agentName: agent.name,
            type: 'exhausted',
            message: 'exhausted and needs repair!',
            timestamp: Date.now(),
            color: 'text-[var(--state-exhausted)]',
            icon: AlertTriangle,
          })
        }

        // Repaired (needsRepair became false)
        if (prevAgent.needsRepair && !agent.needsRepair) {
          newEvents.push({
            id: `${agent.id}-${Date.now()}-repaired`,
            agentId: agent.id,
            agentName: agent.name,
            type: 'repaired',
            message: 'was repaired and ready to deploy!',
            timestamp: Date.now(),
            color: 'text-[var(--brand-green-4)]',
            icon: Wrench,
          })
        }

        // Milestones (discovery count thresholds)
        const milestones = [5, 10, 25, 50, 100, 250, 500, 1000]
        for (const milestone of milestones) {
          if (prevAgent.spacesDiscovered < milestone && agent.spacesDiscovered >= milestone) {
            newEvents.push({
              id: `${agent.id}-${Date.now()}-milestone-${milestone}`,
              agentId: agent.id,
              agentName: agent.name,
              type: 'milestone',
              message: `reached ${milestone} discoveries!`,
              timestamp: Date.now(),
              color: 'text-[var(--tier-legendary)]',
              icon: Trophy,
            })
            break // Only one milestone event per update
          }
        }
      } else {
        // New agent - was deployed
        if (agent.state !== 'idle') {
          newEvents.push({
            id: `${agent.id}-${Date.now()}-deployed`,
            agentId: agent.id,
            agentName: agent.name,
            type: 'deployed',
            message: 'was deployed',
            timestamp: Date.now(),
            color: 'text-[var(--brand-teal-1)]',
            icon: Navigation,
          })
        }
      }
    })

    // Update prev agents map
    const newPrevAgents = new Map<string, Agent>()
    agents.forEach((agent) => newPrevAgents.set(agent.id, { ...agent }))
    prevAgentsRef.current = newPrevAgents

    // Add new events
    if (newEvents.length > 0) {
      setEvents((prev) => [...newEvents, ...prev].slice(0, maxEvents))
    }
  }, [agents, maxEvents])

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    return `${Math.floor(minutes / 60)}h ago`
  }

  // Calculate session stats
  const sessionStats = {
    discoveries: events.filter(e => e.type === 'discovery').length,
    milestones: events.filter(e => e.type === 'milestone').length,
    deploys: events.filter(e => e.type === 'deployed').length,
    repairs: events.filter(e => e.type === 'repaired').length,
    exhausted: events.filter(e => e.type === 'exhausted').length,
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-10)', paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)' }}>
        <div className="relative" style={{ width: 'var(--space-16)', height: 'var(--space-16)', marginBottom: 'var(--space-5)' }}>
          {/* Animated rings */}
          <div className="absolute inset-0 rounded-full border border-[var(--tier-trait)]/20 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute rounded-full border border-[var(--tier-trait)]/15 animate-ping" style={{ inset: 'var(--space-2)', animationDuration: '3s', animationDelay: '0.5s' }} />
          {/* Core icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-[var(--tier-trait)]/10 to-[var(--tier-mythic)]/10 border border-[var(--tier-trait)]/20" style={{ width: 'var(--space-12)', height: 'var(--space-12)' }}>
              <Activity className="text-[var(--tier-trait)]/60" style={{ height: 'var(--space-6)', width: 'var(--space-6)' }} />
            </div>
          </div>
        </div>
        <p className="text-base font-medium text-[var(--text-secondary)]" style={{ marginBottom: 'var(--space-2)' }}>No activity yet</p>
        <p className="text-sm text-[var(--text-muted)] text-center" style={{ maxWidth: 'var(--content-max-sm)' }}>Deploy agents to see their exploration activity here</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Session Stats Summary */}
      {(sessionStats.discoveries > 0 || sessionStats.milestones > 0) && (
        <div className="flex items-center rounded-xl bg-gradient-to-r from-[var(--state-solving)]/10 to-transparent border border-[var(--state-solving)]/20" style={{ gap: 'var(--space-4)', paddingLeft: 'var(--space-5)', paddingRight: 'var(--space-5)', paddingTop: 'var(--padding-card-sm)', paddingBottom: 'var(--padding-card-sm)' }}>
          <div className="rounded-lg bg-[var(--state-solving)]/10" style={{ padding: 'var(--space-2)' }}>
            <Sparkles className="text-[var(--state-solving)]" style={{ height: 'var(--space-4)', width: 'var(--space-4)' }} />
          </div>
          <div className="flex flex-wrap items-center text-xs" style={{ gap: 'var(--space-4) var(--space-2)' }}>
            {sessionStats.discoveries > 0 && (
              <span className="text-[var(--state-solving)] font-semibold flex items-center" style={{ gap: 'var(--space-2)' }}>
                <span className="rounded-full bg-[var(--state-solving)]" style={{ width: 'var(--space-2)', height: 'var(--space-2)' }} />
                {sessionStats.discoveries} discovery{sessionStats.discoveries > 1 ? 'ies' : 'y'}
              </span>
            )}
            {sessionStats.milestones > 0 && (
              <span className="text-[var(--tier-legendary)] font-semibold flex items-center" style={{ gap: 'var(--space-2)' }}>
                <span className="rounded-full bg-[var(--tier-legendary)]" style={{ width: 'var(--space-2)', height: 'var(--space-2)' }} />
                {sessionStats.milestones} milestone{sessionStats.milestones > 1 ? 's' : ''}
              </span>
            )}
            {sessionStats.deploys > 0 && (
              <span className="text-[var(--brand-teal-1)] font-semibold flex items-center" style={{ gap: 'var(--space-2)' }}>
                <span className="rounded-full bg-[var(--brand-teal-1)]" style={{ width: 'var(--space-2)', height: 'var(--space-2)' }} />
                {sessionStats.deploys} deploy{sessionStats.deploys > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <span className="ml-auto text-xs text-[var(--text-muted)] font-medium whitespace-nowrap">
            This session
          </span>
        </div>
      )}

      {/* Events List */}
      <div className="max-h-60 overflow-y-auto scrollbar-thin" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingRight: 'var(--space-1)' }}>
        <AnimatePresence initial={false}>
          {events.map((event) => {
            const Icon = event.icon
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.2 }}
                className="group flex items-start rounded-xl bg-[var(--background-primary)]/50 hover:bg-[var(--background-primary)] transition-all duration-200 border border-transparent hover:border-[var(--card-border)]/50"
                style={{ gap: 'var(--space-4)', paddingLeft: 'var(--space-5)', paddingRight: 'var(--space-5)', paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)' }}
              >
                {/* Icon with background */}
                <div className={`rounded-lg ${event.color.replace('text-', 'bg-').replace('400', '500/10')} shrink-0`} style={{ padding: 'var(--space-2)' }}>
                  <Icon className={event.color} style={{ height: 'var(--space-4)', width: 'var(--space-4)' }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">
                    <span className="font-semibold text-[var(--text-primary)]">{event.agentName}</span>
                    {' '}
                    <span className={event.color}>{event.message}</span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)]" style={{ marginTop: 'var(--space-2)' }}>{formatTime(event.timestamp)}</p>
                </div>

                {/* Pulse indicator for recent events */}
                {Date.now() - event.timestamp < 3000 && (
                  <motion.div
                    className={`rounded-full ${event.color.replace('text-', 'bg-')} shrink-0`}
                    style={{ width: 'var(--space-3)', height: 'var(--space-3)', marginTop: 'var(--space-1)' }}
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
