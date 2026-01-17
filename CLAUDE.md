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

# Backend (Go - from server-go/)
cd server-go && go build -o bin/server ./cmd/server    # Build server
cd server-go && ./bin/server                            # Run server (port 4000)

# Using start script
./start.sh dev         # Start both frontend and Go server in tmux
./start.sh watch       # Auto-redeploy on code changes
./start.sh stop        # Stop all services
```

### Verification

```bash
# Type check
npx tsc --noEmit       # Frontend

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
| Backend | Go (net/http, gorilla/websocket), SQLite (modernc.org/sqlite) |
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

server-go/
├── cmd/server/main.go    # Server entry point
├── internal/
│   ├── config/           # Game configuration
│   ├── db/               # Database operations
│   ├── dto/              # Data transfer objects
│   ├── handlers/         # HTTP handlers
│   ├── middleware/       # Auth middleware
│   ├── models/           # Database models
│   ├── simulation/       # Game tick simulation
│   └── websocket/        # WebSocket hub
└── data/                 # SQLite database (teneo.db)
```

### Key Architectural Patterns

**Server-Authoritative**: All business logic lives on the server. Client fetches config from `/api/config` and acts as a presentation layer. Game constants (costs, rates, traits) are defined in `server-go/internal/config/`.

**Real-time Updates**: WebSocket broadcasts `state:sync`, `space:discovered`, `agents:update` events. Client subscribes via `useWebSocketConnection` hook.

**LOD (Level of Detail)**: Large datasets (200M+ synapses) use precomputed clusters at LOD 0/1/2. Camera distance determines which LOD to render.

**Custom Three.js Integration**: No React Three Fiber—uses vanilla Three.js with SolidJS via `src/three/` (ThreeCanvas, ThreeContext, useFrame hook).

### Database

SQLite with WAL mode at `server-go/data/teneo.db`. Core tables:
- `spaces` - Discoverable synapses with position, state, loot
- `agents` - User ships with traits, fuel, position
- `users` - Player accounts with wallet, points, tier
- `space_clusters` / `agent_clusters` - Precomputed LOD data

### Environment

```bash
# .env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
DATABASE_PATH=./server-go/data/teneo.db
PORT=4000
```

## Cross-Cutting Changes

When modifying game mechanics, update:
1. `server-go/internal/config/` - Server constants
2. `server-go/internal/dto/` - Backend types
3. `src/types/game.ts` - Frontend types
4. `server-go/internal/simulation/` - Simulation logic
5. `src/stores/` - Affected stores (shipStore, configStore)

For new database fields, update models in `server-go/internal/models/`.
