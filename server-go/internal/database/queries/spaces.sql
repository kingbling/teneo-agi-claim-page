-- name: GetSpace :one
SELECT * FROM spaces WHERE id = $1;

-- name: GetSpacesByState :many
SELECT * FROM spaces WHERE state = $1 LIMIT $2;

-- name: GetNearestSpace :one
SELECT * FROM spaces
WHERE position_x BETWEEN $1 AND $2
  AND position_y BETWEEN $3 AND $4
  AND position_z BETWEEN $5 AND $6
ORDER BY (position_x - $7)*(position_x - $7) +
         (position_y - $8)*(position_y - $8) +
         (position_z - $9)*(position_z - $9) ASC
LIMIT 1;

-- name: UpdateSpace :exec
UPDATE spaces SET
    state = $2,
    discovered_at = $3,
    points_accumulated = $4,
    current_eta_minutes = $5
WHERE id = $1;

-- name: GetSpaceCount :one
SELECT COUNT(*) FROM spaces;

-- name: GetSpaceStats :one
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE state = 'undiscovered') as undiscovered,
    COUNT(*) FILTER (WHERE state = 'being_solved') as being_solved,
    COUNT(*) FILTER (WHERE state = 'discovered') as discovered
FROM spaces;

-- name: GetRandomUndiscoveredSpace :one
SELECT * FROM spaces WHERE state = 'undiscovered' ORDER BY RANDOM() LIMIT 1;

-- name: GetRandomUndiscoveredSpaceInRegion :one
SELECT * FROM spaces WHERE state = 'undiscovered' AND region = $1 ORDER BY RANDOM() LIMIT 1;

-- name: GetBulkSpaces :many
SELECT position_x, position_y, position_z, state, synapse_type
FROM spaces ORDER BY id;

-- name: GetAllSpaceIDs :many
SELECT id FROM spaces ORDER BY id;

-- name: UpdateSpaceState :exec
UPDATE spaces SET state = $2 WHERE id = $1;

-- name: UpdateSpaceStateIfUndiscovered :execrows
UPDATE spaces SET state = 'being_solved' WHERE id = $1 AND state = 'undiscovered';

-- name: UpdateSpacePointsAndETA :exec
UPDATE spaces SET
    points_accumulated = $2,
    current_eta_minutes = $3,
    state = $4
WHERE id = $1;

-- name: CompleteSpace :exec
UPDATE spaces SET
    state = 'discovered',
    discovered_at = $2,
    points_accumulated = points_required
WHERE id = $1;

-- name: GetNearbyUnoccupiedSpaces :many
SELECT s.* FROM spaces s
LEFT JOIN synapse_explorers se ON s.id = se.synapse_id
WHERE s.state = 'undiscovered' AND se.id IS NULL
ORDER BY
    (s.position_x - $1)*(s.position_x - $1) +
    (s.position_y - $2)*(s.position_y - $2) +
    (s.position_z - $3)*(s.position_z - $3)
LIMIT 5;

-- name: GetSynapseTypeDistribution :many
SELECT
    synapse_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE state = 'discovered') as discovered,
    COUNT(*) FILTER (WHERE state = 'being_solved') as being_explored
FROM spaces
GROUP BY synapse_type;

-- name: GetDiscoveryRateByDay :many
SELECT
    to_char(to_timestamp(discovered_at / 1000), 'YYYY-MM-DD') as day,
    COUNT(*) as count
FROM spaces
WHERE state = 'discovered' AND discovered_at >= $1
GROUP BY day
ORDER BY day;

-- name: ListSpaces :many
SELECT * FROM spaces ORDER BY id LIMIT $1 OFFSET $2;

-- name: GetInProgressSpaces :many
SELECT * FROM spaces WHERE state = 'being_solved' ORDER BY points_accumulated DESC LIMIT $1 OFFSET $2;
