-- name: ListSynapseTypes :many
SELECT * FROM synapse_types ORDER BY sort_order ASC, name ASC;

-- name: GetSynapseType :one
SELECT * FROM synapse_types WHERE id = $1;

-- name: GetSynapseTypeByName :one
SELECT * FROM synapse_types WHERE name = $1;

-- name: CreateSynapseType :one
INSERT INTO synapse_types (id, name, display_name, color_r, color_g, color_b, eta_minutes_min, eta_minutes_max, max_points_per_min, agi_reward_min, agi_reward_max, model_filename, sort_order, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *;

-- name: UpdateSynapseType :exec
UPDATE synapse_types SET
    name = $2,
    display_name = $3,
    color_r = $4,
    color_g = $5,
    color_b = $6,
    eta_minutes_min = $7,
    eta_minutes_max = $8,
    max_points_per_min = $9,
    agi_reward_min = $10,
    agi_reward_max = $11,
    model_filename = $12,
    sort_order = $13,
    updated_at = $14
WHERE id = $1;

-- name: DeleteSynapseType :exec
DELETE FROM synapse_types WHERE id = $1;

-- name: CountSpacesBySynapseType :one
SELECT COUNT(*) FROM spaces WHERE synapse_type = $1;

-- name: SumAGIBySynapseType :one
SELECT COALESCE(SUM(agi_reward), 0)::BIGINT as total_agi FROM spaces WHERE synapse_type = $1;
