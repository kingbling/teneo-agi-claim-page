package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"
	"teneo/server-go/internal/dto"
	"teneo/server-go/internal/teneo"
	wshub "teneo/server-go/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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

// buildTravelUpdateParams creates UpdateAgentParams for an agent starting travel to a target
func buildTravelUpdateParams(agent generated.Agent, synapseID string, targetX, targetY, targetZ float64, params TravelParams) generated.UpdateAgentParams {
	startTime := params.StartTime
	duration := params.TravelDuration
	return generated.UpdateAgentParams{
		ID:                  agent.ID,
		Name:                agent.Name,
		State:               string(dto.AgentTraveling),
		PositionX:           agent.PositionX,
		PositionY:           agent.PositionY,
		PositionZ:           agent.PositionZ,
		StartPositionX:      &agent.PositionX,
		StartPositionY:      &agent.PositionY,
		StartPositionZ:      &agent.PositionZ,
		TargetSpaceID:       StringToPgUUID(synapseID),
		TravelStartTime:     &startTime,
		TravelDuration:      &duration,
		TargetX:             &targetX,
		TargetY:             &targetY,
		TargetZ:             &targetZ,
		CurrentSpaceID:      pgtype.UUID{Valid: false},
		CurrentPointsPerMin: agent.CurrentPointsPerMin,
		AutopilotEnabled:    agent.AutopilotEnabled,
		HomeX:               agent.HomeX,
		HomeY:               agent.HomeY,
		HomeZ:               agent.HomeZ,
	}
}

// broadcastTravelStarted sends the travel:started WebSocket event
func broadcastTravelStarted(hub *wshub.Hub, agent generated.Agent, space generated.Space, params TravelParams) {
	hub.SendToUser(agent.OwnerID, dto.ServerMessageTypeTravelStarted, dto.TravelStartedEvent{
		ShipID:          agent.ID,
		StartPositionX:  agent.PositionX,
		StartPositionY:  agent.PositionY,
		StartPositionZ:  agent.PositionZ,
		TargetPositionX: space.PositionX,
		TargetPositionY: space.PositionY,
		TargetPositionZ: space.PositionZ,
		TravelStartTime: params.StartTime,
		TravelDuration:  params.TravelDuration,
		TravelCost:      params.TravelCost,
		TargetSynapseID: space.ID,
	})
}

// ConvertGenAgentToShipDTO converts a generated.Agent to ShipDTO
func ConvertGenAgentToShipDTO(agent generated.Agent) dto.ShipDTO {
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
		ID:                  agent.ID,
		OwnerID:             agent.OwnerID,
		Name:                agent.Name,
		State:               dto.MapAgentStateToShipState(dto.AgentState(agent.State)),
		ShipType:            shipType,
		PositionX:           agent.PositionX,
		PositionY:           agent.PositionY,
		PositionZ:           agent.PositionZ,
		StartPositionX:      agent.StartPositionX,
		StartPositionY:      agent.StartPositionY,
		StartPositionZ:      agent.StartPositionZ,
		TargetPositionX:     agent.TargetX,
		TargetPositionY:     agent.TargetY,
		TargetPositionZ:     agent.TargetZ,
		CurrentSynapseID:    PgUUIDToStringPtr(agent.CurrentSpaceID),
		TravelStartTime:     agent.TravelStartTime,
		TravelDuration:      agent.TravelDuration,
		RotationY:           rotationY,
		AutopilotEnabled:    agent.AutopilotEnabled,
		EquippedItems:       []dto.EquippedItem{},
		CurrentPointsPerMin: float64(agent.CurrentPointsPerMin),
		SpacesDiscovered:    int(agent.SpacesDiscovered),
		TotalAgiEarned:      float64(agent.TotalAgiEarned),
		CreatedAt:           agent.CreatedAt,
	}
}

// PgUUIDToStringPtr converts a pgtype.UUID to a *string (nil if not valid)
func PgUUIDToStringPtr(u pgtype.UUID) *string {
	if !u.Valid {
		return nil
	}
	s := fmt.Sprintf("%x-%x-%x-%x-%x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
	return &s
}

// StringToPgUUID converts a string UUID to pgtype.UUID
func StringToPgUUID(s string) pgtype.UUID {
	parsed, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{Valid: false}
	}
	return pgtype.UUID{Bytes: parsed, Valid: true}
}

