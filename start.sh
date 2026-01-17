#!/bin/bash

# Teneo Discovery Portal - Start Script
# Usage: ./start.sh [dev|watch|local|prod|docker|stop]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_info() {
    echo -e "${CYAN}[i]${NC} $1"
}

# Wrapper for tmux commands that might hang (only for kill/list operations)
tmux_safe_kill() {
    # Run in background with timeout to prevent tmux hangs
    tmux "$@" 2>/dev/null &
    local TMUX_PID=$!
    sleep 1.5
    kill $TMUX_PID 2>/dev/null || true
    wait $TMUX_PID 2>/dev/null || true
}

# Normal tmux commands (no timeout wrapper)
tmux_run() {
    tmux "$@"
}

# Gracefully stop processes on specified ports
graceful_stop() {
    local ports="$1"
    local service_name="$2"

    for port in $ports; do
        local pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            print_info "Stopping $service_name on port $port (PID: $pid)..."
            kill -TERM $pid 2>/dev/null || true

            # Wait up to 5 seconds for graceful shutdown
            local count=0
            while [ $count -lt 50 ] && lsof -ti:$port >/dev/null 2>&1; do
                sleep 0.1
                count=$((count + 1))
            done

            # Force kill if still running
            if lsof -ti:$port >/dev/null 2>&1; then
                print_warning "Force stopping $service_name on port $port..."
                kill -9 $pid 2>/dev/null || true
            fi
            print_status "$service_name stopped on port $port"
        fi
    done
}

# Check if database exists, if not generate spaces
init_database() {
    if [ ! -f "server-go/data/teneo.db" ]; then
        print_warning "Database not found. Run Go server to initialize..."
        mkdir -p server-go/data
        print_status "Database directory created"
    else
        print_status "Database found"
    fi
}

# Get next available tmux session number
get_next_session_number() {
    local num=1
    while timeout 1s tmux has-session -t "teneo-$num" 2>/dev/null; do
        num=$((num + 1))
    done
    echo $num
}

# Start tmux mode with split panes
tmux_mode() {
    echo ""
    echo "=========================================="
    echo "  Teneo Discovery Portal - Tmux Dev"
    echo "=========================================="
    echo ""

    # Ensure air is installed (check Go version, not R language air)
    if [ ! -x "$HOME/go/bin/air" ]; then
        print_warning "Installing 'air' for Go hot reload..."
        go install github.com/cosmtrek/air@latest
    fi

    # Check dependencies
    if [ ! -d "node_modules" ]; then
        print_warning "Installing frontend dependencies..."
        npm install
    fi

    # Get session number
    SESSION_NUM=$(get_next_session_number)
    SESSION_NAME="teneo-$SESSION_NUM"

    # Initialize database
    init_database

    # Create tmux session with shell
    timeout 3s tmux new-session -d -s "$SESSION_NAME" -n "teneo" -c "$PWD" || {
        print_error "Failed to create tmux session. Try: ./start.sh stop"
        exit 1
    }

    # Wait for session to be ready
    sleep 0.5

    # Create logs directory
    mkdir -p logs
    rm -f logs/server.log logs/frontend.log

    # Left pane: Go server with air (use full path to avoid R language air)
    timeout 2s tmux send-keys -t "$SESSION_NAME:1" "cd server-go && ~/go/bin/air" C-m || {
        print_error "Failed to send keys to pane 0"
        exit 1
    }
    # Start logging for left pane
    sleep 0.2
    timeout 2s tmux pipe-pane -o -t "$SESSION_NAME:1" "cat >> logs/server.log"

    sleep 0.3

    # Split vertically for frontend
    timeout 2s tmux split-window -h -t "$SESSION_NAME:1" -c "$PWD" "npm run dev" || {
        print_error "Failed to create split pane"
        exit 1
    }
    # Start logging for right pane
    sleep 0.2
    timeout 2s tmux pipe-pane -o -t "$SESSION_NAME:1.{right}" "cat >> logs/frontend.log"

    # Attach
    echo ""
    print_status "Session: $SESSION_NAME"
    print_status "Left:  Go server (air hot reload on port 4000)"
    print_status "Right: Frontend (Vite HMR on port 5176)"
    print_status "Logs:  logs/server.log, logs/frontend.log"
    echo ""
    print_warning "Tmux shortcuts:"
    echo "  Ctrl+B, ↑/↓  - Switch between panes"
    echo "  Ctrl+B, o    - Cycle panes"
    echo "  Ctrl+B, z    - Zoom current pane (toggle)"
    echo "  Ctrl+B, d    - Detach (keeps running)"
    echo ""
    tmux attach -t "$SESSION_NAME"
}

