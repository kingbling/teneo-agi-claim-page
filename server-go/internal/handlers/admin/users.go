package admin

import (
	"strconv"
	"time"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// CheckAdmin returns whether the current user is an admin
// This endpoint is called before RequireAdmin middleware
func CheckAdmin(c *fiber.Ctx) error {
	// If we reach this handler, the middleware already verified admin access
	return c.JSON(fiber.Map{"isAdmin": true})
}

// ListUsers returns paginated list of users
func ListUsers(c *fiber.Ctx) error {
	database := db.Get()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	search := c.Query("search", "")
	sortBy := c.Query("sortBy", "created_at")
	offset := (page - 1) * limit

	// Build query
	query := database.Model(&models.User{})
	if search != "" {
		query = query.Where("wallet LIKE ? OR username LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Count total
	var total int64
	query.Count(&total)

	// Get users
	var users []models.User
	query.Order(sortBy + " DESC").Limit(limit).Offset(offset).Find(&users)

	// Convert to response
	result := make([]fiber.Map, len(users))
	for i, user := range users {
		result[i] = fiber.Map{
			"id":               user.ID,
			"wallet":           user.Wallet,
			"points":           user.Points,
			"tier":             user.Tier,
			"usdcSpent":        user.UsdcSpent,
			"agenticBalance":   user.AgenticBalance,
			"totalAgiEarned":   user.TotalAgiEarned,
			"totalTeneoEarned": user.TotalTeneoEarned,
			"lotteryTickets":   user.LotteryTickets,
			"nftCount":         user.NftCount,
			"userLevel":        user.UserLevel,
			"maxShips":         user.MaxShips,
			"isAdmin":          user.IsAdmin,
			"isBanned":         user.BannedAt != nil,
			"createdAt":        user.CreatedAt,
		}
	}

	return c.JSON(fiber.Map{
		"users": result,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetUserDetail returns detailed user info
func GetUserDetail(c *fiber.Ctx) error {
	database := db.Get()
	userID := c.Params("id")

	var user models.User
	if err := database.First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Get user's ships
	var agents []models.Agent
	database.Select("id, name, state").Where("owner_id = ?", userID).Find(&agents)

	ships := make([]fiber.Map, len(agents))
	for i, agent := range agents {
		ships[i] = fiber.Map{"id": agent.ID, "name": agent.Name, "state": agent.State}
	}

	return c.JSON(fiber.Map{
		"id":               user.ID,
		"wallet":           user.Wallet,
		"points":           user.Points,
		"tier":             user.Tier,
		"usdcSpent":        user.UsdcSpent,
		"agenticBalance":   user.AgenticBalance,
		"totalAgiEarned":   user.TotalAgiEarned,
		"totalTeneoEarned": user.TotalTeneoEarned,
		"lotteryTickets":   user.LotteryTickets,
		"nftCount":         user.NftCount,
		"userLevel":        user.UserLevel,
		"maxShips":         user.MaxShips,
		"isAdmin":          user.IsAdmin,
		"isBanned":         user.BannedAt != nil,
		"createdAt":        user.CreatedAt,
		"ships":            ships,
	})
}

// UpdateUser updates user fields
func UpdateUser(c *fiber.Ctx) error {
	database := db.Get()
	userID := c.Params("id")

	var req struct {
		Points         *float64 `json:"points"`
		AgenticBalance *float64 `json:"agenticBalance"`
		UserLevel      *int     `json:"userLevel"`
		MaxShips       *int     `json:"maxShips"`
		Tier           *string  `json:"tier"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Build update map dynamically
	updates := make(map[string]interface{})

	if req.Points != nil {
		updates["points"] = *req.Points
	}
	if req.AgenticBalance != nil {
		updates["agentic_balance"] = *req.AgenticBalance
	}
	if req.UserLevel != nil {
		updates["user_level"] = *req.UserLevel
	}
	if req.MaxShips != nil {
		updates["max_ships"] = *req.MaxShips
	}
	if req.Tier != nil {
		updates["tier"] = *req.Tier
	}

	if len(updates) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No fields to update"})
	}

	if err := database.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update user"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// BanUser bans a user
func BanUser(c *fiber.Ctx) error {
	database := db.Get()
	userID := c.Params("id")

	var req struct {
		Reason string `json:"reason"`
	}
	c.BodyParser(&req)

	now := time.Now().UnixMilli()
	updates := map[string]interface{}{
		"banned_at": now,
	}
	if req.Reason != "" {
		updates["ban_reason"] = req.Reason
	}

	if err := database.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to ban user"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "User banned"})
}

// UnbanUser unbans a user
func UnbanUser(c *fiber.Ctx) error {
	database := db.Get()
	userID := c.Params("id")

	if err := database.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"banned_at":  nil,
		"ban_reason": nil,
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to unban user"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "User unbanned"})
}

// GrantTokens grants tokens to a user
func GrantTokens(c *fiber.Ctx) error {
	database := db.Get()
	userID := c.Params("id")

	var req struct {
		Type      string  `json:"type"`      // points, agi, agentic, teneo
		TokenType string  `json:"tokenType"` // alias for type (frontend compat)
		Amount    float64 `json:"amount"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Support both "type" and "tokenType" fields
	tokenType := req.Type
	if tokenType == "" {
		tokenType = req.TokenType
	}

	var column string
	switch tokenType {
	case "points":
		column = "points"
	case "agi":
		column = "total_agi_earned"
	case "agentic":
		column = "agentic_balance"
	case "teneo":
		column = "total_teneo_earned"
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Invalid token type"})
	}

	if err := database.Model(&models.User{}).Where("id = ?", userID).
		Update(column, gorm.Expr(column+" + ?", req.Amount)).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to grant tokens"})
	}

	return c.JSON(fiber.Map{"success": true, "granted": req.Amount, "type": tokenType})
}

// SetAdmin grants or revokes admin status
func SetAdmin(c *fiber.Ctx) error {
	database := db.Get()
	userID := c.Params("id")

	var req struct {
		IsAdmin bool `json:"isAdmin"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if err := database.Model(&models.User{}).Where("id = ?", userID).Update("is_admin", req.IsAdmin).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update admin status"})
	}

	return c.JSON(fiber.Map{"success": true, "isAdmin": req.IsAdmin})
}
