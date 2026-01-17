package handlers

import (
	"log"
	"time"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/dto"
	"teneo/server-go/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LoginOrCreateUser logs in or creates a user by wallet address
func LoginOrCreateUser(c *fiber.Ctx, database *gorm.DB) error {
	var req struct {
		Wallet string `json:"wallet"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Wallet == "" {
		return c.Status(400).JSON(fiber.Map{"error": "wallet is required"})
	}

	// Try to get existing user
	user, err := db.GetUserByWallet(database, req.Wallet)
	if err != nil {
		// User doesn't exist, create new user
		log.Printf("[USERS] Creating new user for wallet: %s", req.Wallet)
		user = &models.User{
			ID:        uuid.New().String(),
			Wallet:    req.Wallet,
			Tier:      "free",
			UserLevel: 1,
			UsdcSpent:  0,
			Points:    0,
			MaxShips:  1,
			CreatedAt: time.Now().UnixMilli(),
		}

		if err := db.CreateUser(database, user); err != nil {
			log.Printf("[USERS] ERROR creating user for wallet %s: %v", req.Wallet, err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create user", "details": err.Error()})
		}
		log.Printf("[USERS] Successfully created user %s for wallet %s", user.ID, req.Wallet)
	} else {
		log.Printf("[USERS] Found existing user %s for wallet %s", user.ID, req.Wallet)
	}

	// Convert to response format
	response := map[string]interface{}{
		"id":                 user.ID,
		"wallet":             user.Wallet,
		"tier":               user.Tier,
		"user_level":         user.UserLevel,
		"usdc_spent":         user.UsdcSpent,
		"points":             user.Points,
		"agentic_balance":    user.AgenticBalance,
		"total_agi_earned":   user.TotalAgiEarned,
		"total_teneo_earned": user.TotalTeneoEarned,
		"lottery_tickets":    user.LotteryTickets,
		"nft_count":          user.NftCount,
		"is_admin":           user.IsAdmin,
		"max_ships":          user.MaxShips,
		"banned_at":          user.BannedAt,
		"ban_reason":         user.BanReason,
		"created_at":         user.CreatedAt,
	}

	return c.JSON(response)
}

// GetUserShips retrieves all ships for a user (re-export from ships.go for route registration)
func GetUserShipsByUserID(c *fiber.Ctx, database *gorm.DB) error {
	userID := c.Params("userId")

	agents, err := db.GetAgentsByOwner(database, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve ships"})
	}

	ships := make([]dto.ShipDTO, len(agents))
	for i, agent := range agents {
		ships[i] = convertAgentToDTO(agent)
	}

	return c.JSON(ships)
}

// RecordUSDCSpent records USDC spending for a user and updates their level
func RecordUSDCSpent(c *fiber.Ctx, database *gorm.DB) error {
	userID := c.Params("userId")

	var req struct {
		Amount float64 `json:"amount"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Amount <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "amount must be positive"})
	}

	user, err := db.GetUser(database, userID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Update USDC spent
	user.UsdcSpent += req.Amount

	// Recalculate user level
	newLevel := dto.CalculateUserLevel(user.UsdcSpent)
	user.UserLevel = int(newLevel)

	if err := db.UpdateUser(database, user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update user"})
	}

	levelConfig := dto.GetDefaultUserLevelConfig()[newLevel]

	return c.JSON(fiber.Map{
		"success": true,
		"user_level": newLevel,
		"usdc_spent": user.UsdcSpent,
		"multiplier": levelConfig.Multiplier,
	})
}
