# Migration Rollout Guide: Server-Authoritative Architecture

## Overview

This migration consolidates all business logic to the server, eliminating duplication between client and server. The changes establish a single source of truth for all game mechanics.

---

## What Changed

### 🎯 Core Changes

1. **Server Config API** - New `/api/config` endpoint provides all game constants
2. **Trance System Migration** - Moved from client-side to server-authoritative
3. **Transaction Safety** - All points operations now use database transactions
4. **Enhanced Validation** - Position bounds and state validation enforced server-side
5. **Client Simplification** - Removed all hardcoded constants and business logic

### 📦 New Files

**Server:**
- `server/src/config/gameConfig.ts` - Central configuration (250 lines)

**Client:**
- `src/stores/configStore.ts` - Config management store (226 lines)

### 📝 Database Changes

**Migration v5** adds trance fields to agents table:
- `trance_active` (INTEGER) - Boolean flag for trance state
- `trance_end_time` (INTEGER) - Unix timestamp when trance ends
- `trance_level` (INTEGER) - Level of trance trait (0-5)

### 🔴 Breaking Changes

1. **Client requires config fetch** - App will not start until `/api/config` succeeds
2. **No fallback values** - Config store throws errors if config not loaded
3. **Trance behavior changed** - Now controlled by server, not client
4. **Position validation** - Invalid deployment positions rejected (bounds: -1.3 to 1.3)

---

## Pre-Deployment Checklist

### ✅ Server Verification
- [ ] Run `cd server && npx tsc --noEmit` (should have no errors)
- [ ] Run `cd server && npm run build` (should succeed)
- [ ] Verify database migrations compile: check `server/src/db/migrations.ts`
- [ ] Verify game config exports: check `server/src/config/gameConfig.ts`

### ✅ Client Verification
- [ ] Run `npx tsc --noEmit` from root (should have no errors)
- [ ] Run `npm run build` (should succeed)
- [ ] Verify config store imports: check `src/stores/configStore.ts`
- [ ] Verify App.tsx fetches config on mount

### ✅ Testing
- [ ] Test server starts without errors: `cd server && npm run dev`
- [ ] Test `/api/config` endpoint returns valid JSON
- [ ] Test client fetches config successfully
- [ ] Test agent creation with various trait combinations
- [ ] Test trance triggering (requires agent with trance trait)

---

## Deployment Sequence

### Phase 1: Database Migration (30 seconds downtime)

**⚠️ This requires brief downtime**

1. **Stop the server**
   ```bash
   # Find and kill the server process
   pkill -f "node.*server"
   ```

2. **Backup the database**
   ```bash
   cd server
   cp data/teneo.db data/teneo.db.backup.$(date +%s)
   cp data/teneo.db-wal data/teneo.db-wal.backup.$(date +%s) 2>/dev/null || true
   cp data/teneo.db-shm data/teneo.db-shm.backup.$(date +%s) 2>/dev/null || true
   ```

3. **Deploy new server code**
   ```bash
   cd server
   npm install  # Install any new dependencies
   npm run build
   ```

4. **Start server** (migration runs automatically on startup)
   ```bash
   npm start
   ```

5. **Verify migration**
   ```bash
   # Check migration applied
   sqlite3 data/teneo.db "PRAGMA table_info(agents);"
   # Should show trance_active, trance_end_time, trance_level columns
   ```

### Phase 2: Deploy Client

1. **Build client**
   ```bash
   npm run build
   ```

2. **Deploy static assets**
   ```bash
   # Copy dist/ to your web server
   # Example for local testing:
   npm run preview
   ```

3. **Verify config fetch**
   - Open browser DevTools Network tab
   - Refresh page
   - Verify `GET /api/config` succeeds with 200 status
   - Check response contains all expected fields

---

## Verification Steps

### 1. Config API Check
```bash
curl http://localhost:4000/api/config | jq
```

**Expected response:**
```json
{
  "costs": {
    "AGENT_BASE_COST": 100,
    "TRAIT_COST_PER_LEVEL": 50,
    "REPAIR_COST_MULTIPLIER": 0.5,
    "STARTING_USER_POINTS": 1000,
    "STARTING_AGENT_FUEL": 500,
    "REPAIR_FUEL_AMOUNT": 100
  },
  "rates": {
    "TICK_INTERVAL_MS": 1000,
    "BASE_BURN_RATE": 1.0,
    "BASE_SPEED": 0.1,
    "BASE_SEARCH_SPEED": 0.03
  },
  "traits": {
    "swift": { "speedBonus": 0.2, "burnPenalty": 0.4 },
    "efficient": { "burnReduction": 0.15, "speedPenalty": 0.3 },
    "explorer": { "discoveryBonus": 0.25 },
    "trance": {
      "tranceDurationBase": 5,
      "tranceDurationPerLevel": 3,
      "tranceTimeScale": 0.05
    },
    ...
  },
  "tiers": { ... },
  "spaces": { ... }
}
```

