-- +goose Up
CREATE TABLE live_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    event_type  TEXT NOT NULL,
    multiplier  DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    start_time  BIGINT NOT NULL,
    end_time    BIGINT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_live_events_is_active ON live_events (is_active);

-- +goose Down
DROP TABLE IF EXISTS live_events;
