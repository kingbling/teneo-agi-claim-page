-- name: GetSimulationState :one
SELECT * FROM simulation_state WHERE id = 1;

-- name: UpdateTickCount :exec
UPDATE simulation_state SET tick_count = $1 WHERE id = 1;
