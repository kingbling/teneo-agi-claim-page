-- Teneo Portal Masterplan 2026 Database Schema

-- ============================================================================
-- SYNAPSES (formerly "spaces") - 7 synapse types with points-based exploration
-- ============================================================================
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  region TEXT NOT NULL,
  zone TEXT NOT NULL,
  synapse_count INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'undiscovered',
  discovered_at INTEGER,

  -- Masterplan 2026: Synapse Type System
  synapse_type TEXT NOT NULL DEFAULT 'minor',           -- minor|complex|deep|core|rare|legendary|unique
  points_required INTEGER NOT NULL DEFAULT 6000,        -- Total points to complete
  points_accumulated INTEGER NOT NULL DEFAULT 0,        -- Current accumulated points
  current_eta_minutes INTEGER,                          -- Calculated ETA with collaboration
  sector_id TEXT,                                       -- Season/sector this synapse belongs to
  agi_reward INTEGER NOT NULL DEFAULT 10                -- $AGI reward for completion
);

CREATE INDEX IF NOT EXISTS idx_spaces_region ON spaces(region);
CREATE INDEX IF NOT EXISTS idx_spaces_state ON spaces(state);
CREATE INDEX IF NOT EXISTS idx_spaces_zone ON spaces(zone);
CREATE INDEX IF NOT EXISTS idx_spaces_synapse_type ON spaces(synapse_type);
CREATE INDEX IF NOT EXISTS idx_spaces_sector ON spaces(sector_id);

-- ============================================================================
-- SHIPS (formerly "agents") - No fuel system, autopilot + items
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle',                   -- idle|exploring|deploying|returning
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  start_position_x REAL,
  start_position_y REAL,
  start_position_z REAL,
  target_space_id TEXT,                                 -- Current synapse being explored
  travel_start_time INTEGER,
  travel_duration INTEGER,

  traits TEXT NOT NULL DEFAULT '[]',

  -- Masterplan 2026: Ship System
  autopilot_enabled INTEGER NOT NULL DEFAULT 0,         -- Auto-find next synapse when done
  equipped_items TEXT NOT NULL DEFAULT '[]',            -- JSON array of equipped item IDs
  current_points_per_min INTEGER NOT NULL DEFAULT 100,  -- Active spending rate

  -- Stats
  spaces_discovered INTEGER NOT NULL DEFAULT 0,
  total_agi_earned INTEGER NOT NULL DEFAULT 0,          -- Total $AGI earned by this ship
  created_at INTEGER NOT NULL,
  FOREIGN KEY (target_space_id) REFERENCES spaces(id)
);

CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_state ON agents(state);
CREATE INDEX IF NOT EXISTS idx_agents_target ON agents(target_space_id);