# Build Go server
build_go_server() {
    print_info "Building Go server..."
    cd server-go && go build -o bin/server ./cmd/server && cd ..
    print_status "Go server built"
}

# Start Go server
start_go_server() {
    cd server-go && DATABASE_PATH="$(pwd)/data/teneo.db" ./bin/server 2>&1 | tee "../logs/server.log" &
    echo $!
}

# Start frontend
start_frontend() {
    npm run dev 2>&1 | tee logs/frontend.log &
    echo $!
}

# Watch mode with auto-redeploy
watch_mode() {
    echo ""
    echo "=========================================="
    echo "  Teneo Discovery Portal - Watch Mode"
    echo "=========================================="
    echo ""
    print_warning "Auto-reload enabled for Go and frontend changes"
    print_warning "Press Ctrl+C to stop"
    echo ""

    PROJECT_DIR="$(pwd)"
    cd "$PROJECT_DIR"

    # Create fresh logs directory
    rm -rf logs
    mkdir -p logs
    print_status "Logs cleared"

    # Check dependencies
    if [ ! -d "node_modules" ]; then
        print_warning "Installing frontend dependencies..."
        npm install
    fi

    # Initialize database
    init_database

    # Initial build
    build_go_server

    # Track process IDs
    SERVER_PID=""
    FRONTEND_PID=""
    SERVER_HASH=""
    FRONTEND_HASH=""

    # Function to restart Go server
    restart_go_server() {
        if [ -n "$SERVER_PID" ]; then
            print_info "Restarting Go server..."
            graceful_stop "4000" "Go server"
        fi

        build_go_server
        SERVER_PID=$(start_go_server)
        sleep 2

        # Verify server started
        if curl -s http://localhost:4000/health >/dev/null 2>&1; then
            print_status "Go server restarted (PID: $SERVER_PID)"
        else
            print_error "Go server failed to start"
        fi
    }

    # Function to restart frontend
    restart_frontend() {
        if [ -n "$FRONTEND_PID" ]; then
            print_info "Restarting frontend..."
            graceful_stop "5176" "Frontend"
        fi

        FRONTEND_PID=$(start_frontend)
        sleep 2

        # Verify frontend started
        if curl -s http://localhost:5176 >/dev/null 2>&1; then
            print_status "Frontend restarted (PID: $FRONTEND_PID)"
        else
            print_error "Frontend failed to start"
        fi
    }

    # Initial start
    print_status "Starting servers..."
    SERVER_PID=$(start_go_server)
    FRONTEND_PID=$(start_frontend)

    sleep 2

    echo ""
    print_status "Server: http://localhost:4000"
    print_status "Frontend: http://localhost:5176"
    print_status "Discovery: http://localhost:5176/discovery"
    echo ""
    print_info "Watching for changes..."
    echo ""

    # Calculate initial hashes
    SERVER_HASH=$(find server-go -name '*.go' -type f 2>/dev/null | xargs cat 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1)
    FRONTEND_HASH=$(find src -type f 2>/dev/null | xargs cat 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1)

    # Setup signal handlers for graceful shutdown
    cleanup() {
        echo ""
        print_info "Shutting down..."
        graceful_stop "4000 5176" "services"
        exit 0
    }
    trap cleanup INT TERM

    # Watch loop
    WATCH_INTERVAL=2
    while true; do
        sleep $WATCH_INTERVAL

        # Check Go server for changes
        CURRENT_SERVER_HASH=$(find server-go -name '*.go' -type f 2>/dev/null | xargs cat 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1)
        if [ "$CURRENT_SERVER_HASH" != "$SERVER_HASH" ]; then
            echo ""
            print_warning "Go code changed!"
            SERVER_HASH="$CURRENT_SERVER_HASH"
            restart_go_server
            echo ""
            print_info "Watching for changes..."
        fi

        # Check frontend for changes (excluding node_modules and build artifacts)
        CURRENT_FRONTEND_HASH=$(find src -type f 2>/dev/null | grep -v node_modules | grep -v dist | xargs cat 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1)
        if [ "$CURRENT_FRONTEND_HASH" != "$FRONTEND_HASH" ]; then
            echo ""
            print_warning "Frontend code changed!"
            FRONTEND_HASH="$CURRENT_FRONTEND_HASH"
            # Vite handles hot reload, but we can log it
            print_info "Frontend changes detected (Vite will hot reload)"
            echo ""
            print_info "Watching for changes..."
        fi

        # Check if processes are still running
        if ! kill -0 $SERVER_PID 2>/dev/null; then
            echo ""
            print_warning "Go server died, restarting..."
            restart_go_server
            echo ""
            print_info "Watching for changes..."
        fi

        if ! kill -0 $FRONTEND_PID 2>/dev/null; then
            echo ""
            print_warning "Frontend died, restarting..."
            restart_frontend
            echo ""
            print_info "Watching for changes..."
        fi
    done
}

