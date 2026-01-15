import 'dotenv/config'

// Install log capture BEFORE any other imports that might log
import { installLogCapture, onLogEntry } from './utils/logCapture.js'
installLogCapture()

import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { v4 as uuid } from 'uuid'

import { initializeDatabase, ensureDatabaseSeeded, db } from './db/index.js'
import {
  getAgent,
  getAgentsByOwner,
  createAgent,
  updateAgent,
  getSpace,
  getUser,
  getUserByWallet,
  createUser,
  updateUser,
  getAgentClusters,
  getSpaceClusters,
  getDiscoveryStats,
  getAgentCount,
} from './db/index.js'
import {
  startSimulation,
  stopSimulation,
  deployAgentToSearch,
  recallAgent,
  onSpaceDiscovered,
  onLootDistributed,
  onAgentsUpdated,
  getTickCount,
  isSimulationRunning,
  // Masterplan 2026: Synapse Exploration
  joinSynapseExploration,
  leaveSynapseExploration,
  updateExplorationRate,
  onSynapseCompleted,
  onExplorationProgress,
  onUserLevelUp,
} from './simulation/engine.js'
import type { Agent, AgentTrait, ClientMessage, ServerMessage, WorldState, User, ShipDTO, ShipState } from './types/index.js'
import { getAgentLimit } from './types/index.js'
import { getGameConfig, WORLD } from './config/gameConfig.js'
import { mountMasterplanRoutes } from './routes/index.js'
import { verifyToken } from './utils/jwt.js'

const PORT = process.env.PORT

// Starting points for new users (legacy - used for backward compatibility)
const STARTING_USER_POINTS = 1000

// Helper to get all LOD clusters (reduces duplication)
function getAllClusters() {
  return {
    synapseClusters: [
      ...getSpaceClusters(0),
      ...getSpaceClusters(1),
      ...getSpaceClusters(2),
    ],
    shipClusters: [
      ...getAgentClusters(0),
      ...getAgentClusters(1),
      ...getAgentClusters(2),
    ],
  }
}

// ============ SHIP SYNC HELPERS ============

// Map server agent state to client-friendly ship state
const agentStateToShipState: Record<string, ShipState> = {
  idle: 'idle',
  searching: 'searching',
  traveling: 'deploying',
  solving: 'exploring',
  returning: 'returning',
}

// Transform server Agent to client-friendly ShipDTO
function agentToShipDTO(agent: Agent): ShipDTO {
  // Query additional ship data from DB if needed
  const shipData = db.prepare(`
    SELECT autopilot_enabled, current_points_per_min, total_agi_earned
    FROM agents WHERE id = ?
  `).get(agent.id) as {
    autopilot_enabled: number | null
    current_points_per_min: number | null
    total_agi_earned: number | null
  } | undefined

  return {
    id: agent.id,
    ownerId: agent.ownerId,
    name: agent.name,
    state: agentStateToShipState[agent.state] || 'idle',
    positionX: agent.positionX,
    positionY: agent.positionY,
    positionZ: agent.positionZ,
    startPositionX: agent.startPositionX,
    startPositionY: agent.startPositionY,
    startPositionZ: agent.startPositionZ,
    targetPositionX: agent.targetX,
    targetPositionY: agent.targetY,
    targetPositionZ: agent.targetZ,
    currentSynapseId: agent.currentSpaceId || agent.targetSpaceId,
    travelStartTime: agent.travelStartTime,
    travelDuration: agent.travelDuration,
    autopilotEnabled: shipData?.autopilot_enabled === 1,
    currentPointsPerMin: shipData?.current_points_per_min || 0,
    spacesDiscovered: agent.spacesDiscovered,
    totalAgiEarned: shipData?.total_agi_earned || 0,
    createdAt: agent.createdAt,
  }
}

if (!PORT) {
  throw new Error('PORT environment variable is not set')
}

// Initialize database
initializeDatabase()

// Create Express app
const app = express()
app.use(cors())
app.use(express.json())

// Create HTTP server
const server = createServer(app)

// Create WebSocket server
const wss = new WebSocketServer({ server })

// Track connected clients
const clients = new Map<string, { ws: WebSocket; userId: string | null }>()

// ============ MASTERPLAN 2026 ROUTES ============
mountMasterplanRoutes(app)

// ============ REST API ============

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    simulation: isSimulationRunning() ? 'running' : 'stopped',
    tick: getTickCount(),
    agents: getAgentCount(),
    discovery: getDiscoveryStats(),
  })
})

