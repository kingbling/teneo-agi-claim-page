-- +goose Up
CREATE TABLE ship_types (
    id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name                  TEXT NOT NULL UNIQUE,
    display_name          TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    creation_cost         INT NOT NULL DEFAULT 0,
    speed_multiplier      REAL NOT NULL DEFAULT 1.0,
    solve_speed_multiplier REAL NOT NULL DEFAULT 1.0,
    fuel_capacity         INT NOT NULL DEFAULT 100,
    detection_radius      REAL NOT NULL DEFAULT 2.0,
    model_filename        TEXT,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order            INT NOT NULL DEFAULT 0,
    created_at            BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    updated_at            BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

INSERT INTO ship_types (name, display_name, description, creation_cost, speed_multiplier, solve_speed_multiplier, fuel_capacity, detection_radius, sort_order) VALUES
    ('neuron',   'Neuron',   'Free starter vessel. Balanced baseline stats across the board.',                             0,   1.0, 1.0, 100, 2.0, 1),
    ('synapse',  'Synapse',  'Heavy explorer. Slow but powerful solver with wide detection range.',                        100, 0.7, 1.4, 100, 3.0, 2),
    ('dendrite', 'Dendrite', 'Sleek scout. Lightning fast travel but weak solver and limited fuel.',                       150, 1.5, 0.6, 80,  2.0, 3),
    ('axon',     'Axon',     'Signal carrier. Fast with a large fuel tank, slight solve penalty.',                         200, 1.3, 0.9, 150, 2.5, 4),
    ('cortex',   'Cortex',   'Premium command vessel. Well-rounded with enhanced stats across all categories.',            500, 1.1, 1.2, 200, 3.5, 5);

-- +goose Down
DROP TABLE IF EXISTS ship_types;
