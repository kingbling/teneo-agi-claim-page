-- name: GetShipSpeedBoost :many
SELECT i.effect_value
FROM user_purchases up
JOIN item_shop i ON up.item_id = i.id
WHERE up.ship_id = $1
  AND up.is_active = TRUE
  AND i.effect_type = 'speed_boost'
  AND (up.expires_at IS NULL OR up.expires_at > $2);

-- name: GetShipXPMultiplier :many
SELECT i.effect_value
FROM user_purchases up
JOIN item_shop i ON up.item_id = i.id
WHERE up.ship_id = $1
  AND up.is_active = TRUE
  AND i.effect_type = 'xp_amplifier'
  AND (up.expires_at IS NULL OR up.expires_at > $2);
