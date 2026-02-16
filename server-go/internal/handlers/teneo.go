package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"
	"teneo/server-go/internal/dto"
	"teneo/server-go/internal/teneo"
	wshub "teneo/server-go/internal/websocket"

	"github.com/gofiber/fiber/v2"
)

// TeneoLink links a game user to their Teneo community account via wallet lookup
func TeneoLink(store *database.Store, client *teneo.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if client == nil {
			return c.Status(503).JSON(fiber.Map{"error": "Teneo integration not configured"})
		}

		ctx := c.Context()

		// Extract user from JWT
		token := c.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		userID, err := VerifyJWTToken(token)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
		}

		// Get user to find wallet
		user, err := store.Queries.GetUser(ctx, userID)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}

		// Lookup wallet in community API
		resp, err := client.Lookup(ctx, user.Wallet)
		if err != nil {
			log.Printf("[Teneo] Lookup failed for wallet %s: %v", user.Wallet[:10], err)
			return c.Status(502).JSON(fiber.Map{"error": "Failed to look up Teneo account"})
		}

		if !resp.Exists {
			return c.JSON(fiber.Map{
				"linked": false,
				"error":  "No Teneo account found for this wallet",
			})
		}

		// Link user
		linkedAt := time.Now().UnixMilli()
		if err := store.Queries.LinkTeneoUser(ctx, generated.LinkTeneoUserParams{
			ID:            userID,
			TeneoUserID:   &resp.TeneoUserID,
			TeneoPoints:   resp.PointsTotal,
			TeneoLinkedAt: &linkedAt,
		}); err != nil {
			log.Printf("[Teneo] Failed to link user %s: %v", userID[:8], err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to link Teneo account"})
		}

		log.Printf("[Teneo] Linked user %s to Teneo %s (%.0f points)", userID[:8], resp.TeneoUserID[:8], resp.PointsTotal)

		return c.JSON(fiber.Map{
			"linked":      true,
			"pointsTotal": resp.PointsTotal,
		})
	}
}

// TeneoBalance fetches the current Teneo point balance for an authenticated user
func TeneoBalance(store *database.Store, client *teneo.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if client == nil {
			return c.Status(503).JSON(fiber.Map{"error": "Teneo integration not configured"})
		}

		ctx := c.Context()

		// Extract user from JWT
		token := c.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		userID, err := VerifyJWTToken(token)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
		}

		// Get Teneo user ID
		teneoUserID, err := store.Queries.GetUserTeneoID(ctx, userID)
		if err != nil || teneoUserID == nil {
			return c.Status(400).JSON(fiber.Map{"error": "User not linked to Teneo"})
		}

		// Fetch balance from community API
		resp, err := client.GetBalance(ctx, *teneoUserID)
		if err != nil {
			log.Printf("[Teneo] Balance fetch failed for user %s: %v", userID[:8], err)
			return c.Status(502).JSON(fiber.Map{"error": "Failed to fetch Teneo balance"})
		}

		// Update cached balance
		_ = store.Queries.UpdateTeneoPoints(ctx, generated.UpdateTeneoPointsParams{
			ID:          userID,
			TeneoPoints: resp.PointsTotal,
		})

		return c.JSON(fiber.Map{
			"pointsTotal": resp.PointsTotal,
		})
	}
}

// burnTeneoPoints deducts Teneo community points via the community API.
// Falls back to local DecrementUserPoints if teneoClient is nil.
func burnTeneoPoints(
	ctx context.Context,
	store *database.Store,
	client *teneo.Client,
	hub *wshub.Hub,
	userID string,
	amount float64,
	reason string,
) error {
	// Get Teneo user ID
	teneoUserID, err := store.Queries.GetUserTeneoID(ctx, userID)
	if err != nil || teneoUserID == nil {
		return fmt.Errorf("user not linked to Teneo")
	}

	idempotencyKey := fmt.Sprintf("%s-%s-%d", userID, reason, time.Now().UnixNano())
	resp, err := client.BurnPoints(ctx, *teneoUserID, amount, reason, idempotencyKey)
	if err != nil {
		return fmt.Errorf("burn points failed: %w", err)
	}

	// Update cached balance
	_ = store.Queries.UpdateTeneoPoints(ctx, generated.UpdateTeneoPointsParams{
		ID:          userID,
		TeneoPoints: resp.NewBalance,
	})

	// Send WS notification
	hub.SendToUser(userID, dto.ServerMessageTypeTeneoBurn, dto.TeneoBurnEvent{
		Amount:     amount,
		Reason:     reason,
		NewBalance: resp.NewBalance,
	})

	return nil
}

// SyncTeneoBalance fetches fresh balance from community API and sends it via WebSocket.
// Used during auth:identify to sync Teneo points.
func SyncTeneoBalance(ctx context.Context, store *database.Store, client *teneo.Client, hub *wshub.Hub, userID string, user generated.User) {
	if client == nil || user.TeneoUserID == nil {
		return
	}

	balance, err := client.GetBalance(ctx, *user.TeneoUserID)
	if err != nil {
		log.Printf("[Teneo] Balance sync failed for user %s: %v", userID[:8], err)
		return
	}

	_ = store.Queries.UpdateTeneoPoints(ctx, generated.UpdateTeneoPointsParams{
		ID:          userID,
		TeneoPoints: balance.PointsTotal,
	})

	hub.SendToUser(userID, dto.ServerMessageTypeTeneoPoints, dto.TeneoPointsEvent{
		PointsTotal: balance.PointsTotal,
		Linked:      true,
	})

	log.Printf("[Teneo] Synced balance for user %s: %.0f points", userID[:8], balance.PointsTotal)
}
