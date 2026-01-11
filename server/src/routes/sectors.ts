/**
 * Sector API Routes - Masterplan 2026
 *
 * Sectors are time-limited exploration zones within the brain.
 * Each sector has a set of synapses and progress is tracked collectively.
 */

import { Router, Request, Response } from 'express'
import { db } from '../db/index.js'

const router = Router()

// Type for sector response
interface SectorResponse {
  id: string
  name: string
  description: string
  region: string
  startTime: number
  endTime: number
  state: 'upcoming' | 'active' | 'completed'
  totalSynapses: number
  completedSynapses: number
  totalAgiRewards: number
  distributedAgiRewards: number
  participantCount: number
  topExplorers?: SectorExplorer[]
}

interface SectorExplorer {
  userId: string
  username: string
  synapsesCompleted: number
  agiEarned: number
  brainXpEarned: number
  rank: number
}

interface SectorProgress {
  sectorId: string
  completionPercentage: number
  synapsesCompleted: number
  synapsesRemaining: number
  estimatedCompletionTime: number | null
  currentExplorers: number
  recentCompletions: RecentCompletion[]
}

interface RecentCompletion {
  synapseId: string
  synapseType: string
  completedAt: number
  completedBy: string[]
}

/**
 * GET /api/sectors
 * Get all sectors with optional filtering
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { state, region, limit } = req.query
    const now = Date.now()

    let query = 'SELECT * FROM sectors WHERE 1=1'
    const params: any[] = []

    if (region) {
      query += ' AND region = ?'
      params.push(region)
    }

    query += ' ORDER BY start_time DESC'

    if (limit) {
      query += ' LIMIT ?'
      params.push(parseInt(limit as string, 10))
    }

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as any[]

    const sectors: SectorResponse[] = rows.map(row => {
      let sectorState: 'upcoming' | 'active' | 'completed'
      if (now < row.start_time) {
        sectorState = 'upcoming'
      } else if (now > row.end_time) {
        sectorState = 'completed'
      } else {
        sectorState = 'active'
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        region: row.region,
        startTime: row.start_time,
        endTime: row.end_time,
        state: sectorState,
        totalSynapses: row.total_synapses || 0,
        completedSynapses: row.completed_synapses || 0,
        totalAgiRewards: row.total_agi_rewards || 0,
        distributedAgiRewards: row.distributed_agi_rewards || 0,
        participantCount: row.participant_count || 0,
      }
    })

    // Filter by state if requested
    let filteredSectors = sectors
    if (state) {
      filteredSectors = sectors.filter(s => s.state === state)
    }

    res.json({ sectors: filteredSectors })
  } catch (error) {
    console.error('Failed to get sectors:', error)
    res.status(500).json({ error: 'Failed to get sectors' })
  }
})

/**
 * GET /api/sectors/active
 * Get the currently active sector
 */
router.get('/active', (req: Request, res: Response) => {
  try {
    const now = Date.now()

    const stmt = db.prepare(`
      SELECT * FROM sectors
      WHERE start_time <= ? AND end_time >= ?
      ORDER BY start_time DESC
      LIMIT 1
    `)
    const row = stmt.get(now, now) as any

    if (!row) {
      return res.status(404).json({
        error: 'No active sector',
        message: 'There is no active exploration sector at this time'
      })
    }

    // Get top explorers for this sector by aggregating from lottery_draws and synapse_explorers
    const explorersStmt = db.prepare(`
      SELECT
        u.id as userId,
        u.wallet as username,
        COUNT(DISTINCT ld.synapse_id) as synapsesCompleted,
        COALESCE(SUM(ld.reward_agi), 0) as agiEarned,
        0 as brainXpEarned
      FROM users u
      LEFT JOIN lottery_draws ld ON ld.winner_user_id = u.id
      LEFT JOIN spaces s ON s.id = ld.synapse_id
      WHERE s.sector_id = ?
      GROUP BY u.id
      HAVING synapsesCompleted > 0
      ORDER BY agiEarned DESC
      LIMIT 10
    `)
    const explorers = explorersStmt.all(row.id) as any[]

    const topExplorers: SectorExplorer[] = explorers.map((e, index) => ({
      ...e,
      rank: index + 1,
    }))

    const sector: SectorResponse = {
      id: row.id,
      name: row.name,
      description: row.description || '',
      region: row.region,
      startTime: row.start_time,
      endTime: row.end_time,
      state: 'active',
      totalSynapses: row.total_synapses || 0,
      completedSynapses: row.completed_synapses || 0,
      totalAgiRewards: row.total_agi_rewards || 0,
      distributedAgiRewards: row.distributed_agi_rewards || 0,
      participantCount: row.participant_count || 0,
      topExplorers,
    }

    res.json({ sector })
  } catch (error) {
    console.error('Failed to get active sector:', error)
    res.status(500).json({ error: 'Failed to get active sector' })
  }
})

