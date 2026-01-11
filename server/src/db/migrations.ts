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
      throw error
    }
  }

  console.log(`Database migrated to version ${migrations[migrations.length - 1].version}`)
}

// Check migration status without running
export function getMigrationStatus(db: DatabaseType) {
  ensureMigrationsTable(db)

  const currentVersion = getCurrentVersion(db)
  const pendingCount = migrations.filter(m => m.version > currentVersion).length

  return {
    currentVersion,
    latestVersion: migrations.length > 0 ? migrations[migrations.length - 1].version : 0,
    pendingCount,
    migrations: migrations.map(m => ({
      ...m,
      applied: m.version <= currentVersion,
    })),
  }
}
