package admin

import (
	"time"

	"teneo/server-go/internal/database"

	"github.com/gofiber/fiber/v2"
)

// GetOverview returns high-level system metrics
func GetOverview(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	userCounts, err := store.Queries.GetOverviewUserCounts(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get user counts"})
	}

	agentCounts, err := store.Queries.GetOverviewAgentCounts(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get agent counts"})
	}

	spaceCounts, err := store.Queries.GetOverviewSpaceCounts(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get space counts"})
	}

	return c.JSON(fiber.Map{
		"users": fiber.Map{
			"total":  userCounts.TotalUsers,
			"active": userCounts.ActiveUsers,
			"banned": userCounts.BannedUsers,
		},
		"ships": fiber.Map{
			"total":     agentCounts.Total,
			"idle":      agentCounts.Idle,
			"searching": agentCounts.Searching,
			"traveling": agentCounts.Traveling,
			"solving":   agentCounts.Solving,
		},
		"spaces": fiber.Map{
			"total":         spaceCounts.Total,
			"discovered":    spaceCounts.Discovered,
			"beingExplored": spaceCounts.BeingExplored,
			"undiscovered":  spaceCounts.Total - spaceCounts.Discovered - spaceCounts.BeingExplored,
		},
		"timestamp": time.Now().UnixMilli(),
	})
}

// GetEconomy returns token economy metrics
func GetEconomy(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	totals, err := store.Queries.GetUserEconomyTotals(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get economy totals"})
	}

	// Level distribution
	levelRows, err := store.Queries.GetUserLevelDistribution(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get level distribution"})
	}

	levelDist := make(map[int32]int64)
	for _, lc := range levelRows {
		levelDist[lc.UserLevel] = lc.Count
	}

	return c.JSON(fiber.Map{
		"circulation": fiber.Map{
			"agi":     totals.TotalAgi,
			"teneo":   totals.TotalTeneo,
			"agentic": totals.TotalAgentic,
			"usdc":    totals.TotalUsdc,
			"points":  totals.TotalPoints,
		},
		"levelDistribution": levelDist,
		"timestamp":         time.Now().UnixMilli(),
	})
}

// GetSynapseTypes returns synapse type distribution
func GetSynapseTypes(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	stats, err := store.Queries.GetSynapseTypeDistribution(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get synapse types"})
	}

	types := make([]fiber.Map, len(stats))
	for i, s := range stats {
		types[i] = fiber.Map{
			"type":          s.SynapseType,
			"total":         s.Total,
			"discovered":    s.Discovered,
			"beingExplored": s.BeingExplored,
			"undiscovered":  s.Total - s.Discovered - s.BeingExplored,
		}
	}

	return c.JSON(fiber.Map{
		"synapseTypes": types,
		"timestamp":    time.Now().UnixMilli(),
	})
}

// GetDiscoveryRate returns discovery rate over time
func GetDiscoveryRate(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	days := c.QueryInt("days", 7)
	now := time.Now()
	startTime := now.AddDate(0, 0, -days).UnixMilli()

	dayCounts, err := store.Queries.GetDiscoveryRateByDay(ctx, &startTime)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get discovery rate"})
	}

	data := make([]fiber.Map, len(dayCounts))
	for i, dc := range dayCounts {
		data[i] = fiber.Map{"day": dc.Day, "count": dc.Count}
	}

	return c.JSON(fiber.Map{
		"discoveryRate": data,
		"days":          days,
		"timestamp":     time.Now().UnixMilli(),
	})
}

// GetUserGrowth returns user registration trends
func GetUserGrowth(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	days := c.QueryInt("days", 30)
	now := time.Now()
	startTime := now.AddDate(0, 0, -days).UnixMilli()

	dayCounts, err := store.Queries.GetUserGrowthByDay(ctx, startTime)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get user growth"})
	}

	data := make([]fiber.Map, len(dayCounts))
	cumulative := int64(0)
	for i, dc := range dayCounts {
		cumulative += dc.Count
		data[i] = fiber.Map{"day": dc.Day, "new": dc.Count, "cumulative": cumulative}
	}

	return c.JSON(fiber.Map{
		"userGrowth": data,
		"days":       days,
		"timestamp":  time.Now().UnixMilli(),
	})
}

// GetTopUsers returns top users by metric
func GetTopUsers(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	metric := c.Query("metric", "agi")
	limit := int32(c.QueryInt("limit", 10))

	type topUser struct {
		ID             string
		Wallet         string
		TotalAgiEarned int32
		Points         float64
		UsdcSpent      float64
		AgenticBalance int32
	}

	var users []topUser

	switch metric {
	case "points":
		rows, err := store.Queries.GetTopUsersByPoints(ctx, limit)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get top users"})
		}
		for _, r := range rows {
			users = append(users, topUser{ID: r.ID, Wallet: r.Wallet, TotalAgiEarned: r.TotalAgiEarned, Points: r.Points, UsdcSpent: r.UsdcSpent, AgenticBalance: r.AgenticBalance})
		}
	case "usdc":
		rows, err := store.Queries.GetTopUsersByUSDC(ctx, limit)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get top users"})
		}
		for _, r := range rows {
			users = append(users, topUser{ID: r.ID, Wallet: r.Wallet, TotalAgiEarned: r.TotalAgiEarned, Points: r.Points, UsdcSpent: r.UsdcSpent, AgenticBalance: r.AgenticBalance})
		}
	case "agentic":
		rows, err := store.Queries.GetTopUsersByAgentic(ctx, limit)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get top users"})
		}
		for _, r := range rows {
			users = append(users, topUser{ID: r.ID, Wallet: r.Wallet, TotalAgiEarned: r.TotalAgiEarned, Points: r.Points, UsdcSpent: r.UsdcSpent, AgenticBalance: r.AgenticBalance})
		}
	default: // "agi"
		rows, err := store.Queries.GetTopUsersByAGI(ctx, limit)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get top users"})
		}
		for _, r := range rows {
			users = append(users, topUser{ID: r.ID, Wallet: r.Wallet, TotalAgiEarned: r.TotalAgiEarned, Points: r.Points, UsdcSpent: r.UsdcSpent, AgenticBalance: r.AgenticBalance})
		}
	}

	result := make([]fiber.Map, len(users))
	for i, user := range users {
		var value float64
		switch metric {
		case "agi":
			value = float64(user.TotalAgiEarned)
		case "points":
			value = user.Points
		case "usdc":
			value = user.UsdcSpent
		case "agentic":
			value = float64(user.AgenticBalance)
		default:
			value = float64(user.TotalAgiEarned)
		}

		result[i] = fiber.Map{
			"rank":   i + 1,
			"id":     user.ID,
			"wallet": user.Wallet,
			"value":  value,
		}
	}

	return c.JSON(fiber.Map{
		"topUsers":  result,
		"metric":    metric,
		"timestamp": time.Now().UnixMilli(),
	})
}
