-- +goose Up
ALTER TABLE users ADD COLUMN teneo_user_id TEXT;
ALTER TABLE users ADD COLUMN teneo_points DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN teneo_linked_at BIGINT;
CREATE UNIQUE INDEX idx_users_teneo_user_id ON users (teneo_user_id) WHERE teneo_user_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_users_teneo_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS teneo_linked_at;
ALTER TABLE users DROP COLUMN IF EXISTS teneo_points;
ALTER TABLE users DROP COLUMN IF EXISTS teneo_user_id;