### 2. Database Schema Check
```bash
cd server
sqlite3 data/teneo.db << EOF
PRAGMA table_info(agents);
SELECT schema_version FROM schema_info;
EOF
```

**Expected:**
- Schema version should be `5`
- agents table should have `trance_active`, `trance_end_time`, `trance_level` columns

### 3. Trance System Check

**Test with an agent that has trance trait:**

1. Create agent with trance trait (level 3)
2. Deploy agent to search for spaces
3. Wait for space discovery
4. Observe agent enters trance state:
   - `tranceActive = true`
   - `tranceEndTime` = now + (5 + 3*3) = 14 seconds
   - Agent state changes to `idle`
5. After 14 seconds, agent automatically returns to `searching`

**Query to check trance state:**
```bash
sqlite3 server/data/teneo.db "SELECT id, name, state, trance_active, trance_end_time, trance_level FROM agents WHERE trance_active = 1;"
```

### 4. Transaction Safety Check

**Test concurrent refuel operations:**

```bash
# Terminal 1
curl -X POST http://localhost:4000/api/agents/AGENT_ID/refuel \
  -H "Content-Type: application/json" \
  -d '{"points": 100}' &

# Terminal 2 (immediately after)
curl -X POST http://localhost:4000/api/agents/AGENT_ID/refuel \
  -H "Content-Type: application/json" \
  -d '{"points": 100}' &

wait
```

**Expected behavior:**
- Both requests complete without errors
- User points deducted exactly 200 (not inconsistent)
- Agent balance increased exactly 200

### 5. Position Validation Check

**Test out-of-bounds deployment:**

```bash
curl -X POST http://localhost:4000/api/agents/AGENT_ID/deploy-to-region \
  -H "Content-Type: application/json" \
  -d '{"positionX": 5.0, "positionY": 0, "positionZ": 0}'
```

**Expected response:**
```json
{
  "error": "Position out of bounds (must be within -1.3 to 1.3)"
}
```

---

## Rollback Procedure

### If Migration Fails

1. **Stop the new server**
   ```bash
   pkill -f "node.*server"
   ```

2. **Restore database backup**
   ```bash
   cd server
   # Find latest backup
   ls -lt data/teneo.db.backup.* | head -1

   # Restore (replace TIMESTAMP with actual backup timestamp)
   cp data/teneo.db.backup.TIMESTAMP data/teneo.db
   cp data/teneo.db-wal.backup.TIMESTAMP data/teneo.db-wal 2>/dev/null || true
   cp data/teneo.db-shm.backup.TIMESTAMP data/teneo.db-shm 2>/dev/null || true
   ```

3. **Revert to previous server code**
   ```bash
   git checkout HEAD~1 server/
   cd server
   npm install
   npm run build
   npm start
   ```

4. **Revert client code**
   ```bash
   git checkout HEAD~1 src/
   npm run build
   ```

### If Client Config Fetch Fails

**Symptoms:**
- Client shows "Loading game configuration..." indefinitely
- Browser console shows 404 or 500 error for `/api/config`

**Fix:**
1. Check server is running: `curl http://localhost:4000/health`
2. Check config endpoint: `curl http://localhost:4000/api/config`
3. If server not responding, check server logs
4. If endpoint missing, verify server code deployed correctly

**Temporary workaround** (emergency only):
```typescript
// In src/stores/configStore.ts, add retry logic:
fetchConfig: async () => {
  const maxRetries = 3
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${API_URL}/api/config`)
      const config = await response.json()
      set({ gameConfig: config, isLoaded: true })
      return
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

---

## Common Issues and Fixes

### Issue 1: "Game config not loaded" error

**Cause:** Client tried to use config before fetch completed

**Fix:** Verify `App.tsx` waits for config:
```typescript
if (!isLoaded && !error) {
  return <div>Loading game configuration...</div>
}
```

### Issue 2: Trance not triggering

**Cause:** Agent doesn't have trance trait or server not detecting it

**Verification:**
```bash
# Check agent has trance trait
sqlite3 server/data/teneo.db "SELECT id, name, traits FROM agents WHERE id = 'AGENT_ID';"

# Check trance level extracted correctly
# Should see tranceLevel > 0 in server logs when agent created
```

**Fix:** Ensure agent creation includes trance trait:
```typescript
traits: [{ type: 'trance', level: 3 }]
```

### Issue 3: Incorrect cost calculations

**Cause:** Client config out of sync with server

**Fix:** Hard refresh client (Cmd+Shift+R) to fetch latest config

**Verification:**
```bash
# Compare client-calculated cost vs server cost
# In browser console:
configStore.calculateAgentCost([{ type: 'swift', level: 2 }])
// Should return: 100 + (2 * 50) = 200

# On server:
curl -X POST http://localhost:4000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID", "name":"Test", "traits":[{"type":"swift","level":2}]}'
# Response should show same cost
```

