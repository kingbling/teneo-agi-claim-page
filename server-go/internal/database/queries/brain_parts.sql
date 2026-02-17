-- name: ListBrainParts :many
SELECT * FROM brain_parts ORDER BY sort_order ASC, name ASC;

-- name: ListEnabledBrainParts :many
SELECT * FROM brain_parts WHERE is_enabled = TRUE ORDER BY sort_order ASC, name ASC;

-- name: GetBrainPart :one
SELECT * FROM brain_parts WHERE id = $1;

-- name: GetBrainPartByName :one
SELECT * FROM brain_parts WHERE name = $1;

-- name: CreateBrainPart :one
INSERT INTO brain_parts (id, name, display_name, description, center_x, center_y, center_z, radius, color_r, color_g, color_b, is_enabled, sort_order, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *;

-- name: UpdateBrainPart :exec
UPDATE brain_parts SET
    name = $2,
    display_name = $3,
    description = $4,
    center_x = $5,
    center_y = $6,
    center_z = $7,
    radius = $8,
    color_r = $9,
    color_g = $10,
    color_b = $11,
    is_enabled = $12,
    sort_order = $13,
    updated_at = $14
WHERE id = $1;

-- name: CountSpacesByRegion :one
SELECT COUNT(*) FROM spaces WHERE region = $1;
