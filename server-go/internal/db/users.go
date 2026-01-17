package db

import (
	"errors"

	"teneo/server-go/internal/models"

	"gorm.io/gorm"
)

// GetUser retrieves a user by ID
func GetUser(db *gorm.DB, id string) (*models.User, error) {
	var user models.User
	result := db.First(&user, "id = ?", id)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("user not found")
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

// GetUserByWallet retrieves a user by wallet address
func GetUserByWallet(db *gorm.DB, wallet string) (*models.User, error) {
	var user models.User
	result := db.First(&user, "wallet = ?", wallet)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("user not found")
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

// CreateUser creates a new user
func CreateUser(db *gorm.DB, user *models.User) error {
	return db.Create(user).Error
}

// UpdateUser updates a user
func UpdateUser(db *gorm.DB, user *models.User) error {
	return db.Save(user).Error
}

// IncrementUserAGI adds AGI to a user's total
func IncrementUserAGI(db *gorm.DB, userID string, amount int) error {
	return db.Model(&models.User{}).
		Where("id = ?", userID).
		Update("total_agi_earned", gorm.Expr("COALESCE(total_agi_earned, 0) + ?", amount)).Error
}

// IncrementUserPoints adds points to a user's total
func IncrementUserPoints(db *gorm.DB, userID string, amount float64) error {
	return db.Model(&models.User{}).
		Where("id = ?", userID).
		Update("points", gorm.Expr("points + ?", amount)).Error
}

// DecrementUserPoints removes points from a user's total
func DecrementUserPoints(db *gorm.DB, userID string, amount float64) error {
	return db.Model(&models.User{}).
		Where("id = ?", userID).
		Update("points", gorm.Expr("points - ?", amount)).Error
}

// GetUserCount returns the total number of users
func GetUserCount(db *gorm.DB) (int64, error) {
	var count int64
	result := db.Model(&models.User{}).Count(&count)
	return count, result.Error
}
