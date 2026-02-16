package teneo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client wraps HTTP calls to the Teneo community-node-service-api.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Teneo community API client.
func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// LookupResponse is returned by the lookup endpoint.
type LookupResponse struct {
	Exists      bool    `json:"exists"`
	TeneoUserID string  `json:"teneoUserId,omitempty"`
	PointsTotal float64 `json:"pointsTotal,omitempty"`
}

// BalanceResponse is returned by the balance endpoint.
type BalanceResponse struct {
	PointsTotal float64 `json:"pointsTotal"`
}

// BurnResponse is returned by the burn-points endpoint.
type BurnResponse struct {
	Success    bool    `json:"success"`
	NewBalance float64 `json:"newBalance"`
}

// Lookup finds a Teneo user by wallet address.
func (c *Client) Lookup(ctx context.Context, wallet string) (*LookupResponse, error) {
	body := map[string]string{"wallet": wallet}
	jsonBody, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/game/lookup", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create lookup request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("lookup request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("lookup returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result LookupResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode lookup response: %w", err)
	}
	return &result, nil
}

// GetBalance fetches the current point balance for a Teneo user.
func (c *Client) GetBalance(ctx context.Context, teneoUserID string) (*BalanceResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/game/balance?teneoUserId="+teneoUserID, nil)
	if err != nil {
		return nil, fmt.Errorf("create balance request: %w", err)
	}
	req.Header.Set("x-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("balance request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("balance returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result BalanceResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode balance response: %w", err)
	}
	return &result, nil
}

// BurnPoints deducts points from a Teneo user's balance.
func (c *Client) BurnPoints(ctx context.Context, teneoUserID string, amount float64, reason, idempotencyKey string) (*BurnResponse, error) {
	body := map[string]interface{}{
		"teneoUserId":    teneoUserID,
		"amount":         amount,
		"reason":         reason,
		"idempotencyKey": idempotencyKey,
	}
	jsonBody, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/game/burn-points", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create burn request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("burn request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("burn returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result BurnResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode burn response: %w", err)
	}
	return &result, nil
}
