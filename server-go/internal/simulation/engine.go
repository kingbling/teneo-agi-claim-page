package simulation

import (
	"log"
	"math"
	"sync"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/dto"
	"teneo/server-go/internal/models"
	wshub "teneo/server-go/internal/websocket"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// explorerData holds explorer info for synapse completion
type explorerData struct {
	id                string
	shipID            string
	userID            string
	pointsPerMin      float64
	pointsContributed float64
}

// Engine handles the game simulation tick loop
type Engine struct {
	db        *gorm.DB
	hub       *wshub.Hub
	cfg       *config.Config
	tickCount int64
	running   bool
	stopCh    chan struct{}
	mu        sync.RWMutex

	// Delta tracking for efficient synapse state updates
	synapseDeltaQueue []dto.SynapseDelta
	synapseDeltaMu    sync.Mutex
	spaceOrderIndex   map[string]uint32 // space ID → array index (matches bulk endpoint order)

	// Callbacks for WebSocket events
	OnSpaceDiscovered     func(dto.SpaceDiscovery)
	OnAgentsUpdated       func([]dto.AgentUpdate)
	OnSynapseCompleted    func(dto.SynapseCompletionEvent)
	OnExplorationProgress func(dto.ExplorationProgressEvent)
	OnUserLevelUp         func(dto.UserLevelUpEvent)
	OnLootDistributed     func(dto.LootEvent)
	OnUserShipUpdated     func(shipID, userID string) // Send ships:sync to specific user after state change
	OnTravelPositions     func(dto.TravelPositionBatch) // Stream positions during travel
}

// New creates a new simulation engine
func New(db *gorm.DB, hub *wshub.Hub, cfg *config.Config) *Engine {
	e := &Engine{
		db:              db,
		hub:             hub,
		cfg:             cfg,
		stopCh:          make(chan struct{}),
		spaceOrderIndex: make(map[string]uint32),
	}
	// Build space order index for delta tracking
	e.buildSpaceOrderIndex()
	return e
}

// buildSpaceOrderIndex creates a mapping from space ID to array index
// This index matches the order used by the /api/synapses/bulk endpoint
func (e *Engine) buildSpaceOrderIndex() {
	var ids []string
	e.db.Model(&models.Space{}).Order("id").Pluck("id", &ids)
	for i, id := range ids {
		e.spaceOrderIndex[id] = uint32(i)
	}
	log.Printf("[Engine] Built space order index with %d entries", len(e.spaceOrderIndex))
}

// trackSynapseStateChange queues a synapse state change for delta broadcast
// newState: 0=undiscovered, 1=being_solved, 2=discovered
func (e *Engine) trackSynapseStateChange(spaceID string, newState uint8) {
	e.synapseDeltaMu.Lock()
	defer e.synapseDeltaMu.Unlock()
	if idx, ok := e.spaceOrderIndex[spaceID]; ok {
		e.synapseDeltaQueue = append(e.synapseDeltaQueue, dto.SynapseDelta{
			Index:    idx,
			NewState: newState,
		})
	}
}

// Start begins the simulation loop
func (e *Engine) Start() {
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return
	}
	e.running = true
	e.mu.Unlock()

	// Load saved tick count
	var simState models.SimulationState
	e.db.First(&simState)
	e.tickCount = simState.TickCount

	log.Printf("[Engine] Starting simulation at tick %d", e.tickCount)

	ticker := time.NewTicker(time.Duration(e.cfg.TickInterval) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-e.stopCh:
			log.Println("[Engine] Simulation stopped")
			return
		case <-ticker.C:
			e.processTick()
		}
	}
}

// Stop halts the simulation
func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.running {
		close(e.stopCh)
		e.running = false
	}
}

// GetTickCount returns the current tick count
func (e *Engine) GetTickCount() int64 {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.tickCount
}

// IsRunning returns whether the engine is running
func (e *Engine) IsRunning() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.running
}

func (e *Engine) processTick() {
	startTime := time.Now()

	// Apply TIME_MULTIPLIER for accelerated simulation
	deltaSeconds := float64(e.cfg.TickInterval) / 1000.0 * float64(e.cfg.TimeMultiplier)

	// Process game logic
	e.processSynapseExploration(deltaSeconds)
	e.processTravelingAgents()
	e.processSearchingAgents()

	e.tickCount++

	// Save simulation state every 10 ticks
	if e.tickCount%10 == 0 {
		e.db.Model(&models.SimulationState{}).Where("id = 1").Update("tick_count", e.tickCount)
		e.logTickStats()
	}

	// Recompute clusters every 30 ticks
	if e.tickCount%30 == 0 {
		go e.recomputeClusters()
	}

	// Broadcast state sync every 5 ticks
	if e.tickCount%5 == 0 {
		e.broadcastStateSync()
	}

	elapsed := time.Since(startTime)
	if elapsed > time.Duration(e.cfg.TickInterval)*time.Millisecond {
		log.Printf("[Engine] Tick %d took %v (over budget)", e.tickCount, elapsed)
	}
}

