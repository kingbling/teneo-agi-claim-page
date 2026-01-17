.PHONY: build run clean test

# Build the Go server
build:
	go build -o bin/server ./cmd/server

# Run the Go server
run:
	go run ./cmd/server

# Run tests
test:
	go test ./...

# Clean build artifacts
clean:
	rm -rf bin/

# Install dependencies
deps:
	go mod download
	go mod tidy
