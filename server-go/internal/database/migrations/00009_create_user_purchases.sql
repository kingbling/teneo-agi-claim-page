-- +goose Up
CREATE TABLE user_purchases (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    item_id      UUID NOT NULL REFERENCES item_shop(id),
    ship_id      UUID REFERENCES agents(id),
    purchased_at BIGINT NOT NULL DEFAULT 0,
    expires_at   BIGINT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_user_purchases_user_id ON user_purchases (user_id);
CREATE INDEX idx_user_purchases_is_active ON user_purchases (is_active);

-- +goose Down
DROP TABLE IF EXISTS user_purchases;
