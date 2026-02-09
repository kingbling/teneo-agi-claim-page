package handlers

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/db"
	"teneo/server-go/internal/dto"
	"teneo/server-go/internal/models"
	wshub "teneo/server-go/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TravelParams contains the calculated parameters for starting travel
type TravelParams struct {
	Distance       float64
	TravelCost     float64
	TravelDuration int64
	StartTime      int64
}

// calculateDistance computes 3D Euclidean distance between two points
func calculateDistance(x1, y1, z1, x2, y2, z2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	dz := z2 - z1
	return math.Sqrt(dx*dx + dy*dy + dz*dz)
}

// calculateTravelParams computes travel cost, duration and timing
func calculateTravelParams(distance float64, cfg *config.Config) TravelParams {
	// Calculate travel cost
	travelCost := math.Max(distance*cfg.TravelCostPerUnit, cfg.TravelCostMinimum)

	// Game time travel, scaled by time multiplier
	gameDuration := distance * cfg.TravelTimePerUnit
	travelDuration := int64(gameDuration / cfg.TimeMultiplier)
	if travelDuration < 2000 {
		travelDuration = 2000
	}

	return TravelParams{
		Distance:       distance,
		TravelCost:     travelCost,
		TravelDuration: travelDuration,
		StartTime:      time.Now().UnixMilli(),
	}
}

// setAgentTravelState updates an agent's state for traveling to a target
// IMPORTANT: All pointer fields must be heap-allocated to avoid dangling pointers
func setAgentTravelState(agent *models.Agent, synapseID string, targetX, targetY, targetZ float64, params TravelParams) {
	agent.State = string(dto.AgentTraveling)

	// Heap-allocate synapse ID (function param would become dangling)
	sid := new(string)
	*sid = synapseID
	agent.TargetSpaceID = sid

	// Heap-allocate start positions (copying from agent's current position)
	startPosX := new(float64)
	startPosY := new(float64)
	startPosZ := new(float64)
	*startPosX = agent.PositionX
	*startPosY = agent.PositionY
	*startPosZ = agent.PositionZ
	agent.StartPositionX = startPosX
	agent.StartPositionY = startPosY
	agent.StartPositionZ = startPosZ

	// Heap-allocate target positions (function params would become dangling)
	tgtX := new(float64)
	tgtY := new(float64)
	tgtZ := new(float64)
	*tgtX = targetX
	*tgtY = targetY
	*tgtZ = targetZ
	agent.TargetX = tgtX
	agent.TargetY = tgtY
	agent.TargetZ = tgtZ

	// Heap-allocate travel timing (struct fields would become dangling)
	startTime := new(int64)
	duration := new(int64)
	*startTime = params.StartTime
	*duration = params.TravelDuration
	agent.TravelStartTime = startTime
	agent.TravelDuration = duration
}

// broadcastTravelStarted sends the travel:started WebSocket event
func broadcastTravelStarted(hub *wshub.Hub, agent *models.Agent, space *models.Space, params TravelParams) {
	hub.SendToUser(agent.OwnerID, dto.ServerMessageTypeTravelStarted, dto.TravelStartedEvent{
		ShipID:          agent.ID,
		StartPositionX:  *agent.StartPositionX,
		StartPositionY:  *agent.StartPositionY,
		StartPositionZ:  *agent.StartPositionZ,
		TargetPositionX: space.PositionX,
		TargetPositionY: space.PositionY,
		TargetPositionZ: space.PositionZ,
		TravelStartTime: params.StartTime,
		TravelDuration:  params.TravelDuration,
		TravelCost:      params.TravelCost,
		TargetSynapseID: space.ID,
	})
}

