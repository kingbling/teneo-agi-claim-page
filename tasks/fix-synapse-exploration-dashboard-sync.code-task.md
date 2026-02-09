---
status: completed
created: 2026-01-18
started: 2026-01-18
completed: 2026-01-18
---
# Task: Fix Synapse Exploration Dashboard Real-Time Sync

## Description
Fix the issue where exploring a synapse doesn't immediately update the status in the dashboard. Currently, when a user starts exploring a synapse, the SynapseListPanel continues showing stale status until the next periodic `state:sync` broadcast (every 5 ticks). The dashboard should reflect "Exploring" status immediately when exploration begins.

## Background
The dashboard's SynapseListPanel component displays synapse cluster status by reading from `synapseClustersLod0` in the shipStore. This data only updates when the server broadcasts `state:sync` events, which happen every 5 simulation ticks (~250ms). When a user starts exploring a synapse via `POST /api/synapses/{id}/explore`, the server updates internal state and sends `ships:sync` to the user, but doesn't immediately broadcast the cluster state change. This creates a noticeable delay where the dashboard shows outdated information.

The status indicators in SynapseListPanel work as follows:
- `beingExploredCount > 0` → "Exploring" (yellow)
- `discoveredCount > 0` → "Partial" (green)
- else → "Undiscovered" (gray)

## Technical Requirements
1. Server must emit an immediate cluster state update when synapse exploration starts
2. Server must emit an immediate cluster state update when synapse exploration completes
3. Frontend WebSocket handler must process these updates and refresh the cluster data in shipStore
4. Dashboard must reactively update to reflect the new status without page refresh
5. Solution must not create excessive WebSocket traffic (targeted updates preferred over full state sync)

## Dependencies
- `server-go/internal/handlers/synapses.go` - ExploreSynapse handler (line 80-206)
- `server-go/internal/simulation/engine.go` - Simulation engine with state tracking
- `server-go/internal/websocket/hub.go` - WebSocket broadcasting
- `src/stores/shipStore.ts` - Frontend state management (WebSocket handlers at line 443-473)
- `src/components/dashboard/SynapseListPanel.tsx` - Dashboard display component

## Implementation Approach
1. **Server-side (Option A - Targeted cluster update):**
   - After successful exploration start in `ExploreSynapse` handler, compute the affected cluster's updated counts
   - Broadcast a targeted `cluster:update` event with just the changed cluster data
   - Add similar broadcast when exploration completes in the simulation engine

2. **Server-side (Option B - Immediate state sync):**
   - After exploration state change, trigger an immediate `state:sync` broadcast
   - Simpler but sends more data than necessary

3. **Frontend:**
   - If using Option A: Add handler for `cluster:update` event in shipStore WebSocket handler
   - Update the relevant cluster in `synapseClustersLod0/1/2` arrays
   - Ensure SolidJS reactivity triggers re-render of SynapseListPanel

4. **Testing:**
   - Verify dashboard shows "Exploring" immediately when starting exploration
   - Verify status updates to "Partial" or stays correct when exploration completes
   - Verify no regression in periodic state sync behavior

## Acceptance Criteria

1. **Immediate Status Update on Exploration Start**
   - Given a user viewing the SynapseListPanel dashboard
   - When they start exploring a synapse (via ship deployment or direct exploration)
   - Then the synapse cluster status changes to "Exploring" (yellow) within 100ms

2. **Immediate Status Update on Exploration Complete**
   - Given a synapse being actively explored
   - When the exploration completes (synapse discovered)
   - Then the synapse cluster status updates to reflect the new discovered count immediately

3. **WebSocket Event Handling**
   - Given the frontend is connected via WebSocket
   - When a cluster state change event is received
   - Then the shipStore updates the affected cluster data and triggers UI reactivity

4. **No Duplicate Updates**
   - Given immediate updates are implemented
   - When periodic state:sync also fires
   - Then no visual glitches or state conflicts occur (idempotent updates)

5. **Unit Test Coverage**
   - Given the implementation
   - When running the test suite
   - Then WebSocket event emission and handling have corresponding tests

## Metadata
- **Complexity**: Medium
- **Labels**: WebSocket, Real-time, Dashboard, State Sync, Bug Fix
- **Required Skills**: Go (net/http, WebSocket), SolidJS stores, TypeScript, Real-time state management