func (e *Engine) logTickStats() {
	type stateCount struct {
		State string
		Count int
	}
	var results []stateCount
	e.db.Model(&models.Agent{}).Select("state, COUNT(*) as count").Group("state").Scan(&results)

	stats := make(map[string]int)
	for _, r := range results {
		stats[r.State] = r.Count
	}

	log.Printf("[Tick %d] %.1fx speed | Ships: idle:%d traveling:%d solving:%d",
		e.tickCount, e.cfg.TimeMultiplier,
		stats["idle"], stats["traveling"], stats["solving"])
}

// processSearchingAgents is disabled - ships no longer wander around searching.
// Ships go directly from idle -> traveling -> exploring.
func (e *Engine) processSearchingAgents() {
	// No-op: searching/wandering behavior has been removed
}

// travelingAgentData holds agent and target data
type travelingAgentData struct {
	ID                  string
	OwnerID             string
	TargetSpaceID       string
	StartPositionX      float64
	StartPositionY      float64
	StartPositionZ      float64
	TravelStartTime     int64
	TravelDuration      int64
	CurrentPointsPerMin int // matches column name current_points_per_min
	TargetX             float64
	TargetY             float64
	TargetZ             float64
}

// processTravelingAgents checks for arrivals and handles state transitions
// Also streams position updates for mid-travel ships for smooth animation
func (e *Engine) processTravelingAgents() {
	var travelingData []travelingAgentData

	// Use GORM with JOIN to fetch traveling agents with their target positions
	e.db.Model(&models.Agent{}).
		Select("agents.id, agents.owner_id, agents.target_space_id, "+
			"agents.start_position_x, agents.start_position_y, agents.start_position_z, "+
			"agents.travel_start_time, agents.travel_duration, agents.current_points_per_min, "+
			"spaces.position_x as target_x, spaces.position_y as target_y, spaces.position_z as target_z").
		Joins("JOIN spaces ON agents.target_space_id = spaces.id").
		Where("agents.state = ?", "traveling").
		Scan(&travelingData)

	now := time.Now().UnixMilli()
	var arrivalUpdates []dto.AgentUpdate
	var shipUserUpdates []struct{ shipID, userID string } // Track ships that need user sync
	var positionUpdates []dto.TravelPositionUpdate        // Mid-travel position updates

	for _, agent := range travelingData {
		if agent.TravelStartTime == 0 || agent.TravelDuration == 0 {
			continue
		}

		elapsed := now - agent.TravelStartTime
		progress := float64(elapsed) / float64(agent.TravelDuration)

		if progress >= 1.0 {
			// Calculate final position at arrival
			finalX := agent.TargetX
			finalY := agent.TargetY
			finalZ := agent.TargetZ

			// Arrived - auto-start exploring
			success := e.joinSynapseExploration(agent.TargetSpaceID, agent.ID, agent.OwnerID, float64(agent.CurrentPointsPerMin))

			if success {
				e.db.Model(&models.Agent{}).Where("id = ?", agent.ID).Updates(map[string]interface{}{
					"position_x":        finalX,
					"position_y":        finalY,
					"position_z":        finalZ,
					"travel_start_time": nil,
					"travel_duration":   nil,
					"start_position_x":  nil,
					"start_position_y":  nil,
					"start_position_z":  nil,
				})

				targetID := agent.TargetSpaceID
				arrivalUpdates = append(arrivalUpdates, dto.AgentUpdate{
					ID:            agent.ID,
					PositionX:     finalX,
					PositionY:     finalY,
					PositionZ:     finalZ,
					State:         dto.AgentSolving,
					TargetSpaceID: &targetID,
				})
				// Track for user-specific sync
				shipUserUpdates = append(shipUserUpdates, struct{ shipID, userID string }{agent.ID, agent.OwnerID})
			} else {
				// Failed to join - synapse already taken, find a nearby one
				redirectUpdate := e.redirectToNearbySynapse(agent.ID, agent.OwnerID, finalX, finalY, finalZ, float64(agent.CurrentPointsPerMin))
				if redirectUpdate != nil {
					arrivalUpdates = append(arrivalUpdates, *redirectUpdate)
					// Track for user-specific sync (redirect means state change to traveling again)
					shipUserUpdates = append(shipUserUpdates, struct{ shipID, userID string }{agent.ID, agent.OwnerID})
				} else {
					// No nearby synapses available - return to idle
					e.db.Model(&models.Agent{}).Where("id = ?", agent.ID).Updates(map[string]interface{}{
						"state":             "idle",
						"position_x":        finalX,
						"position_y":        finalY,
						"position_z":        finalZ,
						"target_space_id":   nil,
						"travel_start_time": nil,
						"travel_duration":   nil,
						"start_position_x":  nil,
						"start_position_y":  nil,
						"start_position_z":  nil,
					})

					arrivalUpdates = append(arrivalUpdates, dto.AgentUpdate{
						ID:        agent.ID,
						PositionX: finalX,
						PositionY: finalY,
						PositionZ: finalZ,
						State:     dto.AgentIdle,
					})
					// Track for user-specific sync
					shipUserUpdates = append(shipUserUpdates, struct{ shipID, userID string }{agent.ID, agent.OwnerID})
				}
			}
		} else {
			// Mid-travel: Calculate interpolated position and rotation
			interpX := agent.StartPositionX + (agent.TargetX-agent.StartPositionX)*progress
			interpY := agent.StartPositionY + (agent.TargetY-agent.StartPositionY)*progress
			interpZ := agent.StartPositionZ + (agent.TargetZ-agent.StartPositionZ)*progress

			// Calculate rotation (yaw) toward target
			// Ship model faces -Z direction, so we use atan2(dx, -dz)
			dx := agent.TargetX - interpX
			dz := agent.TargetZ - interpZ
			rotationY := math.Atan2(dx, -dz)

			positionUpdates = append(positionUpdates, dto.TravelPositionUpdate{
				ShipID:    agent.ID,
				PositionX: interpX,
				PositionY: interpY,
				PositionZ: interpZ,
				RotationY: rotationY,
				Progress:  progress,
			})
		}
	}

	// Only broadcast on arrivals (state changes), not mid-travel
	if len(arrivalUpdates) > 0 && e.OnAgentsUpdated != nil {
		e.OnAgentsUpdated(arrivalUpdates)
	}

	// Send ships:sync to specific users for their ships that changed state
	if e.OnUserShipUpdated != nil {
		for _, update := range shipUserUpdates {
			e.OnUserShipUpdated(update.shipID, update.userID)
		}
	}

	// Broadcast position updates every 2 ticks (~100ms at 50ms tick interval)
	if len(positionUpdates) > 0 && e.tickCount%2 == 0 && e.OnTravelPositions != nil {
		e.OnTravelPositions(dto.TravelPositionBatch{
			Ships:     positionUpdates,
			Timestamp: now,
		})
	}
}