// convertAgentToDTO converts a models.Agent to ShipDTO
func convertAgentToDTO(agent models.Agent) dto.ShipDTO {
	// Default to "neuron" if ShipType is empty (backwards compatibility)
	shipType := agent.ShipType
	if shipType == "" {
		shipType = string(config.ShipTypeNeuron)
	}

	// Calculate rotationY (yaw) toward target if available
	// Ship model faces -Z direction, so we use atan2(dx, -dz)
	var rotationY float64 = 0
	if agent.TargetX != nil && agent.TargetZ != nil {
		dx := *agent.TargetX - agent.PositionX
		dz := *agent.TargetZ - agent.PositionZ
		rotationY = math.Atan2(dx, -dz)
	}

	return dto.ShipDTO{
		ID:                 agent.ID,
		OwnerID:            agent.OwnerID,
		Name:               agent.Name,
		State:              dto.MapAgentStateToShipState(dto.AgentState(agent.State)),
		ShipType:           shipType,
		PositionX:          agent.PositionX,
		PositionY:          agent.PositionY,
		PositionZ:          agent.PositionZ,
		StartPositionX:     agent.StartPositionX,
		StartPositionY:     agent.StartPositionY,
		StartPositionZ:     agent.StartPositionZ,
		TargetPositionX:    agent.TargetX,
		TargetPositionY:    agent.TargetY,
		TargetPositionZ:    agent.TargetZ,
		CurrentSynapseID:   agent.CurrentSpaceID,
		TravelStartTime:    agent.TravelStartTime,
		TravelDuration:     agent.TravelDuration,
		RotationY:          rotationY, // Include calculated rotation
		AutopilotEnabled:   agent.AutopilotEnabled,
		EquippedItems:      []dto.EquippedItem{},
		CurrentPointsPerMin: float64(agent.CurrentPointsPerMin),
		SpacesDiscovered:   agent.SpacesDiscovered,
		TotalAgiEarned:     float64(agent.TotalAgiEarned),
		CreatedAt:          agent.CreatedAt,
	}
}

