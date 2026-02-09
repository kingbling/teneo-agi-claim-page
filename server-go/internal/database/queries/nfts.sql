-- name: CreateNFT :one
INSERT INTO nfts (id, user_id, nft_type, synapse_id, metadata, minted_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetUserNFTs :many
SELECT * FROM nfts WHERE user_id = $1 ORDER BY minted_at DESC;
