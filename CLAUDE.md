# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important

**Never start the server.** The user manages server processes manually.

## Commands

### Development

```bash
# Frontend (from repo root)
npm install          # Install frontend dependencies
npm run dev          # Start Vite dev server (port 5176)
npm run build        # Build production bundle
npm run lint         # Run ESLint
npm run preview      # Preview production build

# Backend (from server/)
cd server && npm install    # Install server dependencies
cd server && npm run dev    # Start server with hot reload (port 4000)
cd server && npm run build  # Build TypeScript to dist/
cd server && npm start      # Run built server

# Database
npm run db:init      # Initialize/seed database (from repo root)
```

### Verification

```bash
# Type check
npx tsc --noEmit                    # Frontend
cd server && npx tsc --noEmit       # Backend

# Health check
curl http://localhost:4000/health
curl http://localhost:4000/api/config
```

## Architecture

This is a full-stack 3D exploration game with a brain-themed visualization. Users deploy "agents" (ships) to discover "synapses" (spaces) and earn rewards.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SolidJS, Vite, Tailwind CSS 4, Three.js |
| State | SolidJS stores, @tanstack/solid-query |
| Auth | wagmi/viem (wallet), JWT tokens |
| Backend | Express, WebSocket (ws), SQLite (better-sqlite3) |
| UI Components | @kobalte/core, lucide-solid icons |

### Project Structure

```
src/
├── components/
│   ├── brain/       # 3D visualization (AgentMarkers, SpaceMarkers, etc.)
│   ├── dashboard/   # UI panels (BrainSceneMinimal, SynapseListPanel)
│   ├── ui/          # Reusable components (button, card, dialog)
│   └── ships/       # Ship management UI
├── stores/          # SolidJS reactive stores
│   ├── authStore    # Wallet & JWT auth
│   ├── userStore    # User progress, levels
│   ├── shipStore    # Ships, synapses, clusters
│   └── configStore  # Server-provided game config
├── three/           # Custom Three.js integration for SolidJS
├── pages/           # DiscoveryDashboard, Landing
└── types/game.ts    # Shared type definitions

server/src/
├── index.ts              # Express + WebSocket server entry
├── config/gameConfig.ts  # Centralized game constants
├── db/
│   ├── index.ts          # Database operations (150+ functions)
│   ├── schema.sql        # SQLite schema
│   └── migrations.ts     # Database migrations
├── routes/               # REST API endpoints
└── simulation/engine.ts  # Game tick simulation
```

### Key Architectural Patterns

**Server-Authoritative**: All business logic lives on the server. Client fetches config from `/api/config` and acts as a presentation layer. Game constants (costs, rates, traits) are defined in `server/src/config/gameConfig.ts`.

**Real-time Updates**: WebSocket broadcasts `state:sync`, `space:discovered`, `agents:update` events. Client subscribes via `useWebSocketConnection` hook.

**LOD (Level of Detail)**: Large datasets (200M+ synapses) use precomputed clusters at LOD 0/1/2. Camera distance determines which LOD to render.

**Custom Three.js Integration**: No React Three Fiber—uses vanilla Three.js with SolidJS via `src/three/` (ThreeCanvas, ThreeContext, useFrame hook).

### Database

SQLite with WAL mode at `server/data/teneo.db`. Core tables:
- `spaces` - Discoverable synapses with position, state, loot
- `agents` - User ships with traits, fuel, position
- `users` - Player accounts with wallet, points, tier
- `space_clusters` / `agent_clusters` - Precomputed LOD data

### Environment

```bash
# .env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
DATABASE_PATH=./server/data/teneo.db
PORT=4000
```

## Cross-Cutting Changes

When modifying game mechanics, update:
1. `server/src/config/gameConfig.ts` - Server constants
2. `server/src/types/index.ts` - Backend types
3. `src/types/game.ts` - Frontend types
4. `server/src/simulation/engine.ts` - Simulation logic
5. `src/stores/` - Affected stores (shipStore, configStore)

For new database fields, add migration in `server/src/db/migrations.ts`.
