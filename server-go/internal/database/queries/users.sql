-- name: GetUser :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByWallet :one
SELECT * FROM users WHERE wallet = $1;

-- name: CreateUser :one
INSERT INTO users (id, wallet, tier, staked_amount, points, total_loot_earned, created_at, user_level, usdc_spent, agentic_balance, total_agi_earned, total_teneo_earned, lottery_tickets, nft_count, max_ships, is_admin)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
RETURNING *;

-- name: UpdateUser :exec
UPDATE users SET
    tier = $2,
    staked_amount = $3,
    points = $4,
    total_loot_earned = $5,
    user_level = $6,
    usdc_spent = $7,
    agentic_balance = $8,
    total_agi_earned = $9,
    total_teneo_earned = $10,
    lottery_tickets = $11,
    nft_count = $12,
    max_ships = $13,
    auth_nonce = $14,
    auth_nonce_issued_at = $15,
    is_admin = $16,
    banned_at = $17,
    ban_reason = $18
WHERE id = $1;

-- name: IncrementUserAGI :exec
UPDATE users SET total_agi_earned = COALESCE(total_agi_earned, 0) + $2 WHERE id = $1;

-- name: IncrementUserPoints :exec
UPDATE users SET points = points + $2 WHERE id = $1;

-- name: DecrementUserPoints :exec
UPDATE users SET points = GREATEST(points - @amount::float8, 0) WHERE id = @id;

-- name: GetUserCount :one
SELECT COUNT(*) FROM users;

-- name: IncrementUserNftCount :exec
UPDATE users SET nft_count = nft_count + 1 WHERE id = $1;

-- name: UpdateUserLevel :exec
UPDATE users SET user_level = $2 WHERE id = $1;

-- name: SetUserAuthNonce :exec
UPDATE users SET auth_nonce = $2, auth_nonce_issued_at = $3 WHERE id = $1;

-- name: ClearUserAuthNonce :exec
UPDATE users SET auth_nonce = NULL, auth_nonce_issued_at = NULL WHERE id = $1;

-- name: BanUser :exec
UPDATE users SET banned_at = $2, ban_reason = $3 WHERE id = $1;

-- name: UnbanUser :exec
UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = $1;

-- name: SetAdmin :exec
UPDATE users SET is_admin = $2 WHERE id = $1;

-- name: GetUserAdminInfo :one
SELECT id, wallet, is_admin FROM users WHERE id = $1;

-- name: ListUsers :many
SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: GetTopUsersByColumn :many
SELECT id, wallet, total_agi_earned, points, usdc_spent, agentic_balance
FROM users ORDER BY total_agi_earned DESC LIMIT $1;

-- name: GetAllUsersForLevelRecalc :many
SELECT id, usdc_spent, user_level FROM users;

-- name: GetUserLevelDistribution :many
SELECT user_level, COUNT(*) as count FROM users GROUP BY user_level;

-- name: GetUserEconomyTotals :one
SELECT
    COALESCE(SUM(total_agi_earned), 0)::DOUBLE PRECISION as total_agi,
    COALESCE(SUM(total_teneo_earned), 0)::DOUBLE PRECISION as total_teneo,
    COALESCE(SUM(agentic_balance), 0)::DOUBLE PRECISION as total_agentic,
    COALESCE(SUM(usdc_spent), 0)::DOUBLE PRECISION as total_usdc,
    COALESCE(SUM(points), 0)::DOUBLE PRECISION as total_points
FROM users;

-- name: GetUserGrowthByDay :many
SELECT
    to_char(to_timestamp(created_at / 1000), 'YYYY-MM-DD') as day,
    COUNT(*) as count
FROM users
WHERE created_at >= $1
GROUP BY day
ORDER BY day;

-- name: UpdateUserUsdcAndLevel :exec
UPDATE users SET usdc_spent = $2, user_level = $3 WHERE id = $1;

-- name: LinkTeneoUser :exec
UPDATE users SET teneo_user_id = $2, teneo_points = $3, teneo_linked_at = $4 WHERE id = $1;

-- name: UpdateTeneoPoints :exec
UPDATE users SET teneo_points = $2 WHERE id = $1;

-- name: GetUserTeneoID :one
SELECT teneo_user_id FROM users WHERE id = $1;
