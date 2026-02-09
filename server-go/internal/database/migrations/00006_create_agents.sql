-- +goose Up
CREATE TABLE agents (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id              UUID NOT NULL REFERENCES users(id),
    name                  TEXT NOT NULL,
    state                 TEXT NOT NULL DEFAULT 'idle',
    position_x            DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y            DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_z            DOUBLE PRECISION NOT NULL DEFAULT 0,
    start_position_x      DOUBLE PRECISION,
    start_position_y      DOUBLE PRECISION,
    start_position_z      DOUBLE PRECISION,
    target_space_id       UUID,
    travel_start_time     BIGINT,
    travel_duration       BIGINT,
    traits                JSONB NOT NULL DEFAULT '[]',
    wander_dir_x          DOUBLE PRECISION NOT NULL DEFAULT 0,
    wander_dir_y          DOUBLE PRECISION NOT NULL DEFAULT 0,
    wander_dir_z          DOUBLE PRECISION NOT NULL DEFAULT 0,
    wander_phase          DOUBLE PRECISION NOT NULL DEFAULT 0,
    autopilot_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    equipped_items        JSONB NOT NULL DEFAULT '[]',
    current_points_per_min INT NOT NULL DEFAULT 100,
    spaces_discovered     INT NOT NULL DEFAULT 0,
    total_agi_earned      INT NOT NULL DEFAULT 0,
    total_brain_xp_earned INT NOT NULL DEFAULT 0,
    created_at            BIGINT NOT NULL DEFAULT 0,
    creation_cost         INT NOT NULL DEFAULT 100,
    needs_repair          BOOLEAN NOT NULL DEFAULT FALSE,
    ship_type             TEXT NOT NULL DEFAULT 'neuron',
    home_x                DOUBLE PRECISION NOT NULL DEFAULT 0,
    home_y                DOUBLE PRECISION NOT NULL DEFAULT 0,
    home_z                DOUBLE PRECISION NOT NULL DEFAULT 0,
    target_x              DOUBLE PRECISION,
    target_y              DOUBLE PRECISION,
    target_z              DOUBLE PRECISION,
    current_space_id      UUID,
    solve_start_time      BIGINT,
    distance_traveled     DOUBLE PRECISION NOT NULL DEFAULT 0,
    deployed_at           BIGINT,
    trance_active         BOOLEAN NOT NULL DEFAULT FALSE,
    trance_end_time       BIGINT,
    trance_level          INT NOT NULL DEFAULT 0,
    autopilot_target_types  JSONB NOT NULL DEFAULT '[]',
    autopilot_max_points_cap INT NOT NULL DEFAULT 0,
    autopilot_avoid_crowded  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_agents_owner_id ON agents (owner_id);
CREATE INDEX idx_agents_state ON agents (state);
CREATE INDEX idx_agents_target_space_id ON agents (target_space_id);

-- +goose Down
DROP TABLE IF EXISTS agents;