// CreateShip creates a new ship for a user
func CreateShip(c *fiber.Ctx, store *database.Store) error {
	ctx := c.Context()

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
	user, err := store.Queries.GetUser(ctx, req.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to look up user"})
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

	existingShips, _ := store.Queries.GetAgentsByOwner(ctx, req.UserID)
	if len(existingShips) >= maxShips {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Ship limit reached (%d ships at user level %d)", maxShips, userLevel),
		})
	}

	// Create ship with random ship type
	newAgent, err := store.Queries.CreateAgent(ctx, generated.CreateAgentParams{
		ID:                    uuid.New().String(),
		OwnerID:               req.UserID,
		Name:                  req.Name,
		State:                 string(dto.AgentIdle),
		ShipType:              string(config.RandomShipType()),
		PositionX:             0,
		PositionY:             0,
		PositionZ:             0,
		HomeX:                 0,
		HomeY:                 0,
		HomeZ:                 0,
		WanderDirX:            rand.Float64()*2 - 1,
		WanderDirY:            rand.Float64()*2 - 1,
		WanderDirZ:            rand.Float64()*2 - 1,
		WanderPhase:           rand.Float64() * 1000,
		SpacesDiscovered:      0,
		DistanceTraveled:      0,
		CreatedAt:             time.Now().UnixMilli(),
		CreationCost:          0,
		NeedsRepair:           false,
		TranceActive:          false,
		TranceLevel:           0,
		CurrentPointsPerMin:   100,
		TotalAgiEarned:        0,
		TotalBrainXpEarned:    0,
		AutopilotEnabled:      false,
		Traits:                json.RawMessage("[]"),
		EquippedItems:         json.RawMessage("[]"),
		AutopilotTargetTypes:  json.RawMessage("[]"),
		AutopilotMaxPointsCap: 0,
		AutopilotAvoidCrowded: false,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create ship"})
	}

	shipDTO := ConvertGenAgentToShipDTO(newAgent)

	return c.Status(201).JSON(fiber.Map{
		"success": true,
		"ship":    shipDTO,
	})
}

// GetUserShips retrieves all ships for a user
func GetUserShips(c *fiber.Ctx, store *database.Store) error {
	ctx := c.Context()
	userID := c.Params("userId")

	agents, err := store.Queries.GetAgentsByOwner(ctx, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve ships"})
	}

	ships := make([]dto.ShipDTO, len(agents))
	for i, agent := range agents {
		ships[i] = ConvertGenAgentToShipDTO(agent)
	}

	return c.JSON(fiber.Map{
		"ships": ships,
	})
}

