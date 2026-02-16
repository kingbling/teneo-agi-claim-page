-- +goose Up
CREATE TABLE synapse_types (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name            TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    color_r         REAL NOT NULL DEFAULT 0.5,
    color_g         REAL NOT NULL DEFAULT 0.7,
    color_b         REAL NOT NULL DEFAULT 1.0,
    points_required INT NOT NULL,
    agi_reward_min  INT NOT NULL,
    agi_reward_max  INT NOT NULL,
    model_filename  TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    updated_at      BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

INSERT INTO synapse_types (name, display_name, color_r, color_g, color_b, points_required, agi_reward_min, agi_reward_max, sort_order) VALUES
    ('minor',   'Minor',   0.5, 0.7, 1.0, 6000,      3,       10,      1),
    ('complex', 'Complex', 0.7, 0.5, 1.0, 120000,     50,      200,     2),
    ('deep',    'Deep',    0.4, 1.0, 0.7, 2000000,    500,     4000,    3);

-- +goose Down
DROP TABLE IF EXISTS synapse_types;
