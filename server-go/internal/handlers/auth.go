package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"os"
	"sync"
	"time"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	nonces      = make(map[string]string)
	noncesMutex sync.RWMutex
	jwtSecret   []byte
)

func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default-dev-secret-change-in-production"
	}
	jwtSecret = []byte(secret)
}

// VerifyJWTToken verifies a JWT token and returns the user ID
func VerifyJWTToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		if userID, ok := claims["userId"].(string); ok {
			return userID, nil
		}
		if sub, ok := claims["sub"].(string); ok {
			return sub, nil
		}
	}

	return "", errors.New("invalid token claims")
}

// GenerateJWTToken creates a new JWT token for a user
func GenerateJWTToken(userID string, wallet string) (string, error) {
	claims := jwt.MapClaims{
		"userId": userID,
		"wallet": wallet,
		"sub":    userID,
		"iat":    time.Now().Unix(),
		"exp":    time.Now().Add(7 * 24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// GetNonce generates a nonce for wallet signature
func GetNonce(c *fiber.Ctx) error {
	wallet := c.Query("wallet", "")
	if wallet == "" {
		return c.Status(400).JSON(fiber.Map{"error": "wallet is required"})
	}

	// Generate random nonce
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate nonce"})
	}

	nonce := hex.EncodeToString(bytes)

	// Store nonce for this wallet (using wallet as key)
	noncesMutex.Lock()
	nonces[wallet] = nonce
	noncesMutex.Unlock()

	// Create message to sign
	message := `Sign this message to verify your wallet ownership.\n\nNonce: ` + nonce + `\n\nThis will not trigger a blockchain transaction or cost any fees.`

	return c.JSON(fiber.Map{
		"message": message,
		"nonce":   nonce,
	})
}

// VerifySignature verifies a wallet signature and returns a JWT
// For development: accepts any signature and creates/returns a user
func VerifySignature(c *fiber.Ctx, database *gorm.DB) error {
	var req struct {
		Wallet    string `json:"wallet"`
		Signature string `json:"signature"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Wallet == "" {
		return c.Status(400).JSON(fiber.Map{"error": "wallet is required"})
	}

	// TODO: Implement actual signature verification
	// For development, skip verification and create/get user

	// Try to get existing user
	user, err := db.GetUserByWallet(database, req.Wallet)
	if err != nil {
		// User doesn't exist, create new user
		log.Printf("[AUTH] Creating new user for wallet: %s", req.Wallet)
		user = &models.User{
			ID:        uuid.New().String(),
			Wallet:    req.Wallet,
			Tier:      "free",
			UserLevel: 1,
			UsdcSpent:  0,
			Points:    1000, // Starting points
			MaxShips:  1,
			CreatedAt: time.Now().UnixMilli(),
		}

		if err := db.CreateUser(database, user); err != nil {
			log.Printf("[AUTH] ERROR creating user for wallet %s: %v", req.Wallet, err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create user", "details": err.Error()})
		}
		log.Printf("[AUTH] Successfully created user %s for wallet %s", user.ID, req.Wallet)
	} else {
		log.Printf("[AUTH] Found existing user %s for wallet %s", user.ID, req.Wallet)
	}

	// Generate JWT token
	token, err := GenerateJWTToken(user.ID, user.Wallet)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.JSON(fiber.Map{
		"token": token,
		"user": fiber.Map{
			"id":       user.ID,
			"wallet":   user.Wallet,
			"tier":     user.Tier,
			"userLevel": user.UserLevel,
		},
	})
}

// VerifyToken verifies a JWT token and returns user info
func VerifyToken(c *fiber.Ctx, database *gorm.DB) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(401).JSON(fiber.Map{"error": "No authorization header"})
	}

	// Extract token from "Bearer <token>"
	if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid authorization header"})
	}

	tokenString := authHeader[7:]

	// Verify token
	userID, err := VerifyJWTToken(tokenString)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}

	// Get user
	user, err := db.GetUser(database, userID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{
		"id":       user.ID,
		"wallet":   user.Wallet,
		"tier":     user.Tier,
		"userLevel": user.UserLevel,
	})
}
