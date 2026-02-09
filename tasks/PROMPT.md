# Fix Ship Status Display WebSocket Sync

## Objective
Fix the ship list (left panel) to display actual ship states from WebSocket messages instead of always showing "idle". Ships should show deploying/exploring/returning states in real-time.

## Tasks (Execute in Order)

1. **fix-websocket-state-sync/task-07-ship-status-display-sync.code-task.md**
   - Trace WebSocket message flow and fix reactivity chain
   - Ensure `agents:update`, `ships:sync`, `travel:started` properly update ship states
   - Verify ShipNavigator component reacts to state changes

## Key Files
- `src/stores/shipStore.ts` - WebSocket handlers (lines 441-825)
- `src/components/ships/ShipNavigator.tsx` - Ship list display
- `server-go/internal/simulation/engine.go` - Agent state broadcasts

## Acceptance Criteria
- Ship list shows "deploying" when ship is traveling
- Ship list shows "exploring" when ship is at synapse
- Ship list shows "returning" when ship is recalled
- States update in real-time without page refresh