// DeployShip deploys a ship directly to a synapse (starts traveling immediately)
// If no synapseId is provided, positions the ship at the given coordinates but keeps it idle
func DeployShip(c *fiber.Ctx, store *database.Store, hub *wshub.Hub, cfg *config.Config, teneoClient *teneo.Client) error {
	ctx := c.Context()
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

	agent, err := store.Queries.GetAgent(ctx, shipID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to look up ship"})
	}

	if agent.State != string(dto.AgentIdle) {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Ship is not idle (current state: %s)", agent.State),
		})
	}

	// If synapseId provided, start traveling directly to the synapse
	if req.SynapseID != "" {
		space, err := store.Queries.GetSpace(ctx, req.SynapseID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
			}
			return c.Status(500).JSON(fiber.Map{"error": "Failed to look up synapse"})
		}

		if space.State == string(dto.SpaceDiscovered) {
			return c.Status(400).JSON(fiber.Map{"error": "Synapse has already been completed"})
		}

		// Check if synapse is already being explored
		explorerCount, _ := store.Queries.GetSynapseExplorerCount(ctx, req.SynapseID)
		if explorerCount >= 1 {
			return c.Status(400).JSON(fiber.Map{"error": "Synapse is already being explored"})
		}

		// Calculate travel parameters using helpers
		distance := calculateDistance(agent.PositionX, agent.PositionY, agent.PositionZ,
			space.PositionX, space.PositionY, space.PositionZ)
		params := calculateTravelParams(distance, cfg)

		// Get user and check points balance
		user, err := store.Queries.GetUser(ctx, agent.OwnerID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return c.Status(404).JSON(fiber.Map{"error": "User not found"})
			}
			return c.Status(500).JSON(fiber.Map{"error": "Failed to look up user"})
		}

		// Deduct travel cost: use Teneo community points if linked, otherwise local points
		if teneoClient != nil && user.TeneoUserID != nil {
			if user.TeneoPoints < params.TravelCost {
				return c.Status(400).JSON(fiber.Map{
					"error":     "Insufficient Teneo points for travel",
					"required":  params.TravelCost,
					"available": user.TeneoPoints,
				})
			}
			if err := burnTeneoPoints(ctx, store, teneoClient, hub, agent.OwnerID, params.TravelCost, "travel"); err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Failed to deduct Teneo points: " + err.Error()})
			}
		} else {
			if user.Points < params.TravelCost {
				return c.Status(400).JSON(fiber.Map{
					"error":     "Insufficient points for travel",
					"required":  params.TravelCost,
					"available": user.Points,
				})
			}
			if err := store.Queries.DecrementUserPoints(ctx, generated.DecrementUserPointsParams{
				ID:     agent.OwnerID,
				Points: params.TravelCost,
			}); err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Failed to deduct travel cost"})
			}
		}

		// Update agent to traveling state
		updateParams := buildTravelUpdateParams(agent, req.SynapseID, space.PositionX, space.PositionY, space.PositionZ, params)
		if err := store.Queries.UpdateAgent(ctx, updateParams); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to deploy ship"})
		}

		// Re-read agent for accurate DTO (positions set by buildTravelUpdateParams)
		updatedAgent, _ := store.Queries.GetAgent(ctx, shipID)

		// Broadcast travel:started event
		broadcastTravelStarted(hub, updatedAgent, space, params)

		return c.JSON(fiber.Map{
			"success":          true,
			"ship":             ConvertGenAgentToShipDTO(updatedAgent),
			"travelDuration":   params.TravelDuration,
			"travelCost":       params.TravelCost,
			"estimatedArrival": params.StartTime + params.TravelDuration,
		})
	}

	// No synapse - just position the ship at coordinates (stays idle)
	if err := store.Queries.UpdateAgent(ctx, generated.UpdateAgentParams{
		ID:                  agent.ID,
		Name:                agent.Name,
		State:               agent.State,
		PositionX:           req.PositionX,
		PositionY:           req.PositionY,
		PositionZ:           req.PositionZ,
		StartPositionX:      agent.StartPositionX,
		StartPositionY:      agent.StartPositionY,
		StartPositionZ:      agent.StartPositionZ,
		TargetSpaceID:       agent.TargetSpaceID,
		TravelStartTime:     agent.TravelStartTime,
		TravelDuration:      agent.TravelDuration,
		TargetX:             agent.TargetX,
		TargetY:             agent.TargetY,
		TargetZ:             agent.TargetZ,
		CurrentSpaceID:      agent.CurrentSpaceID,
		CurrentPointsPerMin: agent.CurrentPointsPerMin,
		AutopilotEnabled:    agent.AutopilotEnabled,
		HomeX:               agent.HomeX,
		HomeY:               agent.HomeY,
		HomeZ:               agent.HomeZ,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to deploy ship"})
	}

	updatedAgent, _ := store.Queries.GetAgent(ctx, shipID)
	shipDTO := ConvertGenAgentToShipDTO(updatedAgent)

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    shipDTO,
	})
}

// RecallShip recalls a ship from exploration back to idle state
func RecallShip(c *fiber.Ctx, store *database.Store) error {
	ctx := c.Context()
	shipID := c.Params("id")

	agent, err := store.Queries.GetAgent(ctx, shipID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to look up ship"})
	}

	if agent.State == string(dto.AgentIdle) {
		return c.Status(400).JSON(fiber.Map{"error": "Ship is already idle"})
	}

	// Remove from synapse exploration if solving
	if agent.State == string(dto.AgentSolving) && agent.TargetSpaceID.Valid {
		_ = store.Queries.RemoveSynapseExplorer(ctx, shipID)
	}

	// Update agent to idle state at home position
	if err := store.Queries.UpdateAgentToIdle(ctx, shipID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to recall ship"})
	}
	// Also move position back to home
	if err := store.Queries.UpdateAgentPosition(ctx, generated.UpdateAgentPositionParams{
		ID:        shipID,
		PositionX: agent.HomeX,
		PositionY: agent.HomeY,
		PositionZ: agent.HomeZ,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update ship position"})
	}

	// Re-read the agent for accurate DTO
	updatedAgent, _ := store.Queries.GetAgent(ctx, shipID)
	shipDTO := ConvertGenAgentToShipDTO(updatedAgent)

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    shipDTO,
	})
}

