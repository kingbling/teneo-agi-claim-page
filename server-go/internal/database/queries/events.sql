-- name: ListEvents :many
SELECT * FROM live_events ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: GetEvent :one
SELECT * FROM live_events WHERE id = $1;

-- name: CreateEvent :one
INSERT INTO live_events (id, name, description, event_type, multiplier, start_time, end_time, is_active, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateEvent :exec
UPDATE live_events SET
    name = $2,
    description = $3,
    event_type = $4,
    multiplier = $5,
    start_time = $6,
    end_time = $7,
    is_active = $8
WHERE id = $1;

-- name: DeleteEvent :exec
DELETE FROM live_events WHERE id = $1;

-- name: ActivateEvent :exec
UPDATE live_events SET is_active = TRUE WHERE id = $1;

-- name: DeactivateEvent :exec
UPDATE live_events SET is_active = FALSE WHERE id = $1;

-- name: GetActiveRewardEvents :many
SELECT * FROM live_events
WHERE is_active = TRUE
  AND start_time <= $1
  AND end_time >= $1
  AND event_type IN ('bonus_agi', 'double_rewards')
ORDER BY multiplier DESC;
