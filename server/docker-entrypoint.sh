#!/bin/sh
set -e

# Ensure data directory exists (handles fresh volume mounts)
DATA_DIR=$(dirname "$DATABASE_PATH")
mkdir -p "$DATA_DIR"

# Initialize database if it doesn't exist
if [ ! -f "$DATABASE_PATH" ]; then
    echo "Database not found at $DATABASE_PATH, initializing..."
    node dist/db/generateSpaces.js
    echo "Database initialized!"
else
    echo "Using existing database at $DATABASE_PATH"
fi

# Start the server
exec node dist/index.js
