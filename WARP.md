# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Key commands

All commands are expected to run with Node 18+ and npm.

### Install dependencies

- Frontend (Vite React app, at repo root):
  - `npm install`
- Backend (simulation server, in `server/`):
  - `cd server && npm install`

### Frontend (React + TypeScript + Vite)

From the repo root:

- Dev server (hot reload UI):
  - `npm run dev`
- Build production bundle:
  - `npm run build`
- Lint TypeScript/JS:
  - `npm run lint`
- Preview the production build locally (after `npm run build`):
  - `npm run preview`

The frontend is created from the standard `react-ts` Vite template (see `README.md`), with React Compiler disabled and ESLint configured via the default Vite setup.

### Backend (TENEO discovery simulation server)

From `server/`:

- Run server in dev mode (TypeScript via `tsx`, watches `src/index.ts`):
  - `npm run dev`
- Build TypeScript to `dist/` and copy DB schema:
  - `npm run build`
- Start the built server:
  - `npm start`
- Initialize / seed the simulation database (generates spaces + clusters):
  - `npm run db:init`
- From the repo root there is a convenience shortcut that runs the server init script:
  - `npm run db:init`

Useful endpoint for sanity checks:

- Health check (returns simulation status and discovery stats):
  - `curl http://localhost:4000/health`

### Environment and ports

- Frontend dev server (Vite): defaults to `http://localhost:5173`.
- Backend server: listens on `process.env.PORT` or `4000` by default.
- Frontend talks to the backend via:
  - `VITE_API_URL` (HTTP, default `http://localhost:4000`)
  - `VITE_WS_URL` (WebSocket, default `ws://localhost:4000`)

To point the UI at a different backend, set these Vite env vars (for example in a `.env.local` file) and restart `npm run dev`.

The backend uses SQLite with:

- `DATABASE_PATH` env var (optional) to override the DB path.
- Default DB file at `server/data/teneo.db` (relative to the built server).
- `SIMULATION_ENABLED` (set to `'false'` to start the server without running the simulation loop).

### Tests

There are currently **no** `test` scripts defined in the root `package.json` or in `server/package.json`, and no conventional Jest/Vitest test setup. There is therefore no standard command to run a full test suite or a single test yet; if you add one, also update this file.

## High-level architecture

### Overview

This project is a TENEO "Discovery Portal" consisting of:

- A **3D/2D React frontend** (Vite + React Three Fiber) that visualizes a brain volume, agents, and discoverable "spaces", and provides dashboards and controls for deploying agents.
- A **Node.js/Express + WebSocket backend** that maintains a large SQLite-backed simulation of agents exploring spaces, performs time-stepped simulation ticks, and streams world state and discovery events to clients.

The main flow is:

1. The backend initializes a SQLite database with spaces, clusters, users, and agents, and runs a continuous simulation loop.
2. The frontend connects to the backend over HTTP (for mutations and initial state) and WebSocket (for live updates).
3. Users create and configure "agents" with traits, deploy them into regions or specific spaces, and watch the 3D brain visualization update in real time as agents discover spaces and earn loot.

### Frontend architecture

**Entry and routing**

- `src/main.tsx` is the React entry point; it mounts `App` into `#root` and pulls in global styles from `src/index.css`.
- `src/App.tsx` sets up `react-router-dom` routing:
  - `/` → `src/pages/Landing.tsx` (marketing-style landing page with a simplified 3D brain background and discovery stats).
  - `/discovery` → `src/pages/DiscoveryDashboard.tsx` (main interactive discovery experience).

**Global simulation and UI state (Zustand store)**

The core client-side logic is centralized in `src/stores/agentStore.ts`:

- Holds connection state to the backend:
  - Tracks an active `WebSocket` instance (`ws`) and `isConnected` flag.
  - `connect()` / `disconnect()` manage the lifecycle and automatic reconnection.
- Manages **user identity and points**:
  - `loginUser(wallet)` uses `POST /api/users` to either fetch or create a `User` and updates `userId`, `userWallet`, `userPoints`, and `userTier`.
- Manages **agents**:
  - `createAgent(name, traits)` calls `POST /api/agents` on the backend and merges the returned agent + updated user points.
  - `fetchUserAgents()` reads agents for the current user via `GET /api/users/:userId/agents`.
  - `deployAgent`, `deployAgentToRegion`, `deployRandomly`, `recallAgent`, and `refuelAgent` call the respective `/api/agents/...` endpoints.
- Manages **world state and level-of-detail (LOD)**:
  - `fetchWorldState()` calls `GET /api/world`, then splits `spaceClusters` and `agentClusters` into LOD buckets (`spaceClustersLod0/1/2`, `agentClustersLod0/1/2`) used by the 3D/2D views.
  - Utility selectors `getSpaceClustersForLod()` and `getAgentClustersForLod()` return the cluster list for the active LOD.
