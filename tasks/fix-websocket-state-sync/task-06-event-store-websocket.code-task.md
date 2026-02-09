---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Convert Event Store Polling to WebSocket

## Description
Refactor eventStore to use WebSocket subscriptions instead of REST API polling for active and upcoming events. Currently, `fetchActiveEvents` and `fetchUpcomingEvents` use traditional fetch calls, missing the real-time capability of WebSocket.

## Background
The event store uses polling (or on-demand fetching) for event data. For real-time event status (starting, ending, participant changes), WebSocket subscriptions provide better UX and reduce server load from repeated polling.

## Technical Requirements
1. Convert `fetchActiveEvents()` (lines 205-232) to WebSocket subscription
2. Convert `fetchUpcomingEvents()` (lines 234-247) to WebSocket subscription
3. Server must broadcast `event:active` and `event:upcoming` events
4. Keep initial fetch for bootstrapping, then rely on WebSocket for updates
5. Handle event state transitions (upcoming → active → completed) via WebSocket

## Dependencies
- Server-side event management in `server-go/internal/handlers/`
- WebSocket hub for broadcasting
- Event timing logic for when to broadcast updates

## Implementation Approach
1. Add server-side logic to broadcast when events become active or complete
2. Add WebSocket event handlers in eventStore
3. Bootstrap with initial API fetch on connection
4. Subscribe to `event:active`, `event:upcoming`, `event:ended` events
5. Remove or reduce polling frequency

## Acceptance Criteria

1. **Active Events via WebSocket**
   - Given an event becomes active (start time reached)
   - When the server detects the transition
   - Then a WebSocket event broadcasts the active event
   - And eventStore updates activeEvents from WebSocket

2. **Upcoming Events via WebSocket**
   - Given a new event is scheduled
   - When the event is created or updated
   - Then a WebSocket event broadcasts the upcoming event
   - And eventStore updates upcomingEvents from WebSocket

3. **Event Completion via WebSocket**
   - Given an active event ends
   - When the server detects the end
   - Then a WebSocket event broadcasts the event completion
   - And eventStore removes it from activeEvents

4. **Initial Bootstrap**
   - Given a client connects
   - When WebSocket connection is established
   - Then initial events are fetched via API
   - And subsequent updates come via WebSocket

5. **Reduced Server Load**
   - Given the refactored event store
   - When events are managed
   - Then no polling intervals exist for event data

6. **Unit Tests**
   - Given the refactored event store
   - When running tests
   - Then WebSocket subscription handlers have test coverage

## Metadata
- **Complexity**: Medium
- **Labels**: WebSocket, State Management, Events, Polling, Real-time
- **Required Skills**: SolidJS stores, WebSocket event handling, Go HTTP handlers, Event scheduling
