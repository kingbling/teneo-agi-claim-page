package admin

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// CheckAdmin returns whether the current user is an admin
// This endpoint is called before RequireAdmin middleware
func CheckAdmin(c *fiber.Ctx) error {
	// If we reach this handler, the middleware already verified admin access
	return c.JSON(fiber.Map{"isAdmin": true})
}

// ListUsers returns paginated list of users
func ListUsers(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	search := c.Query("search", "")
	offset := (page - 1) * limit

	var users []generated.User
	var total int64

	if search != "" {
		// Use raw SQL for search since sqlc ListUsers doesn't support dynamic WHERE
		searchPattern := "%" + search + "%"
		countRow := store.Pool.QueryRow(ctx,
			"SELECT COUNT(*) FROM users WHERE wallet ILIKE $1 OR wallet ILIKE $2",
			searchPattern, searchPattern)
		if err := countRow.Scan(&total); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to count users"})
		}

		rows, err := store.Pool.Query(ctx,
			`SELECT id, wallet, tier, staked_amount, points, total_loot_earned, created_at,
			        user_level, usdc_spent, agentic_balance, total_agi_earned, total_teneo_earned,
			        lottery_tickets, nft_count, max_ships, auth_nonce, auth_nonce_issued_at,
			        is_admin, banned_at, ban_reason
			 FROM users WHERE wallet ILIKE $1 OR wallet ILIKE $2
			 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
			searchPattern, searchPattern, limit, offset)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to query users"})
		}
		defer rows.Close()

		for rows.Next() {
			var u generated.User
			if err := rows.Scan(
				&u.ID, &u.Wallet, &u.Tier, &u.StakedAmount, &u.Points, &u.TotalLootEarned,
				&u.CreatedAt, &u.UserLevel, &u.UsdcSpent, &u.AgenticBalance, &u.TotalAgiEarned,
				&u.TotalTeneoEarned, &u.LotteryTickets, &u.NftCount, &u.MaxShips,
				&u.AuthNonce, &u.AuthNonceIssuedAt, &u.IsAdmin, &u.BannedAt, &u.BanReason,
			); err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Failed to scan user"})
			}
			users = append(users, u)
		}
		if err := rows.Err(); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to iterate users"})
		}
	} else {
		var err error
		total, err = store.Queries.GetUserCount(ctx)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to count users"})
		}

		users, err = store.Queries.ListUsers(ctx, generated.ListUsersParams{
			Limit:  int32(limit),
			Offset: int32(offset),
		})
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to list users"})
		}
	}

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
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	userID := c.Params("id")

	user, err := store.Queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get user"})
	}

	// Get user's ships
	agents, err := store.Queries.GetAgentsByOwner(ctx, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get user agents"})
	}

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
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	userID := c.Params("id")

	var req struct {
		Points         *float64 `json:"points"`
		AgenticBalance *int32   `json:"agenticBalance"`
		UserLevel      *int32   `json:"userLevel"`
		MaxShips       *int32   `json:"maxShips"`
		Tier           *string  `json:"tier"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Points == nil && req.AgenticBalance == nil && req.UserLevel == nil && req.MaxShips == nil && req.Tier == nil {
		return c.Status(400).JSON(fiber.Map{"error": "No fields to update"})
	}

	// Get existing user to merge changes
	user, err := store.Queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get user"})
	}

	// Merge changes
	params := generated.UpdateUserParams{
		ID:                user.ID,
		Tier:              user.Tier,
		StakedAmount:      user.StakedAmount,
		Points:            user.Points,
		TotalLootEarned:   user.TotalLootEarned,
		UserLevel:         user.UserLevel,
		UsdcSpent:         user.UsdcSpent,
		AgenticBalance:    user.AgenticBalance,
		TotalAgiEarned:    user.TotalAgiEarned,
		TotalTeneoEarned:  user.TotalTeneoEarned,
		LotteryTickets:    user.LotteryTickets,
		NftCount:          user.NftCount,
		MaxShips:          user.MaxShips,
		AuthNonce:         user.AuthNonce,
		AuthNonceIssuedAt: user.AuthNonceIssuedAt,
		IsAdmin:           user.IsAdmin,
		BannedAt:          user.BannedAt,
		BanReason:         user.BanReason,
	}

	if req.Points != nil {
		params.Points = *req.Points
	}
	if req.AgenticBalance != nil {
		params.AgenticBalance = *req.AgenticBalance
	}
	if req.UserLevel != nil {
		params.UserLevel = *req.UserLevel
	}
	if req.MaxShips != nil {
		params.MaxShips = *req.MaxShips
	}
	if req.Tier != nil {
		params.Tier = *req.Tier
	}

	if err := store.Queries.UpdateUser(ctx, params); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update user"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// BanUser bans a user
func BanUser(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	userID := c.Params("id")

	var req struct {
		Reason string `json:"reason"`
	}
	c.BodyParser(&req)

	now := time.Now().UnixMilli()
	var reason *string
	if req.Reason != "" {
		reason = &req.Reason
	}

	if err := store.Queries.BanUser(ctx, generated.BanUserParams{
		ID:        userID,
		BannedAt:  &now,
		BanReason: reason,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to ban user"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "User banned"})
}

// UnbanUser unbans a user
func UnbanUser(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	userID := c.Params("id")

	if err := store.Queries.UnbanUser(ctx, userID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to unban user"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "User unbanned"})
}

// GrantTokens grants tokens to a user
func GrantTokens(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
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

	switch tokenType {
	case "points":
		_, err := store.Pool.Exec(ctx, "UPDATE users SET points = points + $1 WHERE id = $2", req.Amount, userID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to grant tokens"})
		}
	case "agi":
		_, err := store.Pool.Exec(ctx, "UPDATE users SET total_agi_earned = total_agi_earned + $1 WHERE id = $2", int32(req.Amount), userID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to grant tokens"})
		}
	case "agentic":
		_, err := store.Pool.Exec(ctx, "UPDATE users SET agentic_balance = agentic_balance + $1 WHERE id = $2", int32(req.Amount), userID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to grant tokens"})
		}
	case "teneo":
		_, err := store.Pool.Exec(ctx, "UPDATE users SET total_teneo_earned = total_teneo_earned + $1 WHERE id = $2", int32(req.Amount), userID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Failed to grant tokens: %v", err)})
		}
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Invalid token type"})
	}

	return c.JSON(fiber.Map{"success": true, "granted": req.Amount, "type": tokenType})
}

// SetAdmin grants or revokes admin status
func SetAdmin(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	userID := c.Params("id")

	var req struct {
		IsAdmin bool `json:"isAdmin"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if err := store.Queries.SetAdmin(ctx, generated.SetAdminParams{
		ID:      userID,
		IsAdmin: req.IsAdmin,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update admin status"})
	}

	return c.JSON(fiber.Map{"success": true, "isAdmin": req.IsAdmin})
}
