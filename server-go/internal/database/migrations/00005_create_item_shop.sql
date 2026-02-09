-- +goose Up
CREATE TABLE item_shop (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT NOT NULL,
    description      TEXT,
    cost             INT NOT NULL,
    effect_type      TEXT NOT NULL,
    effect_value     DOUBLE PRECISION NOT NULL,
    duration_minutes INT,
    is_available     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       BIGINT NOT NULL DEFAULT 0
);

-- +goose Down
DROP TABLE IF EXISTS item_shop;
