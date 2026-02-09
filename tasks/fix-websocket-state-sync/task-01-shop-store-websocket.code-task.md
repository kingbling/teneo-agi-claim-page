---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Fix Shop Store WebSocket State Synchronization

## Description
Refactor shopStore to use WebSocket-driven state updates instead of direct state mutations after REST API calls. Currently, `purchaseItem`, `activateItem`, and `deactivateItem` functions manually update local state after API responses, bypassing the server-authoritative WebSocket system.

## Background
The application uses a server-authoritative architecture where WebSocket broadcasts should drive state updates. However, the shop store performs manual state updates after API calls, which can lead to state inconsistencies between client and server.

## Technical Requirements
1. Remove direct state mutations in `purchaseItem()` (lines 313-331)
2. Remove direct state mutations in `activateItem()` (lines 390-394)
3. Remove direct state mutations in `deactivateItem()` (lines 409-429)
4. Add WebSocket event handlers for shop-related events
5. Ensure server broadcasts appropriate events after shop operations

## Dependencies
- Server must broadcast WebSocket events for: `item:purchased`, `item:activated`, `item:deactivated`
- WebSocket connection established via `useWebSocketConnection` hook
- Existing WebSocket infrastructure in shipStore.ts can be used as reference

## Implementation Approach
1. Identify server-side handlers for shop operations in `server-go/internal/handlers/`
2. Add WebSocket broadcast calls after successful shop operations
3. Add WebSocket event handlers in shopStore.ts to update state
4. Remove manual setState calls from API response handlers
5. Keep API calls for triggering actions, but let WebSocket drive state updates

## Acceptance Criteria

1. **Purchase Item via WebSocket**
   - Given a user purchases an item via API
   - When the server processes the purchase
   - Then a WebSocket event broadcasts the updated inventory
   - And shopStore updates state from the WebSocket event, not the API response

2. **Activate Item via WebSocket**
   - Given a user activates an item
   - When the server processes the activation
   - Then a WebSocket event broadcasts the item state change
   - And shopStore updates activeItems from the WebSocket event

3. **Deactivate Item via WebSocket**
   - Given a user deactivates an item
   - When the server processes the deactivation
   - Then a WebSocket event broadcasts the item state change
   - And shopStore updates state from the WebSocket event

4. **State Consistency**
   - Given multiple clients connected
   - When one client makes a shop action
   - Then all clients receive WebSocket updates and stay in sync

5. **Unit Tests**
   - Given the refactored shop store
   - When running tests
   - Then WebSocket event handlers have test coverage

## Metadata
- **Complexity**: Medium
- **Labels**: WebSocket, State Management, Shop, Refactoring
- **Required Skills**: SolidJS stores, WebSocket event handling, Go HTTP handlers
