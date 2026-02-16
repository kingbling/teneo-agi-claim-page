-- name: ListShipTypes :many
SELECT * FROM ship_types ORDER BY sort_order ASC, name ASC;

-- name: ListActiveShipTypes :many
SELECT * FROM ship_types WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC;

-- name: GetShipType :one
SELECT * FROM ship_types WHERE id = $1;

-- name: GetShipTypeByName :one
SELECT * FROM ship_types WHERE name = $1;

-- name: CreateShipType :one
INSERT INTO ship_types (id, name, display_name, description, creation_cost, speed_multiplier, solve_speed_multiplier, fuel_capacity, detection_radius, model_filename, is_active, sort_order, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: UpdateShipType :exec
UPDATE ship_types SET
    name = $2,
    display_name = $3,
    description = $4,
    creation_cost = $5,
    speed_multiplier = $6,
    solve_speed_multiplier = $7,
    fuel_capacity = $8,
    detection_radius = $9,
    model_filename = $10,
    is_active = $11,
    sort_order = $12,
    updated_at = $13
WHERE id = $1;

-- name: DeleteShipType :exec
DELETE FROM ship_types WHERE id = $1;

-- name: CountAgentsByShipType :one
SELECT COUNT(*) FROM agents WHERE ship_type = $1;
