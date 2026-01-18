package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
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

// verifyEthSignature verifies an Ethereum signed message and returns the recovered address
func verifyEthSignature(message string, signatureHex string) (common.Address, error) {
	// Remove 0x prefix if present
	sig := strings.TrimPrefix(signatureHex, "0x")

	// Decode hex signature
	sigBytes, err := hex.DecodeString(sig)
	if err != nil {
		return common.Address{}, fmt.Errorf("invalid signature hex: %w", err)
	}

	if len(sigBytes) != 65 {
		return common.Address{}, fmt.Errorf("invalid signature length: expected 65 bytes, got %d", len(sigBytes))
	}

	// Ethereum signatures have v = 27 or 28, but go-ethereum expects 0 or 1
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	// Hash the message with Ethereum prefix
	prefixedMessage := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)
	hash := crypto.Keccak256Hash([]byte(prefixedMessage))

	// Recover the public key
	pubKey, err := crypto.SigToPub(hash.Bytes(), sigBytes)
	if err != nil {
		return common.Address{}, fmt.Errorf("failed to recover public key: %w", err)
	}

	// Derive address from public key
	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	return recoveredAddr, nil
}

// VerifySignature verifies a wallet signature and returns a JWT
func VerifySignature(c *fiber.Ctx, database *gorm.DB) error {
	var req struct {
		Wallet    string `json:"wallet"`
		Signature string `json:"signature"`
		DevBypass bool   `json:"devBypass"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Wallet == "" {
		return c.Status(400).JSON(fiber.Map{"error": "wallet is required"})
	}

	// DEV BYPASS: Skip signature verification in development
	// TODO: Change to os.Getenv("DEV_AUTH_BYPASS") == "true" for production
	devBypassEnabled := true // HARDCODED FOR DEV
	if devBypassEnabled && req.DevBypass {
		log.Printf("[AUTH] DEV BYPASS: Skipping signature verification for wallet: %s", req.Wallet)
	} else {
		// Production: require proper signature verification
		if req.Signature == "" {
			return c.Status(400).JSON(fiber.Map{"error": "signature is required"})
		}

		// Get the stored nonce for this wallet
		noncesMutex.RLock()
		nonce, exists := nonces[req.Wallet]
		noncesMutex.RUnlock()

		if !exists {
			return c.Status(400).JSON(fiber.Map{"error": "No nonce found. Please request a new nonce first."})
		}

		// Reconstruct the message that was signed
		message := `Sign this message to verify your wallet ownership.\n\nNonce: ` + nonce + `\n\nThis will not trigger a blockchain transaction or cost any fees.`

		// Verify the signature
		recoveredAddr, err := verifyEthSignature(message, req.Signature)
		if err != nil {
			log.Printf("[AUTH] Signature verification failed for wallet %s: %v", req.Wallet, err)
			return c.Status(401).JSON(fiber.Map{"error": "Invalid signature"})
		}

		// Compare recovered address with claimed wallet (case-insensitive)
		if !strings.EqualFold(recoveredAddr.Hex(), req.Wallet) {
			log.Printf("[AUTH] Address mismatch: recovered %s, claimed %s", recoveredAddr.Hex(), req.Wallet)
			return c.Status(401).JSON(fiber.Map{"error": "Signature does not match wallet address"})
		}

		// Clear the used nonce (one-time use)
		noncesMutex.Lock()
		delete(nonces, req.Wallet)
		noncesMutex.Unlock()

		log.Printf("[AUTH] Signature verified for wallet: %s", req.Wallet)
	}

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
