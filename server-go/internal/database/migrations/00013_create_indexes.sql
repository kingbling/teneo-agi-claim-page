-- +goose Up
-- Composite indexes for common query patterns

-- Spaces: undiscovered lookup with no active explorers (for autopilot/redirect)
CREATE INDEX idx_spaces_state_undiscovered ON spaces (state) WHERE state = 'undiscovered';

-- Spaces: being_solved for progress tracking
CREATE INDEX idx_spaces_state_being_solved ON spaces (state) WHERE state = 'being_solved';

-- Agents: traveling state for tick processing
CREATE INDEX idx_agents_state_traveling ON agents (state) WHERE state = 'traveling';

-- Agents: solving state for tick processing
CREATE INDEX idx_agents_state_solving ON agents (state) WHERE state = 'solving';

-- User purchases: active ship boosts
CREATE INDEX idx_user_purchases_ship_active ON user_purchases (ship_id, is_active) WHERE is_active = TRUE;

-- Live events: active events in time range
CREATE INDEX idx_live_events_active_time ON live_events (is_active, start_time, end_time) WHERE is_active = TRUE;

-- +goose Down
DROP INDEX IF EXISTS idx_spaces_state_undiscovered;
DROP INDEX IF EXISTS idx_spaces_state_being_solved;
DROP INDEX IF EXISTS idx_agents_state_traveling;
DROP INDEX IF EXISTS idx_agents_state_solving;
DROP INDEX IF EXISTS idx_user_purchases_ship_active;
DROP INDEX IF EXISTS idx_live_events_active_time;
