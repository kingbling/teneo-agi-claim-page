# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json ./
COPY src/ src/
COPY public/ public/
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY server-go/go.mod server-go/go.sum ./
RUN go mod download
COPY server-go/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# Stage 3: Production image
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=backend /server ./server
COPY --from=frontend /app/dist ./dist

ENV PORT=8080
EXPOSE 8080

CMD ["./server"]
