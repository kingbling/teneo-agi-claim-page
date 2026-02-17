-- +goose Up
ALTER TABLE synapse_types
  ADD COLUMN eta_minutes_min INT NOT NULL DEFAULT 10,
  ADD COLUMN eta_minutes_max INT NOT NULL DEFAULT 30,
  ADD COLUMN max_points_per_min INT NOT NULL DEFAULT 100;

UPDATE synapse_types SET eta_minutes_min = 10,  eta_minutes_max = 30,   max_points_per_min = 100  WHERE name = 'minor';
UPDATE synapse_types SET eta_minutes_min = 60,  eta_minutes_max = 180,  max_points_per_min = 500  WHERE name = 'complex';
UPDATE synapse_types SET eta_minutes_min = 360, eta_minutes_max = 1440, max_points_per_min = 2000 WHERE name = 'deep';

ALTER TABLE synapse_types DROP COLUMN points_required;

-- +goose Down
ALTER TABLE synapse_types ADD COLUMN points_required INT NOT NULL DEFAULT 6000;
UPDATE synapse_types SET points_required = 6000    WHERE name = 'minor';
UPDATE synapse_types SET points_required = 120000  WHERE name = 'complex';
UPDATE synapse_types SET points_required = 2000000 WHERE name = 'deep';
ALTER TABLE synapse_types DROP COLUMN eta_minutes_min, DROP COLUMN eta_minutes_max, DROP COLUMN max_points_per_min;
