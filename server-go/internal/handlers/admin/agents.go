package admin

import (
	"errors"
	"strconv"
	"time"

	"teneo/server-go/internal/database"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// ListAgents returns paginated list of agents/ships
func ListAgents(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	state := c.Query("state", "")
	offset := (page - 1) * limit

	var total int64
	var err error

	if state != "" {
		total, err = store.Queries.GetAgentCountByState(ctx, state)
	} else {
		total, err = store.Queries.GetAgentCount(ctx)
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to count agents"})
	}

	// Get agents with owner wallet via raw SQL join
	type agentRow struct {
		ID               string
		OwnerID          string
		Name             string
		State            string
		PositionX        float64
		PositionY        float64
		PositionZ        float64
		TargetSpaceID    *string
		AutopilotEnabled bool
		CreatedAt        int64
		OwnerWallet      *string
	}

	var query string
	var args []interface{}
	if state != "" {
		query = `SELECT a.id, a.owner_id, a.name, a.state, a.position_x, a.position_y, a.position_z,
		                a.target_space_id::TEXT, a.autopilot_enabled, a.created_at, u.wallet
		         FROM agents a LEFT JOIN users u ON a.owner_id = u.id
		         WHERE a.state = $1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`
		args = []interface{}{state, limit, offset}
	} else {
		query = `SELECT a.id, a.owner_id, a.name, a.state, a.position_x, a.position_y, a.position_z,
		                a.target_space_id::TEXT, a.autopilot_enabled, a.created_at, u.wallet
		         FROM agents a LEFT JOIN users u ON a.owner_id = u.id
		         ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`
		args = []interface{}{limit, offset}
	}

	rows, err := store.Pool.Query(ctx, query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to query agents"})
	}
	defer rows.Close()

	var results []agentRow
	for rows.Next() {
		var r agentRow
		if err := rows.Scan(&r.ID, &r.OwnerID, &r.Name, &r.State, &r.PositionX, &r.PositionY, &r.PositionZ,
			&r.TargetSpaceID, &r.AutopilotEnabled, &r.CreatedAt, &r.OwnerWallet); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to scan agent"})
		}
		results = append(results, r)
	}
	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to iterate agents"})
	}

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
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	ownerID := c.Params("ownerId")

	agents, err := store.Queries.GetAgentsByOwner(ctx, ownerID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to query agents"})
	}

	result := make([]fiber.Map, len(agents))
	for i, agent := range agents {
		targetSpaceID := ""
		if agent.TargetSpaceID.Valid {
			b, _ := agent.TargetSpaceID.MarshalJSON()
			targetSpaceID = string(b)
			// Strip quotes from JSON marshaled UUID
			if len(targetSpaceID) > 2 {
				targetSpaceID = targetSpaceID[1 : len(targetSpaceID)-1]
			}
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
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	now := currentTimeMs()

	stuckAgents, err := store.Queries.GetStuckAgents(ctx, &now)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get stuck agents"})
	}

	// Get owner wallets for stuck agents
	agents := make([]fiber.Map, len(stuckAgents))
	for i, a := range stuckAgents {
		wallet := ""
		owner, err := store.Queries.GetUser(ctx, a.OwnerID)
		if err == nil {
			wallet = owner.Wallet
		}

		stuckDuration := int64(0)
		if a.TravelStartTime != nil {
			stuckDuration = now - *a.TravelStartTime
		}
		travelStartTime := int64(0)
		if a.TravelStartTime != nil {
			travelStartTime = *a.TravelStartTime
		}

		agents[i] = fiber.Map{
			"id":              a.ID,
			"ownerId":         a.OwnerID,
			"ownerWallet":     wallet,
			"name":            a.Name,
			"state":           a.State,
			"travelStartTime": travelStartTime,
			"stuckDuration":   stuckDuration,
		}
	}

	return c.JSON(fiber.Map{"stuckAgents": agents, "count": len(agents)})
}

// GetAgentDetail returns detailed info about a specific agent
func GetAgentDetail(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	agentID := c.Params("id")

	agent, err := store.Queries.GetAgent(ctx, agentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get agent"})
	}

	// Get owner wallet
	ownerWallet := ""
	owner, err := store.Queries.GetUser(ctx, agent.OwnerID)
	if err == nil {
		ownerWallet = owner.Wallet
	}

	// Get current exploration if any
	var currentExploration fiber.Map
	explorer, err := store.Queries.GetExplorerByShip(ctx, agentID)
	if err == nil {
		currentExploration = fiber.Map{
			"explorerId":        explorer.ID,
			"synapseId":         explorer.SynapseID,
			"pointsContributed": explorer.PointsContributed,
			"joinedAt":          explorer.JoinedAt,
		}
	}

	targetSpaceID := ""
	if agent.TargetSpaceID.Valid {
		b, _ := agent.TargetSpaceID.MarshalJSON()
		targetSpaceID = string(b)
		if len(targetSpaceID) > 2 {
			targetSpaceID = targetSpaceID[1 : len(targetSpaceID)-1]
		}
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

