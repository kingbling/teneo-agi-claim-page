-- +goose Up
CREATE TABLE spaces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_x          DOUBLE PRECISION NOT NULL,
    position_y          DOUBLE PRECISION NOT NULL,
    position_z          DOUBLE PRECISION NOT NULL,
    region              TEXT NOT NULL,
    zone                TEXT NOT NULL,
    synapse_count       INT NOT NULL DEFAULT 1,
    state               TEXT NOT NULL DEFAULT 'undiscovered',
    discovered_at       BIGINT,
    synapse_type        TEXT NOT NULL DEFAULT 'minor',
    points_required     INT NOT NULL DEFAULT 6000,
    points_accumulated  INT NOT NULL DEFAULT 0,
    current_eta_minutes INT,
    sector_id           UUID REFERENCES sectors(id),
    agi_reward          INT NOT NULL DEFAULT 10,
    brain_xp_reward     INT NOT NULL DEFAULT 100
);

CREATE INDEX idx_spaces_state ON spaces (state);
CREATE INDEX idx_spaces_region ON spaces (region);
CREATE INDEX idx_spaces_zone ON spaces (zone);
CREATE INDEX idx_spaces_synapse_type ON spaces (synapse_type);
CREATE INDEX idx_spaces_sector_id ON spaces (sector_id);

-- +goose Down
DROP TABLE IF EXISTS spaces;