- Tracks **discovery progress and event feeds**:
  - `discoveryProgress` mirrors the backend's `{ total, discovered, beingSolved }`.
  - `recentDiscoveries` and `recentLoot` track recent `space:discovered` and `loot:distributed` events from the WebSocket.
- Encodes **view and interaction state**:
  - `viewMode`, `showAgentPaths`, `showDiscoveredOnly`, `currentLodLevel` control visualization settings.
- Implements **Trance Mode (time scaling)** purely on the client:
  - Store fields `timeScale`, `tranceActive`, `tranceEndTime`, `tranceAgentId` and actions `triggerTrance`, `endTrance`, `updateTrance` drive a temporary "20x slowdown" effect and auto-deploying an agent when trance ends.
  - `triggerTrance` is activated when a `space:discovered` WebSocket message references one of the user's agents with a `trance` trait.
  - `updateTrance` is called on every frame / via timers to end trance when `tranceEndTime` is reached and then `deployRandomly` the agent.
- The `handleServerMessage` helper processes WebSocket `ServerMessage`s (mirroring the shared types in `src/types/agent.ts`):
  - `state:sync` → refreshes LOD cluster arrays and `discoveryProgress`.
  - `space:discovered` → updates `recentDiscoveries` and optionally triggers Trance Mode.
  - `loot:distributed` → updates `recentLoot`.
  - `agents:update` → merges new agent state into the user's agent list.

This store is the main coordination point between the visualization components and the backend API/WebSocket surface; new frontend features should usually integrate with it rather than introducing independent fetch logic.

**3D/2D visualization stack**

- The 3D experiences are built with **React Three Fiber** + **drei**:
  - `src/pages/DiscoveryDashboard.tsx` renders a `<Canvas>` with a custom `DiscoveryBrainContent` scene component, an `OrbitControls`-driven camera, and keyboard navigation (WASD / arrow keys).
  - The scene composes several visual layers from `src/components/brain/*`:
    - `BrainParticles` and `SynapseParticles` render the brain volume and background particle field.
    - `SpaceMarkers` draw discoverable space clusters based on the current LOD selection and route clicks back into React to open deployment dialogs.
    - `AgentMarkers` render user agents and aggregated `agentClusters`.
    - `BurnParticles` and `ElectronFlow` provide visual feedback for point burning and recent discoveries.
    - `SynapseNetwork` uses the stable LOD0 `spaceClusters` to render persistent connection lines between discovered regions.
- `DiscoveryDashboard` also owns **camera/LOD coordination**:
  - Tracks camera distance and chooses an LOD (0/1/2) using hysteresis to avoid thrashing.
  - Exposes `zoomInfo` (distance + lod) to the UI overlay and uses `zoomTarget` to drive smooth camera motions when the user clicks a recent discovery in the sidebar.
- A 2D top-down visualization `TopDownView` (also in `src/components/brain`) offers a simplified map-like representation of clusters and agents.
- `src/hooks/useScaledTime.ts` provides a shared, time-scaled clock using React Three Fiber's `useFrame`, multiplying elapsed time by the current `timeScale` from the store; this is intended for animations that need to respect Trance Mode.

**UI shell and dashboards**

- `src/pages/Landing.tsx` is a single-page marketing overview that:
  - Connects to the WebSocket and calls `fetchWorldState()` on mount.
  - Displays global discovery stats and a live connection indicator.
  - Renders `LandingBrainScene`, a simplified 3D background scene built from the same `BrainParticles` / `SynapseParticles` primitives.
- `src/pages/DiscoveryDashboard.tsx` is the main operational dashboard:
  - Left sidebar (`AgentPanel` from `src/components/agents/AgentPanel.tsx`) for creating agents, inspecting traits and fuel, refueling, deploying randomly, and recalling.
  - Center canvas area for the 3D/2D brain.
  - Right sidebar (internal JSX in `DiscoveryDashboard.tsx`) summarizing global discovery metrics, per-user stats, recent discoveries (clickable to zoom the camera), and live agent statuses.
  - A modal `DeploymentDialog` (in `src/components/agents/DeploymentDialog.tsx`) used to deploy agents into specific clusters.
- `src/components/ui/*` contains Tailwind/Radix-style primitive components (`button`, `card`, `dialog`, `progress`, etc.) shared across pages.

**Shared types and data**

- `src/types/agent.ts` defines the core domain model used by the frontend:
  - Agent, Space, AgentCluster, SpaceCluster, DiscoveryProgress, User, and events (`SpaceDiscoveryEvent`, `LootEvent`).
  - Trait system (`TraitType`, `AgentTrait`) including a frontend-only `trance` trait used to drive the client-side Trance Mode.
  - `TIER_LIMITS`, `getAgentLimit`, and `TRAIT_EFFECTS` encoding tier limits and trait semantics for UI presentation.
