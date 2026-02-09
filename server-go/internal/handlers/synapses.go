package handlers

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"fmt"
	"math"
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
func updateClusterBeingSolvedCount(database *gorm.DB, posX, posY, posZ float64, delta int) {
	now := time.Now().UnixMilli()

	// Update cluster counts for all LOD levels
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		clusterID := getClusterIDForPosition(posX, posY, posZ, lodLevel)
		database.Model(&models.SpaceCluster{}).
			Where("id = ?", clusterID).
			Updates(map[string]interface{}{
				"being_solved_count": gorm.Expr("MAX(0, being_solved_count + ?)", delta),
				"updated_at":         now,
			})
	}
}

// broadcastAffectedClusters fetches and broadcasts updated cluster data for a synapse position
// This enables immediate dashboard updates when exploration starts/stops
func broadcastAffectedClusters(database *gorm.DB, hub *wshub.Hub, posX, posY, posZ float64) {
	var clusters []dto.SpaceCluster
	now := time.Now().UnixMilli()

	// Get updated cluster data for all LOD levels
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		clusterID := getClusterIDForPosition(posX, posY, posZ, lodLevel)
		var cluster models.SpaceCluster
		if err := database.First(&cluster, "id = ?", clusterID).Error; err == nil {
			clusters = append(clusters, dto.SpaceCluster{
				ID:               cluster.ID,
				LODLevel:         cluster.LodLevel,
				PositionX:        cluster.PositionX,
				PositionY:        cluster.PositionY,
				PositionZ:        cluster.PositionZ,
				SpaceCount:       cluster.SpaceCount,
				DiscoveredCount:  cluster.DiscoveredCount,
				BeingSolvedCount: cluster.BeingSolvedCount,
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
func GetNearestSynapse(c *fiber.Ctx, database *gorm.DB) error {
	x := c.QueryFloat("x", 0)
	y := c.QueryFloat("y", 0)
	z := c.QueryFloat("z", 0)
	radius := c.QueryFloat("radius", 0.5)

	space, err := db.GetNearestSpace(database, x, y, z, radius)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "No synapse found near coordinates"})
	}

	// Get explorers if any
	explorers, _ := db.GetSynapseExplorers(database, space.ID)

	// Convert to DTO
	synapse := convertSpaceToSynapseDTO(space, explorers)

	return c.JSON(fiber.Map{
		"synapse": synapse,
	})
}

// GetSynapse retrieves a synapse by ID
func GetSynapse(c *fiber.Ctx, database *gorm.DB) error {
	id := c.Params("id")

	space, err := db.GetSpace(database, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
	}

	// Get explorers
	explorers, _ := db.GetSynapseExplorers(database, space.ID)

	// Convert to DTO
	synapse := convertSpaceToSynapseDTO(space, explorers)

	// Build explorer info
	explorerInfo := make([]dto.ExplorerInfo, len(explorers))
	for i, exp := range explorers {
		agent, _ := db.GetAgent(database, exp.ShipID)
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
func ExploreSynapse(c *fiber.Ctx, database *gorm.DB, hub *wshub.Hub) error {
	synapseID := c.Params("id")

	var req struct {
		ShipID      string  `json:"shipId"`
		UserID      string  `json:"userId"`
		PointsPerMin float64 `json:"pointsPerMin,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ShipID == "" || req.UserID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "shipId and userId are required"})
	}

	// Get synapse
	space, err := db.GetSpace(database, synapseID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Synapse not found"})
	}

	if space.State == string(dto.SpaceDiscovered) {
		return c.Status(400).JSON(fiber.Map{"error": "Synapse has already been completed"})
	}

	// Get agent
	agent, err := db.GetAgent(database, req.ShipID)
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
	user, _ := db.GetUser(database, req.UserID)
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
	explorerCount, _ := db.GetSynapseExplorerCount(database, synapseID)
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
	explorer := &models.SynapseExplorer{
		ID:                uuid.New().String(),
		SynapseID:         synapseID,
		ShipID:            req.ShipID,
		UserID:            req.UserID,
		PointsContributed: 0,
		PointsPerMinute:   cappedRate,
		JoinedAt:          now,
		LastUpdatedAt:     now,
	}

	if err := db.AddSynapseExplorer(database, explorer); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to start exploration"})
	}

	// Update agent state
	// Heap-allocate synapse ID to avoid dangling pointer issues
	sidTarget := new(string)
	sidCurrent := new(string)
	*sidTarget = synapseID
	*sidCurrent = synapseID
	agent.State = string(dto.AgentSolving)
	agent.TargetSpaceID = sidTarget
	agent.CurrentSpaceID = sidCurrent
	agent.PositionX = space.PositionX
	agent.PositionY = space.PositionY
	agent.PositionZ = space.PositionZ
	agent.CurrentPointsPerMin = cappedRate

	if err := db.UpdateAgent(database, agent); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update ship"})
	}

	// Update synapse state if needed
	stateChanged := false
	if space.State == string(dto.SpaceUndiscovered) {
		space.State = string(dto.SpaceBeingSolved)
		db.UpdateSpace(database, space)
		stateChanged = true
	}

	// Update cluster counts and broadcast immediately for dashboard sync
	if stateChanged {
		updateClusterBeingSolvedCount(database, space.PositionX, space.PositionY, space.PositionZ, 1)
		broadcastAffectedClusters(database, hub, space.PositionX, space.PositionY, space.PositionZ)
	}

	// Trigger WebSocket update
	hub.SendToUser(req.UserID, "ships:sync", map[string]interface{}{
		"ships":     []dto.ShipDTO{convertAgentToDTO(*agent)},
		"timestamp": time.Now().UnixMilli(),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"ship":    convertAgentToDTO(*agent),
		"synapse": convertSpaceToSynapseDTO(space, []models.SynapseExplorer{*explorer}),
	})
}

// LeaveSynapse removes a ship from synapse exploration
func LeaveSynapse(c *fiber.Ctx, database *gorm.DB, hub *wshub.Hub) error {
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

	agent, err := db.GetAgent(database, req.ShipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	// Verify ship is exploring this synapse
	if agent.TargetSpaceID == nil || *agent.TargetSpaceID != synapseID {
		return c.Status(400).JSON(fiber.Map{"error": "Ship is not exploring this synapse"})
	}

	// Remove explorer
	if err := db.RemoveSynapseExplorer(database, req.ShipID); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Failed to leave exploration"})
	}

	// Update agent state back to idle
	agent.State = string(dto.AgentIdle)
	agent.TargetSpaceID = nil
	agent.CurrentSpaceID = nil
	agent.CurrentPointsPerMin = 0

	if err := db.UpdateAgent(database, agent); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update ship"})
	}

	// Check if synapse has no more explorers
	remaining, _ := db.GetSynapseExplorerCount(database, synapseID)
	stateChanged := false
	var spacePosition struct{ X, Y, Z float64 }

	if remaining == 0 {
		// Reset synapse state
		space, _ := db.GetSpace(database, synapseID)
		if space.State == string(dto.SpaceBeingSolved) {
			space.State = string(dto.SpaceUndiscovered)
			db.UpdateSpace(database, space)
			stateChanged = true
			spacePosition.X = space.PositionX
			spacePosition.Y = space.PositionY
			spacePosition.Z = space.PositionZ
		}
	}

	// Update cluster counts and broadcast immediately for dashboard sync
	if stateChanged {
		updateClusterBeingSolvedCount(database, spacePosition.X, spacePosition.Y, spacePosition.Z, -1)
		broadcastAffectedClusters(database, hub, spacePosition.X, spacePosition.Y, spacePosition.Z)
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

// UpdateExplorationRate updates the spending rate for an active exploration
func UpdateExplorationRate(c *fiber.Ctx, database *gorm.DB, hub *wshub.Hub) error {
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

	agent, err := db.GetAgent(database, req.ShipID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ship not found"})
	}

	// Verify ship is exploring this synapse
	if agent.TargetSpaceID == nil || *agent.TargetSpaceID != synapseID {
		return c.Status(400).JSON(fiber.Map{"error": "Ship is not exploring this synapse"})
	}

	// Get synapse config to cap rate
	space, _ := db.GetSpace(database, synapseID)
	synapseType := dto.SynapseType(space.SynapseType)
	synapseConfig := dto.GetDefaultSynapseConfig()[synapseType]
	cappedRate := int(math.Min(req.PointsPerMin, float64(synapseConfig.MaxPerMin)))

	// Get explorer and update rate
	explorer, _ := db.GetExplorerByShip(database, req.ShipID)
	if explorer != nil {
		db.UpdateExplorerRate(database, explorer.ID, cappedRate)
	}

	// Update agent
	agent.CurrentPointsPerMin = cappedRate
	if err := db.UpdateAgent(database, agent); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update ship"})
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

// convertSpaceToSynapseDTO converts a models.Space to a dto.Synapse
func convertSpaceToSynapseDTO(space *models.Space, explorers []models.SynapseExplorer) dto.Synapse {
	var currentETAMinutes *float64
	if space.CurrentEtaMinutes != nil {
		// Heap-allocate to avoid dangling pointer to stack variable
		val := new(float64)
		*val = float64(*space.CurrentEtaMinutes)
		currentETAMinutes = val
	}

	synapseSpace := dto.Space{
		ID:                space.ID,
		PositionX:         space.PositionX,
		PositionY:         space.PositionY,
		PositionZ:         space.PositionZ,
		Region:            dto.BrainRegion(space.Region),
		Zone:              space.Zone,
		SynapseCount:      space.SynapseCount,
		State:             dto.SpaceState(space.State),
		DiscoveredAt:      space.DiscoveredAt,
		SynapseType:       dto.SynapseType(space.SynapseType),
		PointsRequired:    space.PointsRequired,
		PointsAccumulated: space.PointsAccumulated,
		CurrentETAMinutes: currentETAMinutes,
		AGIReward:         float64(space.AgiReward),
		SectorID:          space.SectorID,
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
func GetBulkSynapses(c *fiber.Ctx, database *gorm.DB) error {
	c.Set("Content-Type", "application/octet-stream")
	c.Set("Content-Encoding", "gzip")
	c.Set("Cache-Control", "no-cache")

	// Fetch all spaces ordered by ID for consistent indexing
	var spaces []models.Space
	database.Select("position_x, position_y, position_z, state, synapse_type").
		Order("id").
		Find(&spaces)

	buf := new(bytes.Buffer)
	gzw := gzip.NewWriter(buf)

	// Write header: version (1 byte) + count (4 bytes)
	binary.Write(gzw, binary.LittleEndian, uint8(1))       // Version 1
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
func GetWorldState(c *fiber.Ctx, database *gorm.DB) error {
	// Get synapse clusters
	var spaceClusters []models.SpaceCluster
	database.Find(&spaceClusters)

	synapseClusters := make([]dto.SpaceCluster, len(spaceClusters))
	for i, c := range spaceClusters {
		synapseClusters[i] = dto.SpaceCluster{
			ID:               c.ID,
			LODLevel:         c.LodLevel,
			PositionX:        c.PositionX,
			PositionY:        c.PositionY,
			PositionZ:        c.PositionZ,
			SpaceCount:       c.SpaceCount,
			DiscoveredCount:  c.DiscoveredCount,
			BeingSolvedCount: c.BeingSolvedCount,
			UpdatedAt:        c.UpdatedAt,
		}
	}

	// Get agent clusters
	var agentClusters []models.AgentCluster
	database.Find(&agentClusters)

	agentClusterResult := make([]dto.AgentCluster, len(agentClusters))
	for i, c := range agentClusters {
		agentClusterResult[i] = dto.AgentCluster{
			ID:            c.ID,
			LODLevel:      c.LodLevel,
			PositionX:     c.PositionX,
			PositionY:     c.PositionY,
			PositionZ:     c.PositionZ,
			AgentCount:    c.AgentCount,
			DominantState: dto.AgentState(c.DominantState),
			AvgProgress:   c.AvgProgress,
			UpdatedAt:     c.UpdatedAt,
		}
	}

	// Get stats
	spaceStats, _ := db.GetSpaceStats(database)

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
