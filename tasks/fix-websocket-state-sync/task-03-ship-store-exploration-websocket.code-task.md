---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Fix Ship Store Exploration WebSocket Patterns

## Description
Refactor exploration-related functions in shipStore to properly leverage WebSocket events instead of direct state mutations. Functions affected: `startExploration`, `leaveExploration`, and `recallShip`.

## Background
The ship store has existing WebSocket handlers (lines 441-825) but exploration actions bypass them by manually updating state after API responses. This creates race conditions and state inconsistencies, especially with the optimistic update pattern currently used.

## Technical Requirements
1. Remove optimistic updates and direct state mutations in `startExploration()` (lines 980, 994-1003)
2. Remove direct state reset in `leaveExploration()` (lines 1043-1050)
3. Remove local fallback updates in `recallShip()` (lines 1321-1340)
4. Ensure server broadcasts `exploration:started`, `exploration:left`, `ship:recalled` events
5. Leverage existing WebSocket infrastructure in shipStore

## Dependencies
- Server handlers in `server-go/internal/handlers/synapses.go` and `agents.go`
- Existing WebSocket event handlers in shipStore.ts (lines 441-825)
- WebSocket hub for broadcasting

## Implementation Approach
1. Review existing WebSocket handlers in shipStore to understand current patterns
2. Add server-side WebSocket broadcasts for exploration state changes
3. Remove optimistic updates - let WebSocket drive all state changes
4. Remove direct setState calls from API response handlers
5. Consider adding loading states while waiting for WebSocket confirmation

## Acceptance Criteria

1. **Start Exploration via WebSocket**
   - Given a user starts exploration via API
   - When the server processes the request
   - Then a WebSocket event broadcasts the exploration state
   - And shipStore updates `currentExplorationSynapse` from WebSocket, not API response

2. **Leave Exploration via WebSocket**
   - Given a user leaves exploration
   - When the server processes the request
   - Then a WebSocket event broadcasts the cleared exploration state
   - And shipStore clears exploration state from WebSocket event

3. **Recall Ship via WebSocket**
   - Given a user recalls a ship
   - When the server processes the recall
   - Then a WebSocket event broadcasts the ship state change
   - And no local fallback state updates occur

4. **No Optimistic Updates**
   - Given the refactored code
   - When reviewing startExploration
   - Then no optimistic state updates exist before API confirmation

5. **Loading States**
   - Given an exploration action is in progress
   - When waiting for WebSocket confirmation
   - Then appropriate loading indicators are shown

6. **Unit Tests**
   - Given the refactored exploration functions
   - When running tests
   - Then WebSocket-driven state updates have test coverage

## Metadata
- **Complexity**: High
- **Labels**: WebSocket, State Management, Ships, Exploration, Refactoring
- **Required Skills**: SolidJS stores, WebSocket event handling, Go HTTP handlers, State machines
