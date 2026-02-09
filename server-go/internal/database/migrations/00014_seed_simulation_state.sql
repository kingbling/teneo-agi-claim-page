-- +goose Up
INSERT INTO simulation_state (id, tick_count, last_tick_at, is_running)
VALUES (1, 0, 0, TRUE)
ON CONFLICT (id) DO NOTHING;

-- +goose Down
DELETE FROM simulation_state WHERE id = 1;
