-- +goose Up
CREATE TABLE space_clusters (
    id                 TEXT PRIMARY KEY,
    lod_level          INT NOT NULL,
    position_x         DOUBLE PRECISION NOT NULL,
    position_y         DOUBLE PRECISION NOT NULL,
    position_z         DOUBLE PRECISION NOT NULL,
    space_count        INT NOT NULL DEFAULT 0,
    discovered_count   INT NOT NULL DEFAULT 0,
    being_solved_count INT NOT NULL DEFAULT 0,
    updated_at         BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_space_clusters_lod_level ON space_clusters (lod_level);

-- +goose Down
DROP TABLE IF EXISTS space_clusters;
