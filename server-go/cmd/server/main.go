package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/database"
	"teneo/server-go/internal/dto"
	"teneo/server-go/internal/handlers"
	"teneo/server-go/internal/handlers/admin"
	"teneo/server-go/internal/middleware"
	"teneo/server-go/internal/simulation"
	wshub "teneo/server-go/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/websocket/v2"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	ctx := context.Background()
	store, err := database.NewStore(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer store.Close()

	// Create WebSocket hub
	hub := wshub.NewHub()
	go hub.Run()

	// Create and start simulation engine
	engine := simulation.New(store, hub, cfg)

	// Wire engine callbacks to WebSocket broadcasts
	engine.OnAgentsUpdated = func(agents []dto.AgentUpdate) {
		hub.Broadcast("agents:update", agents)
	}
	engine.OnSynapseCompleted = func(event dto.SynapseCompletionEvent) {
		hub.Broadcast("synapse:completed", event)
	}
	engine.OnExplorationProgress = func(event dto.ExplorationProgressEvent) {
		hub.Broadcast("exploration:progress", event)
	}
	engine.OnUserLevelUp = func(event dto.UserLevelUpEvent) {
		hub.Broadcast("user:levelup", event)
	}
	engine.OnUserShipUpdated = func(shipID, userID string) {
		// Fetch the updated ship from database and send ships:sync to the specific user
		agent, err := store.Queries.GetAgent(context.Background(), shipID)
		if err != nil {
			log.Printf("[Engine] Failed to fetch ship %s for user sync: %v", shipID[:8], err)
			return
		}
		hub.SendToUser(userID, "ships:sync", map[string]interface{}{
			"ships":     []dto.ShipDTO{handlers.ConvertGenAgentToShipDTO(agent)},
			"timestamp": time.Now().UnixMilli(),
		})
		log.Printf("[Engine] Sent ships:sync for ship %s to user %s (state: %s)", shipID[:8], userID[:8], agent.State)
	}
	engine.OnTravelPositions = func(batch dto.TravelPositionBatch) {
		hub.Broadcast("travel:position", batch)
	}
	engine.OnClusterUpdate = func(event dto.ClusterUpdateEvent) {
		hub.Broadcast("cluster:update", event)
	}
	engine.OnWorldShipsUpdate = func(batch dto.WorldShipsBatch) {
		hub.Broadcast("world:ships", batch)
	}

	// Start engine in background
	go engine.Start()

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	})

	// Middleware
	app.Use(logger.New())
	corsOrigins := "http://localhost:5176, http://localhost:5177, http://localhost:4444, http://localhost:3000"
	if extra := os.Getenv("CORS_ORIGINS"); extra != "" {
		corsOrigins = extra
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	// Set store in Fiber locals for admin handlers + middleware
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("store", store)
		return c.Next()
	})

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"timestamp": time.Now().UnixMilli(),
		})
	})

	// Game config endpoint
	app.Get("/api/config", func(c *fiber.Ctx) error {
		return handlers.GetGameConfig(c, cfg)
	})

	// WebSocket endpoint
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws", websocket.New(func(c *websocket.Conn) {
		client := &wshub.Client{
			ID:   generateClientID(),
			Conn: c,
			Send: make(chan []byte, 256),
			Hub:  hub,
		}

		// Register client
		hub.RegisterClient(client)

		// Start pumps
		go client.WritePump()

		// Read pump with message handler
		client.ReadPump(func(message []byte) {
			handleWebSocketMessage(client, message, hub, store)
		})
	}))

	// Ships routes
	ships := app.Group("/api/ships")
	ships.Post("/", func(c *fiber.Ctx) error { return handlers.CreateShip(c, store) })
	ships.Post("/:id/deploy", func(c *fiber.Ctx) error { return handlers.DeployShip(c, store, hub, cfg) })
	ships.Post("/:id/recall", func(c *fiber.Ctx) error { return handlers.RecallShip(c, store) })
	ships.Post("/:id/travel-to-synapse", func(c *fiber.Ctx) error { return handlers.TravelToSynapse(c, store, hub, cfg) })
	ships.Post("/:id/autopilot", func(c *fiber.Ctx) error { return handlers.ToggleAutopilot(c, store) })

	// Users routes
	users := app.Group("/api/users")
	users.Post("/", func(c *fiber.Ctx) error { return handlers.LoginOrCreateUser(c, store) })
	users.Get("/:userId/ships", func(c *fiber.Ctx) error { return handlers.GetUserShipsByUserID(c, store) })
	users.Post("/:userId/usdc-spent", func(c *fiber.Ctx) error { return handlers.RecordUSDCSpent(c, store) })

	// Synapses routes
	synapses := app.Group("/api/synapses")
	synapses.Get("/bulk", func(c *fiber.Ctx) error { return handlers.GetBulkSynapses(c, store) })
	synapses.Get("/near", func(c *fiber.Ctx) error { return handlers.GetNearestSynapse(c, store) })
	synapses.Get("/:id", func(c *fiber.Ctx) error { return handlers.GetSynapse(c, store) })
	synapses.Post("/:id/explore", func(c *fiber.Ctx) error { return handlers.ExploreSynapse(c, store, hub) })
	synapses.Post("/:id/leave", func(c *fiber.Ctx) error { return handlers.LeaveSynapse(c, store, hub) })
	synapses.Post("/:id/rate", func(c *fiber.Ctx) error { return handlers.UpdateExplorationRate(c, store) })

	// World state
	app.Get("/api/world", func(c *fiber.Ctx) error { return handlers.GetWorldState(c, store) })

	// Auth routes
	auth := app.Group("/api/auth")
	auth.Get("/nonce", handlers.GetNonce)
	auth.Post("/verify", func(c *fiber.Ctx) error { return handlers.VerifySignature(c, store) })
	auth.Get("/me", func(c *fiber.Ctx) error { return handlers.VerifyToken(c, store) })

	// Admin routes (all require admin authentication)
	adminGroup := app.Group("/api/admin", middleware.RequireAdmin)

	// Admin - Check (must be first)
	adminGroup.Get("/check", admin.CheckAdmin)

	// Admin - Users
	adminGroup.Get("/users", admin.ListUsers)
	adminGroup.Get("/users/:id", admin.GetUserDetail)
	adminGroup.Put("/users/:id", admin.UpdateUser)
	adminGroup.Patch("/users/:id", admin.UpdateUser)
	adminGroup.Post("/users/:id/ban", admin.BanUser)
	adminGroup.Post("/users/:id/unban", admin.UnbanUser)
	adminGroup.Post("/users/:id/grant", admin.GrantTokens)
	adminGroup.Post("/users/:id/admin", admin.SetAdmin)

	// Admin - Agents/Ships
	adminGroup.Get("/agents", admin.ListAgents)
	adminGroup.Get("/agents/by-owner/:ownerId", admin.GetAgentsByOwner)
	adminGroup.Get("/agents/stuck", admin.GetStuckAgents)
	adminGroup.Get("/agents/status/stuck", admin.GetStuckAgents) // alias for frontend
	adminGroup.Get("/agents/:id", admin.GetAgentDetail)

	// Admin - Spaces/Synapses
	adminGroup.Get("/spaces", admin.ListSpaces)
	adminGroup.Get("/spaces/in-progress", admin.GetInProgressSpaces)
	adminGroup.Get("/spaces/:id", admin.GetSpaceDetail)

	// Admin - Analytics
	adminGroup.Get("/analytics/overview", admin.GetOverview)
	adminGroup.Get("/analytics/economy", admin.GetEconomy)
	adminGroup.Get("/analytics/synapse-types", admin.GetSynapseTypes)
	adminGroup.Get("/analytics/discovery-rate", admin.GetDiscoveryRate)
	adminGroup.Get("/analytics/user-growth", admin.GetUserGrowth)
	adminGroup.Get("/analytics/top-users", admin.GetTopUsers)

	// Admin - Interventions
	adminGroup.Post("/interventions/reset-ship/:id", admin.ResetShip)
	adminGroup.Post("/interventions/complete-synapse/:id", admin.CompleteSynapse)
	adminGroup.Get("/interventions/simulation-status", admin.GetSimulationStatus)
	adminGroup.Post("/interventions/bulk-reset-ships", admin.BulkResetShips)
	adminGroup.Post("/interventions/recalculate-user-levels", admin.RecalculateUserLevels)

	// Admin - Events
	adminGroup.Get("/events", admin.ListEvents)
	adminGroup.Get("/events/:id", admin.GetEventDetail)
	adminGroup.Post("/events", admin.CreateEvent)
	adminGroup.Put("/events/:id", admin.UpdateEvent)
	adminGroup.Patch("/events/:id", admin.UpdateEvent)
	adminGroup.Delete("/events/:id", admin.DeleteEvent)
	adminGroup.Post("/events/:id/activate", admin.ActivateEvent)
	adminGroup.Post("/events/:id/deactivate", admin.DeactivateEvent)

	// Admin - Logs
	adminGroup.Get("/logs", admin.GetLogs)
	adminGroup.Delete("/logs", admin.ClearLogs)

	// Serve frontend static files in production
	if _, err := os.Stat("./dist"); err == nil {
		app.Static("/", "./dist", fiber.Static{
			Compress: true,
		})

		// SPA fallback: serve index.html for non-API routes
		app.Get("/*", func(c *fiber.Ctx) error {
			return c.SendFile("./dist/index.html")
		})

		log.Println("Serving frontend from ./dist")
	}

	// Start server
	go func() {
		addr := fmt.Sprintf(":%s", cfg.Port)
		log.Printf("Server starting on %s", addr)
		if err := app.Listen(addr); err != nil {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	if err := app.ShutdownWithTimeout(30 * time.Second); err != nil {
		log.Fatalf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
}

func generateClientID() string {
	return fmt.Sprintf("client-%d", time.Now().UnixNano())
}

func handleWebSocketMessage(client *wshub.Client, message []byte, hub *wshub.Hub, store *database.Store) {
	var msg dto.ClientMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("[WS] Invalid message format from client %s", client.ID)
		return
	}

	switch msg.Type {
	case "ping":
		// Heartbeat - no response needed
		return

	case "auth:identify":
		var data dto.AuthIdentifyData
		if err := json.Unmarshal(msg.Data, &data); err != nil {
			sendAuthError(client, "Invalid auth data")
			return
		}

		// Verify JWT token
		userID, err := handlers.VerifyJWTToken(data.Token)
		if err != nil {
			sendAuthError(client, "Invalid token")
			return
		}

		// Set user ID on client
		client.UserID = userID
		hub.UpdateClientUser(client.ID, userID)

		// Send success
		sendToClient(client, "auth:success", dto.AuthSuccessData{UserID: userID})

		// Send user's ships
		sendUserShips(client, store)

		log.Printf("[WS] Client %s authenticated as user %s", client.ID[:12], userID[:8])

	case "auth:logout":
		client.UserID = ""
		hub.UpdateClientUser(client.ID, "")
		log.Printf("[WS] Client %s logged out", client.ID[:12])

	default:
		log.Printf("[WS] Unknown message type: %s", msg.Type)
	}
}

func sendAuthError(client *wshub.Client, message string) {
	sendToClient(client, "auth:error", dto.AuthErrorData{Message: message})
}

func sendToClient(client *wshub.Client, msgType string, data interface{}) {
	msg := dto.ServerMessage{Type: msgType, Data: data}
	bytes, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case client.Send <- bytes:
	default:
		// Channel full
	}
}

func sendUserShips(client *wshub.Client, store *database.Store) {
	if client.UserID == "" {
		return
	}

	agents, err := store.Queries.GetAgentsByOwner(context.Background(), client.UserID)
	if err != nil {
		return
	}

	ships := make([]dto.ShipDTO, len(agents))
	for i, agent := range agents {
		ships[i] = handlers.ConvertGenAgentToShipDTO(agent)
	}

	sendToClient(client, "ships:sync", dto.ShipSyncData{
		Ships:     ships,
		Timestamp: time.Now().UnixMilli(),
	})
}
