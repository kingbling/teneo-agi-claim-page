package handlers

import (
	"errors"
	"log"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"
	"teneo/server-go/internal/dto"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// LoginOrCreateUser logs in or creates a user by wallet address
func LoginOrCreateUser(c *fiber.Ctx, store *database.Store, cfg *config.Config) error {
	var req struct {
		Wallet string `json:"wallet"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Wallet == "" {
		return c.Status(400).JSON(fiber.Map{"error": "wallet is required"})
	}

	ctx := c.Context()

	// Try to get existing user
	user, err := store.Queries.GetUserByWallet(ctx, req.Wallet)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[USERS] ERROR looking up user for wallet %s: %v", req.Wallet, err)
			return c.Status(500).JSON(fiber.Map{"error": "Database error"})
		}

		// User doesn't exist, create new user
		log.Printf("[USERS] Creating new user for wallet: %s", req.Wallet)
		user, err = store.Queries.CreateUser(ctx, generated.CreateUserParams{
			ID:        uuid.New().String(),
			Wallet:    req.Wallet,
			Tier:      "free",
			UserLevel: 1,
			UsdcSpent: 0,
			Points:    cfg.StartingPoints,
			MaxShips:  int32(cfg.StartingMaxShips),
			CreatedAt: time.Now().UnixMilli(),
		})
		if err != nil {
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

// GetUserShipsByUserID retrieves all ships for a user by user ID
func GetUserShipsByUserID(c *fiber.Ctx, store *database.Store) error {
	userID := c.Params("userId")

	agents, err := store.Queries.GetAgentsByOwner(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve ships"})
	}

	ships := make([]dto.ShipDTO, len(agents))
	for i, agent := range agents {
		ships[i] = ConvertGenAgentToShipDTO(agent)
	}

	return c.JSON(ships)
}

// RecordUSDCSpent records USDC spending for a user and updates their level
func RecordUSDCSpent(c *fiber.Ctx, store *database.Store) error {
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

	ctx := c.Context()

	user, err := store.Queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Database error"})
	}

	// Update USDC spent
	newUsdcSpent := user.UsdcSpent + req.Amount

	// Recalculate user level
	newLevel := dto.CalculateUserLevel(newUsdcSpent)

	if err := store.Queries.UpdateUserUsdcAndLevel(ctx, generated.UpdateUserUsdcAndLevelParams{
		ID:        userID,
		UsdcSpent: newUsdcSpent,
		UserLevel: int32(newLevel),
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update user"})
	}

	levelConfig := dto.GetDefaultUserLevelConfig()[newLevel]

	return c.JSON(fiber.Map{
		"success":    true,
		"user_level": newLevel,
		"usdc_spent": newUsdcSpent,
		"multiplier": levelConfig.Multiplier,
	})
}
