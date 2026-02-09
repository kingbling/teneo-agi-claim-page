package handlers

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"
	"teneo/server-go/internal/dto"
	wshub "teneo/server-go/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// Grid sizes for LOD cluster computation (must match engine.go recomputeClusters)
var lodGridSizes = map[int]float64{
	0: 0.08,
	1: 0.3,
	2: 1.0,
}

// getClusterIDForPosition computes the cluster ID for a given position and LOD level
func getClusterIDForPosition(x, y, z float64, lodLevel int) string {
	gridSize := lodGridSizes[lodLevel]
	gridX := int(x / gridSize)
	gridY := int(y / gridSize)
	gridZ := int(z / gridSize)
	return fmt.Sprintf("%d_%d_%d_%d", lodLevel, gridX, gridY, gridZ)
}

// updateClusterBeingSolvedCount updates the beingSolvedCount for clusters containing a synapse
// delta: +1 when exploration starts, -1 when exploration stops
func updateClusterBeingSolvedCount(ctx context.Context, store *database.Store, posX, posY, posZ float64, delta int) {
	now := time.Now().UnixMilli()

	// Update cluster counts for all LOD levels
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		clusterID := getClusterIDForPosition(posX, posY, posZ, lodLevel)
		store.Queries.UpdateClusterBeingSolvedCount(ctx, generated.UpdateClusterBeingSolvedCountParams{
			ID:               clusterID,
			BeingSolvedCount: int32(delta),
			UpdatedAt:        now,
		})
	}
}

// broadcastAffectedClusters fetches and broadcasts updated cluster data for a synapse position
// This enables immediate dashboard updates when exploration starts/stops
func broadcastAffectedClusters(ctx context.Context, store *database.Store, hub *wshub.Hub, posX, posY, posZ float64) {
	var clusters []dto.SpaceCluster
	now := time.Now().UnixMilli()

	// Get updated cluster data for all LOD levels
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		clusterID := getClusterIDForPosition(posX, posY, posZ, lodLevel)
		cluster, err := store.Queries.GetSpaceCluster(ctx, clusterID)
		if err == nil {
			clusters = append(clusters, dto.SpaceCluster{
				ID:               cluster.ID,
				LODLevel:         int(cluster.LodLevel),
				PositionX:        cluster.PositionX,
				PositionY:        cluster.PositionY,
				PositionZ:        cluster.PositionZ,
				SpaceCount:       int(cluster.SpaceCount),
				DiscoveredCount:  int(cluster.DiscoveredCount),
				BeingSolvedCount: int(cluster.BeingSolvedCount),
				UpdatedAt:        cluster.UpdatedAt,
			})
		}
	}

	if len(clusters) > 0 {
		hub.Broadcast("cluster:update", dto.ClusterUpdateEvent{
			Clusters:  clusters,
			Timestamp: now,
		})
	}
}

// GetNearestSynapse finds the nearest synapse to given coordinates
func GetNearestSynapse(c *fiber.Ctx, store *database.Store) error {
	ctx := context.Background()

	x := c.QueryFloat("x", 0)
	y := c.QueryFloat("y", 0)
	z := c.QueryFloat("z", 0)
	radius := c.QueryFloat("radius", 0.5)

	space, err := store.Queries.GetNearestSpace(ctx, generated.GetNearestSpaceParams{
		PositionX:   x - radius,
		PositionX_2: x + radius,
		PositionY:   y - radius,
		PositionY_2: y + radius,
		PositionZ:   z - radius,
		PositionZ_2: z + radius,
		PositionX_3: x,
		PositionY_3: y,
		PositionZ_3: z,
	})
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "No synapse found near coordinates"})
	}

	// Get explorers if any
	explorers, _ := store.Queries.GetSynapseExplorers(ctx, space.ID)

	// Convert to DTO
	synapse := convertGenSpaceToSynapseDTO(space, explorers)

	return c.JSON(fiber.Map{
		"synapse": synapse,
	})
}

// GetSynapse retrieves a synapse by ID
func GetSynapse(c *fiber.Ctx, store *database.Store) error {
	ctx := context.Background()
	id := c.Params("id")

	space, err := store.Queries.GetSpace(ctx, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
	}

	// Get explorers
	explorers, _ := store.Queries.GetSynapseExplorers(ctx, space.ID)

	// Convert to DTO
	synapse := convertGenSpaceToSynapseDTO(space, explorers)

	// Build explorer info
	explorerInfo := make([]dto.ExplorerInfo, len(explorers))
	for i, exp := range explorers {
		agent, _ := store.Queries.GetAgent(ctx, exp.ShipID)
		explorerInfo[i] = dto.ExplorerInfo{
			ShipID:            exp.ShipID,
			UserID:            exp.UserID,
			ShipName:          agent.Name,
			PointsContributed: float64(exp.PointsContributed),
			PointsPerMinute:   float64(exp.PointsPerMinute),
			JoinedAt:          exp.JoinedAt,
		}
	}
	synapse.Explorers = explorerInfo

	return c.JSON(fiber.Map{
		"synapse": synapse,
	})
}

