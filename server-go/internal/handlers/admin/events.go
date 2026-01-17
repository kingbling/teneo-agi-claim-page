package admin

import (
	"time"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ListEvents returns all events
func ListEvents(c *fiber.Ctx) error {
	database := db.Get()

	var events []models.LiveEvent
	database.Order("start_time DESC").Find(&events)

	result := make([]fiber.Map, len(events))
	for i, event := range events {
		description := ""
		if event.Description != nil {
			description = *event.Description
		}
		result[i] = fiber.Map{
			"id":          event.ID,
			"name":        event.Name,
			"description": description,
			"type":        event.EventType,
			"multiplier":  event.Multiplier,
			"startTime":   event.StartTime,
			"endTime":     event.EndTime,
			"isActive":    event.IsActive,
			"createdAt":   event.CreatedAt,
		}
	}

	return c.JSON(fiber.Map{"events": result})
}

// GetEventDetail returns detailed event info
func GetEventDetail(c *fiber.Ctx) error {
	database := db.Get()
	eventID := c.Params("id")

	var event models.LiveEvent
	if err := database.First(&event, "id = ?", eventID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
	}

	description := ""
	if event.Description != nil {
		description = *event.Description
	}
	return c.JSON(fiber.Map{
		"id":          event.ID,
		"name":        event.Name,
		"description": description,
		"type":        event.EventType,
		"multiplier":  event.Multiplier,
		"startTime":   event.StartTime,
		"endTime":     event.EndTime,
		"isActive":    event.IsActive,
		"createdAt":   event.CreatedAt,
	})
}

// CreateEvent creates a new event
func CreateEvent(c *fiber.Ctx) error {
	database := db.Get()

	var req struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		Type        string  `json:"type"` // points_multiplier, agi_multiplier, etc.
		Multiplier  float64 `json:"multiplier"`
		StartTime   int64   `json:"startTime"`
		EndTime     int64   `json:"endTime"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}
	if req.Type == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Type is required"})
	}
	if req.Multiplier <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Multiplier must be positive"})
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}
	event := models.LiveEvent{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: description,
		EventType:   req.Type,
		Multiplier:  req.Multiplier,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		IsActive:    false,
		CreatedAt:   time.Now().UnixMilli(),
	}

	if err := database.Create(&event).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create event"})
	}

	return c.JSON(fiber.Map{"success": true, "id": event.ID})
}

// UpdateEvent updates an existing event
func UpdateEvent(c *fiber.Ctx) error {
	database := db.Get()
	eventID := c.Params("id")

	var req struct {
		Name        *string  `json:"name"`
		Description *string  `json:"description"`
		Type        *string  `json:"type"`
		Multiplier  *float64 `json:"multiplier"`
		StartTime   *int64   `json:"startTime"`
		EndTime     *int64   `json:"endTime"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := make(map[string]interface{})

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Type != nil {
		updates["event_type"] = *req.Type
	}
	if req.Multiplier != nil {
		updates["multiplier"] = *req.Multiplier
	}
	if req.StartTime != nil {
		updates["start_time"] = *req.StartTime
	}
	if req.EndTime != nil {
		updates["end_time"] = *req.EndTime
	}

	if len(updates) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No fields to update"})
	}

	if err := database.Model(&models.LiveEvent{}).Where("id = ?", eventID).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update event"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// DeleteEvent deletes an event
func DeleteEvent(c *fiber.Ctx) error {
	database := db.Get()
	eventID := c.Params("id")

	result := database.Delete(&models.LiveEvent{}, "id = ?", eventID)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete event"})
	}

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// ActivateEvent activates an event
func ActivateEvent(c *fiber.Ctx) error {
	database := db.Get()
	eventID := c.Params("id")

	result := database.Model(&models.LiveEvent{}).Where("id = ?", eventID).Update("is_active", true)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to activate event"})
	}

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Event activated"})
}

// DeactivateEvent deactivates an event
func DeactivateEvent(c *fiber.Ctx) error {
	database := db.Get()
	eventID := c.Params("id")

	result := database.Model(&models.LiveEvent{}).Where("id = ?", eventID).Update("is_active", false)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to deactivate event"})
	}

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Event deactivated"})
}
