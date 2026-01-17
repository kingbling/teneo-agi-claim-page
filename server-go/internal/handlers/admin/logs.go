package admin

import (
	"strconv"
	"time"

	"teneo/server-go/internal/db"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AdminLog represents an admin action log entry
type AdminLog struct {
	ID        string `gorm:"primaryKey;column:id"`
	Type      string `gorm:"column:type"`
	Action    string `gorm:"column:action"`
	Details   string `gorm:"column:details"`
	AdminID   string `gorm:"column:admin_id"`
	TargetID  string `gorm:"column:target_id"`
	CreatedAt int64  `gorm:"column:created_at"`
}

// TableName specifies the table name for AdminLog
func (AdminLog) TableName() string { return "admin_logs" }

// EnsureAdminLogsTable creates the admin_logs table if it doesn't exist
func EnsureAdminLogsTable(database *gorm.DB) {
	database.AutoMigrate(&AdminLog{})
}

// GetLogs returns admin action logs
func GetLogs(c *fiber.Ctx) error {
	database := db.Get()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	logType := c.Query("type", "")
	offset := (page - 1) * limit

	// Ensure table exists
	EnsureAdminLogsTable(database)

	// Build query
	query := database.Model(&AdminLog{})
	if logType != "" {
		query = query.Where("type = ?", logType)
	}

	// Count total
	var total int64
	query.Count(&total)

	// Get logs
	var logs []AdminLog
	query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs)

	result := make([]fiber.Map, len(logs))
	for i, log := range logs {
		result[i] = fiber.Map{
			"id":        log.ID,
			"type":      log.Type,
			"action":    log.Action,
			"details":   log.Details,
			"adminId":   log.AdminID,
			"targetId":  log.TargetID,
			"createdAt": log.CreatedAt,
		}
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
	database := db.Get()

	var req struct {
		OlderThanDays int `json:"olderThanDays"`
	}
	c.BodyParser(&req)

	if req.OlderThanDays <= 0 {
		req.OlderThanDays = 30 // Default to 30 days
	}

	cutoffTime := time.Now().AddDate(0, 0, -req.OlderThanDays).UnixMilli()

	result := database.Where("created_at < ?", cutoffTime).Delete(&AdminLog{})

	return c.JSON(fiber.Map{
		"success":      true,
		"deletedCount": result.RowsAffected,
		"cutoffDays":   req.OlderThanDays,
	})
}

// WriteLog writes an admin action log (internal helper)
func WriteLog(logType, action, details, adminID, targetID string) error {
	database := db.Get()

	// Ensure table exists
	EnsureAdminLogsTable(database)

	log := AdminLog{
		ID:        uuid.New().String(),
		Type:      logType,
		Action:    action,
		Details:   details,
		AdminID:   adminID,
		TargetID:  targetID,
		CreatedAt: time.Now().UnixMilli(),
	}

	return database.Create(&log).Error
}
