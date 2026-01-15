import type { Database as DatabaseType } from 'better-sqlite3'

interface Migration {
  version: number
  name: string
  up: (db: DatabaseType) => void
}

// Define all migrations here
const migrations: Migration[] = [
  {
    version: 1,
    name: 'add_agent_start_position_columns',
    up: (db) => {
      // Check if columns exist first
      const tableInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      if (!columnNames.includes('start_position_x')) {
        db.exec('ALTER TABLE agents ADD COLUMN start_position_x REAL')
      }
      if (!columnNames.includes('start_position_y')) {
        db.exec('ALTER TABLE agents ADD COLUMN start_position_y REAL')
      }
      if (!columnNames.includes('start_position_z')) {
        db.exec('ALTER TABLE agents ADD COLUMN start_position_z REAL')
      }
    },
  },
  {
    version: 2,
    name: 'add_agent_wander_columns',
    up: (db) => {
      // Check if columns exist first
      const tableInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      if (!columnNames.includes('wander_dir_x')) {
        db.exec('ALTER TABLE agents ADD COLUMN wander_dir_x REAL DEFAULT 0')
      }
      if (!columnNames.includes('wander_dir_y')) {
        db.exec('ALTER TABLE agents ADD COLUMN wander_dir_y REAL DEFAULT 0')
      }
      if (!columnNames.includes('wander_dir_z')) {
        db.exec('ALTER TABLE agents ADD COLUMN wander_dir_z REAL DEFAULT 0')
      }
      if (!columnNames.includes('wander_phase')) {
        db.exec('ALTER TABLE agents ADD COLUMN wander_phase REAL DEFAULT 0')
      }
    },
  },
  {
    version: 3,
    name: 'add_agent_repair_columns',
    up: (db) => {
      // Check if columns exist first
      const tableInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      if (!columnNames.includes('creation_cost')) {
        db.exec('ALTER TABLE agents ADD COLUMN creation_cost INTEGER DEFAULT 100')
      }
      if (!columnNames.includes('needs_repair')) {
        db.exec('ALTER TABLE agents ADD COLUMN needs_repair INTEGER DEFAULT 0')  // SQLite uses INTEGER for boolean
      }
    },
  },
  {
    version: 4,
    name: 'add_agent_exploration_columns',
    up: (db) => {
      // Check if columns exist first
      const tableInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      // Home position (always center)
      if (!columnNames.includes('home_x')) {
        db.exec('ALTER TABLE agents ADD COLUMN home_x REAL DEFAULT 0')
      }
      if (!columnNames.includes('home_y')) {
        db.exec('ALTER TABLE agents ADD COLUMN home_y REAL DEFAULT 0')
      }
      if (!columnNames.includes('home_z')) {
        db.exec('ALTER TABLE agents ADD COLUMN home_z REAL DEFAULT 0')
      }

      // Target position for biased random walk
      if (!columnNames.includes('target_x')) {
        db.exec('ALTER TABLE agents ADD COLUMN target_x REAL')
      }
      if (!columnNames.includes('target_y')) {
        db.exec('ALTER TABLE agents ADD COLUMN target_y REAL')
      }
      if (!columnNames.includes('target_z')) {
        db.exec('ALTER TABLE agents ADD COLUMN target_z REAL')
      }

      // Current space being solved
      if (!columnNames.includes('current_space_id')) {
        db.exec('ALTER TABLE agents ADD COLUMN current_space_id TEXT')
      }
      if (!columnNames.includes('solve_start_time')) {
        db.exec('ALTER TABLE agents ADD COLUMN solve_start_time INTEGER')
      }

      // Distance tracking
      if (!columnNames.includes('distance_traveled')) {
        db.exec('ALTER TABLE agents ADD COLUMN distance_traveled REAL DEFAULT 0')
      }

      // Deploy timestamp
      if (!columnNames.includes('deployed_at')) {
        db.exec('ALTER TABLE agents ADD COLUMN deployed_at INTEGER')
      }
    },
  },
  {
    version: 5,
    name: 'add_agent_trance_columns',
    up: (db) => {
      // Check if columns exist first
      const tableInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      // Trance state tracking
      if (!columnNames.includes('trance_active')) {
        db.exec('ALTER TABLE agents ADD COLUMN trance_active INTEGER DEFAULT 0')  // SQLite uses INTEGER for boolean
      }
      if (!columnNames.includes('trance_end_time')) {
        db.exec('ALTER TABLE agents ADD COLUMN trance_end_time INTEGER')  // Timestamp when trance ends
      }
      if (!columnNames.includes('trance_level')) {
        db.exec('ALTER TABLE agents ADD COLUMN trance_level INTEGER DEFAULT 0')  // Level of trance trait
      }
    },
  },
  {
    version: 6,
    name: 'add_sectors_columns',
    up: (db) => {
      // First ensure sectors table exists (it may not exist in older databases)
      db.exec(`
        CREATE TABLE IF NOT EXISTS sectors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          is_active INTEGER NOT NULL DEFAULT 0,
          unlock_condition TEXT,
          reward_pool INTEGER NOT NULL DEFAULT 0,
          start_date INTEGER,
          end_date INTEGER,
          created_at INTEGER NOT NULL DEFAULT 0
        )
      `)

      // Check if columns exist first
      const tableInfo = db.prepare("PRAGMA table_info(sectors)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      // Add missing columns for sector tracking
      if (!columnNames.includes('region')) {
        db.exec("ALTER TABLE sectors ADD COLUMN region TEXT DEFAULT 'frontal'")
      }
      if (!columnNames.includes('start_time')) {
        db.exec('ALTER TABLE sectors ADD COLUMN start_time INTEGER')
        // Copy from start_date if it exists
        db.exec('UPDATE sectors SET start_time = start_date WHERE start_time IS NULL')
      }
      if (!columnNames.includes('end_time')) {
        db.exec('ALTER TABLE sectors ADD COLUMN end_time INTEGER')
        // Copy from end_date if it exists
        db.exec('UPDATE sectors SET end_time = end_date WHERE end_time IS NULL')
      }
      if (!columnNames.includes('total_synapses')) {
        db.exec('ALTER TABLE sectors ADD COLUMN total_synapses INTEGER DEFAULT 0')
      }
      if (!columnNames.includes('completed_synapses')) {
        db.exec('ALTER TABLE sectors ADD COLUMN completed_synapses INTEGER DEFAULT 0')
      }
      if (!columnNames.includes('total_agi_rewards')) {
        db.exec('ALTER TABLE sectors ADD COLUMN total_agi_rewards INTEGER DEFAULT 0')
      }
      if (!columnNames.includes('distributed_agi_rewards')) {
        db.exec('ALTER TABLE sectors ADD COLUMN distributed_agi_rewards INTEGER DEFAULT 0')
      }
      if (!columnNames.includes('participant_count')) {
        db.exec('ALTER TABLE sectors ADD COLUMN participant_count INTEGER DEFAULT 0')
      }
    },
  },
  {
    version: 7,
    name: 'add_masterplan_2026_synapse_columns',
    up: (db) => {
      // Add Masterplan 2026 columns to spaces table
      const tableInfo = db.prepare("PRAGMA table_info(spaces)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      if (!columnNames.includes('synapse_type')) {
        db.exec("ALTER TABLE spaces ADD COLUMN synapse_type TEXT NOT NULL DEFAULT 'minor'")
      }
      if (!columnNames.includes('points_required')) {
        db.exec('ALTER TABLE spaces ADD COLUMN points_required INTEGER NOT NULL DEFAULT 6000')
      }
      if (!columnNames.includes('points_accumulated')) {
        db.exec('ALTER TABLE spaces ADD COLUMN points_accumulated INTEGER NOT NULL DEFAULT 0')
      }
      if (!columnNames.includes('current_eta_minutes')) {
        db.exec('ALTER TABLE spaces ADD COLUMN current_eta_minutes INTEGER')
      }
      if (!columnNames.includes('sector_id')) {
        db.exec('ALTER TABLE spaces ADD COLUMN sector_id TEXT')
      }
      if (!columnNames.includes('agi_reward')) {
        db.exec('ALTER TABLE spaces ADD COLUMN agi_reward INTEGER NOT NULL DEFAULT 10')
      }
      if (!columnNames.includes('brain_xp_reward')) {
        db.exec('ALTER TABLE spaces ADD COLUMN brain_xp_reward INTEGER NOT NULL DEFAULT 100')
      }
    },
  },
  {
    version: 8,
    name: 'assign_synapse_types_to_existing_spaces',
    up: (db) => {
      // Distribution: 60% minor, 25% complex, 10% deep, 3% core, 1.5% rare, 0.4% legendary, 0.1% unique
      const spaces = db.prepare("SELECT id FROM spaces WHERE synapse_type = 'minor'").all() as { id: string }[]

      if (spaces.length === 0) {
        console.log('No spaces to update')
        return
      }

      const updateStmt = db.prepare(`
        UPDATE spaces SET synapse_type = ?, points_required = ?, agi_reward = ?, brain_xp_reward = ?
        WHERE id = ?
      `)

      const configs: Record<string, { points: number; agi: number; xp: number }> = {
        minor:     { points: 6000,      agi: 10,     xp: 100 },
        complex:   { points: 120000,    agi: 50,     xp: 500 },
        deep:      { points: 2000000,   agi: 500,    xp: 2500 },
        core:      { points: 20000000,  agi: 2500,   xp: 10000 },
        rare:      { points: 50000000,  agi: 10000,  xp: 50000 },
        legendary: { points: 100000000, agi: 50000,  xp: 200000 },
        unique:    { points: 500000000, agi: 250000, xp: 1000000 },
      }

      let counts: Record<string, number> = {
        minor: 0, complex: 0, deep: 0, core: 0, rare: 0, legendary: 0, unique: 0
      }

      db.transaction(() => {
        for (const space of spaces) {
          const rand = Math.random() * 100
          let type = 'minor'
          if (rand > 99.9) type = 'unique'
          else if (rand > 99.5) type = 'legendary'
          else if (rand > 98) type = 'rare'
          else if (rand > 95) type = 'core'
          else if (rand > 85) type = 'deep'
          else if (rand > 60) type = 'complex'

          const cfg = configs[type]
          updateStmt.run(type, cfg.points, cfg.agi, cfg.xp, space.id)
          counts[type]++
        }
      })()

      console.log(`Assigned synapse types to ${spaces.length} spaces:`)
      for (const [type, count] of Object.entries(counts)) {
        if (count > 0) {
          console.log(`  ${type}: ${count}`)
        }
      }
    },
  },
  {
    version: 9,
    name: 'add_masterplan_2026_user_columns',
    up: (db) => {
      // Add Masterplan 2026 columns to users table
      const tableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      // User Levels (based on USDC spent)
      if (!columnNames.includes('user_level')) {
        db.exec('ALTER TABLE users ADD COLUMN user_level INTEGER NOT NULL DEFAULT 1')
      }
      if (!columnNames.includes('usdc_spent')) {
        db.exec('ALTER TABLE users ADD COLUMN usdc_spent REAL NOT NULL DEFAULT 0')
      }

      // Brain Levels (248 levels with XP)
      if (!columnNames.includes('brain_level')) {
        db.exec('ALTER TABLE users ADD COLUMN brain_level INTEGER NOT NULL DEFAULT 1')
      }
      if (!columnNames.includes('brain_xp')) {
        db.exec('ALTER TABLE users ADD COLUMN brain_xp INTEGER NOT NULL DEFAULT 0')
      }
      if (!columnNames.includes('total_brain_xp')) {
        db.exec('ALTER TABLE users ADD COLUMN total_brain_xp INTEGER NOT NULL DEFAULT 0')
      }

      // Token Balances
      if (!columnNames.includes('agentic_balance')) {
        db.exec('ALTER TABLE users ADD COLUMN agentic_balance INTEGER NOT NULL DEFAULT 0')
      }
      if (!columnNames.includes('total_agi_earned')) {
        db.exec('ALTER TABLE users ADD COLUMN total_agi_earned INTEGER NOT NULL DEFAULT 0')
      }
      if (!columnNames.includes('total_teneo_earned')) {
        db.exec('ALTER TABLE users ADD COLUMN total_teneo_earned INTEGER NOT NULL DEFAULT 0')
      }

      // Lottery & NFTs
      if (!columnNames.includes('lottery_tickets')) {
        db.exec('ALTER TABLE users ADD COLUMN lottery_tickets INTEGER NOT NULL DEFAULT 0')
      }
      if (!columnNames.includes('nft_count')) {
        db.exec('ALTER TABLE users ADD COLUMN nft_count INTEGER NOT NULL DEFAULT 0')
      }

      // Ship Management
      if (!columnNames.includes('max_ships')) {
        db.exec('ALTER TABLE users ADD COLUMN max_ships INTEGER NOT NULL DEFAULT 1')
      }
    },
  },
  {
    version: 10,
    name: 'add_masterplan_2026_ship_columns',
    up: (db) => {
      // Add Masterplan 2026 columns to agents (ships) table
      const tableInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      // Autopilot system
      if (!columnNames.includes('autopilot_enabled')) {
        db.exec('ALTER TABLE agents ADD COLUMN autopilot_enabled INTEGER NOT NULL DEFAULT 0')
      }
      if (!columnNames.includes('equipped_items')) {
        db.exec("ALTER TABLE agents ADD COLUMN equipped_items TEXT NOT NULL DEFAULT '[]'")
      }
      if (!columnNames.includes('current_points_per_min')) {
        db.exec('ALTER TABLE agents ADD COLUMN current_points_per_min INTEGER NOT NULL DEFAULT 100')
      }

      // Ship stats
      if (!columnNames.includes('total_agi_earned')) {
        db.exec('ALTER TABLE agents ADD COLUMN total_agi_earned INTEGER NOT NULL DEFAULT 0')
      }
      if (!columnNames.includes('total_brain_xp_earned')) {
        db.exec('ALTER TABLE agents ADD COLUMN total_brain_xp_earned INTEGER NOT NULL DEFAULT 0')
      }

      // Travel timing
      if (!columnNames.includes('travel_start_time')) {
        db.exec('ALTER TABLE agents ADD COLUMN travel_start_time INTEGER')
      }
      if (!columnNames.includes('travel_duration')) {
        db.exec('ALTER TABLE agents ADD COLUMN travel_duration INTEGER')
      }
    },
  },
  {
    version: 11,
    name: 'add_autopilot_preferences_columns',
    up: (db) => {
      // Add autopilot preference columns to agents (ships) table
      const tableInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      // Target synapse types (JSON array of synapse types to prioritize)
      if (!columnNames.includes('autopilot_target_types')) {
        db.exec("ALTER TABLE agents ADD COLUMN autopilot_target_types TEXT NOT NULL DEFAULT '[]'")
      }
      // Max points cap per synapse (0 = no limit)
      if (!columnNames.includes('autopilot_max_points_cap')) {
        db.exec('ALTER TABLE agents ADD COLUMN autopilot_max_points_cap INTEGER NOT NULL DEFAULT 0')
      }
      // Avoid crowded synapses (with many explorers)
      if (!columnNames.includes('autopilot_avoid_crowded')) {
        db.exec('ALTER TABLE agents ADD COLUMN autopilot_avoid_crowded INTEGER NOT NULL DEFAULT 0')
      }
    },
  },
  {
    version: 12,
    name: 'add_auth_nonce_columns',
    up: (db) => {
      // Add auth nonce columns to users table for wallet signature verification
      const tableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      // Nonce for wallet signature verification (ephemeral, cleared after use)
      if (!columnNames.includes('auth_nonce')) {
        db.exec('ALTER TABLE users ADD COLUMN auth_nonce TEXT')
      }
      // Timestamp when nonce was generated (for expiry)
      if (!columnNames.includes('auth_nonce_issued_at')) {
        db.exec('ALTER TABLE users ADD COLUMN auth_nonce_issued_at INTEGER')
      }
    },
  },
  {
    version: 13,
    name: 'masterplan_2026_remove_brain_level_system',
    up: (db) => {
      // Masterplan 2026 Alignment: Single USDC-based level system
      // Brain Level (248 XP-based levels) is DEPRECATED
      //
      // The following columns are no longer used but kept for data integrity:
      // - users.brain_level, users.brain_xp, users.total_brain_xp
      // - spaces.brain_xp_reward
      // - agents.total_brain_xp_earned
      //
      // Synapse type unlocking is now gated by User Level (USDC-based):
      // - Level 2 ($1+) -> Rare Synapses
      // - Level 3 ($10+) -> Legendary Synapses
      // - Level 4 ($100+) -> Unique Synapses
      //
      // Level Boost now multiplies points/min instead of reducing ETA

      console.log('[Migration 13] Masterplan 2026: Brain Level system deprecated')
      console.log('  - Synapse unlocking now uses User Level (USDC-based)')
      console.log('  - Level multiplier now applies to points/min')
      console.log('  - Brain XP columns remain in database but are no longer used')

      // Reset brain levels to 1 (deprecated)
      db.exec('UPDATE users SET brain_level = 1, brain_xp = 0')

      // Reset brain XP rewards to 0 (deprecated)
      db.exec('UPDATE spaces SET brain_xp_reward = 0')

      // Reset ship brain XP earned to 0 (deprecated)
      db.exec('UPDATE agents SET total_brain_xp_earned = 0')
    },
  },
  {
    version: 14,
    name: 'add_raffle_system_tables',
    up: (db) => {
      // V1 Masterplan: Ticket-Based Raffle System
      // Raffles are separate from regular synapses - points/tickets deducted immediately,
      // one winner selected at end, bigger rewards

      // Raffles table - defines each raffle instance
      db.exec(`
        CREATE TABLE IF NOT EXISTS raffles (
          id TEXT PRIMARY KEY,
          tier TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'upcoming',

          -- Prize Pool
          agi_prize_pool INTEGER NOT NULL,
          bonus_prizes TEXT,

          -- Timing
          starts_at INTEGER NOT NULL,
          ends_at INTEGER NOT NULL,
          drawn_at INTEGER,

          -- Entry Tracking
          total_entries INTEGER NOT NULL DEFAULT 0,
          total_points_spent INTEGER NOT NULL DEFAULT 0,
          total_tickets_spent INTEGER NOT NULL DEFAULT 0,
          participant_count INTEGER NOT NULL DEFAULT 0,

          -- Winner
          winner_user_id TEXT,
          winner_entries INTEGER,

          -- Metadata
          name TEXT,
          description TEXT,
          created_at INTEGER NOT NULL
        )
      `)

      // Indexes for raffles
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffles_tier ON raffles(tier)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffles_ends_at ON raffles(ends_at)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffles_winner ON raffles(winner_user_id)')

      // Raffle entries table - user participation
      db.exec(`
        CREATE TABLE IF NOT EXISTS raffle_entries (
          id TEXT PRIMARY KEY,
          raffle_id TEXT NOT NULL,
          user_id TEXT NOT NULL,

          -- Entry Details
          entry_method TEXT NOT NULL,
          amount_spent INTEGER NOT NULL,
          entries_received INTEGER NOT NULL,

          -- Timing
          entered_at INTEGER NOT NULL,

          FOREIGN KEY (raffle_id) REFERENCES raffles(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)

      // Indexes for raffle_entries
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle ON raffle_entries(raffle_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffle_entries_user ON raffle_entries(user_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle_user ON raffle_entries(raffle_id, user_id)')

      // Raffle winners history - for analytics and display
      db.exec(`
        CREATE TABLE IF NOT EXISTS raffle_winners_history (
          id TEXT PRIMARY KEY,
          raffle_id TEXT NOT NULL,
          winner_user_id TEXT NOT NULL,
          tier TEXT NOT NULL,
          agi_won INTEGER NOT NULL,
          total_entries INTEGER NOT NULL,
          winner_entries INTEGER NOT NULL,
          participant_count INTEGER NOT NULL,
          won_at INTEGER NOT NULL,

          FOREIGN KEY (raffle_id) REFERENCES raffles(id),
          FOREIGN KEY (winner_user_id) REFERENCES users(id)
        )
      `)

      // Index for raffle history
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffle_history_user ON raffle_winners_history(winner_user_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_raffle_history_date ON raffle_winners_history(won_at)')

      console.log('[Migration 14] V1 Masterplan: Raffle system tables created')
      console.log('  - raffles: Raffle instances with prize pools and timing')
      console.log('  - raffle_entries: User participation with entry method and amounts')
      console.log('  - raffle_winners_history: Historical record of winners')
    },
  },
  {
    version: 15,
    name: 'deprecate_legacy_space_discovery_system',
    up: (db) => {
      // Legacy space discovery system is being removed.
      // All exploration now uses the synapse system (completeSynapse).
      //
      // This migration:
      // 1. Resets ships stuck in legacy states to 'idle'
      // 2. Clears orphaned space_solvers entries
      // 3. Marks legacy fields as deprecated (kept for data integrity)

      // Count ships in legacy states for logging
      const stuckShips = db.prepare(`
        SELECT COUNT(*) as count FROM agents
        WHERE state IN ('searching', 'traveling', 'solving')
      `).get() as { count: number }

      // Reset any ships stuck in legacy states to idle
      db.exec(`
        UPDATE agents
        SET state = 'idle',
            target_space_id = NULL,
            current_space_id = NULL,
            solve_start_time = NULL
        WHERE state IN ('searching', 'traveling', 'solving')
      `)

      // Clear orphaned space_solvers entries (legacy tracking table) if it exists
      try {
        db.exec('DELETE FROM space_solvers')
      } catch {
        // Table doesn't exist on fresh databases, that's fine
      }

      // Reset solve_progress on spaces (legacy field, no longer used) if it exists
      const spaceColumns = db.prepare("PRAGMA table_info(spaces)").all() as { name: string }[]
      if (spaceColumns.some(c => c.name === 'solve_progress')) {
        db.exec('UPDATE spaces SET solve_progress = 0 WHERE solve_progress > 0')
      }

      console.log('[Migration 15] Legacy space discovery system deprecated')
      console.log(`  - ${stuckShips.count} ships reset from legacy states to idle`)
      console.log('  - space_solvers table cleared')
      console.log('  - All exploration now uses synapse system (completeSynapse)')
      console.log('')
      console.log('  DEPRECATED FIELDS (kept for data integrity):')
      console.log('  - space_solvers table')
      console.log('  - spaces.solve_progress, spaces.loot_pool, spaces.base_probability')
      console.log('  - agents.total_loot (use total_agi_earned instead)')
    },
  },
  {
    version: 16,
    name: 'add_admin_columns',
    up: (db) => {
      // Add admin and ban columns to users table
      const tableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
      const columnNames = tableInfo.map(c => c.name)

      // Admin flag
      if (!columnNames.includes('is_admin')) {
        db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')
      }
      // Ban tracking
      if (!columnNames.includes('banned_at')) {
        db.exec('ALTER TABLE users ADD COLUMN banned_at INTEGER')
      }
      if (!columnNames.includes('ban_reason')) {
        db.exec('ALTER TABLE users ADD COLUMN ban_reason TEXT')
      }

      console.log('[Migration 16] Admin system columns added')
      console.log('  - users.is_admin: Admin flag (0/1)')
      console.log('  - users.banned_at: Ban timestamp')
      console.log('  - users.ban_reason: Reason for ban')
    },
  },
  {
    version: 17,
    name: 'remove_deprecated_fields',
    up: (db) => {
      // Remove deprecated fields from database tables
      // This migration is idempotent - it checks if work needs to be done

      console.log('[Migration 17] Removing deprecated fields from database...')

      // Check if this migration is needed by looking for deprecated columns
      const agentColumns = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[]
      const agentColumnNames = agentColumns.map(c => c.name)
      const hasDeprecatedAgentColumns = agentColumnNames.includes('total_loot') || agentColumnNames.includes('points_balance')

      const spaceColumns = db.prepare("PRAGMA table_info(spaces)").all() as { name: string }[]
      const spaceColumnNames = spaceColumns.map(c => c.name)
      const hasDeprecatedSpaceColumns = spaceColumnNames.includes('loot_pool') || spaceColumnNames.includes('base_probability')

      const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
      const userColumnNames = userColumns.map(c => c.name)
      const hasDeprecatedUserColumns = userColumnNames.includes('brain_level') || userColumnNames.includes('brain_xp')

      // If no deprecated columns exist, this is a fresh database - skip migration
      if (!hasDeprecatedAgentColumns && !hasDeprecatedSpaceColumns && !hasDeprecatedUserColumns) {
        console.log('  - No deprecated columns found, skipping migration (fresh database)')
        db.exec('DROP TABLE IF EXISTS space_solvers')
        return
      }

      // Clear synapse_explorers to avoid FK constraint issues when recreating tables
      try {
        db.exec('DELETE FROM synapse_explorers')
        console.log('  - Cleared synapse_explorers table')
      } catch {
        console.log('  - synapse_explorers table does not exist, skipping')
      }

      // Transfer legacy loot to AGI if the column exists
      if (agentColumnNames.includes('total_loot')) {
        console.log('  - Transferring legacy loot to user AGI...')

        const shipsWithLoot = db.prepare(`
          SELECT owner_id, SUM(total_loot) as total_loot
          FROM agents
          WHERE total_loot > 0
          GROUP BY owner_id
        `).all() as Array<{ owner_id: string; total_loot: number }>

        let totalTransferred = 0
        for (const ship of shipsWithLoot) {
          db.prepare(`UPDATE users SET total_agi_earned = total_agi_earned + ? WHERE id = ?`).run(ship.total_loot, ship.owner_id)
          totalTransferred += ship.total_loot
        }

        db.exec(`UPDATE agents SET total_agi_earned = total_agi_earned + total_loot WHERE total_loot > 0`)
        console.log(`  - Transferred ${totalTransferred} loot to AGI`)
      }

      // Drop deprecated tables
      db.exec('DROP TABLE IF EXISTS space_solvers')
      console.log('  - Dropped space_solvers table')

      // Recreate spaces table if needed
      if (hasDeprecatedSpaceColumns) {
        db.exec(`
          CREATE TABLE spaces_new (
            id TEXT PRIMARY KEY,
            position_x REAL NOT NULL, position_y REAL NOT NULL, position_z REAL NOT NULL,
            region TEXT NOT NULL, zone TEXT NOT NULL, synapse_count INTEGER NOT NULL,
            state TEXT NOT NULL DEFAULT 'undiscovered', discovered_at INTEGER,
            synapse_type TEXT NOT NULL DEFAULT 'minor', points_required INTEGER NOT NULL DEFAULT 6000,
            points_accumulated INTEGER NOT NULL DEFAULT 0, current_eta_minutes INTEGER,
            sector_id TEXT, agi_reward INTEGER NOT NULL DEFAULT 10
          )
        `)
        db.exec(`
          INSERT INTO spaces_new (id, position_x, position_y, position_z, region, zone, synapse_count,
            state, discovered_at, synapse_type, points_required, points_accumulated, current_eta_minutes, sector_id, agi_reward)
          SELECT id, position_x, position_y, position_z, region, zone, synapse_count,
            state, discovered_at, synapse_type, points_required, points_accumulated, current_eta_minutes, sector_id, agi_reward
          FROM spaces
        `)
        db.exec('DROP TABLE spaces')
        db.exec('ALTER TABLE spaces_new RENAME TO spaces')
        db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_region ON spaces(region)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_state ON spaces(state)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_zone ON spaces(zone)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_synapse_type ON spaces(synapse_type)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_sector ON spaces(sector_id)')
        console.log('  - Recreated spaces table')
      }

      // Recreate agents table if needed
      if (hasDeprecatedAgentColumns) {
        db.exec(`
          CREATE TABLE agents_new (
            id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'idle', position_x REAL NOT NULL, position_y REAL NOT NULL, position_z REAL NOT NULL,
            start_position_x REAL, start_position_y REAL, start_position_z REAL, target_space_id TEXT,
            travel_start_time INTEGER, travel_duration INTEGER, traits TEXT NOT NULL DEFAULT '[]',
            autopilot_enabled INTEGER NOT NULL DEFAULT 0, equipped_items TEXT NOT NULL DEFAULT '[]',
            current_points_per_min INTEGER NOT NULL DEFAULT 100, spaces_discovered INTEGER NOT NULL DEFAULT 0,
            total_agi_earned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
            home_x REAL DEFAULT 0, home_y REAL DEFAULT 0, home_z REAL DEFAULT 0,
            target_x REAL, target_y REAL, target_z REAL, current_space_id TEXT, solve_start_time INTEGER,
            distance_traveled REAL DEFAULT 0, deployed_at INTEGER,
            wander_dir_x REAL DEFAULT 0, wander_dir_y REAL DEFAULT 0, wander_dir_z REAL DEFAULT 0, wander_phase REAL DEFAULT 0,
            creation_cost INTEGER DEFAULT 100, needs_repair INTEGER DEFAULT 0,
            trance_active INTEGER DEFAULT 0, trance_end_time INTEGER, trance_level INTEGER DEFAULT 0,
            autopilot_target_types TEXT NOT NULL DEFAULT '[]', autopilot_max_points_cap INTEGER NOT NULL DEFAULT 0,
            autopilot_avoid_crowded INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (target_space_id) REFERENCES spaces(id)
          )
        `)
        db.exec(`
          INSERT INTO agents_new (id, owner_id, name, state, position_x, position_y, position_z,
            start_position_x, start_position_y, start_position_z, target_space_id,
            travel_start_time, travel_duration, traits, autopilot_enabled, equipped_items,
            current_points_per_min, spaces_discovered, total_agi_earned, created_at,
            home_x, home_y, home_z, target_x, target_y, target_z, current_space_id,
            solve_start_time, distance_traveled, deployed_at, wander_dir_x, wander_dir_y,
            wander_dir_z, wander_phase, creation_cost, needs_repair, trance_active,
            trance_end_time, trance_level, autopilot_target_types, autopilot_max_points_cap, autopilot_avoid_crowded)
          SELECT id, owner_id, name, state, position_x, position_y, position_z,
            start_position_x, start_position_y, start_position_z, target_space_id,
            travel_start_time, travel_duration, traits, COALESCE(autopilot_enabled, 0), COALESCE(equipped_items, '[]'),
            COALESCE(current_points_per_min, 100), spaces_discovered, COALESCE(total_agi_earned, 0), created_at,
            COALESCE(home_x, 0), COALESCE(home_y, 0), COALESCE(home_z, 0), target_x, target_y, target_z, current_space_id,
            solve_start_time, COALESCE(distance_traveled, 0), deployed_at, COALESCE(wander_dir_x, 0), COALESCE(wander_dir_y, 0),
            COALESCE(wander_dir_z, 0), COALESCE(wander_phase, 0), COALESCE(creation_cost, 100), COALESCE(needs_repair, 0), COALESCE(trance_active, 0),
            trance_end_time, COALESCE(trance_level, 0), COALESCE(autopilot_target_types, '[]'), COALESCE(autopilot_max_points_cap, 0),
            COALESCE(autopilot_avoid_crowded, 0)
          FROM agents
        `)
        db.exec('DROP TABLE agents')
        db.exec('ALTER TABLE agents_new RENAME TO agents')
        db.exec('CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_agents_state ON agents(state)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_agents_target ON agents(target_space_id)')
        console.log('  - Recreated agents table')
      }

      // Recreate users table if needed
      if (hasDeprecatedUserColumns) {
        db.exec(`
        CREATE TABLE IF NOT EXISTS users_new (
          id TEXT PRIMARY KEY,
          wallet TEXT UNIQUE NOT NULL,
          tier TEXT NOT NULL DEFAULT 'free',
          staked_amount REAL NOT NULL DEFAULT 0,
          points REAL NOT NULL DEFAULT 1000,
          total_loot_earned INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          user_level INTEGER NOT NULL DEFAULT 1,
          usdc_spent REAL NOT NULL DEFAULT 0,
          agentic_balance INTEGER NOT NULL DEFAULT 0,
          total_agi_earned INTEGER NOT NULL DEFAULT 0,
          total_teneo_earned INTEGER NOT NULL DEFAULT 0,
          lottery_tickets INTEGER NOT NULL DEFAULT 0,
          nft_count INTEGER NOT NULL DEFAULT 0,
          max_ships INTEGER NOT NULL DEFAULT 1,
          auth_nonce TEXT,
          auth_nonce_issued_at INTEGER,
          is_admin INTEGER NOT NULL DEFAULT 0,
          banned_at INTEGER,
          ban_reason TEXT
        )
      `)

      db.exec(`
        INSERT INTO users_new (
          id, wallet, tier, staked_amount, points, total_loot_earned, created_at,
          user_level, usdc_spent, agentic_balance, total_agi_earned, total_teneo_earned,
          lottery_tickets, nft_count, max_ships, auth_nonce, auth_nonce_issued_at,
          is_admin, banned_at, ban_reason
        )
        SELECT
          id, wallet, tier, staked_amount, points, total_loot_earned, created_at,
          COALESCE(user_level, 1), COALESCE(usdc_spent, 0), COALESCE(agentic_balance, 0),
          COALESCE(total_agi_earned, 0), COALESCE(total_teneo_earned, 0),
          COALESCE(lottery_tickets, 0), COALESCE(nft_count, 0), COALESCE(max_ships, 1),
          auth_nonce, auth_nonce_issued_at, COALESCE(is_admin, 0), banned_at, ban_reason
        FROM users
      `)

        db.exec('DROP TABLE users')
        db.exec('ALTER TABLE users_new RENAME TO users')
        db.exec('CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_users_level ON users(user_level)')
        console.log('  - Recreated users table')
      }

      // Recreate space_clusters table if it has deprecated columns
      const clusterColumns = db.prepare("PRAGMA table_info(space_clusters)").all() as { name: string }[]
      const clusterColumnNames = clusterColumns.map(c => c.name)
      const hasDeprecatedClusterColumns = clusterColumnNames.includes('avg_loot_pool')

      if (hasDeprecatedClusterColumns) {
        db.exec(`
          CREATE TABLE space_clusters_new (
            id TEXT PRIMARY KEY, lod_level INTEGER NOT NULL,
            position_x REAL NOT NULL, position_y REAL NOT NULL, position_z REAL NOT NULL,
            space_count INTEGER NOT NULL, discovered_count INTEGER NOT NULL DEFAULT 0,
            being_solved_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
          )
        `)
        db.exec(`
          INSERT INTO space_clusters_new (id, lod_level, position_x, position_y, position_z,
            space_count, discovered_count, being_solved_count, updated_at)
          SELECT id, lod_level, position_x, position_y, position_z,
            space_count, discovered_count, being_solved_count, updated_at
          FROM space_clusters
        `)
        db.exec('DROP TABLE space_clusters')
        db.exec('ALTER TABLE space_clusters_new RENAME TO space_clusters')
        db.exec('CREATE INDEX IF NOT EXISTS idx_space_clusters_lod ON space_clusters(lod_level)')
        console.log('  - Recreated space_clusters table')
      }

      console.log('[Migration 17] Deprecated fields removed successfully')
      console.log('')
      console.log('  REMOVED FIELDS:')
      console.log('  - spaces: base_probability, solve_progress, loot_pool, brain_xp_reward')
      console.log('  - agents: points_balance, points_burn_rate, total_points_burned, total_loot, total_brain_xp_earned')
      console.log('  - users: brain_level, brain_xp, total_brain_xp')
      console.log('  - space_clusters: avg_loot_pool')
      console.log('  - space_solvers table (dropped)')
    },
  },
]

// Create migrations tracking table
function ensureMigrationsTable(db: DatabaseType) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)
}

// Get current schema version
function getCurrentVersion(db: DatabaseType): number {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null }
  return row?.version ?? 0
}

// Run all pending migrations
export function runMigrations(db: DatabaseType) {
  ensureMigrationsTable(db)

  const currentVersion = getCurrentVersion(db)
  const pendingMigrations = migrations.filter(m => m.version > currentVersion)

  if (pendingMigrations.length === 0) {
    console.log(`Database schema is up to date (version ${currentVersion})`)
    return
  }

  console.log(`Running ${pendingMigrations.length} migration(s)...`)

  // Disable foreign keys for migrations (must be outside transaction)
  db.pragma('foreign_keys = OFF')

  for (const migration of pendingMigrations) {
    console.log(`  Applying migration ${migration.version}: ${migration.name}`)

    try {
      // Run migration in a transaction
      db.transaction(() => {
        migration.up(db)

        // Record the migration
        db.prepare(`
          INSERT INTO schema_migrations (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(migration.version, migration.name, Date.now())
      })()

      console.log(`  Migration ${migration.version} applied successfully`)
    } catch (error) {
      console.error(`  Migration ${migration.version} failed:`, error)
      // Re-enable foreign keys before throwing
      db.pragma('foreign_keys = ON')
      throw error
    }
  }

  // Re-enable foreign keys after all migrations
  db.pragma('foreign_keys = ON')

  console.log(`Database migrated to version ${migrations[migrations.length - 1].version}`)
}
