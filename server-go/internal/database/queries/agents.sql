-- name: GetAgent :one
SELECT * FROM agents WHERE id = $1;

-- name: GetAgentsByOwner :many
SELECT * FROM agents WHERE owner_id = $1;

-- name: CreateAgent :one
INSERT INTO agents (
    id, owner_id, name, state, position_x, position_y, position_z,
    traits, wander_dir_x, wander_dir_y, wander_dir_z, wander_phase,
    autopilot_enabled, equipped_items, current_points_per_min,
    spaces_discovered, total_agi_earned, total_brain_xp_earned,
    created_at, creation_cost, needs_repair, ship_type,
    home_x, home_y, home_z, distance_traveled,
    trance_active, trance_level,
    autopilot_target_types, autopilot_max_points_cap, autopilot_avoid_crowded
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, $10, $11, $12,
    $13, $14, $15,
    $16, $17, $18,
    $19, $20, $21, $22,
    $23, $24, $25, $26,
    $27, $28,
    $29, $30, $31
) RETURNING *;

-- name: UpdateAgent :exec
UPDATE agents SET
    name = $2, state = $3,
    position_x = $4, position_y = $5, position_z = $6,
    start_position_x = $7, start_position_y = $8, start_position_z = $9,
    target_space_id = $10, travel_start_time = $11, travel_duration = $12,
    target_x = $13, target_y = $14, target_z = $15,
    current_space_id = $16, current_points_per_min = $17,
    autopilot_enabled = $18,
    home_x = $19, home_y = $20, home_z = $21
WHERE id = $1;

-- name: GetAgentCount :one
SELECT COUNT(*) FROM agents;

-- name: GetAgentsByState :many
SELECT * FROM agents WHERE state = $1;

-- name: GetAgentCountByState :one
SELECT COUNT(*) FROM agents WHERE state = $1;

-- name: GetTravelingAgentsWithTargets :many
SELECT
    a.id, a.owner_id, a.target_space_id,
    a.start_position_x, a.start_position_y, a.start_position_z,
    a.travel_start_time, a.travel_duration, a.current_points_per_min,
    s.position_x as target_x, s.position_y as target_y, s.position_z as target_z
FROM agents a
JOIN spaces s ON a.target_space_id = s.id
WHERE a.state = 'traveling';

-- name: UpdateAgentStateToSolving :exec
UPDATE agents SET
    state = 'solving',
    target_space_id = $2,
    current_space_id = $2,
    current_points_per_min = $3
WHERE id = $1;

-- name: UpdateAgentArrival :exec
UPDATE agents SET
    position_x = $2, position_y = $3, position_z = $4,
    travel_start_time = NULL, travel_duration = NULL,
    start_position_x = NULL, start_position_y = NULL, start_position_z = NULL
WHERE id = $1;

-- name: UpdateAgentToIdle :exec
UPDATE agents SET
    state = 'idle',
    target_space_id = NULL,
    current_space_id = NULL,
    travel_start_time = NULL,
    travel_duration = NULL,
    start_position_x = NULL,
    start_position_y = NULL,
    start_position_z = NULL
WHERE id = $1;

-- name: UpdateAgentToTraveling :exec
UPDATE agents SET
    state = 'traveling',
    target_space_id = $2,
    current_space_id = NULL,
    position_x = $3, position_y = $4, position_z = $5,
    start_position_x = $3, start_position_y = $4, start_position_z = $5,
    travel_start_time = $6,
    travel_duration = $7
WHERE id = $1;

-- name: IncrementAgentStats :exec
UPDATE agents SET
    total_agi_earned = total_agi_earned + $2,
    spaces_discovered = spaces_discovered + 1
WHERE id = $1;

-- name: UpdateAgentAutopilot :exec
UPDATE agents SET autopilot_enabled = $2 WHERE id = $1;

-- name: ResetAgentToIdle :exec
UPDATE agents SET
    state = 'idle',
    target_space_id = NULL,
    current_space_id = NULL,
    travel_start_time = NULL,
    travel_duration = NULL,
    start_position_x = NULL,
    start_position_y = NULL,
    start_position_z = NULL
WHERE id = $1;

-- name: GetAgentStateCounts :many
SELECT state, COUNT(*) as count FROM agents GROUP BY state;

-- name: ListAgents :many
SELECT * FROM agents ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: GetAgentIDsByState :many
SELECT id FROM agents WHERE state = $1;

-- name: UpdateAgentPosition :exec
UPDATE agents SET position_x = $2, position_y = $3, position_z = $4 WHERE id = $1;