// processSynapseExploration updates points for all active explorations
func (e *Engine) processSynapseExploration(deltaSeconds float64) {
	var synapseIDs []string
	e.db.Model(&models.SynapseExplorer{}).Distinct().Pluck("synapse_id", &synapseIDs)

	for _, synapseID := range synapseIDs {
		e.updateSynapseProgress(synapseID, deltaSeconds)
	}
}

func (e *Engine) updateSynapseProgress(synapseID string, deltaSeconds float64) {
	// Get synapse details
	var space models.Space
	if err := e.db.First(&space, "id = ?", synapseID).Error; err != nil || space.State == "discovered" {
		return
	}

	// Get explorers
	var explorers []models.SynapseExplorer
	e.db.Where("synapse_id = ?", synapseID).Find(&explorers)

	if len(explorers) == 0 {
		return
	}

	now := time.Now().UnixMilli()
	var totalPointsThisTick float64

	// Calculate points from each explorer
	var explorerDataList []explorerData
	for _, exp := range explorers {
		explorerDataList = append(explorerDataList, explorerData{
			id:                exp.ID,
			shipID:            exp.ShipID,
			userID:            exp.UserID,
			pointsPerMin:      float64(exp.PointsPerMinute),
			pointsContributed: float64(exp.PointsContributed),
		})

		// Get item effects
		speedBoost := e.getShipSpeedBoost(exp.ShipID)
		speedMultiplier := 1.0 + speedBoost

		synapseConfig := dto.GetDefaultSynapseConfig()[dto.SynapseType(space.SynapseType)]
		boostedRate := float64(exp.PointsPerMinute) * speedMultiplier
		effectiveRate := math.Min(boostedRate, float64(synapseConfig.MaxPerMin))
		pointsThisTick := (effectiveRate / 60.0) * deltaSeconds

		totalPointsThisTick += pointsThisTick

		// Update explorer contribution
		e.db.Model(&models.SynapseExplorer{}).Where("id = ?", exp.ID).Updates(map[string]interface{}{
			"points_contributed": gorm.Expr("points_contributed + ?", int(pointsThisTick)),
			"last_updated_at":    now,
		})
	}

	// Update synapse points
	newAccumulated := float64(space.PointsAccumulated) + totalPointsThisTick
	isCompleted := newAccumulated >= float64(space.PointsRequired)

	// Calculate ETA
	exp := explorerDataList[0]
	var user models.User
	e.db.First(&user, "id = ?", exp.userID)
	userLevel := user.UserLevel
	if userLevel == 0 {
		userLevel = 1
	}

	synapseConfig := dto.GetDefaultSynapseConfig()[dto.SynapseType(space.SynapseType)]
	speedBoost := e.getShipSpeedBoost(exp.shipID)
	currentETA := dto.CalculateFinalETA(synapseConfig.ETAMinutes, userLevel, speedBoost)

	newState := "being_solved"
	if isCompleted {
		newState = "discovered"
		newAccumulated = float64(space.PointsRequired)
	}

	e.db.Model(&models.Space{}).Where("id = ?", synapseID).Updates(map[string]interface{}{
		"points_accumulated":  int(newAccumulated),
		"current_eta_minutes": currentETA,
		"state":               newState,
	})

	// Emit progress event
	if e.OnExplorationProgress != nil {
		e.OnExplorationProgress(dto.ExplorationProgressEvent{
			SynapseID:         synapseID,
			SynapseType:       dto.SynapseType(space.SynapseType),
			PointsAccumulated: newAccumulated,
			PointsRequired:    float64(space.PointsRequired),
			ETAMinutes:        currentETA,
			ExplorerCount:     len(explorers),
			Timestamp:         now,
		})
	}

	// Complete synapse if done
	if isCompleted {
		e.completeSynapse(synapseID, dto.SynapseType(space.SynapseType), explorerDataList)
	}
}

