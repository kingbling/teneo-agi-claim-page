import 'dotenv/config'
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
  refuelAgent,
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
import type { Agent, AgentTrait, ClientMessage, ServerMessage, WorldState, User } from './types/index.js'
import { getAgentLimit } from './types/index.js'
import { getGameConfig, COSTS, WORLD, calculateAgentCost, calculateRepairCost } from './config/gameConfig.js'
import { mountMasterplanRoutes } from './routes/index.js'

const PORT = process.env.PORT

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
      points: COSTS.STARTING_USER_POINTS,
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

// Create agent
app.post('/api/agents', (req, res) => {
  const { userId, name, traits } = req.body as {
    userId: string
    name: string
    traits: AgentTrait[]
  }

  const user = getUser(userId)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  // Check agent limit
  const existingAgents = getAgentsByOwner(userId)
  const limit = getAgentLimit(user.tier, user.stakedAmount)
  if (existingAgents.length >= limit) {
    return res.status(400).json({ error: 'Agent limit reached' })
  }

  // Calculate creation cost based on traits
  const totalCost = calculateAgentCost(traits)

  if (user.points < totalCost) {
    return res.status(400).json({ error: 'Insufficient points' })
  }

  // Use transaction to ensure atomicity
  try {
    const result = db.transaction(() => {
      // Deduct points
      updateUser({ id: userId, points: user.points - totalCost })

      // Create agent at brain center
      const agent: Agent = {
        id: uuid(),
        ownerId: userId,
        name,
        state: 'idle',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        homeX: 0,
        homeY: 0,
        homeZ: 0,
        targetX: null,
        targetY: null,
        targetZ: null,
        startPositionX: null,
        startPositionY: null,
        startPositionZ: null,
        wanderDirX: 0,
        wanderDirY: 0,
        wanderDirZ: 0,
        wanderPhase: 0,
        targetSpaceId: null,
        currentSpaceId: null,
        solveStartTime: null,
        travelStartTime: null,
        travelDuration: null,
        pointsBalance: COSTS.STARTING_AGENT_FUEL,
        pointsBurnRate: 1.0,
        traits,
        spacesDiscovered: 0,
        totalLoot: 0,
        totalPointsBurned: 0,
        distanceTraveled: 0,
        createdAt: Date.now(),
        deployedAt: null,
        creationCost: totalCost,  // Store for repair cost calculation
        needsRepair: false,
        tranceActive: false,
        tranceEndTime: null,
        tranceLevel: traits.find(t => t.type === 'trance')?.level || 0,
      }

      createAgent(agent)

      // Return agent and updated user
      const updatedUser = getUser(userId)
      return { agent, user: updatedUser }
    })()

    res.json(result)
  } catch (error) {
    console.error('Agent creation transaction failed:', error)
    return res.status(500).json({ error: 'Failed to create agent' })
  }
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
  if (agent.pointsBalance <= 0) {
    return res.status(400).json({ error: 'Agent has no fuel (points)' })
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

// Refuel agent
app.post('/api/agents/:agentId/refuel', (req, res) => {
  const { points } = req.body
  const agent = getAgent(req.params.agentId)

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }

  const user = getUser(agent.ownerId)
  if (!user || user.points < points) {
    return res.status(400).json({ error: 'Insufficient points' })
  }

  // Use transaction to ensure atomicity
  try {
    const result = db.transaction(() => {
      const newUserPoints = user.points - points
      updateUser({ id: user.id, points: newUserPoints })
      refuelAgent(req.params.agentId, points)

      return { agent: getAgent(req.params.agentId), userPoints: newUserPoints }
    })()

    res.json(result)
  } catch (error) {
    console.error('Refuel transaction failed:', error)
    return res.status(500).json({ error: 'Failed to refuel agent' })
  }
})

// Repair exhausted agent (costs 50% of creation cost)
app.post('/api/agents/:agentId/repair', (req, res) => {
  const agent = getAgent(req.params.agentId)

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }

  if (!agent.needsRepair) {
    return res.status(400).json({ error: 'Agent does not need repair' })
  }

  // Calculate repair cost (50% of creation cost)
  const repairCost = calculateRepairCost(agent.creationCost || COSTS.AGENT_BASE_COST)

  const user = getUser(agent.ownerId)
  if (!user || user.points < repairCost) {
    return res.status(400).json({ error: `Insufficient points (need ${repairCost})` })
  }

  // Use transaction to ensure atomicity
  try {
    const result = db.transaction(() => {
      // Deduct repair cost from user
      const newUserPoints = user.points - repairCost
      updateUser({ id: user.id, points: newUserPoints })

      // Repair the agent (clear needsRepair flag, give some initial fuel)
      updateAgent({
        id: agent.id,
        needsRepair: false,
        pointsBalance: COSTS.REPAIR_FUEL_AMOUNT,
      })

      return {
        agent: { ...agent, needsRepair: false, pointsBalance: COSTS.REPAIR_FUEL_AMOUNT },
        userPoints: newUserPoints,
        repairCost,
      }
    })()

    res.json(result)
  } catch (error) {
    console.error('Repair transaction failed:', error)
    return res.status(500).json({ error: 'Failed to repair agent' })
  }
})

// Get world state
app.get('/api/world', (req, res) => {
  const stats = getDiscoveryStats()

  const worldState: WorldState = {
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
      userShips: [],
      discoveryProgress: stats,
    },
  }
  ws.send(JSON.stringify(initialState))

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage

      switch (message.type) {
        case 'agent:recall': {
          const { agentId } = message.data
          recallAgent(agentId)
          break
        }

        case 'agent:refuel': {
          const { agentId, points } = message.data
          const agent = getAgent(agentId)
          if (agent) {
            const user = getUser(agent.ownerId)
            if (user && user.points >= points) {
              updateUser({ id: user.id, points: user.points - points })
              refuelAgent(agentId, points)
            }
          }
          break
        }
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

// Set up simulation event handlers
onSpaceDiscovered((event) => {
  broadcast({ type: 'space:discovered', data: event as any })
})

onLootDistributed((event) => {
  broadcast({ type: 'loot:distributed', data: event as any })
})

onAgentsUpdated((agents) => {
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

// Periodic state broadcast (every 5 seconds)
setInterval(() => {
  const stats = getDiscoveryStats()
  broadcast({
    type: 'state:sync',
    data: {
      synapseClusters: getSpaceClusters(0),  // Just LOD 0 for periodic updates
      shipClusters: getAgentClusters(0),
      userShips: [],
      discoveryProgress: stats,
    },
  })
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
