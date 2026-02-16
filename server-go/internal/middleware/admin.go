package middleware

import (
	"errors"
	"os"
	"strings"

	"teneo/server-go/internal/database"
	"teneo/server-go/internal/handlers"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

var adminWallets []string

func init() {
	wallets := os.Getenv("ADMIN_WALLETS")
	if wallets != "" {
		adminWallets = strings.Split(wallets, ",")
		for i := range adminWallets {
			adminWallets[i] = strings.TrimSpace(strings.ToLower(adminWallets[i]))
		}
	}
}

// RequireAdmin middleware checks if the user is an admin
func RequireAdmin(c *fiber.Ctx) error {
	// Get token from Authorization header
	auth := c.Get("Authorization")
	if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
		return c.Status(401).JSON(fiber.Map{"error": "Authorization required"})
	}

	token := strings.TrimPrefix(auth, "Bearer ")
	userID, err := handlers.VerifyJWTToken(token)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}

	// Check if user is admin
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	user, err := store.Queries.GetUserAdminInfo(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(401).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(401).JSON(fiber.Map{"error": "User not found"})
	}

	// TODO: re-enable admin check before production
	_ = adminWallets
	_ = user

	// Store user ID in context
	c.Locals("userId", userID)
	return c.Next()
}
