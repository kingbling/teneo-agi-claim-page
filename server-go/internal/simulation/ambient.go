package simulation

import (
	"context"
	"fmt"
	"log"
	"math"
	"math/rand"
	"sync"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/database"
	"teneo/server-go/internal/dto"
)

// AmbientShip represents a virtual ship flying between synapses
type AmbientShip struct {
	ID string

	// Current position (interpolated)
	CurrentX, CurrentY, CurrentZ float64

	// Start position of current travel
	StartX, StartY, StartZ float64

	// Target position
	TargetX, TargetY, TargetZ float64

	// Timing (milliseconds)
	TravelStart    int64
	TravelDuration int64

	// State: 0=traveling, 1=idle
	State int

	// When idle, wait until this time before picking next target
	IdleUntil int64
}

// AmbientManager manages a pool of ambient ships
type AmbientManager struct {
	cfg   *config.Config
	store *database.Store

	ships      []*AmbientShip
	targetCount int // desired number of active ships
	mu         sync.RWMutex
}

// NewAmbientManager creates a new ambient ship manager
func NewAmbientManager(cfg *config.Config, store *database.Store) *AmbientManager {
	return &AmbientManager{
		cfg:         cfg,
		store:       store,
		targetCount: cfg.AmbientShipsMax,
	}
}

// Init fetches random synapse positions and initializes the ambient ship pool
func (am *AmbientManager) Init() {
	am.mu.Lock()
	defer am.mu.Unlock()

	ctx := context.Background()

	// Fetch enough positions for max ships * 2 (start + target for each)
	count := int32(am.cfg.AmbientShipsMax * 2)
	positions, err := am.store.Queries.GetRandomSpacePositions(ctx, count)
	if err != nil || len(positions) < 2 {
		log.Printf("[Ambient] Failed to fetch positions or not enough spaces: %v (got %d)", err, len(positions))
		return
	}

	now := time.Now().UnixMilli()

	for i := 0; i < am.cfg.AmbientShipsMax && i*2+1 < len(positions); i++ {
		start := positions[i*2]
		target := positions[i*2+1]

		// Calculate travel duration based on distance and speed factor
		dx := target.PositionX - start.PositionX
		dy := target.PositionY - start.PositionY
		dz := target.PositionZ - start.PositionZ
		distance := math.Sqrt(dx*dx + dy*dy + dz*dz)

		// Use TravelTimePerUnit scaled by AmbientSpeedFactor and TimeMultiplier
		gameDuration := distance * am.cfg.TravelTimePerUnit / am.cfg.AmbientSpeedFactor
		travelDuration := int64(gameDuration / am.cfg.TimeMultiplier)
		if travelDuration < 3000 {
			travelDuration = 3000
		}

		// Stagger start times so ships don't all start at once
		staggerOffset := int64(rand.Intn(int(travelDuration)))

		ship := &AmbientShip{
			ID:             fmt.Sprintf("ambient-%d", i),
			StartX:         start.PositionX,
			StartY:         start.PositionY,
			StartZ:         start.PositionZ,
			TargetX:        target.PositionX,
			TargetY:        target.PositionY,
			TargetZ:        target.PositionZ,
			TravelStart:    now - staggerOffset,
			TravelDuration: travelDuration,
			State:          0, // traveling
		}
		am.ships = append(am.ships, ship)
	}

	log.Printf("[Ambient] Initialized %d ambient ships", len(am.ships))
}

