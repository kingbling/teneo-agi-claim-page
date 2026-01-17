package websocket

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"
)

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[string]*Client // clientID -> Client
	userIndex  map[string]map[string]bool // userID -> clientID set
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	usercast   chan *UserMessage
	mu         sync.RWMutex
}

// UserMessage is a message targeted to a specific user
type UserMessage struct {
	UserID string
	Data   []byte
}

// Client represents a WebSocket client connection
type Client struct {
	ID     string
	UserID string
	Conn   *websocket.Conn
	Send   chan []byte
	Hub    *Hub
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		userIndex:  make(map[string]map[string]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte, 256),
		usercast:   make(chan *UserMessage, 256),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)

		case message := <-h.usercast:
			h.sendToUser(message.UserID, message.Data)
		}
	}
}

// RegisterClient adds a new client (public method)
func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

// UnregisterClient removes a client (public method)
func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}

// registerClient adds a new client
func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[client.ID] = client

	if client.UserID != "" {
		if _, exists := h.userIndex[client.UserID]; !exists {
			h.userIndex[client.UserID] = make(map[string]bool)
		}
		h.userIndex[client.UserID][client.ID] = true
	}
}

// unregisterClient removes a client
func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client.ID]; ok {
		delete(h.clients, client.ID)
		close(client.Send)

		if client.UserID != "" {
			if userClients, exists := h.userIndex[client.UserID]; exists {
				delete(userClients, client.ID)
				if len(userClients) == 0 {
					delete(h.userIndex, client.UserID)
				}
			}
		}
	}
}

// broadcastMessage sends a message to all connected clients
func (h *Hub) broadcastMessage(data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		select {
		case client.Send <- data:
		default:
			// Client channel is full, close it
			close(client.Send)
			delete(h.clients, client.ID)
		}
	}
}

// sendToUser sends a message to all clients of a specific user
func (h *Hub) sendToUser(userID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if userClients, exists := h.userIndex[userID]; exists {
		for clientID := range userClients {
			if client, ok := h.clients[clientID]; ok {
				select {
				case client.Send <- data:
				default:
					close(client.Send)
					delete(h.clients, clientID)
				}
			}
		}
	}
}

// Broadcast sends a message to all connected clients
func (h *Hub) Broadcast(messageType string, data interface{}) error {
	msg := map[string]interface{}{
		"type": messageType,
		"data": data,
	}

	bytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	h.broadcast <- bytes
	return nil
}

// SendToUser sends a message to a specific user's clients
func (h *Hub) SendToUser(userID string, messageType string, data interface{}) error {
	msg := map[string]interface{}{
		"type": messageType,
		"data": data,
	}

	bytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	h.usercast <- &UserMessage{
		UserID: userID,
		Data:   bytes,
	}

	return nil
}

// GetClientCount returns the number of connected clients
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// UpdateClientUser updates a client's user ID (for authentication)
func (h *Hub) UpdateClientUser(clientID string, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	client, exists := h.clients[clientID]
	if !exists {
		return
	}

	// Remove from old user index if any
	if client.UserID != "" {
		if userClients, ok := h.userIndex[client.UserID]; ok {
			delete(userClients, clientID)
			if len(userClients) == 0 {
				delete(h.userIndex, client.UserID)
			}
		}
	}

	// Update client's user ID
	client.UserID = userID

	// Add to new user index
	if userID != "" {
		if _, ok := h.userIndex[userID]; !ok {
			h.userIndex[userID] = make(map[string]bool)
		}
		h.userIndex[userID][clientID] = true
	}
}

// WritePump handles writing messages to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second) // Ping interval
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump handles reading messages from the WebSocket connection
func (c *Client) ReadPump(messageHandler func([]byte)) {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				// Log error if needed
			}
			break
		}

		if messageHandler != nil {
			messageHandler(message)
		}
	}
}
