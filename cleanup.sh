#!/bin/bash

# Teneo Discovery Portal - Cleanup Script
# Usage: ./.cleanup.sh [db|docker|all]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

clean_database() {
    print_warning "Cleaning database..."

    # Local database
    if [ -f "server/data/teneo.db" ]; then
        rm -f server/data/teneo.db
        rm -f server/data/teneo.db-wal
        rm -f server/data/teneo.db-shm
        print_status "Removed local database"
    fi

    # Docker volume database (if container is running)
    if docker ps -q --filter "name=poc-teneo" | grep -q .; then
        docker exec poc-teneo-dev-1 rm -f /app/server/data/teneo.db 2>/dev/null || true
        docker exec poc-teneo-dev-1 rm -f /app/server/data/teneo.db-wal 2>/dev/null || true
        docker exec poc-teneo-dev-1 rm -f /app/server/data/teneo.db-shm 2>/dev/null || true
        print_status "Removed Docker container database"
    fi

    print_status "Database cleaned. It will be recreated on next server start."
}

clean_docker() {
    print_warning "Cleaning Docker resources..."

    # Stop containers
    docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    docker-compose down --remove-orphans 2>/dev/null || true

    # Remove volumes
    docker volume rm poc_server-data 2>/dev/null || true

    # Prune images
    docker image prune -f 2>/dev/null || true

    print_status "Docker resources cleaned"
}

clean_all() {
    print_warning "Full cleanup..."

    clean_docker
    clean_database

    # Clean node_modules
    if [ -d "node_modules" ]; then
        rm -rf node_modules
        print_status "Removed frontend node_modules"
    fi

    if [ -d "server/node_modules" ]; then
        rm -rf server/node_modules
        print_status "Removed server node_modules"
    fi

    # Clean build artifacts
    rm -rf dist server/dist 2>/dev/null || true
    print_status "Removed build artifacts"

    # Clean logs
    rm -rf logs/*.log 2>/dev/null || true
    print_status "Cleaned logs"

    print_status "Full cleanup complete"
}

case "${1:-db}" in
    db|database)
        echo ""
        echo "=== Database Cleanup ==="
        echo ""
        clean_database
        ;;

    docker)
        echo ""
        echo "=== Docker Cleanup ==="
        echo ""
        clean_docker
        ;;

    all)
        echo ""
        echo "=== Full Cleanup ==="
        echo ""
        clean_all
        ;;

    *)
        echo "Usage: ./.cleanup.sh [command]"
        echo ""
        echo "Commands:"
        echo "  db       - Clean database only (default)"
        echo "  docker   - Stop containers and clean Docker resources"
        echo "  all      - Full cleanup (db + docker + node_modules + builds)"
        exit 1
        ;;
esac

echo ""
print_status "Done!"