// CreateShip creates a new ship for a user
func CreateShip(c *fiber.Ctx, database *gorm.DB, hub *wshub.Hub) error {
	var req struct {
		UserID string `json:"userId"`
		Name   string `json:"name"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.UserID == "" || req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "userId and name are required"})
	}

	// Check if user exists
	user, err := db.GetUser(database, req.UserID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Check ship limit based on user level
	userLevel := dto.CalculateUserLevel(user.UsdcSpent)
	maxShips := 1 // Default for level 1
	if userLevel >= 5 {
		maxShips = 10
	} else if userLevel >= 4 {
		maxShips = 5
	} else if userLevel >= 3 {
		maxShips = 3
	} else if userLevel >= 2 {
		maxShips = 2
	}

	existingShips, _ := db.GetAgentsByOwner(database, req.UserID)
	if len(existingShips) >= maxShips {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Ship limit reached (%d ships at user level %d)", maxShips, userLevel),
		})
	}

	// Create ship with random ship type
	agent := &models.Agent{
		ID:                 uuid.New().String(),
		OwnerID:            req.UserID,
		Name:               req.Name,
		State:              string(dto.AgentIdle),
		ShipType:           string(config.RandomShipType()),
		PositionX:          0,
		PositionY:          0,
		PositionZ:          0,
		HomeX:              0,
		HomeY:              0,
		HomeZ:              0,
		WanderDirX:         rand.Float64()*2 - 1,
		WanderDirY:         rand.Float64()*2 - 1,
		WanderDirZ:         rand.Float64()*2 - 1,
		WanderPhase:        rand.Float64() * 1000,
		SpacesDiscovered:   0,
		DistanceTraveled:   0,
		CreatedAt:          time.Now().UnixMilli(),
		CreationCost:       0,
		NeedsRepair:        false,
		TranceActive:       false,
		TranceLevel:        0,
		CurrentPointsPerMin: 100,
		TotalAgiEarned:     0,
		AutopilotEnabled:   false,
	}

	if err := db.CreateAgent(database, agent); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create ship"})
	}

	// Trigger WebSocket update
	hub.SendToUser(req.UserID, "ships:sync", map[string]interface{}{
		"ships":     []dto.ShipDTO{convertAgentToDTO(*agent)},
		"timestamp": time.Now().UnixMilli(),
	})

	shipDTO := convertAgentToDTO(*agent)
	return c.Status(201).JSON(fiber.Map{
		"success": true,
		"ship":    shipDTO,
	})
}

// GetUserShips retrieves all ships for a user
func GetUserShips(c *fiber.Ctx, database *gorm.DB) error {
	userID := c.Params("userId")

	agents, err := db.GetAgentsByOwner(database, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve ships"})
	}

	ships := make([]dto.ShipDTO, len(agents))
	for i, agent := range agents {
		ships[i] = convertAgentToDTO(agent)
	}

	return c.JSON(fiber.Map{
		"ships": ships,
	})
}

// DeployShip deploys a ship directly to a synapse (starts traveling immediately)
// If no synapseId is provided, positions the ship at the given coordinates but keeps it idle
func DeployShip(c *fiber.Ctx, database *gorm.DB, hub *wshub.Hub, cfg *config.Config) error {
	shipID := c.Params("id")

	var req struct {
		SynapseID string  `json:"synapseId,omitempty"`
		PositionX float64 `json:"positionX,omitempty"`
		PositionY float64 `json:"positionY,omitempty"`
		PositionZ float64 `json:"positionZ,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	agent, err := db.GetAgent(database, shipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	if agent.State != string(dto.AgentIdle) {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Ship is not idle (current state: %s)", agent.State),
		})
	}

	// If synapseId provided, start traveling directly to the synapse
	if req.SynapseID != "" {
		space, err := db.GetSpace(database, req.SynapseID)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
		}

		if space.State == string(dto.SpaceDiscovered) {
			return c.Status(400).JSON(fiber.Map{"error": "Synapse has already been completed"})
		}

		// Check if synapse is already being explored
		explorerCount, _ := db.GetSynapseExplorerCount(database, req.SynapseID)
		if explorerCount >= 1 {
			return c.Status(400).JSON(fiber.Map{"error": "Synapse is already being explored"})
		}

		// Calculate travel parameters using helpers
		distance := calculateDistance(agent.PositionX, agent.PositionY, agent.PositionZ,
			space.PositionX, space.PositionY, space.PositionZ)
		params := calculateTravelParams(distance, cfg)

		// Get user and check points balance
		user, err := db.GetUser(database, agent.OwnerID)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}

		if user.Points < params.TravelCost {
			return c.Status(400).JSON(fiber.Map{
				"error":     "Insufficient points for travel",
				"required":  params.TravelCost,
				"available": user.Points,
			})
		}

		// Deduct travel cost from user's points
		if err := db.DecrementUserPoints(database, agent.OwnerID, params.TravelCost); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to deduct travel cost"})
		}

		// Update agent to traveling state using helper
		setAgentTravelState(agent, req.SynapseID, space.PositionX, space.PositionY, space.PositionZ, params)

		if err := db.UpdateAgent(database, agent); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to deploy ship"})
		}

		// Broadcast travel:started event
		broadcastTravelStarted(hub, agent, space, params)

		return c.JSON(fiber.Map{
			"success":          true,
			"ship":             convertAgentToDTO(*agent),
			"travelDuration":   params.TravelDuration,
			"travelCost":       params.TravelCost,
			"estimatedArrival": params.StartTime + params.TravelDuration,
		})
	}

	// No synapse - just position the ship at coordinates (stays idle)
	agent.PositionX = req.PositionX
	agent.PositionY = req.PositionY
	agent.PositionZ = req.PositionZ

	if err := db.UpdateAgent(database, agent); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to deploy ship"})
	}

	// Trigger WebSocket update
	hub.SendToUser(agent.OwnerID, "ships:sync", map[string]interface{}{
		"ships":     []dto.ShipDTO{convertAgentToDTO(*agent)},
		"timestamp": time.Now().UnixMilli(),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    convertAgentToDTO(*agent),
	})
}

// RecallShip recalls a ship from exploration back to idle state
func RecallShip(c *fiber.Ctx, database *gorm.DB, hub *wshub.Hub) error {
	shipID := c.Params("id")

	agent, err := db.GetAgent(database, shipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	if agent.State == string(dto.AgentIdle) {
		return c.Status(400).JSON(fiber.Map{"error": "Ship is already idle"})
	}

	// Remove from synapse exploration if exploring
	if agent.State == string(dto.AgentSolving) && agent.TargetSpaceID != nil {
		db.RemoveSynapseExplorer(database, shipID)
	}

	// Update agent to idle state at home
	agent.State = string(dto.AgentIdle)
	agent.PositionX = agent.HomeX
	agent.PositionY = agent.HomeY
	agent.PositionZ = agent.HomeZ
	agent.TargetSpaceID = nil
	agent.CurrentSpaceID = nil
	agent.TravelStartTime = nil
	agent.TravelDuration = nil

	if err := db.UpdateAgent(database, agent); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to recall ship"})
	}

	// Trigger WebSocket update
	hub.SendToUser(agent.OwnerID, "ships:sync", map[string]interface{}{
		"ships":     []dto.ShipDTO{convertAgentToDTO(*agent)},
		"timestamp": time.Now().UnixMilli(),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    convertAgentToDTO(*agent),
	})
}

