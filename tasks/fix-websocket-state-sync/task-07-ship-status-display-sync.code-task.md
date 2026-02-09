---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Fix Ship Status Display WebSocket Sync

## Description
The ship list (ShipNavigator component) always displays "idle" status for ships regardless of their actual state from WebSocket messages. The UI reads `ship.state` correctly, but the reactive store isn't being updated when `agents:update` or `ships:sync` WebSocket messages arrive.

## Background
Ships have multiple states: `idle`, `deploying`, `exploring`, `returning`. The server broadcasts state changes via WebSocket (`agents:update`, `ships:sync`, `travel:started`), but the ship list on the left always shows "idle". The handlers exist in shipStore.ts but aren't properly triggering reactive updates.

## Technical Requirements
1. Trace WebSocket message flow from server → client → store → UI
2. Verify server is sending correct state in `agents:update` messages
3. Ensure `handleServerMessage` properly updates the reactive store for ship states
4. Verify `travel:started` events transition ships from `idle` → `deploying`
5. Confirm ShipNavigator reactively updates when `userShips()` state changes

## Dependencies
- `src/stores/shipStore.ts` - WebSocket handlers (lines 441-825)
- `src/components/ships/ShipNavigator.tsx` - Ship list display
- `server-go/internal/simulation/engine.go` - Agent state broadcasts
- `server-go/internal/dto/websocket.go` - WebSocket message types

## Implementation Approach
1. Add console logging to trace WebSocket messages for `agents:update` and `ships:sync`
2. Verify the `mapServerShipState()` function correctly maps server states
3. Check if `setState` calls in handlers trigger reactivity (SolidJS store patterns)
4. Ensure `userShips` derived signal recomputes when underlying state changes
5. Fix any broken reactivity chain between WebSocket handlers and UI

## Acceptance Criteria

1. **Deploying State Displayed**
   - Given a ship starts traveling to a synapse
   - When the server sends `travel:started` or state update
   - Then the ship list shows "deploying" status (not "idle")

2. **Exploring State Displayed**
   - Given a ship arrives at a synapse and begins exploring
   - When the server sends `agents:update` with exploring state
   - Then the ship list shows "exploring" status

3. **Returning State Displayed**
   - Given a ship is recalled and traveling home
   - When the server sends the state update
   - Then the ship list shows "returning" status

4. **Real-time Updates**
   - Given the ship list is visible
   - When ship state changes on the server
   - Then the UI updates within 1 second without page refresh

5. **State Consistency**
   - Given multiple ships with different states
   - When viewing the ship list
   - Then each ship shows its correct individual state

6. **Unit Tests**
   - Given the refactored WebSocket handlers
   - When running tests
   - Then ship state update flows have test coverage

## Metadata
- **Complexity**: Medium
- **Labels**: WebSocket, State Management, Ships, UI, Reactivity, Debug
- **Required Skills**: SolidJS reactive stores, WebSocket debugging, State flow tracing
