package simulation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"
	"teneo/server-go/internal/dto"
	wshub "teneo/server-go/internal/websocket"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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
	store     *database.Store
	hub       *wshub.Hub
	cfg       *config.Config
	tickCount int64
	running   bool
	stopCh    chan struct{}
	mu        sync.RWMutex

	// Delta tracking for efficient synapse state updates
	synapseDeltaQueue []dto.SynapseDelta
	synapseDeltaMu    sync.Mutex
	spaceOrderIndex   map[string]uint32 // space ID -> array index (matches bulk endpoint order)

	// LOD cluster dirty tracking - only recompute when state changes
	clustersDirty bool

	// Ambient ships manager
	ambient *AmbientManager

	// Callbacks for WebSocket events
	OnSpaceDiscovered     func(dto.SpaceDiscovery)
	OnAgentsUpdated       func([]dto.AgentUpdate)
	OnSynapseCompleted    func(dto.SynapseCompletionEvent)
	OnExplorationProgress func(dto.ExplorationProgressEvent)
	OnUserLevelUp         func(dto.UserLevelUpEvent)
	OnLootDistributed     func(dto.LootEvent)
	OnUserShipUpdated     func(shipID, userID string) // Send ships:sync to specific user after state change
	OnTravelPositions     func(dto.TravelPositionBatch) // Stream positions during travel
	OnClusterUpdate       func(dto.ClusterUpdateEvent) // Immediate cluster update for dashboard sync
	OnWorldShipsUpdate    func(dto.WorldShipsBatch) // Broadcast ambient + other-user ship positions
}

// lodGridSizes references the shared config for LOD cluster computation
var lodGridSizes = config.LODGridSizes

// --- pgtype.UUID conversion helpers ---

func stringToPgUUID(s string) pgtype.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgUUIDToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	id, _ := uuid.FromBytes(u.Bytes[:])
	return id.String()
}

// getClusterIDForPosition computes the cluster ID for a given position and LOD level
func getClusterIDForPosition(x, y, z float64, lodLevel int) string {
	gridSize := lodGridSizes[lodLevel]
	gridX := int(x / gridSize)
	gridY := int(y / gridSize)
	gridZ := int(z / gridSize)
	return fmt.Sprintf("%d_%d_%d_%d", lodLevel, gridX, gridY, gridZ)
}

// updateClusterCounts updates cluster counts for a synapse state change
// beingSolvedDelta: +1/-1 for being_solved state changes
// discoveredDelta: +1 for discovered state changes
func (e *Engine) updateClusterCounts(posX, posY, posZ float64, beingSolvedDelta, discoveredDelta int) {
	ctx := context.Background()
	now := time.Now().UnixMilli()

	// Mark clusters as dirty so they get recomputed on the next interval
	e.clustersDirty = true

	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		clusterID := getClusterIDForPosition(posX, posY, posZ, lodLevel)
		if err := e.store.Queries.UpdateClusterCounts(ctx, generated.UpdateClusterCountsParams{
			ID:               clusterID,
			BeingSolvedCount: int32(beingSolvedDelta),
			DiscoveredCount:  int32(discoveredDelta),
			UpdatedAt:        now,
		}); err != nil {
			log.Printf("[Engine] Failed to update cluster counts for %s: %v", clusterID, err)
		}
	}
}

// broadcastClusterUpdate broadcasts updated cluster data for a synapse position
func (e *Engine) broadcastClusterUpdate(posX, posY, posZ float64) {
	if e.OnClusterUpdate == nil {
		return
	}

	ctx := context.Background()
	var clusters []dto.SpaceCluster
	now := time.Now().UnixMilli()

	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		clusterID := getClusterIDForPosition(posX, posY, posZ, lodLevel)
		cluster, err := e.store.Queries.GetSpaceCluster(ctx, clusterID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			log.Printf("[Engine] Failed to get space cluster %s: %v", clusterID, err)
			continue
		}
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

	if len(clusters) > 0 {
		e.OnClusterUpdate(dto.ClusterUpdateEvent{
			Clusters:  clusters,
			Timestamp: now,
		})
	}
}

// New creates a new simulation engine
func New(store *database.Store, hub *wshub.Hub, cfg *config.Config) *Engine {
	e := &Engine{
		store:           store,
		hub:             hub,
		cfg:             cfg,
		stopCh:          make(chan struct{}),
		spaceOrderIndex: make(map[string]uint32),
		ambient:         NewAmbientManager(cfg, store),
	}
	// Build space order index for delta tracking
	e.buildSpaceOrderIndex()
	return e
}