- `src/types/index.ts` simply re-exports the agent types for convenience.
- `src/data/*.json` and `src/scripts/schema.sql` define a separate, static mock data model and schema for brain regions, users, synapse nodes, etc. These were used to bootstrap the concept and are largely superseded by the live simulation in `server/`. They are still useful as reference for dashboard-style aggregations and database structure ideas, but the production-of-record state is in the server's SQLite schema.

### Backend architecture

**Server entrypoint and HTTP/WebSocket surface**

- `server/src/index.ts` is the entrypoint for the simulation server:
  - Initializes the SQLite database via `initializeDatabase()` and `ensureDatabaseSeeded()` from `server/src/db/index.ts`.
  - Configures an Express app with CORS and JSON body parsing.
  - Wraps the Express app in an HTTP server and attaches a `WebSocketServer` from `ws`.
- **REST API** endpoints:
  - `GET /health` — returns current simulation status, tick count, number of agents, and discovery stats from the DB.
  - `POST /api/users` — lookup or create a `User` record by wallet; initializes new users with starting points and tier `free`.
  - `GET /api/users/:userId/agents` — returns all agents owned by the given user.
  - `POST /api/agents` — creates an agent for a user, enforcing per-tier agent limits and deducting points based on traits.
  - `POST /api/agents/:agentId/deploy` — legacy deployment to a specific `Space` by ID (straight-line travel).
  - `POST /api/agents/:agentId/deploy-to-region` — new deployment mode: starts the agent in `searching` state at a given position, letting the simulation wander and auto-discover nearby spaces.
  - `POST /api/agents/:agentId/recall` — recalls an agent back to idle, removing it from any active solvers.
  - `POST /api/agents/:agentId/refuel` — transfers points from the owning `User` to the agent's `pointsBalance`.
  - `GET /api/world` — returns the current `WorldState` snapshot (LOD 0–2 `spaceClusters` and `agentClusters`, plus global discovery stats). `userAgents` is left empty; the frontend loads per-user agent state separately.
  - `GET /api/spaces/:spaceId` — returns details for a given `Space`.
- **WebSocket API** (using `ServerMessage` / `ClientMessage` types from `server/src/types/index.ts`):
  - Every new connection receives an initial `state:sync` snapshot built from the LOD0–2 cluster tables and current discovery stats.
  - Incoming messages allow clients to deploy, recall, and refuel agents without going through REST for everything:
    - `agent:deploy`, `agent:recall`, `agent:refuel`.
  - Outgoing broadcasts:
    - Periodic `state:sync` messages (every 5 seconds) using LOD0 clusters for lighter-weight updates.
    - `space:discovered` when a space reaches discovered state, including loot distribution and coordinates.
    - `loot:distributed` events as loot allocations are written.
    - `agents:update` with updated positions/points/state for a subset of agents.
  - `broadcast()` fans out messages to all connected WebSocket clients; the simulation engine registers callbacks to emit events into this channel.

**Database layer and schema**

- `server/src/db/index.ts` encapsulates all direct SQLite access using `better-sqlite3`:
  - Connects to `DATABASE_PATH` or a default `teneo.db` and enables WAL mode.
  - Runs the core schema from `server/src/db/schema.sql` during `initializeDatabase()`, followed by `runMigrations()`.
  - `ensureDatabaseSeeded()` checks whether there are any spaces; if none, it dynamically imports `./generateSpaces.js` and calls `generateSpaces()` and `generateSpaceClusters()` to populate the `spaces` and `space_clusters` tables.
- The DB exposes high-level operations grouped by domain:
  - **Spaces**:
    - `getSpace`, `getSpacesByRegion`, `getSpacesByState`.
    - `updateSpace` (partial updates of `state`, `solveProgress`, `discoveredAt`).
    - `getSpaceSolvers`, `addSpaceSolver`, `removeSpaceSolver`, `clearSpaceSolvers` to manage agents currently solving a space.
    - `findNearestUndiscoveredSpace(x,y,z,radius)` to support the search-mode behavior in the simulation.
  - **Agents**:
    - `getAgent`, `getAgentsByOwner`, `getAgentsByState`, `getActiveAgents`.
    - `createAgent`, `updateAgent`, `batchUpdateAgents` handling persistence and incremental updates for many agents per tick.
  - **Users**:
    - `getUser`, `getUserByWallet`, `createUser`, `updateUser` (points, total loot, tier, staked amount).
  - **Clusters and stats**:
    - `getAgentClusters`, `getSpaceClusters` return precomputed LOD clusters for visualization.
    - `recomputeSpaceClusters` and `recomputeAgentClusters` periodically rebuild these cluster tables (see "Simulation engine" below).
    - `getDiscoveryStats` (counts of total/discovered/being_solved spaces).
    - `getAgentCount`.
  - **Simulation state**:
    - `getSimulationState` / `updateSimulationState` maintain a `simulation_state` singleton row tracking tick count and last tick time.