// Tick updates all ambient ships and returns position updates for traveling ships
func (am *AmbientManager) Tick(now int64) []dto.WorldShipUpdate {
	am.mu.Lock()
	defer am.mu.Unlock()

	var updates []dto.WorldShipUpdate

	for _, ship := range am.ships {
		switch ship.State {
		case 0: // traveling
			elapsed := now - ship.TravelStart
			progress := float64(elapsed) / float64(ship.TravelDuration)

			if progress >= 1.0 {
				// Arrived — set to idle with 2-5s pause
				ship.State = 1
				ship.CurrentX = ship.TargetX
				ship.CurrentY = ship.TargetY
				ship.CurrentZ = ship.TargetZ
				ship.IdleUntil = now + int64(2000+rand.Intn(3000))
			} else {
				// Interpolate position
				ship.CurrentX = ship.StartX + (ship.TargetX-ship.StartX)*progress
				ship.CurrentY = ship.StartY + (ship.TargetY-ship.StartY)*progress
				ship.CurrentZ = ship.StartZ + (ship.TargetZ-ship.StartZ)*progress

				// Calculate rotation toward target
				dx := ship.TargetX - ship.CurrentX
				dz := ship.TargetZ - ship.CurrentZ
				rotationY := math.Atan2(dx, -dz)

				updates = append(updates, dto.WorldShipUpdate{
					ID:        ship.ID,
					PositionX: ship.CurrentX,
					PositionY: ship.CurrentY,
					PositionZ: ship.CurrentZ,
					RotationY: rotationY,
					State:     0,
				})
			}

		case 1: // idle
			if now >= ship.IdleUntil {
				// Pick new random target
				am.dispatchShip(ship, now)
			}
		}
	}

	return updates
}

// dispatchShip sends an idle ship to a new random synapse position
func (am *AmbientManager) dispatchShip(ship *AmbientShip, now int64) {
	ctx := context.Background()
	target, err := am.store.Queries.GetRandomUndiscoveredSpace(ctx)
	if err != nil {
		// Fallback: pick random position within brain bounds
		ship.TargetX = (rand.Float64() - 0.5) * 2.0
		ship.TargetY = (rand.Float64() - 0.5) * 2.0
		ship.TargetZ = (rand.Float64() - 0.5) * 2.0
	} else {
		ship.TargetX = target.PositionX
		ship.TargetY = target.PositionY
		ship.TargetZ = target.PositionZ
	}

	// Start position = current position
	ship.StartX = ship.CurrentX
	ship.StartY = ship.CurrentY
	ship.StartZ = ship.CurrentZ

	// Calculate duration
	dx := ship.TargetX - ship.StartX
	dy := ship.TargetY - ship.StartY
	dz := ship.TargetZ - ship.StartZ
	distance := math.Sqrt(dx*dx + dy*dy + dz*dz)

	gameDuration := distance * am.cfg.TravelTimePerUnit / am.cfg.AmbientSpeedFactor
	travelDuration := int64(gameDuration / am.cfg.TimeMultiplier)
	if travelDuration < 3000 {
		travelDuration = 3000
	}

	ship.TravelStart = now
	ship.TravelDuration = travelDuration
	ship.State = 0 // traveling
}

// AdjustCount scales the number of active ambient ships inversely to real ship activity.
// More real ships traveling → fewer ambient ships, and vice versa.
func (am *AmbientManager) AdjustCount(realTravelingCount int) {
	am.mu.Lock()
	defer am.mu.Unlock()

	// Scale: 0 real ships → max ambient, many real ships → min ambient
	target := am.cfg.AmbientShipsMax - realTravelingCount
	if target < am.cfg.AmbientShipsMin {
		target = am.cfg.AmbientShipsMin
	}
	if target > am.cfg.AmbientShipsMax {
		target = am.cfg.AmbientShipsMax
	}
	am.targetCount = target

	// Add ships if needed
	now := time.Now().UnixMilli()
	for len(am.ships) < am.targetCount {
		idx := len(am.ships)
		ship := &AmbientShip{
			ID:        fmt.Sprintf("ambient-%d", idx),
			State:     1, // start idle
			IdleUntil: now,
		}
		// Pick a random starting position
		ctx := context.Background()
		pos, err := am.store.Queries.GetRandomSpacePositions(ctx, 1)
		if err == nil && len(pos) > 0 {
			ship.CurrentX = pos[0].PositionX
			ship.CurrentY = pos[0].PositionY
			ship.CurrentZ = pos[0].PositionZ
		}
		am.ships = append(am.ships, ship)
	}

	// Remove excess ships by shrinking slice (don't re-dispatch arrivals beyond target)
	if len(am.ships) > am.targetCount {
		am.ships = am.ships[:am.targetCount]
	}
}

// GetTravelingCount returns how many ambient ships are currently traveling
func (am *AmbientManager) GetTravelingCount() int {
	am.mu.RLock()
	defer am.mu.RUnlock()
	count := 0
	for _, s := range am.ships {
		if s.State == 0 {
			count++
		}
	}
	return count
}