// buildSpaceOrderIndex creates a mapping from space ID to array index
// This index matches the order used by the /api/synapses/bulk endpoint
func (e *Engine) buildSpaceOrderIndex() {
	ctx := context.Background()
	ids, err := e.store.Queries.GetAllSpaceIDs(ctx)
	if err != nil {
		log.Printf("[Engine] Failed to build space order index: %v", err)
		return
	}
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
	ctx := context.Background()
	simState, err := e.store.Queries.GetSimulationState(ctx)
	if err != nil {
		log.Printf("[Engine] Failed to load simulation state: %v (starting from tick 0)", err)
	} else {
		e.tickCount = simState.TickCount
	}

	log.Printf("[Engine] Starting simulation at tick %d", e.tickCount)

	// Initialize ambient ships
	e.ambient.Init()

	// Compute clusters on startup so /api/world has data immediately
	e.recomputeClusters()

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

	// Tick ambient ships and broadcast world:ships every 3 ticks
	now := time.Now().UnixMilli()
	ambientUpdates := e.ambient.Tick(now)
	if e.tickCount%3 == 0 && e.OnWorldShipsUpdate != nil {
		e.OnWorldShipsUpdate(dto.WorldShipsBatch{
			Ships:     ambientUpdates,
			Timestamp: now,
		})
	}

	e.tickCount++

	// Save simulation state every 10 ticks
	if e.tickCount%10 == 0 {
		ctx := context.Background()
		if err := e.store.Queries.UpdateTickCount(ctx, e.tickCount); err != nil {
			log.Printf("[Engine] Failed to save tick count: %v", err)
		}
		e.logTickStats()
	}

	// Recompute clusters every 30 ticks, but only if something changed
	if e.tickCount%30 == 0 && e.clustersDirty {
		e.clustersDirty = false
		go e.recomputeClusters()
	}

	// Adjust ambient ship count every 30 ticks based on real ship activity
	if e.tickCount%30 == 0 {
		ctx := context.Background()
		travelingData, err := e.store.Queries.GetTravelingAgentsWithTargets(ctx)
		if err == nil {
			e.ambient.AdjustCount(len(travelingData))
		}
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
	ctx := context.Background()
	results, err := e.store.Queries.GetAgentStateCounts(ctx)
	if err != nil {
		log.Printf("[Engine] Failed to get agent state counts: %v", err)
		return
	}

	stats := make(map[string]int64)
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

// processTravelingAgents checks for arrivals and handles state transitions
// Also streams position updates for mid-travel ships for smooth animation
func (e *Engine) processTravelingAgents() {
	ctx := context.Background()
	travelingData, err := e.store.Queries.GetTravelingAgentsWithTargets(ctx)
	if err != nil {
		log.Printf("[Engine] Failed to get traveling agents: %v", err)
		return
	}

	now := time.Now().UnixMilli()
	var arrivalUpdates []dto.AgentUpdate
	var shipUserUpdates []struct{ shipID, userID string } // Track ships that need user sync
	var positionUpdates []dto.TravelPositionUpdate        // Mid-travel position updates

	for _, agent := range travelingData {
		if agent.TravelStartTime == nil || agent.TravelDuration == nil ||
			*agent.TravelStartTime == 0 || *agent.TravelDuration == 0 {
			continue
		}

		// Safely dereference start positions (nullable in DB)
		startX := 0.0
		startY := 0.0
		startZ := 0.0
		if agent.StartPositionX != nil {
			startX = *agent.StartPositionX
		}
		if agent.StartPositionY != nil {
			startY = *agent.StartPositionY
		}
		if agent.StartPositionZ != nil {
			startZ = *agent.StartPositionZ
		}

		elapsed := now - *agent.TravelStartTime
		progress := float64(elapsed) / float64(*agent.TravelDuration)

		targetSpaceID := pgUUIDToString(agent.TargetSpaceID)

		if progress >= 1.0 {
			// Calculate final position at arrival
			finalX := agent.TargetX
			finalY := agent.TargetY
			finalZ := agent.TargetZ

			// Arrived - auto-start exploring
			success := e.joinSynapseExploration(targetSpaceID, agent.ID, agent.OwnerID, float64(agent.CurrentPointsPerMin))

			if success {
				if err := e.store.Queries.UpdateAgentArrival(ctx, generated.UpdateAgentArrivalParams{
					ID:        agent.ID,
					PositionX: finalX,
					PositionY: finalY,
					PositionZ: finalZ,
				}); err != nil {
					log.Printf("[Engine] Failed to update agent arrival %s: %v", agent.ID, err)
				}

				arrivalUpdates = append(arrivalUpdates, dto.AgentUpdate{
					ID:            agent.ID,
					PositionX:     finalX,
					PositionY:     finalY,
					PositionZ:     finalZ,
					State:         dto.AgentSolving,
					TargetSpaceID: &targetSpaceID,
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
					// Set position first, then idle state
					if err := e.store.Queries.UpdateAgentPosition(ctx, generated.UpdateAgentPositionParams{
						ID:        agent.ID,
						PositionX: finalX,
						PositionY: finalY,
						PositionZ: finalZ,
					}); err != nil {
						log.Printf("[Engine] Failed to update agent position %s: %v", agent.ID, err)
					}
					if err := e.store.Queries.UpdateAgentToIdle(ctx, agent.ID); err != nil {
						log.Printf("[Engine] Failed to set agent idle %s: %v", agent.ID, err)
					}

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
			interpX := startX + (agent.TargetX-startX)*progress
			interpY := startY + (agent.TargetY-startY)*progress
			interpZ := startZ + (agent.TargetZ-startZ)*progress

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
		log.Printf("[Travel] Streaming %d ship positions (rotation included)", len(positionUpdates))
		for _, u := range positionUpdates {
			log.Printf("[Travel] Ship %s: pos=(%.3f,%.3f,%.3f) rot=%.3frad (%.1f) progress=%.2f",
				u.ShipID[:8], u.PositionX, u.PositionY, u.PositionZ,
				u.RotationY, u.RotationY*180/math.Pi, u.Progress)
		}
		e.OnTravelPositions(dto.TravelPositionBatch{
			Ships:     positionUpdates,
			Timestamp: now,
		})
	}
}

// processSynapseExploration updates points for all active explorations
func (e *Engine) processSynapseExploration(deltaSeconds float64) {
	ctx := context.Background()
	synapseIDs, err := e.store.Queries.GetActiveSynapseIDs(ctx)
	if err != nil {
		log.Printf("[Engine] Failed to get active synapse IDs: %v", err)
		return
	}

	for _, synapseID := range synapseIDs {
		e.updateSynapseProgress(synapseID, deltaSeconds)
	}
}

func (e *Engine) updateSynapseProgress(synapseID string, deltaSeconds float64) {
	ctx := context.Background()

	// Get synapse details
	space, err := e.store.Queries.GetSpace(ctx, synapseID)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[Engine] Failed to get space %s: %v", synapseID, err)
		}
		return
	}
	if space.State == "discovered" {
		return
	}

	// Get explorers
	explorers, err := e.store.Queries.GetSynapseExplorers(ctx, synapseID)
	if err != nil {
		log.Printf("[Engine] Failed to get explorers for %s: %v", synapseID, err)
		return
	}

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
		if err := e.store.Queries.UpdateExplorerPoints(ctx, generated.UpdateExplorerPointsParams{
			ID:                exp.ID,
			PointsContributed: int32(pointsThisTick),
			LastUpdatedAt:     now,
		}); err != nil {
			log.Printf("[Engine] Failed to update explorer points %s: %v", exp.ID, err)
		}
	}

	// Update synapse points
	newAccumulated := float64(space.PointsAccumulated) + totalPointsThisTick
	isCompleted := newAccumulated >= float64(space.PointsRequired)

	// Calculate ETA
	exp := explorerDataList[0]
	user, err := e.store.Queries.GetUser(ctx, exp.userID)
	userLevel := int32(1)
	if err == nil && user.UserLevel > 0 {
		userLevel = user.UserLevel
	}

	synapseConfig := dto.GetDefaultSynapseConfig()[dto.SynapseType(space.SynapseType)]
	speedBoost := e.getShipSpeedBoost(exp.shipID)
	currentETA := dto.CalculateFinalETA(synapseConfig.ETAMinutes, int(userLevel), speedBoost)

	newState := "being_solved"
	if isCompleted {
		newState = "discovered"
		newAccumulated = float64(space.PointsRequired)
	}

	etaMinutes := int32(currentETA)
	if err := e.store.Queries.UpdateSpacePointsAndETA(ctx, generated.UpdateSpacePointsAndETAParams{
		ID:                synapseID,
		PointsAccumulated: int32(math.Round(newAccumulated)),
		CurrentEtaMinutes: &etaMinutes,
		State:             newState,
	}); err != nil {
		log.Printf("[Engine] Failed to update space points %s: %v", synapseID, err)
	}

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
	ctx := context.Background()
	config := dto.GetDefaultSynapseConfig()[synapseType]
	now := time.Now().UnixMilli()

	// Fetch space for position data (needed for completion event)
	space, err := e.store.Queries.GetSpace(ctx, synapseID)
	if err != nil {
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
	err = e.store.WithTx(ctx, func(q *generated.Queries) error {
		// 1. Update user AGI balance
		if err := q.IncrementUserAGI(ctx, generated.IncrementUserAGIParams{
			ID:             exp.userID,
			TotalAgiEarned: int32(amplifiedReward),
		}); err != nil {
			return err
		}

		// 2. Update ship stats
		if err := q.IncrementAgentStats(ctx, generated.IncrementAgentStatsParams{
			ID:             exp.shipID,
			TotalAgiEarned: int32(amplifiedReward),
		}); err != nil {
			return err
		}

		// 3. Mint NFT for rare+ synapses
		if mintNFT {
			if _, err := q.CreateNFT(ctx, generated.CreateNFTParams{
				ID:        uuid.New().String(),
				UserID:    exp.userID,
				NftType:   "synapse_discovery",
				SynapseID: stringToPgUUID(synapseID),
				Metadata:  json.RawMessage("{}"),
				MintedAt:  now,
			}); err != nil {
				return err
			}

			if err := q.IncrementUserNftCount(ctx, exp.userID); err != nil {
				return err
			}
		}

		// 4. Clear explorers
		if err := q.ClearSynapseExplorers(ctx, synapseID); err != nil {
			return err
		}

		// 5. Update synapse state
		if err := q.CompleteSpace(ctx, generated.CompleteSpaceParams{
			ID:           synapseID,
			DiscoveredAt: &now,
		}); err != nil {
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

	// Update cluster counts: -1 being_solved (was exploring), +1 discovered
	e.updateClusterCounts(space.PositionX, space.PositionY, space.PositionZ, -1, 1)
	// Broadcast immediate cluster update for dashboard sync
	e.broadcastClusterUpdate(space.PositionX, space.PositionY, space.PositionZ)

	if mintNFT {
		log.Printf("[NFT] Minted %s synapse NFT for user %s", synapseType, exp.userID[:8])
	}

	log.Printf("[SOLVED] %s synapse completed! +%.0f $AGI", synapseType, amplifiedReward)

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
	ctx := context.Background()

	space, err := e.store.Queries.GetSpace(ctx, synapseID)
	if err != nil || space.State == "discovered" {
		return false
	}

	// Check if already occupied
	count, err := e.store.Queries.GetSynapseExplorerCount(ctx, synapseID)
	if err != nil {
		log.Printf("[Engine] Failed to get explorer count for %s: %v", synapseID, err)
		return false
	}
	if count >= 1 {
		return false
	}

	config := dto.GetDefaultSynapseConfig()[dto.SynapseType(space.SynapseType)]
	effectiveRate := math.Min(pointsPerMin, float64(config.MaxPerMin))
	now := time.Now().UnixMilli()

	// Add explorer
	if _, err := e.store.Queries.AddSynapseExplorer(ctx, generated.AddSynapseExplorerParams{
		ID:                uuid.New().String(),
		SynapseID:         synapseID,
		ShipID:            shipID,
		UserID:            userID,
		PointsContributed: 0,
		PointsPerMinute:   int32(effectiveRate),
		JoinedAt:          now,
		LastUpdatedAt:     now,
	}); err != nil {
		log.Printf("[Engine] Failed to add synapse explorer: %v", err)
		return false
	}

	// Update synapse state and track delta
	rowsAffected, err := e.store.Queries.UpdateSpaceStateIfUndiscovered(ctx, synapseID)
	if err != nil {
		log.Printf("[Engine] Failed to update space state for %s: %v", synapseID, err)
	}
	if rowsAffected > 0 {
		e.trackSynapseStateChange(synapseID, 1) // 1 = being_solved
		// Update cluster counts and broadcast for immediate dashboard sync
		e.updateClusterCounts(space.PositionX, space.PositionY, space.PositionZ, 1, 0)
		e.broadcastClusterUpdate(space.PositionX, space.PositionY, space.PositionZ)
	}

	// Update ship state - set both target_space_id and current_space_id
	// current_space_id is what the frontend uses to know which synapse the ship is at
	if err := e.store.Queries.UpdateAgentStateToSolving(ctx, generated.UpdateAgentStateToSolvingParams{
		ID:                  shipID,
		TargetSpaceID:       stringToPgUUID(synapseID),
		CurrentPointsPerMin: int32(effectiveRate),
	}); err != nil {
		log.Printf("[Engine] Failed to update agent to solving %s: %v", shipID, err)
	}

	log.Printf("[Exploration] Ship %s started exploring at %.0f pts/min", shipID[:8], effectiveRate)
	return true
}

// redirectToNearbySynapse finds and redirects a ship to a nearby unoccupied synapse
func (e *Engine) redirectToNearbySynapse(shipID, userID string, currentX, currentY, currentZ, pointsPerMin float64) *dto.AgentUpdate {
	ctx := context.Background()

	// Find nearby undiscovered synapses that aren't being explored
	// Order by distance from current position
	nearbySpaces, err := e.store.Queries.GetNearbyUnoccupiedSpaces(ctx, generated.GetNearbyUnoccupiedSpacesParams{
		PositionX: currentX,
		PositionY: currentY,
		PositionZ: currentZ,
	})
	if err != nil {
		log.Printf("[Engine] Failed to get nearby unoccupied spaces: %v", err)
		return nil
	}

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

	// Update ship to start traveling to new synapse - clear current_space_id since ship is leaving
	if err := e.store.Queries.UpdateAgentToTraveling(ctx, generated.UpdateAgentToTravelingParams{
		ID:              shipID,
		TargetSpaceID:   stringToPgUUID(nextSpace.ID),
		PositionX:       currentX,
		PositionY:       currentY,
		PositionZ:       currentZ,
		TravelStartTime: &now,
		TravelDuration:  &travelDuration,
	}); err != nil {
		log.Printf("[Engine] Failed to update agent to traveling %s: %v", shipID, err)
		return nil
	}

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
	ctx := context.Background()

	agent, err := e.store.Queries.GetAgent(ctx, shipID)
	if err != nil || !agent.AutopilotEnabled {
		// Return to idle - clear both target and current space
		if err := e.store.Queries.UpdateAgentToIdle(ctx, shipID); err != nil {
			log.Printf("[Engine] Failed to set agent idle %s: %v", shipID, err)
		}
		return &dto.AgentUpdate{
			ID:        shipID,
			PositionX: currentX,
			PositionY: currentY,
			PositionZ: currentZ,
			State:     dto.AgentIdle,
		}
	}

	// Find next available synapse
	nextSpace, err := e.store.Queries.GetRandomUndiscoveredSpace(ctx)
	if err != nil {
		// No available synapses - clear both target and current space
		if err := e.store.Queries.UpdateAgentToIdle(ctx, shipID); err != nil {
			log.Printf("[Engine] Failed to set agent idle %s: %v", shipID, err)
		}
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

	// Start traveling - clear current_space_id since ship is leaving synapse
	if err := e.store.Queries.UpdateAgentToTraveling(ctx, generated.UpdateAgentToTravelingParams{
		ID:              shipID,
		TargetSpaceID:   stringToPgUUID(nextSpace.ID),
		PositionX:       currentX,
		PositionY:       currentY,
		PositionZ:       currentZ,
		TravelStartTime: &now,
		TravelDuration:  &travelDuration,
	}); err != nil {
		log.Printf("[Engine] Failed to update agent to traveling %s: %v", shipID, err)
	}

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

// getShipSpeedBoost returns the cumulative speed boost for a ship from purchased items.
// Item shop has been removed — always returns 0 (no boost).
func (e *Engine) getShipSpeedBoost(shipID string) float64 {
	return 0
}

// getShipXPMultiplier returns the cumulative XP multiplier for a ship from purchased items.
// Item shop has been removed — always returns 0 (no multiplier).
func (e *Engine) getShipXPMultiplier(shipID string) float64 {
	return 0
}

func (e *Engine) getActiveRewardMultiplier() float64 {
	ctx := context.Background()
	now := time.Now().UnixMilli()
	var multiplier float64 = 1.0

	events, err := e.store.Queries.GetActiveRewardEvents(ctx, now)
	if err != nil {
		log.Printf("[Engine] Failed to get active reward events: %v", err)
		return multiplier
	}

	for _, event := range events {
		if event.Multiplier > multiplier {
			multiplier = event.Multiplier
		}
	}
	return multiplier
}

func (e *Engine) recomputeClusters() {
	ctx := context.Background()
	log.Println("[Engine] Recomputing LOD clusters...")

	// Delete existing clusters
	if err := e.store.Queries.DeleteAllSpaceClusters(ctx); err != nil {
		log.Printf("[Engine] Failed to delete space clusters: %v", err)
		return
	}
	if err := e.store.Queries.DeleteAllAgentClusters(ctx); err != nil {
		log.Printf("[Engine] Failed to delete agent clusters: %v", err)
		return
	}

	now := time.Now().UnixMilli()

	// Recompute space clusters at 3 LOD levels
	// Grid sizes tuned to show more visible markers at close zoom
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		gridSize := lodGridSizes[lodLevel]
		if err := e.store.Queries.InsertSpaceClusters(ctx, generated.InsertSpaceClustersParams{
			Column1: int32(lodLevel),
			Column2: gridSize,
			Column3: now,
		}); err != nil {
			log.Printf("[Engine] Failed to insert space clusters LOD %d: %v", lodLevel, err)
		}
	}

	// Recompute agent clusters at 3 LOD levels
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		gridSize := 0.5 * float64(lodLevel+1)
		if err := e.store.Queries.InsertAgentClusters(ctx, generated.InsertAgentClustersParams{
			Column1: int32(lodLevel),
			Column2: gridSize,
			Column3: now,
		}); err != nil {
			log.Printf("[Engine] Failed to insert agent clusters LOD %d: %v", lodLevel, err)
		}
	}
}

func (e *Engine) broadcastStateSync() {
	ctx := context.Background()

	// Get clusters
	spaceClusters := e.getSpaceClusters(ctx)
	agentClusters := e.getAgentClusters(ctx)

	// Get discovery progress
	stats, err := e.store.Queries.GetSpaceStats(ctx)
	if err != nil {
		log.Printf("[Engine] Failed to get space stats: %v", err)
		return
	}

	worldState := dto.WorldState{
		SynapseClusters: spaceClusters,
		AgentClusters:   agentClusters,
		DiscoveryProgress: dto.DiscoveryProgress{
			Total:         int(stats.Total),
			Discovered:    int(stats.Discovered),
			BeingExplored: int(stats.BeingSolved),
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

func (e *Engine) getSpaceClusters(ctx context.Context) []dto.SpaceCluster {
	clusters, err := e.store.Queries.GetAllSpaceClusters(ctx)
	if err != nil {
		log.Printf("[Engine] Failed to get space clusters: %v", err)
		return nil
	}

	result := make([]dto.SpaceCluster, len(clusters))
	for i, c := range clusters {
		result[i] = dto.SpaceCluster{
			ID:               c.ID,
			LODLevel:         int(c.LodLevel),
			PositionX:        c.PositionX,
			PositionY:        c.PositionY,
			PositionZ:        c.PositionZ,
			SpaceCount:       int(c.SpaceCount),
			DiscoveredCount:  int(c.DiscoveredCount),
			BeingSolvedCount: int(c.BeingSolvedCount),
			UpdatedAt:        c.UpdatedAt,
		}
	}
	return result
}

func (e *Engine) getAgentClusters(ctx context.Context) []dto.AgentCluster {
	clusters, err := e.store.Queries.GetAllAgentClusters(ctx)
	if err != nil {
		log.Printf("[Engine] Failed to get agent clusters: %v", err)
		return nil
	}

	result := make([]dto.AgentCluster, len(clusters))
	for i, c := range clusters {
		result[i] = dto.AgentCluster{
			ID:            c.ID,
			LODLevel:      int(c.LodLevel),
			PositionX:     c.PositionX,
			PositionY:     c.PositionY,
			PositionZ:     c.PositionZ,
			AgentCount:    int(c.AgentCount),
			DominantState: dto.AgentState(c.DominantState),
			AvgProgress:   c.AvgProgress,
			UpdatedAt:     c.UpdatedAt,
		}
	}
	return result
}
