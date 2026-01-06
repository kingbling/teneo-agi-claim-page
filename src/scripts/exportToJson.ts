#!/usr/bin/env npx tsx
/**
 * Export SQLite database to JSON for frontend use
 *
 * Usage: npm run export-json (runs after generate-db)
 */

import Database from 'better-sqlite3'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '../../data/teneo.db')
const outputDir = join(__dirname, '../../src/data')

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true })

const db = new Database(dbPath, { readonly: true })

console.log('📤 Exporting database to JSON...\n')

// Export global stats
const globalStats = db.prepare('SELECT * FROM global_stats WHERE id = 1').get()
writeFileSync(join(outputDir, 'globalStats.json'), JSON.stringify(globalStats, null, 2))
console.log('✓ Exported global_stats')

// Export brain regions
const brainRegions = db.prepare('SELECT * FROM brain_regions ORDER BY display_order').all()
writeFileSync(join(outputDir, 'brainRegions.json'), JSON.stringify(brainRegions, null, 2))
console.log('✓ Exported brain_regions')

// Export region progress view
const regionProgress = db.prepare('SELECT * FROM v_region_progress').all()
writeFileSync(join(outputDir, 'regionProgress.json'), JSON.stringify(regionProgress, null, 2))
console.log('✓ Exported region_progress')

// Export users
const users = db.prepare('SELECT * FROM users').all()
writeFileSync(join(outputDir, 'users.json'), JSON.stringify(users, null, 2))
console.log('✓ Exported users')

// Export current user
const currentUser = db.prepare('SELECT * FROM users WHERE is_current_user = 1').get()
writeFileSync(join(outputDir, 'currentUser.json'), JSON.stringify(currentUser, null, 2))
console.log('✓ Exported current_user')

// Export user connections for current user
const currentUserId = (currentUser as any)?.id
if (currentUserId) {
  const userConnections = db
    .prepare('SELECT * FROM user_connections WHERE user_id = ?')
    .all(currentUserId)
  writeFileSync(join(outputDir, 'userConnections.json'), JSON.stringify(userConnections, null, 2))
  console.log('✓ Exported user_connections')

  // Export passive bonuses for current user
  const passiveBonuses = db
    .prepare('SELECT * FROM passive_bonuses WHERE user_id = ?')
    .all(currentUserId)
  writeFileSync(join(outputDir, 'passiveBonuses.json'), JSON.stringify(passiveBonuses, null, 2))
  console.log('✓ Exported passive_bonuses')
}

// Export synapse nodes
const synapseNodes = db.prepare('SELECT * FROM synapse_nodes').all()
writeFileSync(join(outputDir, 'synapseNodes.json'), JSON.stringify(synapseNodes, null, 2))
console.log('✓ Exported synapse_nodes')

// Export synapse connections
const synapseConnections = db.prepare('SELECT * FROM synapse_connections').all()
writeFileSync(join(outputDir, 'synapseConnections.json'), JSON.stringify(synapseConnections, null, 2))
console.log('✓ Exported synapse_connections')

// Export allocations
const allocations = db.prepare('SELECT * FROM allocations').all()
writeFileSync(join(outputDir, 'allocations.json'), JSON.stringify(allocations, null, 2))
console.log('✓ Exported allocations')

// Export leaderboard
const leaderboard = db.prepare('SELECT * FROM v_leaderboard LIMIT 50').all()
writeFileSync(join(outputDir, 'leaderboard.json'), JSON.stringify(leaderboard, null, 2))
console.log('✓ Exported leaderboard')

// Export recent transactions
const transactions = db
  .prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100')
  .all()
writeFileSync(join(outputDir, 'transactions.json'), JSON.stringify(transactions, null, 2))
console.log('✓ Exported transactions')

db.close()

console.log(`\n✅ All data exported to: ${outputDir}`)
