FROM node:20-alpine

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Copy non-TS files to dist (schema.sql)
RUN cp src/db/schema.sql dist/db/schema.sql

# Copy and make entrypoint executable
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 4000

# Environment
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/teneo.db
ENV SIMULATION_ENABLED=true

# Use entrypoint script to initialize DB on first run
ENTRYPOINT ["/app/docker-entrypoint.sh"]
