---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Fix Ship Store Equipment/Autopilot WebSocket Patterns

## Description
Refactor equipment and autopilot functions in shipStore to use WebSocket-driven state updates. Functions affected: `toggleAutopilot`, `equipItem`, and `unequipItem`.

## Background
These functions directly update ship state from API responses instead of waiting for WebSocket broadcasts. This breaks the server-authoritative pattern and can cause state drift between clients.

## Technical Requirements
1. Remove direct state updates in `toggleAutopilot()` (lines 1107-1112)
2. Remove direct state updates in `equipItem()` (lines 1161-1166)
3. Remove direct state updates in `unequipItem()` (lines 1177-1201)
4. Server must broadcast equipment/autopilot state changes via WebSocket
5. Add or enhance WebSocket handlers for ship equipment state

## Dependencies
- Server handlers for equipment operations in `server-go/internal/handlers/`
- Existing ship-related WebSocket handlers in shipStore.ts
- WebSocket hub for broadcasting

## Implementation Approach
1. Locate server handlers for autopilot and equipment in Go codebase
2. Add WebSocket broadcast after successful equipment operations
3. Add/enhance WebSocket handlers in shipStore for equipment events
4. Remove direct setState from API response handlers
5. API calls trigger actions; WebSocket delivers state updates

## Acceptance Criteria

1. **Toggle Autopilot via WebSocket**
   - Given a user toggles autopilot for a ship
   - When the server processes the toggle
   - Then a WebSocket event broadcasts the ship's autopilot state
   - And shipStore updates the ship from WebSocket, not API response

2. **Equip Item via WebSocket**
   - Given a user equips an item to a ship
   - When the server processes the equipment
   - Then a WebSocket event broadcasts the ship's equipped items
   - And shipStore updates from WebSocket

3. **Unequip Item via WebSocket**
   - Given a user unequips an item from a ship
   - When the server processes the unequip
   - Then a WebSocket event broadcasts the updated ship state
   - And shipStore updates from WebSocket

4. **Multi-Client Sync**
   - Given multiple clients viewing the same ship
   - When one client changes equipment
   - Then all clients receive the update via WebSocket

5. **Unit Tests**
   - Given the refactored equipment functions
   - When running tests
   - Then WebSocket event handlers have test coverage

## Metadata
- **Complexity**: Medium
- **Labels**: WebSocket, State Management, Ships, Equipment, Autopilot, Refactoring
- **Required Skills**: SolidJS stores, WebSocket event handling, Go HTTP handlers
