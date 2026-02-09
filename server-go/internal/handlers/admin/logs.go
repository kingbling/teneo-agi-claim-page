package admin

import (
	"context"
	"strconv"
	"time"

	"teneo/server-go/internal/database"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ensureAdminLogsTable creates the admin_logs table if it doesn't exist (PostgreSQL)
func ensureAdminLogsTable(ctx context.Context, pool *pgxpool.Pool) {
	pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS admin_logs (
		id TEXT PRIMARY KEY,
		type TEXT NOT NULL DEFAULT '',
		action TEXT NOT NULL DEFAULT '',
		details TEXT NOT NULL DEFAULT '',
		admin_id TEXT NOT NULL DEFAULT '',
		target_id TEXT NOT NULL DEFAULT '',
		created_at BIGINT NOT NULL DEFAULT 0
	)`)
}

// GetLogs returns admin action logs
func GetLogs(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	logType := c.Query("type", "")
	offset := (page - 1) * limit

	// Ensure table exists
	ensureAdminLogsTable(ctx, store.Pool)

	var total int64
	var args []interface{}
	argIdx := 1

	countQuery := "SELECT COUNT(*) FROM admin_logs"
	dataQuery := "SELECT id, type, action, details, admin_id, target_id, created_at FROM admin_logs"

	if logType != "" {
		countQuery += " WHERE type = $" + strconv.Itoa(argIdx)
		dataQuery += " WHERE type = $" + strconv.Itoa(argIdx)
		args = append(args, logType)
		argIdx++
	}

	// Count
	countRow := store.Pool.QueryRow(ctx, countQuery, args...)
	if err := countRow.Scan(&total); err != nil {
		total = 0
	}

	// Data
	dataQuery += " ORDER BY created_at DESC LIMIT $" + strconv.Itoa(argIdx) + " OFFSET $" + strconv.Itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := store.Pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to query logs"})
	}
	defer rows.Close()

	var result []fiber.Map
	for rows.Next() {
		var id, logT, action, details, adminID, targetID string
		var createdAt int64
		if err := rows.Scan(&id, &logT, &action, &details, &adminID, &targetID, &createdAt); err != nil {
			continue
		}
		result = append(result, fiber.Map{
			"id":        id,
			"type":      logT,
			"action":    action,
			"details":   details,
			"adminId":   adminID,
			"targetId":  targetID,
			"createdAt": createdAt,
		})
	}

	if result == nil {
		result = []fiber.Map{}
	}

	return c.JSON(fiber.Map{
		"logs":  result,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// ClearLogs clears admin logs older than specified days
func ClearLogs(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	var req struct {
		OlderThanDays int `json:"olderThanDays"`
	}
	c.BodyParser(&req)

	if req.OlderThanDays <= 0 {
		req.OlderThanDays = 30 // Default to 30 days
	}

	cutoffTime := time.Now().AddDate(0, 0, -req.OlderThanDays).UnixMilli()

	tag, err := store.Pool.Exec(ctx, "DELETE FROM admin_logs WHERE created_at < $1", cutoffTime)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to clear logs"})
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"deletedCount": tag.RowsAffected(),
		"cutoffDays":   req.OlderThanDays,
	})
}

// WriteLog writes an admin action log (internal helper)
func WriteLog(pool *pgxpool.Pool, logType, action, details, adminID, targetID string) error {
	ctx := context.Background()

	// Ensure table exists
	ensureAdminLogsTable(ctx, pool)

	_, err := pool.Exec(ctx,
		"INSERT INTO admin_logs (id, type, action, details, admin_id, target_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		uuid.New().String(), logType, action, details, adminID, targetID, time.Now().UnixMilli())

	return err
}