// Get game configuration
app.get('/api/config', (req, res) => {
  const config = getGameConfig()
  res.json(config)
})

// Get or create user
app.post('/api/users', (req, res) => {
  const { wallet } = req.body
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet required' })
  }

  let user = getUserByWallet(wallet)
  if (!user) {
    user = {
      id: uuid(),
      wallet,
      tier: 'free',
      stakedAmount: 0,
      points: STARTING_USER_POINTS,
      totalLootEarned: 0,
      createdAt: Date.now(),
    }
    createUser(user)
  }

  res.json(user)
})

// Get user's agents
app.get('/api/users/:userId/agents', (req, res) => {
  const agents = getAgentsByOwner(req.params.userId)
  res.json(agents)
})

// Deploy agent to region - starts in searching mode, wandering and auto-discovering
app.post('/api/agents/:agentId/deploy-to-region', (req, res) => {
  const { positionX, positionY, positionZ } = req.body as {
    positionX: number
    positionY: number
    positionZ: number
  }

  // Validate position bounds
  const { BRAIN_BOUNDS_MIN, BRAIN_BOUNDS_MAX } = WORLD
  if (
    positionX < BRAIN_BOUNDS_MIN || positionX > BRAIN_BOUNDS_MAX ||
    positionY < BRAIN_BOUNDS_MIN || positionY > BRAIN_BOUNDS_MAX ||
    positionZ < BRAIN_BOUNDS_MIN || positionZ > BRAIN_BOUNDS_MAX
  ) {
    return res.status(400).json({
      error: `Position out of bounds (must be within ${BRAIN_BOUNDS_MIN} to ${BRAIN_BOUNDS_MAX})`
    })
  }

  const agent = getAgent(req.params.agentId)
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }
  if (agent.state !== 'idle') {
    return res.status(400).json({ error: `Agent is not idle (state: ${agent.state})` })
  }

  // Deploy agent in searching mode at the given position
  const success = deployAgentToSearch(req.params.agentId, {
    x: positionX,
    y: positionY,
    z: positionZ,
  })

  if (success) {
    const updatedAgent = getAgent(req.params.agentId)
    res.json({ agent: updatedAgent, mode: 'searching' })
  } else {
    res.status(400).json({ error: 'Failed to deploy agent (unknown reason)' })
  }
})

// Recall agent
app.post('/api/agents/:agentId/recall', (req, res) => {
  const success = recallAgent(req.params.agentId)

  if (success) {
    const agent = getAgent(req.params.agentId)
    res.json(agent)
  } else {
    res.status(400).json({ error: 'Failed to recall agent' })
  }
})

// Repair exhausted agent (no cost in Masterplan 2026)
app.post('/api/agents/:agentId/repair', (req, res) => {
  const agent = getAgent(req.params.agentId)

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }

  if (!agent.needsRepair) {
    return res.status(400).json({ error: 'Agent does not need repair' })
  }

  // Repair the agent (clear needsRepair flag)
  updateAgent({
    id: agent.id,
    needsRepair: false,
  })

  const updatedAgent = getAgent(req.params.agentId)
  res.json({ agent: updatedAgent })
})

// Get world state
app.get('/api/world', (req, res) => {
  const stats = getDiscoveryStats()

  const worldState: WorldState = {
    ...getAllClusters(),
    userShips: [],  // Will be populated per-user via WebSocket
    discoveryProgress: stats,
  }

  res.json(worldState)
})

// Get space details
app.get('/api/spaces/:spaceId', (req, res) => {
  const space = getSpace(req.params.spaceId)
  if (!space) {
    return res.status(404).json({ error: 'Space not found' })
  }
  res.json(space)
})

// ============ WEBSOCKET ============

