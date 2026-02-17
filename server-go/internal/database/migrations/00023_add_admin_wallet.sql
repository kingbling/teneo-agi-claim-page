-- +goose Up
UPDATE users SET is_admin = true WHERE LOWER(wallet) = LOWER('0xC17Df543f330eF88C30C9862BFcBcF0564aE43BE');

-- +goose Down
UPDATE users SET is_admin = false WHERE LOWER(wallet) = LOWER('0xC17Df543f330eF88C30C9862BFcBcF0564aE43BE');
