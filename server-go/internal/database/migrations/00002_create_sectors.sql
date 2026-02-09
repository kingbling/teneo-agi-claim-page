-- +goose Up
CREATE TABLE sectors (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    description             TEXT,
    is_active               BOOLEAN NOT NULL DEFAULT FALSE,
    unlock_condition        TEXT,
    reward_pool             INT NOT NULL DEFAULT 0,
    start_date              BIGINT,
    end_date                BIGINT,
    created_at              BIGINT NOT NULL DEFAULT 0,
    region                  TEXT NOT NULL DEFAULT 'frontal',
    start_time              BIGINT,
    end_time                BIGINT,
    total_synapses          INT NOT NULL DEFAULT 0,
    completed_synapses      INT NOT NULL DEFAULT 0,
    total_agi_rewards       INT NOT NULL DEFAULT 0,
    distributed_agi_rewards INT NOT NULL DEFAULT 0,
    participant_count       INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_sectors_is_active ON sectors (is_active);

-- +goose Down
DROP TABLE IF EXISTS sectors;