// ExploreSynapse starts exploring a synapse with a ship
func ExploreSynapse(c *fiber.Ctx, store *database.Store, hub *wshub.Hub) error {
	ctx := context.Background()
	synapseID := c.Params("id")

	var req struct {
		ShipID       string  `json:"shipId"`
		UserID       string  `json:"userId"`
		PointsPerMin float64 `json:"pointsPerMin,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ShipID == "" || req.UserID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "shipId and userId are required"})
	}

	// Get synapse
	space, err := store.Queries.GetSpace(ctx, synapseID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
	}

	if space.State == string(dto.SpaceDiscovered) {
		return c.Status(400).JSON(fiber.Map{"error": "Synapse has already been completed"})
	}

	// Get agent
	agent, err := store.Queries.GetAgent(ctx, req.ShipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	if agent.OwnerID != req.UserID {
		return c.Status(403).JSON(fiber.Map{"error": "Ship does not belong to user"})
	}

	if agent.State != string(dto.AgentIdle) && agent.State != string(dto.AgentSearching) {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Ship is not available (current state: %s)", agent.State),
		})
	}

	// Get synapse config
	synapseType := dto.SynapseType(space.SynapseType)
	synapseConfig := dto.GetDefaultSynapseConfig()[synapseType]

	// Check user level requirement
	user, _ := store.Queries.GetUser(ctx, req.UserID)
	userLevel := dto.CalculateUserLevel(user.UsdcSpent)
	requiredLevel := synapseConfig.UnlockUserLevel

	if userLevel < requiredLevel {
		levelConfig := dto.GetDefaultUserLevelConfig()[requiredLevel]
		return c.Status(403).JSON(fiber.Map{
			"error": fmt.Sprintf("User level %d too low for %s synapse (requires level %d, $%.0f+ USDC spent)",
				userLevel, synapseType, requiredLevel, levelConfig.MinUSDC),
		})
	}

	// Check if synapse is already being explored
	explorerCount, _ := store.Queries.GetSynapseExplorerCount(ctx, synapseID)
	if explorerCount >= 1 {
		return c.Status(400).JSON(fiber.Map{
			"error": "Synapse is already being explored. Try a different synapse or wait for it to complete.",
		})
	}

	// Apply level multiplier
	levelMultiplier := dto.GetDefaultUserLevelConfig()[userLevel].Multiplier
	requestedRate := req.PointsPerMin
	if requestedRate == 0 {
		requestedRate = 100
	}
	boostedRate := int(requestedRate * levelMultiplier)
	cappedRate := int(math.Min(float64(boostedRate), float64(synapseConfig.MaxPerMin)))

	now := time.Now().UnixMilli()

	// Add explorer
	explorerID := uuid.New().String()
	explorer, err := store.Queries.AddSynapseExplorer(ctx, generated.AddSynapseExplorerParams{
		ID:                explorerID,
		SynapseID:         synapseID,
		ShipID:            req.ShipID,
		UserID:            req.UserID,
		PointsContributed: 0,
		PointsPerMinute:   int32(cappedRate),
		JoinedAt:          now,
		LastUpdatedAt:     now,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to start exploration"})
	}

	// Update agent state to solving
	spaceUUID := StringToPgUUID(synapseID)
	if err := store.Queries.UpdateAgent(ctx, generated.UpdateAgentParams{
		ID:                  agent.ID,
		Name:                agent.Name,
		State:               string(dto.AgentSolving),
		PositionX:           space.PositionX,
		PositionY:           space.PositionY,
		PositionZ:           space.PositionZ,
		StartPositionX:      agent.StartPositionX,
		StartPositionY:      agent.StartPositionY,
		StartPositionZ:      agent.StartPositionZ,
		TargetSpaceID:       spaceUUID,
		TravelStartTime:     agent.TravelStartTime,
		TravelDuration:      agent.TravelDuration,
		TargetX:             agent.TargetX,
		TargetY:             agent.TargetY,
		TargetZ:             agent.TargetZ,
		CurrentSpaceID:      spaceUUID,
		CurrentPointsPerMin: int32(cappedRate),
		AutopilotEnabled:    agent.AutopilotEnabled,
		HomeX:               agent.HomeX,
		HomeY:               agent.HomeY,
		HomeZ:               agent.HomeZ,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update ship"})
	}

	// Re-fetch agent after update for accurate DTO conversion
	updatedAgent, _ := store.Queries.GetAgent(ctx, agent.ID)

	// Update synapse state if needed
	stateChanged := false
	if space.State == string(dto.SpaceUndiscovered) {
		if err := store.Queries.UpdateSpaceState(ctx, generated.UpdateSpaceStateParams{
			ID:    synapseID,
			State: string(dto.SpaceBeingSolved),
		}); err == nil {
			stateChanged = true
		}
	}

	// Update cluster counts and broadcast immediately for dashboard sync
	if stateChanged {
		updateClusterBeingSolvedCount(ctx, store, space.PositionX, space.PositionY, space.PositionZ, 1)
		broadcastAffectedClusters(ctx, store, hub, space.PositionX, space.PositionY, space.PositionZ)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    ConvertGenAgentToShipDTO(updatedAgent),
		"synapse": convertGenSpaceToSynapseDTO(space, []generated.SynapseExplorer{explorer}),
	})
}

// LeaveSynapse removes a ship from synapse exploration
func LeaveSynapse(c *fiber.Ctx, store *database.Store, hub *wshub.Hub) error {
	ctx := context.Background()
	synapseID := c.Params("id")

	var req struct {
		ShipID string `json:"shipId"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ShipID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "shipId is required"})
	}

	agent, err := store.Queries.GetAgent(ctx, req.ShipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	// Verify ship is exploring this synapse
	targetID := PgUUIDToStringPtr(agent.TargetSpaceID)
	if targetID == nil || *targetID != synapseID {
		return c.Status(400).JSON(fiber.Map{"error": "Ship is not exploring this synapse"})
	}

	// Remove explorer
	if err := store.Queries.RemoveSynapseExplorer(ctx, req.ShipID); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Failed to leave exploration"})
	}

	// Update agent state back to idle
	if err := store.Queries.UpdateAgent(ctx, generated.UpdateAgentParams{
		ID:               agent.ID,
		Name:             agent.Name,
		State:            string(dto.AgentIdle),
		PositionX:        agent.PositionX,
		PositionY:        agent.PositionY,
		PositionZ:        agent.PositionZ,
		StartPositionX:   agent.StartPositionX,
		StartPositionY:   agent.StartPositionY,
		StartPositionZ:   agent.StartPositionZ,
		TargetSpaceID:    pgtype.UUID{}, // NULL
		TravelStartTime:  agent.TravelStartTime,
		TravelDuration:   agent.TravelDuration,
		TargetX:          agent.TargetX,
		TargetY:          agent.TargetY,
		TargetZ:          agent.TargetZ,
		CurrentSpaceID:   pgtype.UUID{}, // NULL
		CurrentPointsPerMin: 0,
		AutopilotEnabled: agent.AutopilotEnabled,
		HomeX:            agent.HomeX,
		HomeY:            agent.HomeY,
		HomeZ:            agent.HomeZ,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update ship"})
	}

	// Re-fetch agent after update for accurate DTO conversion
	updatedAgent, _ := store.Queries.GetAgent(ctx, agent.ID)

	// Check if synapse has no more explorers
	remaining, _ := store.Queries.GetSynapseExplorerCount(ctx, synapseID)
	stateChanged := false
	var spacePosition struct{ X, Y, Z float64 }

	if remaining == 0 {
		// Reset synapse state
		space, err := store.Queries.GetSpace(ctx, synapseID)
		if err == nil && space.State == string(dto.SpaceBeingSolved) {
			if err := store.Queries.UpdateSpaceState(ctx, generated.UpdateSpaceStateParams{
				ID:    synapseID,
				State: string(dto.SpaceUndiscovered),
			}); err == nil {
				stateChanged = true
				spacePosition.X = space.PositionX
				spacePosition.Y = space.PositionY
				spacePosition.Z = space.PositionZ
			}
		}
	}

	// Update cluster counts and broadcast immediately for dashboard sync
	if stateChanged {
		updateClusterBeingSolvedCount(ctx, store, spacePosition.X, spacePosition.Y, spacePosition.Z, -1)
		broadcastAffectedClusters(ctx, store, hub, spacePosition.X, spacePosition.Y, spacePosition.Z)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    ConvertGenAgentToShipDTO(updatedAgent),
	})
}

