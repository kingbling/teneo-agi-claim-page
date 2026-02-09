-- +goose Up
CREATE TABLE agent_clusters (
    id              TEXT PRIMARY KEY,
    lod_level       INT NOT NULL,
    position_x      DOUBLE PRECISION NOT NULL,
    position_y      DOUBLE PRECISION NOT NULL,
    position_z      DOUBLE PRECISION NOT NULL,
    agent_count     INT NOT NULL DEFAULT 0,
    dominant_state  TEXT NOT NULL DEFAULT '',
    avg_progress    DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_agent_clusters_lod_level ON agent_clusters (lod_level);

-- +goose Down
DROP TABLE IF EXISTS agent_clusters;
