# Rough Idea: Fix Current Game - WebSocket Architecture Enhancement

## Project Overview
Fix and enhance the current 3D exploration game by centralizing business logic in the WebSocket backend and improving the frontend user experience.

## Core Requirements

### Business Logic
- Move all business logic to WebSocket (Go backend)
- WebSocket should control ship steering and rotation

### User Experience & Animations
The user should see smooth animations for all interactions:
1. User selects synapses to deploy to
2. User can select a ship
3. Ship starts autorotating toward new coordinates
4. Ship starts flying to synapse
5. Ship arrives at synapse
6. Ship starts solving synapse

### Interaction Features
- User can either follow the ship or fly around freely
- User should see tooltips for Synapses
- User should be able to filter Synapses by their own Level

### Ship Status
- Ship should show status in legend
- Currently only "idle" status works; need to implement all states

### Code Quality
- Remove old unused code
- Remove mocked code
- Remove todos/TODO comments
- Remove duplicate code

## Success Criteria
- All requirements implemented
- Tests passing with >80% coverage
- No linter errors
- Documentation updated

## Technical Constraints
- Frontend runs at localhost:5177
- WebSocket in Go on port 4000
- Never start the server (auto-restarting)
- Use agent-browser or playwright for frontend checks
- Use agent-browser to view console.logs from frontend
- Align DTOs from WebSocket with frontend

## Current Tech Stack
- Frontend: SolidJS (not React - based on codebase)
- Backend: Go with WebSocket
- 3D: Three.js
- Database: SQLite
