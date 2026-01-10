-- Teneo Discovery Agent Database Schema

-- Spaces (1M+ rows)
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  region TEXT NOT NULL,
  zone TEXT NOT NULL,
  synapse_count INTEGER NOT NULL,
  base_probability REAL NOT NULL,
  state TEXT NOT NULL DEFAULT 'undiscovered',
  solve_progress REAL NOT NULL DEFAULT 0,
  loot_pool INTEGER NOT NULL,
  discovered_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_spaces_region ON spaces(region);
CREATE INDEX IF NOT EXISTS idx_spaces_state ON spaces(state);
CREATE INDEX IF NOT EXISTS idx_spaces_zone ON spaces(zone);

-- Agents (100M+ rows eventually)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  start_position_x REAL,
  start_position_y REAL,
  start_position_z REAL,
  target_space_id TEXT,
  travel_start_time INTEGER,
  travel_duration INTEGER,
  points_balance REAL NOT NULL DEFAULT 0,
  points_burn_rate REAL NOT NULL DEFAULT 1.0,
  traits TEXT NOT NULL DEFAULT '[]',
  spaces_discovered INTEGER NOT NULL DEFAULT 0,
  total_loot INTEGER NOT NULL DEFAULT 0,
  total_points_burned REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (target_space_id) REFERENCES spaces(id)
);

CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_state ON agents(state);
CREATE INDEX IF NOT EXISTS idx_agents_target ON agents(target_space_id);

-- Space solvers (junction table for agents currently solving a space)
CREATE TABLE IF NOT EXISTS space_solvers (
  space_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  PRIMARY KEY (space_id, agent_id),
  FOREIGN KEY (space_id) REFERENCES spaces(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

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
  avg_loot_pool REAL NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_space_clusters_lod ON space_clusters(lod_level);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  staked_amount REAL NOT NULL DEFAULT 0,
  points REAL NOT NULL DEFAULT 1000,
  total_loot_earned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);

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
