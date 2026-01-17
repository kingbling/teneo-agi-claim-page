package admin

import (
	"time"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetOverview returns high-level system metrics
func GetOverview(c *fiber.Ctx) error {
	database := db.Get()

	var totalUsers, activeUsers, bannedUsers int64
	var totalShips, idleShips, searchingShips, travelingShips, solvingShips int64
	var totalSpaces, discoveredSpaces, beingExploredSpaces int64

	database.Model(&models.User{}).Count(&totalUsers)
	database.Model(&models.User{}).Where("is_banned = ?", false).Count(&activeUsers)
	database.Model(&models.User{}).Where("is_banned = ?", true).Count(&bannedUsers)

	database.Model(&models.Agent{}).Count(&totalShips)
	database.Model(&models.Agent{}).Where("state = ?", "idle").Count(&idleShips)
	database.Model(&models.Agent{}).Where("state = ?", "searching").Count(&searchingShips)
	database.Model(&models.Agent{}).Where("state = ?", "traveling").Count(&travelingShips)
	database.Model(&models.Agent{}).Where("state = ?", "solving").Count(&solvingShips)

	database.Model(&models.Space{}).Count(&totalSpaces)
	database.Model(&models.Space{}).Where("state = ?", "discovered").Count(&discoveredSpaces)
	database.Model(&models.Space{}).Where("state = ?", "being_solved").Count(&beingExploredSpaces)

	return c.JSON(fiber.Map{
		"users": fiber.Map{
			"total":  totalUsers,
			"active": activeUsers,
			"banned": bannedUsers,
		},
		"ships": fiber.Map{
			"total":     totalShips,
			"idle":      idleShips,
			"searching": searchingShips,
			"traveling": travelingShips,
			"solving":   solvingShips,
		},
		"spaces": fiber.Map{
			"total":         totalSpaces,
			"discovered":    discoveredSpaces,
			"beingExplored": beingExploredSpaces,
			"undiscovered":  totalSpaces - discoveredSpaces - beingExploredSpaces,
		},
		"timestamp": time.Now().UnixMilli(),
	})
}

// GetEconomy returns token economy metrics
func GetEconomy(c *fiber.Ctx) error {
	database := db.Get()

	var totalAgi, totalTeneo, totalAgentic, totalUsdc, totalPoints float64

	database.Model(&models.User{}).Select("COALESCE(SUM(total_agi_earned), 0)").Scan(&totalAgi)
	database.Model(&models.User{}).Select("COALESCE(SUM(total_teneo_earned), 0)").Scan(&totalTeneo)
	database.Model(&models.User{}).Select("COALESCE(SUM(agentic_balance), 0)").Scan(&totalAgentic)
	database.Model(&models.User{}).Select("COALESCE(SUM(usdc_spent), 0)").Scan(&totalUsdc)
	database.Model(&models.User{}).Select("COALESCE(SUM(points), 0)").Scan(&totalPoints)

	// Level distribution
	type LevelCount struct {
		UserLevel int
		Count     int64
	}
	var levelCounts []LevelCount
	database.Model(&models.User{}).Select("user_level, COUNT(*) as count").Group("user_level").Find(&levelCounts)

	levelDist := make(map[int]int64)
	for _, lc := range levelCounts {
		levelDist[lc.UserLevel] = lc.Count
	}

	return c.JSON(fiber.Map{
		"circulation": fiber.Map{
			"agi":     totalAgi,
			"teneo":   totalTeneo,
			"agentic": totalAgentic,
			"usdc":    totalUsdc,
			"points":  totalPoints,
		},
		"levelDistribution": levelDist,
		"timestamp":         time.Now().UnixMilli(),
	})
}

// GetSynapseTypes returns synapse type distribution
func GetSynapseTypes(c *fiber.Ctx) error {
	database := db.Get()

	type TypeStats struct {
		SynapseType   string
		Total         int64
		Discovered    int64
		BeingExplored int64
	}

	var stats []TypeStats
	database.Model(&models.Space{}).
		Select(`synapse_type,
		        COUNT(*) as total,
		        SUM(CASE WHEN state = 'discovered' THEN 1 ELSE 0 END) as discovered,
		        SUM(CASE WHEN state = 'being_solved' THEN 1 ELSE 0 END) as being_explored`).
		Group("synapse_type").
		Find(&stats)

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
	database := db.Get()

	days := c.QueryInt("days", 7)
	now := time.Now()
	startTime := now.AddDate(0, 0, -days).UnixMilli()

	type DayCount struct {
		Day   string
		Count int64
	}

	var dayCounts []DayCount
	database.Model(&models.Space{}).
		Select("DATE(discovered_at/1000, 'unixepoch') as day, COUNT(*) as count").
		Where("state = ? AND discovered_at >= ?", "discovered", startTime).
		Group("day").
		Order("day").
		Find(&dayCounts)

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
	database := db.Get()

	days := c.QueryInt("days", 30)
	now := time.Now()
	startTime := now.AddDate(0, 0, -days).UnixMilli()

	type DayCount struct {
		Day   string
		Count int64
	}

	var dayCounts []DayCount
	database.Model(&models.User{}).
		Select("DATE(created_at/1000, 'unixepoch') as day, COUNT(*) as count").
		Where("created_at >= ?", startTime).
		Group("day").
		Order("day").
		Find(&dayCounts)

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
	database := db.Get()

	metric := c.Query("metric", "agi")
	limit := c.QueryInt("limit", 10)

	var column string
	switch metric {
	case "agi":
		column = "total_agi_earned"
	case "points":
		column = "points"
	case "usdc":
		column = "usdc_spent"
	case "agentic":
		column = "agentic_balance"
	default:
		column = "total_agi_earned"
	}

	var users []models.User
	database.Select("id, wallet, username, "+column+" as total_agi_earned").
		Order(column + " DESC").
		Limit(limit).
		Find(&users)

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
