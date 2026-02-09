-- name: GetAllSpaceClusters :many
SELECT * FROM space_clusters;

-- name: GetAllAgentClusters :many
SELECT * FROM agent_clusters;

-- name: GetSpaceCluster :one
SELECT * FROM space_clusters WHERE id = $1;

-- name: UpdateClusterBeingSolvedCount :exec
UPDATE space_clusters SET
    being_solved_count = GREATEST(0, being_solved_count + $2),
    updated_at = $3
WHERE id = $1;

-- name: UpdateClusterCounts :exec
UPDATE space_clusters SET
    being_solved_count = GREATEST(0, being_solved_count + $2),
    discovered_count = discovered_count + $3,
    updated_at = $4
WHERE id = $1;

-- name: DeleteAllSpaceClusters :exec
DELETE FROM space_clusters;

-- name: DeleteAllAgentClusters :exec
DELETE FROM agent_clusters;

-- name: InsertSpaceClusters :exec
INSERT INTO space_clusters (id, lod_level, position_x, position_y, position_z, space_count, discovered_count, being_solved_count, updated_at)
SELECT
    format('%s_%s_%s_%s', $1::int, FLOOR(position_x/$2::float)::int, FLOOR(position_y/$2::float)::int, FLOOR(position_z/$2::float)::int),
    $1::int,
    ROUND(AVG(position_x)::numeric, 2)::float,
    ROUND(AVG(position_y)::numeric, 2)::float,
    ROUND(AVG(position_z)::numeric, 2)::float,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE state = 'discovered')::int,
    COUNT(*) FILTER (WHERE state = 'being_solved')::int,
    $3::bigint
FROM spaces
GROUP BY FLOOR(position_x/$2::float)::int, FLOOR(position_y/$2::float)::int, FLOOR(position_z/$2::float)::int;

-- name: InsertAgentClusters :exec
INSERT INTO agent_clusters (id, lod_level, position_x, position_y, position_z, agent_count, dominant_state, avg_progress, updated_at)
SELECT
    format('a%s_%s_%s_%s', $1::int, FLOOR(position_x/$2::float)::int, FLOOR(position_y/$2::float)::int, FLOOR(position_z/$2::float)::int),
    $1::int,
    ROUND(AVG(position_x)::numeric, 2)::float,
    ROUND(AVG(position_y)::numeric, 2)::float,
    ROUND(AVG(position_z)::numeric, 2)::float,
    COUNT(*)::int,
    (SELECT a2.state FROM agents a2
     WHERE FLOOR(a2.position_x/$2::float)::int = FLOOR(agents.position_x/$2::float)::int
       AND FLOOR(a2.position_y/$2::float)::int = FLOOR(agents.position_y/$2::float)::int
       AND FLOOR(a2.position_z/$2::float)::int = FLOOR(agents.position_z/$2::float)::int
     GROUP BY a2.state ORDER BY COUNT(*) DESC LIMIT 1),
    0,
    $3::bigint
FROM agents
GROUP BY FLOOR(position_x/$2::float)::int, FLOOR(position_y/$2::float)::int, FLOOR(position_z/$2::float)::int;
