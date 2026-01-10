FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build for production (skip type checking for faster Docker builds)
RUN npx vite build

# Install serve for production
RUN npm install -g serve

# Expose port
EXPOSE 4444

# Serve the built app
CMD ["serve", "-s", "dist", "-l", "4444"]
