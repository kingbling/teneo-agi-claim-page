#!/bin/bash

# Teneo Discovery Portal - Start Script
# Usage: ./start.sh [dev|prod|docker|stop]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if database exists, if not generate spaces
init_database() {
    if [ ! -f "server/data/teneo.db" ]; then
        print_warning "Database not found. Initializing with 100K spaces..."
        cd server
        npm run db:init
        cd ..
        print_status "Database initialized with spaces and test agents"
    else
        print_status "Database found"
    fi
}

case "${1:-docker-dev}" in
    local)
        echo ""
        echo "=========================================="
        echo "  Teneo Discovery Portal - Development"
        echo "=========================================="
        echo ""

        # Check dependencies
        if [ ! -d "node_modules" ]; then
            print_warning "Installing frontend dependencies..."
            npm install
        fi

        if [ ! -d "server/node_modules" ]; then
            print_warning "Installing server dependencies..."
            cd server && npm install && cd ..
        fi

        # Build server if needed
        if [ ! -d "server/dist" ]; then
            print_warning "Building server..."
            cd server && npm run build && cd ..
        fi

        # Initialize database
        init_database

        print_status "Starting server on port 4000..."
        print_status "Starting frontend on port 5175..."
        echo ""

        # Start both in parallel
        (cd server && npm run dev) &
        SERVER_PID=$!

        sleep 2
        npm run dev &
        FRONTEND_PID=$!

        # Wait for interrupt
        trap "kill $SERVER_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

        echo ""
        print_status "Server: http://localhost:4000"
        print_status "Frontend: http://localhost:5175"
        print_status "Discovery: http://localhost:5175/discovery"
        print_status "Health check: http://localhost:4000/health"
        echo ""
        print_warning "Press Ctrl+C to stop"

        wait
        ;;

    prod)
        echo ""
        echo "=========================================="
        echo "  Teneo Discovery Portal - Production"
        echo "=========================================="
        echo ""

        # Build everything
        print_status "Building server..."
        cd server && npm ci && npm run build && cd ..

        print_status "Building frontend..."
        npm ci && npm run build

        # Initialize database
        init_database

        print_status "Starting server on port 4000..."
        cd server && NODE_ENV=production node dist/index.js &
        SERVER_PID=$!
        cd ..

        sleep 2

        print_status "Starting frontend on port 4444..."
        npx serve -s dist -l 4444 &
        FRONTEND_PID=$!

        trap "kill $SERVER_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

        echo ""
        print_status "Server: http://localhost:4000"
        print_status "Frontend: http://localhost:4444"
        echo ""

        wait
        ;;

    docker)
        echo ""
        echo "=========================================="
        echo "  Teneo Discovery Portal - Docker (Prod)"
        echo "=========================================="
        echo ""

        print_status "Building and starting Docker containers..."
        docker-compose up -d --build

        echo ""
        print_status "Containers started!"
        print_status "Server: http://localhost:4000"
        print_status "Frontend: http://localhost:4444"
        print_status "Health check: http://localhost:4000/health"
        echo ""
        print_warning "Run './start.sh stop' to stop containers"
        print_warning "Run 'docker-compose logs -f' to view logs"
        ;;

    docker-dev)
        echo ""
        echo "=========================================="
        echo "  Teneo Discovery Portal - Docker Dev"
        echo "=========================================="
        echo ""

        # Check if Docker is running
        if ! docker info >/dev/null 2>&1; then
            print_error "Docker is not running!"
            echo ""
            echo "Please start Docker Desktop first, then run ./start.sh again"
            echo ""
            # Try to open Docker Desktop on macOS
            if [[ "$OSTYPE" == "darwin"* ]]; then
                print_warning "Attempting to start Docker Desktop..."
                open -a Docker
                echo "Waiting for Docker to start (this may take a minute)..."
                while ! docker info >/dev/null 2>&1; do
                    sleep 2
                done
                print_status "Docker is now running!"
            else
                exit 1
            fi
        fi

        # Stop any existing containers first (including orphans)
        docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null
        docker-compose down --remove-orphans 2>/dev/null

        # Kill any processes on our ports
        lsof -ti:4444 | xargs kill -9 2>/dev/null
        lsof -ti:5175 | xargs kill -9 2>/dev/null

        # Clean up dangling images to avoid cache issues
        docker image prune -f 2>/dev/null

        print_status "Building and starting dev container with tmux..."
        docker-compose -f docker-compose.dev.yml build --no-cache
        docker-compose -f docker-compose.dev.yml up -d

        echo ""
        print_status "Container started with hot reload!"
        print_status "Server: http://localhost:4444"
        print_status "Frontend: http://localhost:5175"
        echo ""
        print_warning "Split view layout:"
        echo "  ┌─────────────────────────┐"
        echo "  │  SERVER (port 4444)     │"
        echo "  ├─────────────────────────┤"
        echo "  │  FRONTEND (port 5175)   │"
        echo "  └─────────────────────────┘"
        echo ""
        print_warning "Tmux shortcuts:"
        echo "  Ctrl+B, ↑/↓  - Switch between panes"
        echo "  Ctrl+B, z    - Zoom current pane (toggle)"
        echo "  Ctrl+B, d    - Detach (keeps running)"
        echo ""

        # Wait a moment for tmux to initialize
        sleep 2

        print_status "Attaching to tmux session..."
        docker exec -it poc-teneo-dev-1 tmux attach -t teneo
        ;;

    attach)
        print_status "Attaching to tmux session..."
        docker exec -it poc-teneo-dev-1 tmux attach -t teneo
        ;;

    stop)
        echo ""
        print_status "Stopping Docker containers..."
        docker-compose down 2>/dev/null || true
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
        print_status "Containers stopped"
        ;;

    logs)
        docker-compose logs -f 2>/dev/null || docker-compose -f docker-compose.dev.yml logs -f
        ;;

    status)
        echo ""
        echo "=== Docker Status ==="
        docker-compose ps 2>/dev/null || docker-compose -f docker-compose.dev.yml ps
        echo ""
        echo "=== Health Check ==="
        curl -s http://localhost:4000/health | jq . 2>/dev/null || print_error "Server not responding"
        ;;

    *)
        echo "Usage: ./start.sh [command]"
        echo ""
        echo "Commands:"
        echo "  (default)  - Start Docker with tmux split view + hot reload"
        echo "  attach     - Attach to tmux session"
        echo "  stop       - Stop Docker containers"
        echo "  logs       - View Docker logs"
        echo "  status     - Check status"
        echo ""
        echo "Other:"
        echo "  local      - Run locally without Docker"
        echo "  prod       - Production mode locally"
        echo "  docker     - Docker production build"
        exit 1
        ;;
esac
