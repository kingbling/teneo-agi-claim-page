---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Fix User Store WebSocket State Synchronization

## Description
Refactor userStore to use WebSocket-driven state updates for user progression changes. Currently, `recordUSDCSpent` performs local calculations for level, multiplier, and unlocks after API calls instead of receiving authoritative state from the server via WebSocket.

## Background
User progression (level, multiplier, maxShips, unlockedSynapseTypes) is calculated locally after API responses. This duplicates server logic on the client and can lead to inconsistencies if the calculation logic differs or changes.

## Technical Requirements
1. Remove local level/progression calculations in `recordUSDCSpent()` (lines 188-198)
2. Server should calculate and broadcast user progression updates
3. Add WebSocket handler for `user:level-updated` or `user:sync` events
4. Ensure initial state from `loginUser()` can be subsequently updated via WebSocket

## Dependencies
- Server must broadcast WebSocket events for user progression changes
- User level calculation logic exists in `server-go/internal/config/`
- WebSocket hub available for broadcasting

## Implementation Approach
1. Locate server handler for USDC spending in `server-go/internal/handlers/`
2. After processing USDC spent, broadcast user state via WebSocket
3. Add WebSocket event handler in userStore.ts
4. Remove local `calculateUserLevel` and `getUserLevelConfig` calls from API handlers
5. API call triggers the action; WebSocket delivers the authoritative result

## Acceptance Criteria

1. **Level Update via WebSocket**
   - Given a user spends USDC that triggers a level up
   - When the server processes the spending
   - Then a WebSocket event broadcasts the new user state (level, multiplier, etc.)
   - And userStore updates from the WebSocket event, not local calculation

2. **Progression State Consistency**
   - Given the server calculates user level
   - When the client receives the WebSocket event
   - Then all derived values (maxShips, unlockedSynapseTypes) match server state

3. **Remove Duplicate Logic**
   - Given the refactored code
   - When reviewing userStore
   - Then no local level/progression calculations exist after API responses

4. **Multi-Client Sync**
   - Given a user is logged in on multiple devices
   - When USDC is spent on one device
   - Then all devices receive the updated user state via WebSocket

5. **Unit Tests**
   - Given the refactored user store
   - When running tests
   - Then WebSocket event handlers have test coverage

## Metadata
- **Complexity**: Medium
- **Labels**: WebSocket, State Management, User, Progression, Refactoring
- **Required Skills**: SolidJS stores, WebSocket event handling, Go HTTP handlers
