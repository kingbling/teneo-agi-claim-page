---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Fix Ship Store Synapse/Ship Creation WebSocket Patterns

## Description
Refactor ship creation and synapse detail functions in shipStore to use WebSocket-driven state updates. Functions affected: `createShip`, `fetchSynapseDetails`, and `fetchSynapseExplorers`.

## Background
These functions directly update state from API responses. For a server-authoritative architecture, state changes should flow through WebSocket events to ensure all clients stay synchronized.

## Technical Requirements
1. Remove direct ship addition in `createShip()` (lines 921-924)
2. Remove direct state update in `fetchSynapseDetails()` (line 1521)
3. Remove direct state update in `fetchSynapseExplorers()` (line 1555)
4. Server must broadcast relevant events: `ships:sync`, `synapse:updated`, `explorers:updated`
5. Add WebSocket handlers for these events

## Dependencies
- Server handlers for ship creation and synapse queries
- Existing WebSocket infrastructure
- WebSocket hub for broadcasting

## Implementation Approach
1. For `createShip`: Server should broadcast `ships:sync` or `ship:created` after creation
2. For synapse details: Consider if this needs WebSocket or if it's acceptable as a query
3. For explorers list: Add WebSocket broadcast when explorer list changes
4. Add WebSocket handlers in shipStore
5. Remove direct setState from API handlers

## Acceptance Criteria

1. **Create Ship via WebSocket**
   - Given a user creates a new ship
   - When the server processes the creation
   - Then a WebSocket event broadcasts the new ship
   - And shipStore adds the ship from WebSocket, not API response

2. **Synapse Details Update**
   - Given synapse details change (e.g., loot collected)
   - When the change is processed
   - Then a WebSocket event broadcasts the updated synapse
   - And connected clients receive the update

3. **Explorers List Update**
   - Given the explorer list for a synapse changes
   - When agents start/stop exploring
   - Then a WebSocket event broadcasts the updated list
   - And `currentExplorers` updates from WebSocket

4. **Initial Fetch Pattern**
   - Given a user navigates to synapse details
   - When the component mounts
   - Then initial data is fetched via API
   - And subsequent updates come via WebSocket subscription

5. **Unit Tests**
   - Given the refactored functions
   - When running tests
   - Then WebSocket event handlers have test coverage

## Metadata
- **Complexity**: Medium
- **Labels**: WebSocket, State Management, Ships, Synapses, Refactoring
- **Required Skills**: SolidJS stores, WebSocket event handling, Go HTTP handlers