func (e *Engine) completeSynapse(synapseID string, synapseType dto.SynapseType, explorers []explorerData) {
	config := dto.GetDefaultSynapseConfig()[synapseType]
	now := time.Now().UnixMilli()

	// Fetch space for position data (needed for completion event)
	var space models.Space
	if err := e.db.First(&space, "id = ?", synapseID).Error; err != nil {
		log.Printf("[ERROR] Failed to fetch space for completion event: %v", err)
		return
	}

	// Get event multipliers
	rewardMultiplier := e.getActiveRewardMultiplier()
	finalAgiReward := float64(config.AGIReward) * rewardMultiplier

	// V1: Single player - explorer gets 100%
	exp := explorers[0]

	// Get AGI amplifier from items
	xpMultiplier := e.getShipXPMultiplier(exp.shipID)
	amplifiedReward := finalAgiReward * (1.0 + xpMultiplier)

	// NFT eligibility check
	nftEligibleTypes := map[dto.SynapseType]bool{
		dto.SynapseCore:      true,
		dto.SynapseRare:      true,
		dto.SynapseLegendary: true,
		dto.SynapseUnique:    true,
	}
	mintNFT := nftEligibleTypes[synapseType]

	// Use transaction for atomic completion
	err := e.db.Transaction(func(tx *gorm.DB) error {
		// 1. Update user AGI balance
		if err := tx.Model(&models.User{}).Where("id = ?", exp.userID).
			Update("total_agi_earned", gorm.Expr("total_agi_earned + ?", int(amplifiedReward))).Error; err != nil {
			return err
		}

		// 2. Update ship stats
		if err := tx.Model(&models.Agent{}).Where("id = ?", exp.shipID).Updates(map[string]interface{}{
			"total_agi_earned":  gorm.Expr("total_agi_earned + ?", int(amplifiedReward)),
			"spaces_discovered": gorm.Expr("spaces_discovered + 1"),
		}).Error; err != nil {
			return err
		}

		// 3. Mint NFT for rare+ synapses
		if mintNFT {
			nft := models.NFT{
				ID:        uuid.New().String(),
				UserID:    exp.userID,
				NftType:   "synapse_discovery",
				SynapseID: &synapseID,
				Metadata:  "{}",
				MintedAt:  now,
			}
			if err := tx.Create(&nft).Error; err != nil {
				return err
			}

			if err := tx.Model(&models.User{}).Where("id = ?", exp.userID).
				Update("nft_count", gorm.Expr("nft_count + 1")).Error; err != nil {
				return err
			}
		}

		// 4. Clear explorers
		if err := tx.Where("synapse_id = ?", synapseID).Delete(&models.SynapseExplorer{}).Error; err != nil {
			return err
		}

		// 5. Update synapse state
		if err := tx.Model(&models.Space{}).Where("id = ?", synapseID).Updates(map[string]interface{}{
			"state":         "discovered",
			"discovered_at": now,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		log.Printf("[ERROR] Failed to complete synapse %s: %v", synapseID, err)
		return
	}

	// Track state change for delta broadcast
	e.trackSynapseStateChange(synapseID, 2) // 2 = discovered

	if mintNFT {
		log.Printf("[NFT] Minted %s synapse NFT for user %s", synapseType, exp.userID[:8])
	}

	log.Printf("[SOLVED] ✓ %s synapse completed! +%.0f $AGI", synapseType, amplifiedReward)

	// Emit completion event (includes position for client-side visual effects)
	if e.OnSynapseCompleted != nil {
		e.OnSynapseCompleted(dto.SynapseCompletionEvent{
			SynapseID:      synapseID,
			SynapseType:    synapseType,
			DiscoveredAt:   now,
			TotalExplorers: len(explorers),
			AGIReward:      amplifiedReward,
			IsLottery:      false,
			WinnerID:       &exp.userID,
			WinnerShipID:   &exp.shipID,
			PositionX:      space.PositionX,
			PositionY:      space.PositionY,
			PositionZ:      space.PositionZ,
		})
	}

	// Process autopilot and broadcast ship state change
	shipUpdate := e.processAutopilot(exp.shipID, exp.userID, space.PositionX, space.PositionY, space.PositionZ)
	if shipUpdate != nil && e.OnAgentsUpdated != nil {
		e.OnAgentsUpdated([]dto.AgentUpdate{*shipUpdate})
	}
	// Send ships:sync to the user whose ship completed exploration
	if e.OnUserShipUpdated != nil {
		e.OnUserShipUpdated(exp.shipID, exp.userID)
	}
}

func (e *Engine) joinSynapseExploration(synapseID, shipID, userID string, pointsPerMin float64) bool {
	var space models.Space
	if err := e.db.First(&space, "id = ?", synapseID).Error; err != nil || space.State == "discovered" {
		return false
	}

	// Check if already occupied
	var count int64
	e.db.Model(&models.SynapseExplorer{}).Where("synapse_id = ?", synapseID).Count(&count)
	if count >= 1 {
		return false
	}

	config := dto.GetDefaultSynapseConfig()[dto.SynapseType(space.SynapseType)]
	effectiveRate := math.Min(pointsPerMin, float64(config.MaxPerMin))
	now := time.Now().UnixMilli()

	// Add explorer
	explorer := models.SynapseExplorer{
		ID:                uuid.New().String(),
		SynapseID:         synapseID,
		ShipID:            shipID,
		UserID:            userID,
		PointsContributed: 0,
		PointsPerMinute:   int(effectiveRate),
		JoinedAt:          now,
		LastUpdatedAt:     now,
	}
	e.db.Create(&explorer)

	// Update synapse state and track delta
	result := e.db.Model(&models.Space{}).Where("id = ? AND state = ?", synapseID, "undiscovered").
		Update("state", "being_solved")
	if result.RowsAffected > 0 {
		e.trackSynapseStateChange(synapseID, 1) // 1 = being_solved
	}

	// Update ship state
	e.db.Model(&models.Agent{}).Where("id = ?", shipID).Updates(map[string]interface{}{
		"state":                  "solving",
		"target_space_id":        synapseID,
		"current_points_per_min": int(effectiveRate),
	})

	log.Printf("[Exploration] Ship %s started exploring at %.0f pts/min", shipID[:8], effectiveRate)
	return true
}

// redirectToNearbySynapse finds and redirects a ship to a nearby unoccupied synapse
func (e *Engine) redirectToNearbySynapse(shipID, userID string, currentX, currentY, currentZ, pointsPerMin float64) *dto.AgentUpdate {
	// Find nearby undiscovered synapses that aren't being explored
	// Order by distance from current position
	var nearbySpaces []models.Space
	e.db.Raw(`
		SELECT s.* FROM spaces s
		LEFT JOIN synapse_explorers se ON s.id = se.synapse_id
		WHERE s.state = 'undiscovered' AND se.id IS NULL
		ORDER BY
			(s.position_x - ?) * (s.position_x - ?) +
			(s.position_y - ?) * (s.position_y - ?) +
			(s.position_z - ?) * (s.position_z - ?)
		LIMIT 5
	`, currentX, currentX, currentY, currentY, currentZ, currentZ).Scan(&nearbySpaces)

	if len(nearbySpaces) == 0 {
		return nil
	}

	// Take the nearest one
	nextSpace := nearbySpaces[0]

	// Game time travel, scaled by time multiplier
	dx := nextSpace.PositionX - currentX
	dy := nextSpace.PositionY - currentY
	dz := nextSpace.PositionZ - currentZ
	distance := math.Sqrt(dx*dx + dy*dy + dz*dz)
	gameDuration := distance * e.cfg.TravelTimePerUnit
	travelDuration := int64(gameDuration / e.cfg.TimeMultiplier)
	if travelDuration < 2000 {
		travelDuration = 2000
	}
	now := time.Now().UnixMilli()

	// Update ship to start traveling to new synapse
	e.db.Model(&models.Agent{}).Where("id = ?", shipID).Updates(map[string]interface{}{
		"state":             "traveling",
		"target_space_id":   nextSpace.ID,
		"position_x":        currentX,
		"position_y":        currentY,
		"position_z":        currentZ,
		"start_position_x":  currentX,
		"start_position_y":  currentY,
		"start_position_z":  currentZ,
		"travel_start_time": now,
		"travel_duration":   travelDuration,
	})

	log.Printf("[Redirect] Ship %s redirected to nearby synapse (occupied on arrival)", shipID[:8])
	targetID := nextSpace.ID
	return &dto.AgentUpdate{
		ID:              shipID,
		PositionX:       currentX,
		PositionY:       currentY,
		PositionZ:       currentZ,
		State:           dto.AgentTraveling,
		TargetSpaceID:   &targetID,
		TravelStartTime: &now,
		TravelDuration:  &travelDuration,
	}
}

func (e *Engine) processAutopilot(shipID, userID string, currentX, currentY, currentZ float64) *dto.AgentUpdate {
	var agent models.Agent
	if err := e.db.First(&agent, "id = ?", shipID).Error; err != nil || !agent.AutopilotEnabled {
		// Return to idle
		e.db.Model(&models.Agent{}).Where("id = ?", shipID).Updates(map[string]interface{}{
			"state":           "idle",
			"target_space_id": nil,
		})
		return &dto.AgentUpdate{
			ID:        shipID,
			PositionX: currentX,
			PositionY: currentY,
			PositionZ: currentZ,
			State:     dto.AgentIdle,
		}
	}

	// Find next available synapse
	var nextSpace models.Space
	if err := e.db.Where("state = ?", "undiscovered").Order("RANDOM()").First(&nextSpace).Error; err != nil {
		// No available synapses
		e.db.Model(&models.Agent{}).Where("id = ?", shipID).Updates(map[string]interface{}{
			"state":           "idle",
			"target_space_id": nil,
		})
		return &dto.AgentUpdate{
			ID:        shipID,
			PositionX: currentX,
			PositionY: currentY,
			PositionZ: currentZ,
			State:     dto.AgentIdle,
		}
	}

	// Game time travel, scaled by time multiplier
	dx := nextSpace.PositionX - currentX
	dy := nextSpace.PositionY - currentY
	dz := nextSpace.PositionZ - currentZ
	distance := math.Sqrt(dx*dx + dy*dy + dz*dz)
	gameDuration := distance * e.cfg.TravelTimePerUnit
	travelDuration := int64(gameDuration / e.cfg.TimeMultiplier)
	if travelDuration < 2000 {
		travelDuration = 2000
	}
	now := time.Now().UnixMilli()

	// Start traveling
	e.db.Model(&models.Agent{}).Where("id = ?", shipID).Updates(map[string]interface{}{
		"state":             "traveling",
		"target_space_id":   nextSpace.ID,
		"start_position_x":  currentX,
		"start_position_y":  currentY,
		"start_position_z":  currentZ,
		"travel_start_time": now,
		"travel_duration":   travelDuration,
	})

	log.Printf("[Autopilot] Ship %s traveling to next synapse", shipID[:8])
	targetID := nextSpace.ID
	return &dto.AgentUpdate{
		ID:            shipID,
		PositionX:     currentX,
		PositionY:     currentY,
		PositionZ:     currentZ,
		State:         dto.AgentTraveling,
		TargetSpaceID: &targetID,
	}
}

// Helper functions

func (e *Engine) updateWanderDirection(dirX, dirY, dirZ, phase float64) (float64, float64, float64) {
	t := (float64(e.tickCount) + phase) * 0.1
	turnRate := e.cfg.WanderTurnRate

	turnX := math.Sin(t*0.7) * math.Cos(t*0.3) * turnRate
	turnY := math.Sin(t*0.5) * math.Cos(t*0.8) * turnRate
	turnZ := math.Sin(t*0.9) * math.Cos(t*0.4) * turnRate

	newDirX := dirX + turnX
	newDirY := dirY + turnY
	newDirZ := dirZ + turnZ

	// Normalize
	length := math.Sqrt(newDirX*newDirX + newDirY*newDirY + newDirZ*newDirZ)
	if length > 0.001 {
		newDirX /= length
		newDirY /= length
		newDirZ /= length
	}

	return newDirX, newDirY, newDirZ
}

func (e *Engine) applyBrainBounds(posX, posY, posZ, dirX, dirY, dirZ float64) (float64, float64, float64) {
	// Ellipsoid scaling factors
	ellipX, ellipY, ellipZ := 1.3, 1.0, 1.1

	// Normalize to unit sphere
	normX := posX / ellipX
	normY := posY / ellipY
	normZ := posZ / ellipZ

	distFromCenter := math.Sqrt(normX*normX + normY*normY + normZ*normZ)
	boundaryThreshold := 1.0 - e.cfg.BoundaryMargin

	if distFromCenter > boundaryThreshold {
		overshoot := (distFromCenter - boundaryThreshold) / e.cfg.BoundaryMargin
		steerScale := math.Min(overshoot, 1.0) * e.cfg.BoundarySteerStrength

		// Steer toward center
		steerX := -normX * steerScale
		steerY := -normY * steerScale
		steerZ := -normZ * steerScale

		newDirX := dirX + steerX
		newDirY := dirY + steerY
		newDirZ := dirZ + steerZ

		// Normalize
		length := math.Sqrt(newDirX*newDirX + newDirY*newDirY + newDirZ*newDirZ)
		if length > 0.001 {
			newDirX /= length
			newDirY /= length
			newDirZ /= length
		}

		return newDirX, newDirY, newDirZ
	}

	return dirX, dirY, dirZ
}

func (e *Engine) getShipSpeedBoost(shipID string) float64 {
	var speedBoost float64
	now := time.Now().UnixMilli()

	type effectResult struct {
		EffectValue float64
	}

	var results []effectResult
	e.db.Model(&models.UserPurchase{}).
		Select("item_shop.effect_value").
		Joins("JOIN item_shop ON user_purchases.item_id = item_shop.id").
		Where("user_purchases.ship_id = ? AND user_purchases.is_active = ?", shipID, true).
		Where("item_shop.effect_type = ?", "speed_boost").
		Where("user_purchases.expires_at IS NULL OR user_purchases.expires_at > ?", now).
		Scan(&results)

	for _, r := range results {
		speedBoost += r.EffectValue
	}
	return speedBoost
}

func (e *Engine) getShipXPMultiplier(shipID string) float64 {
	var xpMult float64
	now := time.Now().UnixMilli()

	type effectResult struct {
		EffectValue float64
	}

	var results []effectResult
	e.db.Model(&models.UserPurchase{}).
		Select("item_shop.effect_value").
		Joins("JOIN item_shop ON user_purchases.item_id = item_shop.id").
		Where("user_purchases.ship_id = ? AND user_purchases.is_active = ?", shipID, true).
		Where("item_shop.effect_type = ?", "xp_amplifier").
		Where("user_purchases.expires_at IS NULL OR user_purchases.expires_at > ?", now).
		Scan(&results)

	for _, r := range results {
		xpMult += r.EffectValue
	}
	return xpMult
}

func (e *Engine) getActiveRewardMultiplier() float64 {
	now := time.Now().UnixMilli()
	var multiplier float64 = 1.0

	var events []models.LiveEvent
	e.db.Where("is_active = ? AND start_time <= ? AND end_time >= ?", true, now, now).
		Where("event_type IN ?", []string{"bonus_agi", "double_rewards"}).
		Order("multiplier DESC").
		Find(&events)

	for _, event := range events {
		if event.Multiplier > multiplier {
			multiplier = event.Multiplier
		}
	}
	return multiplier
}

func (e *Engine) recomputeClusters() {
	log.Println("[Engine] Recomputing LOD clusters...")

	// Delete existing clusters
	e.db.Exec("DELETE FROM space_clusters")
	e.db.Exec("DELETE FROM agent_clusters")

	now := time.Now().UnixMilli()

	// Recompute space clusters at 3 LOD levels
	// Grid sizes tuned to show more visible markers at close zoom
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		var gridSize float64
		switch lodLevel {
		case 0:
			gridSize = 0.08 // ~15,000 clusters for detailed view
		case 1:
			gridSize = 0.3 // ~200 clusters for medium view
		default:
			gridSize = 1.0 // ~8 clusters for far view
		}
		e.db.Exec(`
			INSERT INTO space_clusters (id, lod_level, position_x, position_y, position_z, space_count, discovered_count, being_solved_count, updated_at)
			SELECT
				printf('%d_%d_%d_%d', ?, CAST(position_x/? AS INTEGER), CAST(position_y/? AS INTEGER), CAST(position_z/? AS INTEGER)),
				?,
				ROUND(AVG(position_x), 2),
				ROUND(AVG(position_y), 2),
				ROUND(AVG(position_z), 2),
				COUNT(*),
				SUM(CASE WHEN state = 'discovered' THEN 1 ELSE 0 END),
				SUM(CASE WHEN state = 'being_solved' THEN 1 ELSE 0 END),
				?
			FROM spaces
			GROUP BY CAST(position_x/? AS INTEGER), CAST(position_y/? AS INTEGER), CAST(position_z/? AS INTEGER)
		`, lodLevel, gridSize, gridSize, gridSize, lodLevel, now, gridSize, gridSize, gridSize)
	}

	// Recompute agent clusters at 3 LOD levels
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		gridSize := 0.5 * float64(lodLevel+1)
		e.db.Exec(`
			INSERT INTO agent_clusters (id, lod_level, position_x, position_y, position_z, agent_count, dominant_state, avg_progress, updated_at)
			SELECT
				printf('a%d_%d_%d_%d', ?, CAST(position_x/? AS INTEGER), CAST(position_y/? AS INTEGER), CAST(position_z/? AS INTEGER)),
				?,
				ROUND(AVG(position_x), 2),
				ROUND(AVG(position_y), 2),
				ROUND(AVG(position_z), 2),
				COUNT(*),
				(SELECT state FROM agents a2 WHERE
					CAST(a2.position_x/? AS INTEGER) = CAST(agents.position_x/? AS INTEGER) AND
					CAST(a2.position_y/? AS INTEGER) = CAST(agents.position_y/? AS INTEGER) AND
					CAST(a2.position_z/? AS INTEGER) = CAST(agents.position_z/? AS INTEGER)
					GROUP BY state ORDER BY COUNT(*) DESC LIMIT 1),
				0,
				?
			FROM agents
			GROUP BY CAST(position_x/? AS INTEGER), CAST(position_y/? AS INTEGER), CAST(position_z/? AS INTEGER)
		`, lodLevel, gridSize, gridSize, gridSize, lodLevel, gridSize, gridSize, gridSize, gridSize, gridSize, gridSize, now, gridSize, gridSize, gridSize)
	}
}

func (e *Engine) broadcastStateSync() {
	// Get clusters
	spaceClusters := e.getSpaceClusters()
	agentClusters := e.getAgentClusters()

	// Get discovery progress
	var total, discovered, beingExplored int64
	e.db.Model(&models.Space{}).Count(&total)
	e.db.Model(&models.Space{}).Where("state = ?", "discovered").Count(&discovered)
	e.db.Model(&models.Space{}).Where("state = ?", "being_solved").Count(&beingExplored)

	worldState := dto.WorldState{
		SynapseClusters: spaceClusters,
		AgentClusters:   agentClusters,
		DiscoveryProgress: dto.DiscoveryProgress{
			Total:         int(total),
			Discovered:    int(discovered),
			BeingExplored: int(beingExplored),
		},
		Timestamp: time.Now().UnixMilli(),
	}

	e.hub.Broadcast("state:sync", worldState)

	// Flush synapse deltas if any
	e.synapseDeltaMu.Lock()
	if len(e.synapseDeltaQueue) > 0 {
		e.hub.Broadcast("synapses:delta", dto.SynapsesDeltaBatch{
			Changes:   e.synapseDeltaQueue,
			Timestamp: time.Now().UnixMilli(),
		})
		e.synapseDeltaQueue = nil
	}
	e.synapseDeltaMu.Unlock()
}

func (e *Engine) getSpaceClusters() []dto.SpaceCluster {
	var clusters []models.SpaceCluster
	e.db.Find(&clusters)

	result := make([]dto.SpaceCluster, len(clusters))
	for i, c := range clusters {
		result[i] = dto.SpaceCluster{
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
	return result
}

func (e *Engine) getAgentClusters() []dto.AgentCluster {
	var clusters []models.AgentCluster
	e.db.Find(&clusters)

	result := make([]dto.AgentCluster, len(clusters))
	for i, c := range clusters {
		result[i] = dto.AgentCluster{
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
	return result
}