### Issue 4: Database locked errors

**Cause:** Multiple server instances or WAL corruption

**Fix:**
```bash
cd server
# Stop all server processes
pkill -f "node.*server"

# Checkpoint WAL file
sqlite3 data/teneo.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Restart server
npm start
```

---

## Performance Monitoring

### Metrics to Watch

1. **Config Fetch Time**
   - Monitor: Browser DevTools Network tab
   - Expected: < 50ms for `/api/config`
   - Alert if: > 200ms

2. **Database Transaction Time**
   - Monitor: Server logs (add timing if needed)
   - Expected: < 10ms per transaction
   - Alert if: > 100ms

3. **Trance System Overhead**
   - Monitor: Tick processing time
   - Expected: < 5ms per tick with 1000 agents
   - Alert if: > 50ms (indicates scaling issue)

### Logging

**Add to server for monitoring:**
```typescript
// In server/src/index.ts after config endpoint
app.get('/api/config', (req, res) => {
  const start = Date.now()
  const config = getGameConfig()
  console.log(`Config fetch took ${Date.now() - start}ms`)
  res.json(config)
})
```

---

## Testing Checklist

### Functional Tests

- [ ] Create agent with no traits (cost = 100)
- [ ] Create agent with swift level 5 (cost = 100 + 250 = 350)
- [ ] Create agent with multiple traits (verify additive cost)
- [ ] Deploy agent to valid position (succeeds)
- [ ] Deploy agent to invalid position (rejected with bounds error)
- [ ] Refuel agent with sufficient points (succeeds)
- [ ] Refuel agent with insufficient points (rejected)
- [ ] Repair exhausted agent (cost = 50% of creation cost)
- [ ] Trigger trance with level 1 (duration = 8 seconds)
- [ ] Trigger trance with level 5 (duration = 20 seconds)
- [ ] Verify trance auto-continues after duration

### Integration Tests

- [ ] Create 10 agents rapidly (verify no race conditions)
- [ ] Deploy all agents simultaneously
- [ ] Verify fuel consumption matches estimates
- [ ] Verify cost calculations client = server
- [ ] Hard refresh client during operation (verify reconnect)

### Load Tests

- [ ] 100 concurrent config fetches
- [ ] 50 agents in trance simultaneously
- [ ] 100 refuel operations per second
- [ ] Database size after 10,000 operations

---

## Security Considerations

1. **Config endpoint is public** - Contains game mechanics
   - No authentication required
   - Safe to expose (no user data)
   - Consider caching headers for CDN

2. **Database transactions prevent race conditions**
   - Points economy protected
   - Agent limits enforced atomically

3. **Server validates all operations**
   - Client predictions ignored
   - Position bounds enforced
   - State transitions validated

---

## Maintenance

### Updating Game Constants

**To change a cost or rate:**

1. Edit `server/src/config/gameConfig.ts`
2. Deploy server (no database migration needed)
3. Client automatically fetches new values on next load

**Example:**
```typescript
// Change agent base cost from 100 to 150
export const COSTS = {
  AGENT_BASE_COST: 150,  // Changed
  // ... rest unchanged
}
```

No client code changes needed - values propagate automatically.

### Adding New Traits

1. Update `TraitType` in `server/src/types/index.ts`
2. Add trait effects to `server/src/config/gameConfig.ts`
3. Update client's `src/types/agent.ts` (if UI needs trait info)
4. No database migration needed

---

## Success Criteria

✅ Migration successful when:

1. Server starts without errors
2. `/api/config` returns valid JSON
3. Database schema version = 5
4. Client loads without "config not loaded" errors
5. Agent creation costs match between client/server
6. Trance system triggers and auto-continues
7. Position validation rejects out-of-bounds deployments
8. Concurrent operations complete without race conditions

---

## Support

**If issues persist:**

1. Check server logs: `cd server && npm start` (watch console)
2. Check database state: `sqlite3 server/data/teneo.db`
3. Check browser console for client errors
4. Verify TypeScript compilation: `npx tsc --noEmit`

**Database inspection:**
```bash
# Check all migrations applied
sqlite3 server/data/teneo.db "SELECT * FROM schema_info;"

# Check agent trance states
sqlite3 server/data/teneo.db "SELECT id, name, state, trance_active, trance_level FROM agents;"

# Check user points
sqlite3 server/data/teneo.db "SELECT id, wallet, points FROM users;"
```

---

## Summary

This migration establishes server as the authoritative source for all game logic. The client becomes a pure presentation layer that fetches rules from the server. This architecture prevents client-side exploits, eliminates duplication, and makes balance changes deployable without client updates.

**Estimated deployment time:** 5-10 minutes (including database migration)
**Estimated rollback time:** 2 minutes (if needed)
**Zero data loss risk:** Database backed up before migration