// TravelToSynapse starts traveling to a specific synapse
func TravelToSynapse(c *fiber.Ctx, database *gorm.DB, hub *wshub.Hub, cfg *config.Config) error {
	shipID := c.Params("id")

	var req struct {
		SynapseID    string  `json:"synapseId"`
		PointsPerMin float64 `json:"pointsPerMin,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.SynapseID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "synapseId is required"})
	}

	agent, err := db.GetAgent(database, shipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	// Allow idle or searching (for backward compatibility with existing ships in searching state)
	if agent.State != string(dto.AgentIdle) && agent.State != string(dto.AgentSearching) {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Ship must be idle to travel (current state: %s)", agent.State),
		})
	}

	// Get synapse
	space, err := db.GetSpace(database, req.SynapseID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
	}

	if space.State == string(dto.SpaceDiscovered) {
		return c.Status(400).JSON(fiber.Map{"error": "Synapse has already been completed"})
	}

	// Check if synapse is already being explored
	explorerCount, _ := db.GetSynapseExplorerCount(database, req.SynapseID)
	if explorerCount >= 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Synapse is already being explored"})
	}

	// Calculate travel parameters using helpers
	distance := calculateDistance(agent.PositionX, agent.PositionY, agent.PositionZ,
		space.PositionX, space.PositionY, space.PositionZ)
	params := calculateTravelParams(distance, cfg)

	// Get user and check points balance
	user, err := db.GetUser(database, agent.OwnerID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if user.Points < params.TravelCost {
		return c.Status(400).JSON(fiber.Map{
			"error":     "Insufficient points for travel",
			"required":  params.TravelCost,
			"available": user.Points,
		})
	}

	// Deduct travel cost from user's points
	if err := db.DecrementUserPoints(database, agent.OwnerID, params.TravelCost); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to deduct travel cost"})
	}

	// Update agent to traveling state using helper
	setAgentTravelState(agent, req.SynapseID, space.PositionX, space.PositionY, space.PositionZ, params)

	// Set points per minute if provided
	if req.PointsPerMin > 0 {
		agent.CurrentPointsPerMin = int(req.PointsPerMin)
	} else if agent.CurrentPointsPerMin == 0 {
		agent.CurrentPointsPerMin = 100
	}

	if err := db.UpdateAgent(database, agent); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to start travel"})
	}

	// Broadcast travel:started event
	broadcastTravelStarted(hub, agent, space, params)

	return c.JSON(fiber.Map{
		"success":          true,
		"ship":             convertAgentToDTO(*agent),
		"travelDuration":   params.TravelDuration,
		"travelCost":       params.TravelCost,
		"estimatedArrival": params.StartTime + params.TravelDuration,
	})
}

// ToggleAutopilot toggles autopilot settings for a ship
func ToggleAutopilot(c *fiber.Ctx, database *gorm.DB, hub *wshub.Hub) error {
	shipID := c.Params("id")

	var req struct {
		Enabled             bool     `json:"enabled"`
		TargetSynapseTypes  []string `json:"targetSynapseTypes,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	agent, err := db.GetAgent(database, shipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	agent.AutopilotEnabled = req.Enabled

	if err := db.UpdateAgent(database, agent); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update autopilot"})
	}

	// Trigger WebSocket update
	hub.SendToUser(agent.OwnerID, "ships:sync", map[string]interface{}{
		"ships":     []dto.ShipDTO{convertAgentToDTO(*agent)},
		"timestamp": time.Now().UnixMilli(),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    convertAgentToDTO(*agent),
		"message": getAutopilotMessage(req.Enabled),
	})
}

func getAutopilotMessage(enabled bool) string {
	if enabled {
		return "Autopilot enabled"
	}
	return "Autopilot disabled"
}