// TravelToSynapse starts traveling to a specific synapse
func TravelToSynapse(c *fiber.Ctx, store *database.Store, hub *wshub.Hub, cfg *config.Config, teneoClient *teneo.Client) error {
	ctx := c.Context()
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

	agent, err := store.Queries.GetAgent(ctx, shipID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to look up ship"})
	}

	// Allow idle or searching (for backward compatibility with existing ships in searching state)
	if agent.State != string(dto.AgentIdle) && agent.State != string(dto.AgentSearching) {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Ship must be idle to travel (current state: %s)", agent.State),
		})
	}

	// Get synapse
	space, err := store.Queries.GetSpace(ctx, req.SynapseID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to look up synapse"})
	}

	if space.State == string(dto.SpaceDiscovered) {
		return c.Status(400).JSON(fiber.Map{"error": "Synapse has already been completed"})
	}

	// Check if synapse is already being explored
	explorerCount, _ := store.Queries.GetSynapseExplorerCount(ctx, req.SynapseID)
	if explorerCount >= 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Synapse is already being explored"})
	}

	// Calculate travel parameters using helpers
	distance := calculateDistance(agent.PositionX, agent.PositionY, agent.PositionZ,
		space.PositionX, space.PositionY, space.PositionZ)
	params := calculateTravelParams(distance, cfg)

	// Get user and check points balance
	user, err := store.Queries.GetUser(ctx, agent.OwnerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to look up user"})
	}

	// Deduct travel cost: use Teneo community points if linked, otherwise local points
	if teneoClient != nil && user.TeneoUserID != nil {
		if user.TeneoPoints < params.TravelCost {
			return c.Status(400).JSON(fiber.Map{
				"error":     "Insufficient Teneo points for travel",
				"required":  params.TravelCost,
				"available": user.TeneoPoints,
			})
		}
		if err := burnTeneoPoints(ctx, store, teneoClient, hub, agent.OwnerID, params.TravelCost, "travel"); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to deduct Teneo points: " + err.Error()})
		}
	} else {
		if user.Points < params.TravelCost {
			return c.Status(400).JSON(fiber.Map{
				"error":     "Insufficient points for travel",
				"required":  params.TravelCost,
				"available": user.Points,
			})
		}
		if err := store.Queries.DecrementUserPoints(ctx, generated.DecrementUserPointsParams{
			ID:     agent.OwnerID,
			Points: params.TravelCost,
		}); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to deduct travel cost"})
		}
	}

	// Update agent to traveling state
	updateParams := buildTravelUpdateParams(agent, req.SynapseID, space.PositionX, space.PositionY, space.PositionZ, params)

	// Set points per minute if provided
	if req.PointsPerMin > 0 {
		updateParams.CurrentPointsPerMin = int32(req.PointsPerMin)
	} else if agent.CurrentPointsPerMin == 0 {
		updateParams.CurrentPointsPerMin = 100
	}

	if err := store.Queries.UpdateAgent(ctx, updateParams); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to start travel"})
	}

	// Re-read agent for accurate DTO
	updatedAgent, _ := store.Queries.GetAgent(ctx, shipID)

	// Broadcast travel:started event
	broadcastTravelStarted(hub, updatedAgent, space, params)

	return c.JSON(fiber.Map{
		"success":          true,
		"ship":             ConvertGenAgentToShipDTO(updatedAgent),
		"travelDuration":   params.TravelDuration,
		"travelCost":       params.TravelCost,
		"estimatedArrival": params.StartTime + params.TravelDuration,
	})
}

// ToggleAutopilot toggles autopilot settings for a ship
func ToggleAutopilot(c *fiber.Ctx, store *database.Store) error {
	ctx := c.Context()
	shipID := c.Params("id")

	var req struct {
		Enabled            bool     `json:"enabled"`
		TargetSynapseTypes []string `json:"targetSynapseTypes,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	agent, err := store.Queries.GetAgent(ctx, shipID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to look up ship"})
	}

	if err := store.Queries.UpdateAgentAutopilot(ctx, generated.UpdateAgentAutopilotParams{
		ID:               shipID,
		AutopilotEnabled: req.Enabled,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update autopilot"})
	}

	// Re-read agent for accurate DTO
	agent.AutopilotEnabled = req.Enabled
	shipDTO := ConvertGenAgentToShipDTO(agent)

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    shipDTO,
		"message": getAutopilotMessage(req.Enabled),
	})
}

func getAutopilotMessage(enabled bool) string {
	if enabled {
		return "Autopilot enabled"
	}
	return "Autopilot disabled"
}