// UpdateExplorationRate updates the spending rate for an active exploration
func UpdateExplorationRate(c *fiber.Ctx, store *database.Store) error {
	ctx := context.Background()
	synapseID := c.Params("id")

	var req struct {
		ShipID       string  `json:"shipId"`
		PointsPerMin float64 `json:"pointsPerMin"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ShipID == "" || req.PointsPerMin < 0 {
		return c.Status(400).JSON(fiber.Map{"error": "shipId and pointsPerMin are required"})
	}

	agent, err := store.Queries.GetAgent(ctx, req.ShipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	// Verify ship is exploring this synapse
	targetID := PgUUIDToStringPtr(agent.TargetSpaceID)
	if targetID == nil || *targetID != synapseID {
		return c.Status(400).JSON(fiber.Map{"error": "Ship is not exploring this synapse"})
	}

	// Get synapse config to cap rate
	space, err := store.Queries.GetSpace(ctx, synapseID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
	}
	synapseType := dto.SynapseType(space.SynapseType)
	synapseConfig := dto.GetDefaultSynapseConfig()[synapseType]
	cappedRate := int(math.Min(req.PointsPerMin, float64(synapseConfig.MaxPerMin)))

	// Get explorer and update rate
	explorer, err := store.Queries.GetExplorerByShip(ctx, req.ShipID)
	if err == nil {
		store.Queries.UpdateExplorerRate(ctx, generated.UpdateExplorerRateParams{
			ID:              explorer.ID,
			PointsPerMinute: int32(cappedRate),
			LastUpdatedAt:   time.Now().UnixMilli(),
		})
	}

	// Update agent
	if err := store.Queries.UpdateAgent(ctx, generated.UpdateAgentParams{
		ID:                  agent.ID,
		Name:                agent.Name,
		State:               agent.State,
		PositionX:           agent.PositionX,
		PositionY:           agent.PositionY,
		PositionZ:           agent.PositionZ,
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
		CurrentPointsPerMin: int32(cappedRate),
		AutopilotEnabled:    agent.AutopilotEnabled,
		HomeX:               agent.HomeX,
		HomeY:               agent.HomeY,
		HomeZ:               agent.HomeZ,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update ship"})
	}

	// Re-fetch agent after update for accurate DTO conversion
	updatedAgent, _ := store.Queries.GetAgent(ctx, agent.ID)

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    ConvertGenAgentToShipDTO(updatedAgent),
	})
}

// GetGameConfig returns the game configuration in frontend-compatible format
func GetGameConfig(c *fiber.Ctx, cfg *config.Config) error {
	// Return the format expected by the frontend (src/stores/configStore.ts)
	return c.JSON(dto.GetFrontendGameConfig(
		cfg.TickInterval,
		cfg.TimeMultiplier,
		cfg.BrainBoundsMin,
		cfg.BrainBoundsMax,
		cfg.BoundaryMargin,
		cfg.BoundarySteerStrength,
	))
}

// convertGenSpaceToSynapseDTO converts a generated.Space to a dto.Synapse
func convertGenSpaceToSynapseDTO(space generated.Space, explorers []generated.SynapseExplorer) dto.Synapse {
	var currentETAMinutes *float64
	if space.CurrentEtaMinutes != nil {
		val := float64(*space.CurrentEtaMinutes)
		currentETAMinutes = &val
	}

	synapseSpace := dto.Space{
		ID:                space.ID,
		PositionX:         space.PositionX,
		PositionY:         space.PositionY,
		PositionZ:         space.PositionZ,
		Region:            dto.BrainRegion(space.Region),
		Zone:              space.Zone,
		SynapseCount:      int(space.SynapseCount),
		State:             dto.SpaceState(space.State),
		DiscoveredAt:      space.DiscoveredAt,
		SynapseType:       dto.SynapseType(space.SynapseType),
		PointsRequired:    int(space.PointsRequired),
		PointsAccumulated: int(space.PointsAccumulated),
		CurrentETAMinutes: currentETAMinutes,
		AGIReward:         float64(space.AgiReward),
		SectorID:          PgUUIDToStringPtr(space.SectorID),
	}

	synapse := dto.SpaceToSynapse(synapseSpace)
	synapse.ExplorerCount = len(explorers)

	return synapse
}

// GetBulkSynapses returns all synapses in a compact binary format for efficient loading
// Binary format (16 bytes per synapse):
// - float32 positionX (4 bytes)
// - float32 positionY (4 bytes)
// - float32 positionZ (4 bytes)
// - uint8   state (1 byte): 0=undiscovered, 1=being_solved, 2=discovered
// - uint8   synapseType (1 byte): 0-6 mapping to minor/complex/deep/core/rare/legendary/unique
// - uint16  reserved (2 bytes)
//
// Response is gzipped. Header: version (1 byte) + count (4 bytes)
func GetBulkSynapses(c *fiber.Ctx, store *database.Store) error {
	ctx := context.Background()

	c.Set("Content-Type", "application/octet-stream")
	c.Set("Content-Encoding", "gzip")
	c.Set("Cache-Control", "no-cache")

	// Fetch all spaces ordered by ID for consistent indexing
	spaces, err := store.Queries.GetBulkSpaces(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch spaces"})
	}

	buf := new(bytes.Buffer)
	gzw := gzip.NewWriter(buf)

	// Write header: version (1 byte) + count (4 bytes)
	binary.Write(gzw, binary.LittleEndian, uint8(1))          // Version 1
	binary.Write(gzw, binary.LittleEndian, uint32(len(spaces)))

	// Write packed records
	for _, s := range spaces {
		binary.Write(gzw, binary.LittleEndian, float32(s.PositionX))
		binary.Write(gzw, binary.LittleEndian, float32(s.PositionY))
		binary.Write(gzw, binary.LittleEndian, float32(s.PositionZ))
		gzw.Write([]byte{encodeState(s.State), encodeSynapseType(s.SynapseType), 0, 0})
	}

	gzw.Close()
	return c.Send(buf.Bytes())
}

// encodeState converts space state string to uint8
func encodeState(s string) uint8 {
	switch s {
	case "being_solved":
		return 1
	case "discovered":
		return 2
	default: // "undiscovered"
		return 0
	}
}

// encodeSynapseType converts synapse type string to uint8
func encodeSynapseType(t string) uint8 {
	types := map[string]uint8{
		"minor":     0,
		"complex":   1,
		"deep":      2,
		"core":      3,
		"rare":      4,
		"legendary": 5,
		"unique":    6,
	}
	if v, ok := types[t]; ok {
		return v
	}
	return 0 // default to minor
}

// GetWorldState returns the current world state including clusters
func GetWorldState(c *fiber.Ctx, store *database.Store) error {
	ctx := context.Background()

	// Get synapse clusters
	spaceClusters, err := store.Queries.GetAllSpaceClusters(ctx)
	if err != nil {
		spaceClusters = []generated.SpaceCluster{}
	}

	synapseClusters := make([]dto.SpaceCluster, len(spaceClusters))
	for i, cl := range spaceClusters {
		synapseClusters[i] = dto.SpaceCluster{
			ID:               cl.ID,
			LODLevel:         int(cl.LodLevel),
			PositionX:        cl.PositionX,
			PositionY:        cl.PositionY,
			PositionZ:        cl.PositionZ,
			SpaceCount:       int(cl.SpaceCount),
			DiscoveredCount:  int(cl.DiscoveredCount),
			BeingSolvedCount: int(cl.BeingSolvedCount),
			UpdatedAt:        cl.UpdatedAt,
		}
	}

	// Get agent clusters
	agentClusters, err := store.Queries.GetAllAgentClusters(ctx)
	if err != nil {
		agentClusters = []generated.AgentCluster{}
	}

	agentClusterResult := make([]dto.AgentCluster, len(agentClusters))
	for i, cl := range agentClusters {
		agentClusterResult[i] = dto.AgentCluster{
			ID:            cl.ID,
			LODLevel:      int(cl.LodLevel),
			PositionX:     cl.PositionX,
			PositionY:     cl.PositionY,
			PositionZ:     cl.PositionZ,
			AgentCount:    int(cl.AgentCount),
			DominantState: dto.AgentState(cl.DominantState),
			AvgProgress:   cl.AvgProgress,
			UpdatedAt:     cl.UpdatedAt,
		}
	}

	// Get stats
	spaceStats, _ := store.Queries.GetSpaceStats(ctx)

	return c.JSON(dto.WorldState{
		SynapseClusters: synapseClusters,
		AgentClusters:   agentClusterResult,
		ShipClusters:    []dto.ShipCluster{}, // Empty for now, mapped from agent clusters on client
		DiscoveryProgress: dto.DiscoveryProgress{
			Total:         int(spaceStats.Total),
			Discovered:    int(spaceStats.Discovered),
			BeingSolved:   int(spaceStats.BeingSolved),
			BeingExplored: int(spaceStats.BeingSolved),
		},
		Timestamp: time.Now().UnixMilli(),
	})
}
