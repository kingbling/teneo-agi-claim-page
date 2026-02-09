-- name: GetSynapseExplorers :many
SELECT * FROM synapse_explorers WHERE synapse_id = $1;

-- name: GetSynapseExplorerCount :one
SELECT COUNT(*) FROM synapse_explorers WHERE synapse_id = $1;

-- name: GetExplorerByShip :one
SELECT * FROM synapse_explorers WHERE ship_id = $1;

-- name: AddSynapseExplorer :one
INSERT INTO synapse_explorers (id, synapse_id, ship_id, user_id, points_contributed, points_per_minute, joined_at, last_updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateExplorerPoints :exec
UPDATE synapse_explorers SET
    points_contributed = points_contributed + $2,
    last_updated_at = $3
WHERE id = $1;

-- name: UpdateExplorerRate :exec
UPDATE synapse_explorers SET
    points_per_minute = $2,
    last_updated_at = $3
WHERE id = $1;

-- name: RemoveSynapseExplorer :exec
DELETE FROM synapse_explorers WHERE ship_id = $1;

-- name: ClearSynapseExplorers :exec
DELETE FROM synapse_explorers WHERE synapse_id = $1;

-- name: GetActiveSynapseIDs :many
SELECT DISTINCT synapse_id FROM synapse_explorers;

-- name: GetAllExplorers :many
SELECT * FROM synapse_explorers;

-- name: GetActiveExplorationCount :one
SELECT COUNT(DISTINCT synapse_id) FROM synapse_explorers;
