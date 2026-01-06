-- Teneo Brain Regions Database Schema
-- SQLite database for mock ecosystem

-- ============================================
-- GLOBAL STATS (Singleton)
-- ============================================
CREATE TABLE IF NOT EXISTS global_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_synapses INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  total_points_distributed INTEGER NOT NULL DEFAULT 0,
  network_created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize singleton row
INSERT OR IGNORE INTO global_stats (id) VALUES (1);

-- ============================================
-- BRAIN REGIONS
-- ============================================
CREATE TABLE IF NOT EXISTS brain_regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  unlock_threshold INTEGER NOT NULL DEFAULT 0,
  reward_multiplier REAL NOT NULL DEFAULT 1.0,
  passive_bonus_percent REAL NOT NULL DEFAULT 0.0,
  color_hex TEXT NOT NULL DEFAULT '#4a90a4',
  glow_color_hex TEXT NOT NULL DEFAULT '#75e6ea',
  is_unlocked INTEGER NOT NULL DEFAULT 0,
  unlocked_at TEXT,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Insert 6 brain regions with unlock thresholds
INSERT OR IGNORE INTO brain_regions (id, name, description, unlock_threshold, reward_multiplier, passive_bonus_percent, color_hex, glow_color_hex, is_unlocked, display_order) VALUES
  ('brainstem', 'Brainstem', 'The foundation of neural activity. Always active.', 0, 1.0, 0.0, '#3d5a6c', '#5a8a9a', 1, 1),
  ('cerebellum', 'Cerebellum', 'Coordination center. Unlocks at 100 collective synapses.', 100, 1.15, 2.0, '#4a7a8a', '#6abacc', 0, 2),
  ('occipital', 'Occipital Lobe', 'Visual processing hub. Unlocks at 250 collective synapses.', 250, 1.25, 4.0, '#5a8a9a', '#7adaea', 0, 3),
  ('temporal', 'Temporal Lobe', 'Memory and language center. Unlocks at 500 collective synapses.', 500, 1.40, 6.0, '#6a9aaa', '#8aeafa', 0, 4),
  ('parietal', 'Parietal Lobe', 'Sensory integration zone. Unlocks at 750 collective synapses.', 750, 1.60, 8.0, '#7aaaBA', '#9afaff', 0, 5),
  ('frontal', 'Frontal Lobe', 'Executive function apex. Unlocks at 1000 collective synapses.', 1000, 2.0, 12.0, '#8abaCA', '#aaffff', 0, 6);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  display_name TEXT,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  total_points INTEGER NOT NULL DEFAULT 0,
  synapse_count INTEGER NOT NULL DEFAULT 0,
  journey_progress REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_current_user INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_synapse_count ON users(synapse_count);

-- ============================================
-- USER CONNECTIONS (Social/Wallet links)
-- ============================================
CREATE TABLE IF NOT EXISTS user_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('twitter', 'discord', 'telegram', 'email', 'wallet')),
  connection_id TEXT NOT NULL,
  display_name TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, connection_type)
);

CREATE INDEX IF NOT EXISTS idx_user_connections_user ON user_connections(user_id);

-- ============================================
-- SYNAPSE NODES (100 nodes across regions)
-- ============================================
CREATE TABLE IF NOT EXISTS synapse_nodes (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES brain_regions(id),
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  state TEXT NOT NULL DEFAULT 'available' CHECK (state IN ('available', 'pending', 'connected')),
  connected_by_user_id TEXT REFERENCES users(id),
  connected_at TEXT,
  base_reward_points INTEGER NOT NULL DEFAULT 100
);

CREATE INDEX IF NOT EXISTS idx_synapse_nodes_region ON synapse_nodes(region_id);
CREATE INDEX IF NOT EXISTS idx_synapse_nodes_state ON synapse_nodes(state);
CREATE INDEX IF NOT EXISTS idx_synapse_nodes_user ON synapse_nodes(connected_by_user_id);

