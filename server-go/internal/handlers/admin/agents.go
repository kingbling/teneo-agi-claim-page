package admin

import (
	"strconv"
	"time"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// AgentWithOwner is a struct to hold agent with owner wallet info
type AgentWithOwner struct {
	models.Agent
	OwnerWallet string `gorm:"column:wallet"`
}

// ListAgents returns paginated list of agents/ships
func ListAgents(c *fiber.Ctx) error {
	database := db.Get()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	state := c.Query("state", "")
	offset := (page - 1) * limit

	// Build query
	query := database.Model(&models.Agent{})
	if state != "" {
		query = query.Where("state = ?", state)
	}

	// Count total
	var total int64
	query.Count(&total)

	// Get agents with owner wallet via join
	var results []struct {
		ID               string   `gorm:"column:id"`
		OwnerID          string   `gorm:"column:owner_id"`
		Name             string   `gorm:"column:name"`
		State            string   `gorm:"column:state"`
		PositionX        float64  `gorm:"column:position_x"`
		PositionY        float64  `gorm:"column:position_y"`
		PositionZ        float64  `gorm:"column:position_z"`
		TargetSpaceID    *string  `gorm:"column:target_space_id"`
		AutopilotEnabled bool     `gorm:"column:autopilot_enabled"`
		CreatedAt        int64    `gorm:"column:created_at"`
		OwnerWallet      *string  `gorm:"column:wallet"`
	}

	database.Table("agents a").
		Select("a.id, a.owner_id, a.name, a.state, a.position_x, a.position_y, a.position_z, a.target_space_id, a.autopilot_enabled, a.created_at, u.wallet").
		Joins("LEFT JOIN users u ON a.owner_id = u.id").
		Where(func() string {
			if state != "" {
				return "a.state = ?"
			}
			return "1=1"
		}(), state).
		Order("a.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&results)

	agents := make([]fiber.Map, len(results))
	for i, r := range results {
		wallet := ""
		if r.OwnerWallet != nil {
			wallet = *r.OwnerWallet
		}
		targetSpaceID := ""
		if r.TargetSpaceID != nil {
			targetSpaceID = *r.TargetSpaceID
		}
		agents[i] = fiber.Map{
			"id":               r.ID,
			"ownerId":          r.OwnerID,
			"ownerWallet":      wallet,
			"name":             r.Name,
			"state":            r.State,
			"positionX":        r.PositionX,
			"positionY":        r.PositionY,
			"positionZ":        r.PositionZ,
			"targetSpaceId":    targetSpaceID,
			"autopilotEnabled": r.AutopilotEnabled,
			"createdAt":        r.CreatedAt,
		}
	}

	return c.JSON(fiber.Map{
		"agents": agents,
		"total":  total,
		"page":   page,
		"limit":  limit,
	})
}

// GetAgentsByOwner returns all agents for a specific user
func GetAgentsByOwner(c *fiber.Ctx) error {
	database := db.Get()
	ownerID := c.Params("ownerId")

	var agents []models.Agent
	if err := database.Select("id, name, state, position_x, position_y, position_z, target_space_id, autopilot_enabled, created_at").
		Where("owner_id = ?", ownerID).Find(&agents).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to query agents"})
	}

	result := make([]fiber.Map, len(agents))
	for i, agent := range agents {
		targetSpaceID := ""
		if agent.TargetSpaceID != nil {
			targetSpaceID = *agent.TargetSpaceID
		}
		result[i] = fiber.Map{
			"id":               agent.ID,
			"name":             agent.Name,
			"state":            agent.State,
			"positionX":        agent.PositionX,
			"positionY":        agent.PositionY,
			"positionZ":        agent.PositionZ,
			"targetSpaceId":    targetSpaceID,
			"autopilotEnabled": agent.AutopilotEnabled,
			"createdAt":        agent.CreatedAt,
		}
	}

	return c.JSON(fiber.Map{"agents": result})
}

// GetStuckAgents returns agents that appear to be stuck
func GetStuckAgents(c *fiber.Ctx) error {
	database := db.Get()

	// Agents stuck in traveling state for more than 1 hour
	stuckThreshold := int64(3600000) // 1 hour in ms
	now := currentTimeMs()

	var results []struct {
		ID              string  `gorm:"column:id"`
		OwnerID         string  `gorm:"column:owner_id"`
		Name            string  `gorm:"column:name"`
		State           string  `gorm:"column:state"`
		TravelStartTime *int64  `gorm:"column:travel_start_time"`
		Wallet          *string `gorm:"column:wallet"`
	}

	database.Table("agents a").
		Select("a.id, a.owner_id, a.name, a.state, a.travel_start_time, u.wallet").
		Joins("LEFT JOIN users u ON a.owner_id = u.id").
		Where("a.state = ? AND a.travel_start_time IS NOT NULL AND (? - a.travel_start_time) > ?",
			"traveling", now, stuckThreshold).
		Order("a.travel_start_time ASC").
		Find(&results)

	agents := make([]fiber.Map, len(results))
	for i, r := range results {
		wallet := ""
		if r.Wallet != nil {
			wallet = *r.Wallet
		}
		stuckDuration := int64(0)
		if r.TravelStartTime != nil {
			stuckDuration = now - *r.TravelStartTime
		}
		travelStartTime := int64(0)
		if r.TravelStartTime != nil {
			travelStartTime = *r.TravelStartTime
		}

		agents[i] = fiber.Map{
			"id":              r.ID,
			"ownerId":         r.OwnerID,
			"ownerWallet":     wallet,
			"name":            r.Name,
			"state":           r.State,
			"travelStartTime": travelStartTime,
			"stuckDuration":   stuckDuration,
		}
	}

	return c.JSON(fiber.Map{"stuckAgents": agents, "count": len(agents)})
}

// GetAgentDetail returns detailed info about a specific agent
func GetAgentDetail(c *fiber.Ctx) error {
	database := db.Get()
	agentID := c.Params("id")

	var agent models.Agent
	if err := database.First(&agent, "id = ?", agentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}

	// Get owner wallet
	var ownerWallet string
	database.Model(&models.User{}).Select("wallet").Where("id = ?", agent.OwnerID).Scan(&ownerWallet)

	// Get current exploration if any
	var currentExploration fiber.Map
	var explorer models.SynapseExplorer
	if err := database.First(&explorer, "ship_id = ?", agentID).Error; err == nil {
		currentExploration = fiber.Map{
			"explorerId":        explorer.ID,
			"synapseId":         explorer.SynapseID,
			"pointsContributed": explorer.PointsContributed,
			"joinedAt":          explorer.JoinedAt,
		}
	}

	targetSpaceID := ""
	if agent.TargetSpaceID != nil {
		targetSpaceID = *agent.TargetSpaceID
	}
	travelStartTime := int64(0)
	if agent.TravelStartTime != nil {
		travelStartTime = *agent.TravelStartTime
	}
	travelDuration := int64(0)
	if agent.TravelDuration != nil {
		travelDuration = *agent.TravelDuration
	}

	return c.JSON(fiber.Map{
		"id":                 agent.ID,
		"ownerId":            agent.OwnerID,
		"ownerWallet":        ownerWallet,
		"name":               agent.Name,
		"state":              agent.State,
		"positionX":          agent.PositionX,
		"positionY":          agent.PositionY,
		"positionZ":          agent.PositionZ,
		"targetSpaceId":      targetSpaceID,
		"travelStartTime":    travelStartTime,
		"travelDuration":     travelDuration,
		"autopilotEnabled":   agent.AutopilotEnabled,
		"equippedItems":      agent.EquippedItems,
		"spacesDiscovered":   agent.SpacesDiscovered,
		"totalAgiEarned":     agent.TotalAgiEarned,
		"createdAt":          agent.CreatedAt,
		"currentExploration": currentExploration,
	})
}

func currentTimeMs() int64 {
	return time.Now().UnixMilli()
}
