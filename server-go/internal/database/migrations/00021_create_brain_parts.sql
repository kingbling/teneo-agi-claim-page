-- +goose Up
CREATE TABLE brain_parts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    center_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    center_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    center_z DOUBLE PRECISION NOT NULL DEFAULT 0,
    radius DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    color_r REAL NOT NULL DEFAULT 0.5,
    color_g REAL NOT NULL DEFAULT 0.7,
    color_b REAL NOT NULL DEFAULT 1.0,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0
);

-- Seed with the 10 brain regions from brainshape.go (all disabled by default)
INSERT INTO brain_parts (id, name, display_name, description, center_x, center_y, center_z, radius, color_r, color_g, color_b, is_enabled, sort_order, created_at, updated_at) VALUES
    ('bp_prefrontal',   'prefrontal_cortex',     'Prefrontal Cortex',     'Executive function, decision making, personality', -0.6, 0.5, 0.2, 0.4,  0.3, 0.6, 1.0, FALSE, 1,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_motor',        'motor_cortex',          'Motor Cortex',          'Voluntary movement control',                      -0.4, 0.7, 0.0, 0.3,  0.9, 0.3, 0.3, FALSE, 2,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_somatosensory','somatosensory_cortex',  'Somatosensory Cortex',  'Touch, temperature, body position',               -0.5, 0.4, -0.3, 0.3, 1.0, 0.7, 0.2, FALSE, 3,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_auditory',     'auditory_cortex',       'Auditory Cortex',       'Sound processing and interpretation',               0.6, -0.2, 0.2, 0.3, 0.5, 0.9, 0.4, FALSE, 4,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_visual',       'visual_cortex',         'Visual Cortex',         'Visual information processing',                     0.4, -0.6, -0.1, 0.4, 0.8, 0.4, 0.9, FALSE, 5,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_hippocampus',  'hippocampus',           'Hippocampus',           'Memory formation and spatial navigation',            0.5, -0.3, 0.1, 0.25, 0.2, 0.8, 0.6, FALSE, 6,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_thalamus',     'thalamus',              'Thalamus',              'Sensory relay center',                               0.0, 0.0, 0.0, 0.2,  0.9, 0.9, 0.3, FALSE, 7,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_cerebellum',   'cerebellum',            'Cerebellum',            'Motor coordination, balance, learning',              0.0, -0.8, -0.4, 0.35, 0.6, 0.3, 0.8, FALSE, 8,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_temporal',     'temporal_lobe',         'Temporal Lobe',         'Language comprehension, auditory processing',        0.7, -0.1, 0.3, 0.3,  0.3, 0.7, 0.5, FALSE, 9,  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    ('bp_parietal',     'parietal_lobe',         'Parietal Lobe',         'Spatial awareness, sensory integration',            -0.6, 0.3, -0.2, 0.3,  0.7, 0.5, 0.3, FALSE, 10, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000);

-- +goose Down
DROP TABLE IF EXISTS brain_parts;