wss.on('connection', (ws) => {
  const clientId = uuid()
  clients.set(clientId, { ws, userId: null })
  console.log(`Client connected: ${clientId}`)

  // Send initial world state
  const stats = getDiscoveryStats()
  const initialState: ServerMessage = {
    type: 'state:sync',
    data: {
      ...getAllClusters(),
      userShips: [],
      discoveryProgress: stats,
    },
  }
  ws.send(JSON.stringify(initialState))

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage

      switch (message.type) {
        case 'auth:identify': {
          const { token } = message.data
          const payload = verifyToken(token)

          if (payload) {
            const client = clients.get(clientId)
            if (client) {
              client.userId = payload.userId
              console.log(`Client ${clientId} authenticated as user ${payload.userId}`)

              // Send auth success
              ws.send(JSON.stringify({
                type: 'auth:success',
                data: { userId: payload.userId },
              } as ServerMessage))

              // Send initial ships for this user
              sendUserShips(clientId)
            }
          } else {
            ws.send(JSON.stringify({
              type: 'auth:error',
              data: { message: 'Invalid or expired token' },
            } as ServerMessage))
          }
          break
        }

        case 'auth:logout': {
          const client = clients.get(clientId)
          if (client) {
            console.log(`Client ${clientId} logged out (was user ${client.userId})`)
            client.userId = null
          }
          break
        }

        case 'ping':
          // Heartbeat - no response needed
          break

        default:
          console.log('Unknown WebSocket message type:', (message as any).type)
      }
    } catch (error) {
      console.error('WebSocket message error:', error)
    }
  })

  ws.on('close', () => {
    clients.delete(clientId)
    console.log(`Client disconnected: ${clientId}`)
  })
})

// Broadcast to all clients
function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message)
  for (const { ws } of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }
}

// Broadcast to a specific user (all their connected clients)
function broadcastToUser(userId: string, message: ServerMessage) {
  const data = JSON.stringify(message)
  for (const client of clients.values()) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data)
    }
  }
}

// Send user's ships to a specific client
function sendUserShips(clientId: string) {
  const client = clients.get(clientId)
  if (!client || !client.userId || client.ws.readyState !== WebSocket.OPEN) return

  const agents = getAgentsByOwner(client.userId)
  const ships = agents.map(agentToShipDTO)

  const message: ServerMessage = {
    type: 'ships:sync',
    data: { ships, timestamp: Date.now() },
  }
  client.ws.send(JSON.stringify(message))
}

// Trigger ship sync for a user (called from REST routes after mutations)
export function triggerShipUpdate(userId: string) {
  const agents = getAgentsByOwner(userId)
  const ships = agents.map(agentToShipDTO)

  broadcastToUser(userId, {
    type: 'ships:sync',
    data: { ships, timestamp: Date.now() },
  })
}

// Set up simulation event handlers
onSpaceDiscovered((event) => {
  broadcast({ type: 'space:discovered', data: event as any })
})

onLootDistributed((event) => {
  broadcast({ type: 'loot:distributed', data: event as any })
})

onAgentsUpdated((agents) => {
  // Group agents by owner and send user-specific ships:sync messages
  const agentsByOwner = new Map<string, Agent[]>()

  for (const agent of agents) {
    const existing = agentsByOwner.get(agent.ownerId) || []
    existing.push(agent)
    agentsByOwner.set(agent.ownerId, existing)
  }

  // Send updates to each user
  for (const [ownerId] of agentsByOwner) {
    // Get ALL ships for this user (not just updated ones) for consistency
    const allUserAgents = getAgentsByOwner(ownerId)
    const ships = allUserAgents.map(agentToShipDTO)

    broadcastToUser(ownerId, {
      type: 'ships:sync',
      data: { ships, timestamp: Date.now() },
    })
  }

  // Also broadcast legacy agents:update for backwards compatibility (can be removed later)
  broadcast({ type: 'agents:update', data: agents as any })
})

// Masterplan 2026: New event handlers
onSynapseCompleted((event) => {
  broadcast({ type: 'synapse:completed', data: event as any })
})

onExplorationProgress((event) => {
  broadcast({ type: 'exploration:progress', data: event as any })
})

onUserLevelUp((event) => {
  broadcast({ type: 'user:levelup', data: event as any })
})

// Stream server logs to connected clients (admin dashboard)
onLogEntry((entry) => {
  broadcast({ type: 'log:entry', data: entry })
})

// Periodic state broadcast (every 5 seconds)
setInterval(() => {
  const stats = getDiscoveryStats()

  // Broadcast world state (clusters, progress) to all clients
  broadcast({
    type: 'state:sync',
    data: {
      ...getAllClusters(),
      userShips: [],
      discoveryProgress: stats,
    },
  })

  // Send user-specific ships to each authenticated client
  for (const [clientId, client] of clients) {
    if (client.userId) {
      sendUserShips(clientId)
    }
  }
}, 5000)

// ============ START SERVER ============

async function start() {
  // Ensure database has spaces/clusters
  await ensureDatabaseSeeded()

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)

    // Start simulation if enabled
    if (process.env.SIMULATION_ENABLED !== 'false') {
      startSimulation()
    }
  })
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...')
  stopSimulation()
  server.close()
  db.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('Shutting down...')
  stopSimulation()
  server.close()
  db.close()
  process.exit(0)
})
