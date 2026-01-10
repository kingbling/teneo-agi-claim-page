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