-- ============================================
-- SYNAPSE CONNECTIONS (Node-to-node links)
-- ============================================
CREATE TABLE IF NOT EXISTS synapse_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_node_id TEXT NOT NULL REFERENCES synapse_nodes(id) ON DELETE CASCADE,
  to_node_id TEXT NOT NULL REFERENCES synapse_nodes(id) ON DELETE CASCADE,
  strength REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_node_id, to_node_id)
);

CREATE INDEX IF NOT EXISTS idx_synapse_connections_from ON synapse_connections(from_node_id);
CREATE INDEX IF NOT EXISTS idx_synapse_connections_to ON synapse_connections(to_node_id);

-- ============================================
-- ALLOCATIONS (User -> Node mappings)
-- ============================================
CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES synapse_nodes(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES brain_regions(id),
  base_points INTEGER NOT NULL,
  multiplier_applied REAL NOT NULL DEFAULT 1.0,
  passive_bonus_applied REAL NOT NULL DEFAULT 0.0,
  final_points INTEGER NOT NULL,
  allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(node_id)
);

CREATE INDEX IF NOT EXISTS idx_allocations_user ON allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_allocations_region ON allocations(region_id);

-- ============================================
-- REWARDS (Type-specific reward data)
-- ============================================
CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  allocation_id INTEGER NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('AGI_TOKENS', 'MULTIPLIER', 'STAKING_BOOST', 'NEURAL_KEY')),
  amount REAL NOT NULL,
  description TEXT,
  is_claimed INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_rewards_allocation ON rewards(allocation_id);
CREATE INDEX IF NOT EXISTS idx_rewards_type ON rewards(reward_type);

-- ============================================
-- PASSIVE BONUSES (Active bonuses from regions)
-- ============================================
CREATE TABLE IF NOT EXISTS passive_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES brain_regions(id),
  bonus_percent REAL NOT NULL,
  activated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_passive_bonuses_user ON passive_bonuses(user_id);

-- ============================================
-- TRANSACTIONS (Audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'SYNAPSE_CLAIM',
    'REGION_UNLOCK',
    'POINTS_EARNED',
    'REWARD_CLAIMED',
    'PASSIVE_BONUS_ACTIVATED',
    'TIER_UPGRADE'
  )),
  reference_id TEXT,
  points_delta INTEGER DEFAULT 0,
  description TEXT,
  metadata TEXT, -- JSON string for extra data
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- ============================================
-- VIEWS (Convenience queries)
-- ============================================

-- Region progress view
CREATE VIEW IF NOT EXISTS v_region_progress AS
SELECT
  br.id,
  br.name,
  br.unlock_threshold,
  br.reward_multiplier,
  br.passive_bonus_percent,
  br.is_unlocked,
  br.display_order,
  gs.total_synapses,
  CASE
    WHEN br.is_unlocked = 1 THEN 100.0
    WHEN br.unlock_threshold = 0 THEN 100.0
    ELSE MIN(100.0, (gs.total_synapses * 100.0 / br.unlock_threshold))
  END as progress_percent,
  CASE
    WHEN br.is_unlocked = 1 THEN 0
    ELSE MAX(0, br.unlock_threshold - gs.total_synapses)
  END as synapses_remaining
FROM brain_regions br
CROSS JOIN global_stats gs
ORDER BY br.display_order;

-- User leaderboard view
CREATE VIEW IF NOT EXISTS v_leaderboard AS
SELECT
  u.id,
  u.wallet_address,
  u.display_name,
  u.tier,
  u.total_points,
  u.synapse_count,
  RANK() OVER (ORDER BY u.total_points DESC) as rank
FROM users u
ORDER BY u.total_points DESC;

-- User with total passive bonus view
CREATE VIEW IF NOT EXISTS v_user_bonuses AS
SELECT
  u.id,
  u.wallet_address,
  u.display_name,
  COALESCE(SUM(pb.bonus_percent), 0) as total_passive_bonus
FROM users u
LEFT JOIN passive_bonuses pb ON u.id = pb.user_id
GROUP BY u.id;