case "${1:-tmux}" in
    tmux)
        tmux_mode
        ;;

    watch)
        watch_mode
        ;;

    dev)
        echo ""
        echo "=========================================="
        echo "  Teneo Discovery Portal - Local Dev"
        echo "=========================================="
        echo ""

        # Kill old processes on ports
        print_warning "Stopping existing services..."
        graceful_stop "4000 5176" "services"

        # Create fresh logs directory
        rm -rf logs
        mkdir -p logs
        print_status "Logs cleared"

        # Check dependencies
        if [ ! -d "node_modules" ]; then
            print_warning "Installing frontend dependencies..."
            npm install
        fi

        # Build Go server if needed
        if [ ! -f "server-go/bin/server" ] || [ "$(find server-go -name '*.go' -newer server-go/bin/server 2>/dev/null | head -1)" ]; then
            print_warning "Building Go server..."
            cd server-go && go build -o bin/server ./cmd/server && cd ..
        fi

        # Initialize database
        init_database

        print_status "Starting Go server on port 4000..."
        print_status "Starting frontend on port 5176..."
        echo ""

        # Start Go server with log streaming
        (cd server-go && DATABASE_PATH="$(pwd)/data/teneo.db" ./bin/server 2>&1 | tee "../logs/server.log") &
        SERVER_PID=$!

        sleep 2
        npm run dev 2>&1 | tee logs/frontend.log &
        FRONTEND_PID=$!

        # Setup graceful shutdown
        shutdown() {
            echo ""
            print_info "Shutting down..."
            graceful_stop "4000 5176" "services"
            exit 0
        }
        trap shutdown INT TERM

        echo ""
        print_status "Server: http://localhost:4000"
        print_status "Frontend: http://localhost:5176"
        print_status "Discovery: http://localhost:5176/discovery"
        print_status "Logs: logs/server.log, logs/frontend.log"
        echo ""
        print_warning "Press Ctrl+C to stop"
        echo ""

        # Show both outputs in real-time
        tail -f logs/server.log 2>/dev/null &
        TAIL_PID=$!

        wait
        kill $TAIL_PID 2>/dev/null || true
        ;;

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

        # Build Go server if needed
        if [ ! -f "server-go/bin/server" ] || [ "$(find server-go -name '*.go' -newer server-go/bin/server 2>/dev/null | head -1)" ]; then
            print_warning "Building Go server..."
            cd server-go && go build -o bin/server ./cmd/server && cd ..
        fi

        # Initialize database
        init_database

        # Create fresh logs directory
        rm -rf logs
        mkdir -p logs
        print_status "Logs cleared"

        print_status "Starting Go server on port 4000..."
        print_status "Starting frontend on port 5176..."
        echo ""

        # Start both in parallel with logging
        (cd server-go && DATABASE_PATH="$(pwd)/data/teneo.db" ./bin/server 2>&1 | tee "../logs/server.log") &
        SERVER_PID=$!

        sleep 2
        npm run dev 2>&1 | tee logs/frontend.log &
        FRONTEND_PID=$!

        # Setup graceful shutdown
        shutdown() {
            echo ""
            print_info "Shutting down gracefully..."
            graceful_stop "4000 5176" "services"
            exit 0
        }
        trap shutdown INT TERM

        echo ""
        print_status "Server: http://localhost:4000"
        print_status "Frontend: http://localhost:5176"
        print_status "Discovery: http://localhost:5176/discovery"
        print_status "Health check: http://localhost:4000/health"
        print_status "Logs: logs/server.log, logs/frontend.log"
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
        print_status "Building Go server..."
        cd server-go && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/server ./cmd/server && cd ..

        print_status "Building frontend..."
        npm ci && npm run build

        # Initialize database
        init_database

        print_status "Starting Go server on port 4000..."
        (cd server-go && DATABASE_PATH="$(pwd)/data/teneo.db" ./bin/server) &
        SERVER_PID=$!

        sleep 2

        print_status "Starting frontend on port 4444..."
        npx serve -s dist -l 4444 &
        FRONTEND_PID=$!

        shutdown() {
            echo ""
            print_info "Shutting down gracefully..."
            graceful_stop "4000 4444" "services"
            exit 0
        }
        trap shutdown INT TERM

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
        graceful_stop "4444 5176" "old services"

        # Clean up dangling images to avoid cache issues
        docker image prune -f 2>/dev/null

        print_status "Building and starting dev container with tmux..."
        docker-compose -f docker-compose.dev.yml build --no-cache
        docker-compose -f docker-compose.dev.yml up -d

        echo ""
        print_status "Container started with hot reload!"
        print_status "Server: http://localhost:4444"
        print_status "Frontend: http://localhost:5176"
        echo ""
        print_warning "Split view layout:"
        echo "  ┌─────────────────────────┐"
        echo "  │  SERVER (port 4444)     │"
        echo "  ├─────────────────────────┤"
        echo "  │  FRONTEND (port 5176)   │"
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
        SESSIONS=$(timeout 2s tmux ls -F '#{session_name}' 2>/dev/null | grep '^teneo-')
        if [ -z "$SESSIONS" ]; then
            print_error "No teneo sessions found"
            exit 1
        fi
        SESSION_COUNT=$(echo "$SESSIONS" | wc -l | tr -d ' ')
        if [ "$SESSION_COUNT" -eq 1 ]; then
            timeout 5s tmux attach -t "$SESSIONS"
        else
            echo ""
            echo "Available sessions:"
            echo "$SESSIONS" | nl
            echo ""
            read -p "Select: " NUM
            timeout 5s tmux attach -t "$(echo "$SESSIONS" | sed -n "${NUM}p")"
        fi
        ;;

    stop)
        echo ""
        print_status "Stopping services..."

        # Stop pipe-pane logging for all teneo sessions
        for session in $(timeout 2s tmux ls -F '#{session_name}' 2>/dev/null | grep '^teneo-' || true); do
            timeout 1s tmux pipe-pane -t "$session:1" "" 2>/dev/null || true
            timeout 1s tmux pipe-pane -t "$session:1.{right}" "" 2>/dev/null || true
        done

        # Kill numbered tmux sessions
        tmux_safe_kill kill-session -t "teneo-" 2>/dev/null && print_status "Tmux sessions killed" || true

        # Kill old single tmux session
        tmux_safe_kill kill-session -t teneo 2>/dev/null || true

        # Gracefully stop processes on ports
        graceful_stop "4000 5176 4444" "services"

        # Stop Docker if running
        docker-compose down 2>/dev/null || true
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true

        print_status "All services stopped"
        ;;

    logs)
        docker-compose logs -f 2>/dev/null || docker-compose -f docker-compose.dev.yml logs -f
        ;;

    status)
        echo ""
        echo "=== Service Status ==="
        echo ""

        # Check Go server
        if curl -s http://localhost:4000/health >/dev/null 2>&1; then
            print_status "Go Server: Running (http://localhost:4000)"
        else
            print_error "Go Server: Not responding"
        fi

        # Check Frontend
        if curl -s http://localhost:5176 >/dev/null 2>&1; then
            print_status "Frontend: Running (http://localhost:5176)"
        else
            print_error "Frontend: Not responding"
        fi

        echo ""
        echo "=== Tmux Sessions ==="
        timeout 2s tmux ls 2>/dev/null | grep '^teneo-' || echo "No teneo sessions"
        echo ""

        echo "=== Docker Status ==="
        docker-compose ps 2>/dev/null || docker-compose -f docker-compose.dev.yml ps 2>/dev/null || echo "Docker not running"
        echo ""
        ;;

    *)
        echo "Usage: ./start.sh [command]"
        echo ""
        echo "Commands:"
        echo "  (default)  - Tmux split view with air hot reload (Go) + Vite HMR"
        echo "  dev        - Legacy: Run both in background with logs"
        echo "  watch      - Legacy: Auto-redeploy on code changes"
        echo "  local      - Legacy: Run in foreground with logging"
        echo "  attach     - Reattach to a numbered tmux session"
        echo "  stop       - Gracefully stop all services"
        echo "  status     - Check service status"
        echo ""
        echo "Docker:"
        echo "  docker-dev - Docker with tmux split view + hot reload"
        echo "  docker     - Docker production build"
        echo "  logs       - View Docker logs"
        exit 1
        ;;
esac