- `server/src/db/migrations.ts` defines a small migration framework:
  - Maintains a `schema_migrations` table and a list of numbered `Migration` objects.
  - Current migrations add travel start position columns and wander parameters to the `agents` table.
  - `runMigrations()` runs all pending migrations in a transaction and records their application.

**Simulation engine**

- `server/src/simulation/engine.ts` is a tick-based simulation that moves agents, consumes points, discovers spaces, and writes discovery/loot events:
  - Configuration constants control tick interval (`TICK_INTERVAL_MS`), base burn rate, base travel speed, search speed, detection radius, wander behavior, and brain bounds.
  - **Trait effects** are implemented procedurally:
    - `efficient` reduces burn rate.
    - `swift` speeds up travel and search movement.
    - `explorer` and `collaborative` increase solve probability, especially with multiple solvers.
    - `staker` and `lucky` influence loot share and occasional bonus multipliers.
  - **Movement and search**:
    - Agents in `searching` state run an organic wandering algorithm (`updateWanderDirection`, `applyBrainBounds`) and move within a bounded brain volume.
    - At each tick, the engine looks for an undiscovered space within `DETECTION_RADIUS` via `findNearestUndiscoveredSpace`; when found, the agent snaps to it and switches to `solving`.
    - In `traveling` state (legacy direct-to-space mode), positions are interpolated between recorded `startPosition*` and the target space position based on elapsed vs. `travelDuration`.
  - **Solving and discovery**:
    - Agents in `solving` state have a per-tick chance to solve their target space based on `calculateSolveProbability` which factors in agent traits and the number of concurrent solvers.
    - On success, `solveSpace`:
      - Marks the space as discovered, clears space solvers, and distributes the space's `lootPool` among solvers according to `calculateLootShare`.
      - Records a discovery event and loot distributions in dedicated tables.
      - Invokes the `discoveryCallback` and `lootCallback` (wired in `server/src/index.ts` to broadcast WebSocket events).
  - **Tick loop**:
    - `startSimulation()` reads the saved tick count, then enters an async `tick()` loop scheduled with `setTimeout` to approximately match `TICK_INTERVAL_MS` while accounting for processing time.
    - Each `processTick()`:
      - Pulls all active agents from the DB.
      - For each agent, computes points burned this tick, transitions state (idle/searching/traveling/solving) as needed, and enqueues partial updates.
      - Uses `batchUpdateAgents` to persist changes.
      - Notifies the `agentUpdateCallback` with updated agent records for broadcasting.
    - Every 10 ticks it calls `updateSimulationState` to persist tick count; every 30 ticks it recomputes clusters with `recomputeSpaceClusters` and `recomputeAgentClusters`.

**Backend types and alignment with frontend**

- `server/src/types/index.ts` defines the backend's core types (Agent, Space, AgentCluster, SpaceCluster, User, WorldState, ClientMessage, ServerMessage, etc.). These mirror, but do not strictly share, the frontend types in `src/types/agent.ts`.
- Notable differences:
  - Backend `TraitType` does **not** include the frontend-only `trance` trait; trance behavior is implemented entirely in the client store and visualization.
  - Backend `getAgentLimit` uses `TIER_LIMITS` and staking thresholds to enforce hard agent limits; the frontend has its own `getAgentLimit` for display that should be kept in sync conceptually.

### How pieces fit together

- **Data of record** lives in the backend's SQLite DB (`server/src/db`) and is the single source of truth for:
  - Spaces and their discovery state.
  - Agents, their positions, state, fuel, and accumulated loot.
  - Per-tier limits, cluster aggregates, and discovery statistics.
- The **simulation engine** is the only code that mutates simulation state continuously; all other code (REST, WebSocket handlers) either reads from DB or triggers small, explicit state transitions (deploy, recall, refuel).
- The **frontend** treats the backend as authoritative:
  - It receives regular `state:sync` snapshots and incremental `agents:update` / `space:discovered` / `loot:distributed` events.
  - Its local state (`useAgentStore`) mostly mirrors backend structures plus some extra UI-only fields (Trance Mode, view options, recent event buffers).
  - 3D/2D visualizations are thin layers over the LOD cluster and agent arrays, plus per-frame hooks for animation.

When making cross-cutting changes (for example, adding new agent traits, modifying the loot model, or changing how LOD clustering works), plan to touch:

- Backend types and simulation logic in `server/src/types/index.ts`, `server/src/simulation/engine.ts`, and relevant DB schema/migrations.
- Frontend types and projections in `src/types/agent.ts` and `src/stores/agentStore.ts`.
- Any visualization components that assume particular states, trait names, or cluster structures under `src/components/brain` and `src/components/agents`.
