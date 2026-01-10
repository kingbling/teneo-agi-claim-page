#!/bin/sh
set -e

# Initialize database if it doesn't exist
if [ ! -f "$DATABASE_PATH" ]; then
    echo "Database not found at $DATABASE_PATH, initializing..."
    node dist/db/generateSpaces.js
    echo "Database initialized!"
fi

# Start the server
exec node dist/index.js
