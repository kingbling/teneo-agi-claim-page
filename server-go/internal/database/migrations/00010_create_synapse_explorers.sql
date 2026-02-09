-- +goose Up
CREATE TABLE synapse_explorers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    synapse_id          UUID NOT NULL REFERENCES spaces(id),
    ship_id             UUID NOT NULL REFERENCES agents(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    points_contributed  INT NOT NULL DEFAULT 0,
    points_per_minute   INT NOT NULL DEFAULT 100,
    joined_at           BIGINT NOT NULL DEFAULT 0,
    last_updated_at     BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_synapse_explorers_synapse_id ON synapse_explorers (synapse_id);
CREATE INDEX idx_synapse_explorers_ship_id ON synapse_explorers (ship_id);
CREATE INDEX idx_synapse_explorers_user_id ON synapse_explorers (user_id);

-- +goose Down
DROP TABLE IF EXISTS synapse_explorers;
