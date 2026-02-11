package admin

import (
	"errors"
	"time"

	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ListEvents returns all events
func ListEvents(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	events, err := store.Queries.ListEvents(ctx, generated.ListEventsParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to list events"})
	}

	now := time.Now().UnixMilli()
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
			"eventType":   event.EventType,
			"multiplier":  event.Multiplier,
			"startTime":   event.StartTime,
			"endTime":     event.EndTime,
			"isActive":    event.IsActive,
			"createdAt":   event.CreatedAt,
			"status":      computeEventStatus(event.IsActive, event.StartTime, event.EndTime, now),
		}
	}

	return c.JSON(fiber.Map{"events": result})
}

// GetEventDetail returns detailed event info
func GetEventDetail(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	eventID := c.Params("id")

	event, err := store.Queries.GetEvent(ctx, eventID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get event"})
	}

	description := ""
	if event.Description != nil {
		description = *event.Description
	}
	now := time.Now().UnixMilli()
	return c.JSON(fiber.Map{
		"id":          event.ID,
		"name":        event.Name,
		"description": description,
		"eventType":   event.EventType,
		"multiplier":  event.Multiplier,
		"startTime":   event.StartTime,
		"endTime":     event.EndTime,
		"isActive":    event.IsActive,
		"createdAt":   event.CreatedAt,
		"status":      computeEventStatus(event.IsActive, event.StartTime, event.EndTime, now),
	})
}

// CreateEvent creates a new event
func CreateEvent(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	var req struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		Type        string  `json:"type"`
		EventType   string  `json:"eventType"`
		Multiplier  float64 `json:"multiplier"`
		StartTime   int64   `json:"startTime"`
		EndTime     int64   `json:"endTime"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Support both "type" and "eventType" fields
	eventType := req.EventType
	if eventType == "" {
		eventType = req.Type
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}
	if eventType == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Type is required"})
	}
	if req.Multiplier <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Multiplier must be positive"})
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	event, err := store.Queries.CreateEvent(ctx, generated.CreateEventParams{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: description,
		EventType:   eventType,
		Multiplier:  req.Multiplier,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		IsActive:    false,
		CreatedAt:   time.Now().UnixMilli(),
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create event"})
	}

	return c.JSON(fiber.Map{"success": true, "id": event.ID})
}

// UpdateEvent updates an existing event
func UpdateEvent(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	eventID := c.Params("id")

	var req struct {
		Name        *string  `json:"name"`
		Description *string  `json:"description"`
		Type        *string  `json:"type"`
		EventType   *string  `json:"eventType"`
		Multiplier  *float64 `json:"multiplier"`
		StartTime   *int64   `json:"startTime"`
		EndTime     *int64   `json:"endTime"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Support both "type" and "eventType" fields
	if req.EventType != nil && req.Type == nil {
		req.Type = req.EventType
	}

	if req.Name == nil && req.Description == nil && req.Type == nil && req.Multiplier == nil && req.StartTime == nil && req.EndTime == nil {
		return c.Status(400).JSON(fiber.Map{"error": "No fields to update"})
	}

	// Get existing event to merge changes
	event, err := store.Queries.GetEvent(ctx, eventID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get event"})
	}

	params := generated.UpdateEventParams{
		ID:          event.ID,
		Name:        event.Name,
		Description: event.Description,
		EventType:   event.EventType,
		Multiplier:  event.Multiplier,
		StartTime:   event.StartTime,
		EndTime:     event.EndTime,
		IsActive:    event.IsActive,
	}

	if req.Name != nil {
		params.Name = *req.Name
	}
	if req.Description != nil {
		params.Description = req.Description
	}
	if req.Type != nil {
		params.EventType = *req.Type
	}
	if req.Multiplier != nil {
		params.Multiplier = *req.Multiplier
	}
	if req.StartTime != nil {
		params.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		params.EndTime = *req.EndTime
	}

	if err := store.Queries.UpdateEvent(ctx, params); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update event"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// DeleteEvent deletes an event
func DeleteEvent(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	eventID := c.Params("id")

	// Verify event exists first
	_, err := store.Queries.GetEvent(ctx, eventID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check event"})
	}

	if err := store.Queries.DeleteEvent(ctx, eventID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete event"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// ActivateEvent activates an event
func ActivateEvent(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	eventID := c.Params("id")

	// Verify event exists
	_, err := store.Queries.GetEvent(ctx, eventID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check event"})
	}

	if err := store.Queries.ActivateEvent(ctx, eventID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to activate event"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Event activated"})
}

// DeactivateEvent deactivates an event
func DeactivateEvent(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	eventID := c.Params("id")

	// Verify event exists
	_, err := store.Queries.GetEvent(ctx, eventID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Event not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check event"})
	}

	if err := store.Queries.DeactivateEvent(ctx, eventID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to deactivate event"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Event deactivated"})
}

// computeEventStatus derives a status string from event fields
func computeEventStatus(isActive bool, startTime, endTime, now int64) string {
	if !isActive {
		return "inactive"
	}
	if now < startTime {
		return "upcoming"
	}
	if now > endTime {
		return "expired"
	}
	return "active"
}
