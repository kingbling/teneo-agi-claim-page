-- +goose Up
CREATE TABLE nfts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    nft_type    TEXT NOT NULL,
    synapse_id  UUID REFERENCES spaces(id),
    metadata    JSONB NOT NULL DEFAULT '{}',
    minted_at   BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_nfts_user_id ON nfts (user_id);
CREATE INDEX idx_nfts_nft_type ON nfts (nft_type);

-- +goose Down
DROP TABLE IF EXISTS nfts;
