-- +goose Up
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet          TEXT NOT NULL UNIQUE,
    tier            TEXT NOT NULL DEFAULT 'free',
    staked_amount   DOUBLE PRECISION NOT NULL DEFAULT 0,
    points          DOUBLE PRECISION NOT NULL DEFAULT 1000,
    total_loot_earned   INT NOT NULL DEFAULT 0,
    created_at      BIGINT NOT NULL DEFAULT 0,
    user_level      INT NOT NULL DEFAULT 1,
    usdc_spent      DOUBLE PRECISION NOT NULL DEFAULT 0,
    agentic_balance INT NOT NULL DEFAULT 0,
    total_agi_earned    INT NOT NULL DEFAULT 0,
    total_teneo_earned  INT NOT NULL DEFAULT 0,
    lottery_tickets INT NOT NULL DEFAULT 0,
    nft_count       INT NOT NULL DEFAULT 0,
    max_ships       INT NOT NULL DEFAULT 1,
    auth_nonce      TEXT,
    auth_nonce_issued_at BIGINT,
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    banned_at       BIGINT,
    ban_reason      TEXT
);

CREATE INDEX idx_users_user_level ON users (user_level);

-- +goose Down
DROP TABLE IF EXISTS users;
