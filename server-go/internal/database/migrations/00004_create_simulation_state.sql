-- +goose Up
CREATE TABLE simulation_state (
    id          INT PRIMARY KEY CHECK (id = 1),
    tick_count  BIGINT NOT NULL DEFAULT 0,
    last_tick_at BIGINT NOT NULL DEFAULT 0,
    is_running  BOOLEAN NOT NULL DEFAULT TRUE
);

-- +goose Down
DROP TABLE IF EXISTS simulation_state;