-- ============================================================================
-- SYNAPSE EXPLORERS - Tracks ships exploring synapses with points contribution
-- ============================================================================
CREATE TABLE IF NOT EXISTS synapse_explorers (
  id TEXT PRIMARY KEY,
  synapse_id TEXT NOT NULL,
  ship_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  points_contributed INTEGER NOT NULL DEFAULT 0,        -- Total points contributed
  points_per_minute INTEGER NOT NULL DEFAULT 100,       -- Current spending rate
  joined_at INTEGER NOT NULL,
  last_updated_at INTEGER NOT NULL,
  FOREIGN KEY (synapse_id) REFERENCES spaces(id),
  FOREIGN KEY (ship_id) REFERENCES agents(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_synapse_explorers_synapse ON synapse_explorers(synapse_id);
CREATE INDEX IF NOT EXISTS idx_synapse_explorers_ship ON synapse_explorers(ship_id);
CREATE INDEX IF NOT EXISTS idx_synapse_explorers_user ON synapse_explorers(user_id);

-- Agent clusters (pre-computed for visualization)
CREATE TABLE IF NOT EXISTS agent_clusters (
  id TEXT PRIMARY KEY,
  lod_level INTEGER NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  agent_count INTEGER NOT NULL,
  dominant_state TEXT NOT NULL,
  avg_progress REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_clusters_lod ON agent_clusters(lod_level);

-- Space clusters (pre-computed for visualization)
CREATE TABLE IF NOT EXISTS space_clusters (
  id TEXT PRIMARY KEY,
  lod_level INTEGER NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  space_count INTEGER NOT NULL,
  discovered_count INTEGER NOT NULL DEFAULT 0,
  being_solved_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_space_clusters_lod ON space_clusters(lod_level);

-- ============================================================================
-- USERS - User accounts with Masterplan 2026 progression
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  staked_amount REAL NOT NULL DEFAULT 0,
  points REAL NOT NULL DEFAULT 1000,
  total_loot_earned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,

  -- Masterplan 2026: User Levels (based on USDC spent)
  user_level INTEGER NOT NULL DEFAULT 1,                -- 1-5 based on cumulative USDC spent
  usdc_spent REAL NOT NULL DEFAULT 0,                   -- Cumulative USDC spent (for level calculation)

  -- Masterplan 2026: Token Balances
  agentic_balance INTEGER NOT NULL DEFAULT 0,           -- $AGENTIC for shop purchases
  total_agi_earned INTEGER NOT NULL DEFAULT 0,          -- Total $AGI earned
  total_teneo_earned INTEGER NOT NULL DEFAULT 0,        -- Total $TENEO earned (future)

  -- Masterplan 2026: Lottery & NFTs
  lottery_tickets INTEGER NOT NULL DEFAULT 0,           -- Consolation tickets for lottery losers
  nft_count INTEGER NOT NULL DEFAULT 0,                 -- Number of NFTs owned

  -- Masterplan 2026: Ship Management
  max_ships INTEGER NOT NULL DEFAULT 1                  -- Maximum ships allowed (from user level)
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(user_level);

-- Discovery events (history)
CREATE TABLE IF NOT EXISTS discovery_events (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  discovered_at INTEGER NOT NULL,
  total_loot INTEGER NOT NULL,
  FOREIGN KEY (space_id) REFERENCES spaces(id)
);

-- Loot distribution (per-agent rewards)
CREATE TABLE IF NOT EXISTS loot_distributions (
  id TEXT PRIMARY KEY,
  discovery_event_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  FOREIGN KEY (discovery_event_id) REFERENCES discovery_events(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Simulation state (singleton)
CREATE TABLE IF NOT EXISTS simulation_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tick_count INTEGER NOT NULL DEFAULT 0,
  last_tick_at INTEGER NOT NULL,
  is_running INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO simulation_state (id, tick_count, last_tick_at, is_running)
VALUES (1, 0, 0, 1);

-- ============================================================================
-- MASTERPLAN 2026: SECTORS (Seasons)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,                 -- Only one active at a time
  unlock_condition TEXT,                                -- JSON: { type: 'date'|'level', value: ... }
  reward_pool INTEGER NOT NULL DEFAULT 0,               -- Total $AGI in this sector
  start_date INTEGER,                                   -- When sector becomes active
  end_date INTEGER,                                     -- When sector ends
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sectors_active ON sectors(is_active);

-- ============================================================================
-- MASTERPLAN 2026: ITEM SHOP
-- ============================================================================
CREATE TABLE IF NOT EXISTS item_shop (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL,                                -- Cost in $AGENTIC
  effect_type TEXT NOT NULL,                            -- speed_boost|luck_charm|xp_amplifier|radar|cloak
  effect_value REAL NOT NULL,                           -- Numeric effect value
  duration_minutes INTEGER,                             -- Duration in minutes, NULL = permanent/single-use
  is_available INTEGER NOT NULL DEFAULT 1,              -- Whether item is currently for sale
  created_at INTEGER NOT NULL
);

-- ============================================================================
-- MASTERPLAN 2026: USER PURCHASES
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  ship_id TEXT,                                         -- Ship item is equipped to (if applicable)
  purchased_at INTEGER NOT NULL,
  expires_at INTEGER,                                   -- When item effect expires
  is_active INTEGER NOT NULL DEFAULT 1,                 -- Whether item is currently active
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES item_shop(id),
  FOREIGN KEY (ship_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_active ON user_purchases(is_active);
CREATE INDEX IF NOT EXISTS idx_user_purchases_ship_active ON user_purchases(ship_id, is_active, expires_at);

-- ============================================================================
-- MASTERPLAN 2026: LOTTERY DRAWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS lottery_draws (
  id TEXT PRIMARY KEY,
  synapse_id TEXT NOT NULL,
  synapse_type TEXT NOT NULL,                           -- deep|core|rare|legendary|unique
  winner_user_id TEXT NOT NULL,
  winner_ship_id TEXT NOT NULL,
  reward_agi INTEGER NOT NULL,                          -- $AGI awarded to winner
  total_participants INTEGER NOT NULL,                  -- Number of explorers
  total_points_contributed INTEGER NOT NULL,            -- Total points from all explorers
  winner_contribution INTEGER NOT NULL,                 -- Winner's points contribution
  drawn_at INTEGER NOT NULL,
  FOREIGN KEY (synapse_id) REFERENCES spaces(id),
  FOREIGN KEY (winner_user_id) REFERENCES users(id),
  FOREIGN KEY (winner_ship_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_draws_synapse ON lottery_draws(synapse_id);
CREATE INDEX IF NOT EXISTS idx_lottery_draws_winner ON lottery_draws(winner_user_id);
CREATE INDEX IF NOT EXISTS idx_lottery_draws_date ON lottery_draws(drawn_at);

-- ============================================================================
-- MASTERPLAN 2026: LEADERBOARD SNAPSHOTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id TEXT PRIMARY KEY,
  leaderboard_type TEXT NOT NULL,                       -- weekly_agi|total_discoveries|sector
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  period_start INTEGER NOT NULL,                        -- Start of leaderboard period
  period_end INTEGER NOT NULL,                          -- End of leaderboard period
  snapshot_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_type ON leaderboard_snapshots(leaderboard_type);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard_snapshots(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard_snapshots(user_id);

-- ============================================================================
-- MASTERPLAN 2026: LIVE EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS live_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,                             -- double_xp|bonus_agi|special_synapse|etc
  multiplier REAL NOT NULL DEFAULT 1.0,                 -- Reward multiplier during event
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_events_active ON live_events(is_active);
CREATE INDEX IF NOT EXISTS idx_live_events_time ON live_events(start_time, end_time);

-- ============================================================================
-- MASTERPLAN 2026: NFT INVENTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS nfts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nft_type TEXT NOT NULL,                               -- synapse_discovery|achievement|special
  synapse_id TEXT,                                      -- Associated synapse (if synapse NFT)
  metadata TEXT NOT NULL,                               -- JSON metadata
  minted_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (synapse_id) REFERENCES spaces(id)
);

CREATE INDEX IF NOT EXISTS idx_nfts_user ON nfts(user_id);
CREATE INDEX IF NOT EXISTS idx_nfts_type ON nfts(nft_type);