/**
 * GET /api/sectors/:id
 * Get detailed information about a specific sector
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const now = Date.now()

    const stmt = db.prepare('SELECT * FROM sectors WHERE id = ?')
    const row = stmt.get(id) as any

    if (!row) {
      return res.status(404).json({ error: 'Sector not found' })
    }

    let sectorState: 'upcoming' | 'active' | 'completed'
    if (now < row.start_time) {
      sectorState = 'upcoming'
    } else if (now > row.end_time) {
      sectorState = 'completed'
    } else {
      sectorState = 'active'
    }

    // Get top explorers by aggregating from lottery_draws and synapse_explorers
    const explorersStmt = db.prepare(`
      SELECT
        u.id as userId,
        u.wallet as username,
        COUNT(DISTINCT ld.synapse_id) as synapsesCompleted,
        COALESCE(SUM(ld.reward_agi), 0) as agiEarned,
        0 as brainXpEarned
      FROM users u
      LEFT JOIN lottery_draws ld ON ld.winner_user_id = u.id
      LEFT JOIN spaces s ON s.id = ld.synapse_id
      WHERE s.sector_id = ?
      GROUP BY u.id
      HAVING synapsesCompleted > 0
      ORDER BY agiEarned DESC
      LIMIT 20
    `)
    const explorers = explorersStmt.all(id) as any[]

    const topExplorers: SectorExplorer[] = explorers.map((e, index) => ({
      ...e,
      rank: index + 1,
    }))

    const sector: SectorResponse = {
      id: row.id,
      name: row.name,
      description: row.description || '',
      region: row.region,
      startTime: row.start_time,
      endTime: row.end_time,
      state: sectorState,
      totalSynapses: row.total_synapses || 0,
      completedSynapses: row.completed_synapses || 0,
      totalAgiRewards: row.total_agi_rewards || 0,
      distributedAgiRewards: row.distributed_agi_rewards || 0,
      participantCount: row.participant_count || 0,
      topExplorers,
    }

    res.json({ sector })
  } catch (error) {
    console.error('Failed to get sector:', error)
    res.status(500).json({ error: 'Failed to get sector details' })
  }
})

/**
 * GET /api/sectors/:id/progress
 * Get real-time progress information for a sector
 */
router.get('/:id/progress', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const sectorStmt = db.prepare('SELECT * FROM sectors WHERE id = ?')
    const sector = sectorStmt.get(id) as any

    if (!sector) {
      return res.status(404).json({ error: 'Sector not found' })
    }

    // Get current explorer count (ships actively exploring synapses in this sector)
    const explorerCountStmt = db.prepare(`
      SELECT COUNT(DISTINCT se.user_id) as count
      FROM synapse_explorers se
      JOIN spaces s ON s.id = se.synapse_id
      WHERE s.sector_id = ?
    `)
    const explorerResult = explorerCountStmt.get(id) as { count: number }

    // Get recent completions
    const recentStmt = db.prepare(`
      SELECT
        s.id as synapseId,
        s.synapse_type as synapseType,
        s.discovered_at as completedAt
      FROM spaces s
      WHERE s.sector_id = ? AND s.state = 'discovered'
      ORDER BY s.discovered_at DESC
      LIMIT 5
    `)
    const recentRows = recentStmt.all(id) as any[]

    const recentCompletions: RecentCompletion[] = recentRows.map(row => ({
      synapseId: row.synapseId,
      synapseType: row.synapseType || 'minor',
      completedAt: row.completedAt,
      completedBy: [], // TODO: Track who completed each synapse
    }))

    // Calculate estimated completion time
    const remainingSynapses = sector.total_synapses - sector.completed_synapses
    let estimatedCompletionTime: number | null = null

    if (remainingSynapses > 0 && sector.completed_synapses > 0) {
      const elapsed = Date.now() - sector.start_time
      const rate = sector.completed_synapses / elapsed
      estimatedCompletionTime = Date.now() + Math.floor(remainingSynapses / rate)
    }

    const progress: SectorProgress = {
      sectorId: id,
      completionPercentage: sector.total_synapses > 0
        ? Math.round((sector.completed_synapses / sector.total_synapses) * 100)
        : 0,
      synapsesCompleted: sector.completed_synapses,
      synapsesRemaining: remainingSynapses,
      estimatedCompletionTime,
      currentExplorers: explorerResult.count,
      recentCompletions,
    }

    res.json({ progress })
  } catch (error) {
    console.error('Failed to get sector progress:', error)
    res.status(500).json({ error: 'Failed to get sector progress' })
  }
})

export default router
