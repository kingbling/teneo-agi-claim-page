-- name: GetOverviewUserCounts :one
SELECT
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE banned_at IS NULL) as active_users,
    COUNT(*) FILTER (WHERE banned_at IS NOT NULL) as banned_users
FROM users;

-- name: GetOverviewAgentCounts :one
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE state = 'idle') as idle,
    COUNT(*) FILTER (WHERE state = 'searching') as searching,
    COUNT(*) FILTER (WHERE state = 'traveling') as traveling,
    COUNT(*) FILTER (WHERE state = 'solving') as solving
FROM agents;

-- name: GetOverviewSpaceCounts :one
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE state = 'discovered') as discovered,
    COUNT(*) FILTER (WHERE state = 'being_solved') as being_explored
FROM spaces;

-- name: GetTopUsersByAGI :many
SELECT id, wallet, total_agi_earned, points, usdc_spent, agentic_balance
FROM users ORDER BY total_agi_earned DESC LIMIT $1;

-- name: GetTopUsersByPoints :many
SELECT id, wallet, total_agi_earned, points, usdc_spent, agentic_balance
FROM users ORDER BY points DESC LIMIT $1;

-- name: GetTopUsersByUSDC :many
SELECT id, wallet, total_agi_earned, points, usdc_spent, agentic_balance
FROM users ORDER BY usdc_spent DESC LIMIT $1;

-- name: GetTopUsersByAgentic :many
SELECT id, wallet, total_agi_earned, points, usdc_spent, agentic_balance
FROM users ORDER BY agentic_balance DESC LIMIT $1;

-- name: GetStuckAgents :many
SELECT * FROM agents
WHERE (state = 'traveling' AND travel_start_time IS NOT NULL AND travel_start_time + travel_duration < $1)
   OR (state = 'solving' AND NOT EXISTS (SELECT 1 FROM synapse_explorers WHERE ship_id = agents.id))
LIMIT 100;

-- name: GrantTokens :exec
UPDATE users SET
    points = points + $2,
    total_agi_earned = total_agi_earned + $3,
    agentic_balance = agentic_balance + $4
WHERE id = $1;
