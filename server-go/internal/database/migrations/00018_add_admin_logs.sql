-- +goose Up
CREATE TABLE IF NOT EXISTS admin_logs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    admin_id TEXT NOT NULL DEFAULT '',
    target_id TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_admin_logs_type ON admin_logs(type);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS admin_logs;
