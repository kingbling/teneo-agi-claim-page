package db

import (
	"fmt"
	"os"
	"sync"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	instance *gorm.DB
	once     sync.Once
)

// Get returns the database instance (singleton)
func Get() *gorm.DB {
	once.Do(func() {
		var err error
		dbPath := os.Getenv("DATABASE_PATH")
		if dbPath == "" {
			dbPath = "./data/teneo.db"
		}

		// SQLite DSN with WAL mode
		dsn := fmt.Sprintf("%s?_journal=WAL&_sync=NORMAL&_timeout=5000", dbPath)

		instance, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Error),
			// Skip auto-migration - we use existing schema
			DisableForeignKeyConstraintWhenMigrating: true,
		})
		if err != nil {
			panic(fmt.Sprintf("failed to open database: %v", err))
		}

		// SQLite single-writer mode
		sqlDB, err := instance.DB()
		if err != nil {
			panic(fmt.Sprintf("failed to get sql.DB: %v", err))
		}
		sqlDB.SetMaxOpenConns(1)
		sqlDB.SetMaxIdleConns(1)

		// Test connection
		if err := sqlDB.Ping(); err != nil {
			panic(fmt.Sprintf("failed to ping database: %v", err))
		}

		// Run auto-migration
		if err := AutoMigrate(instance); err != nil {
			panic(fmt.Sprintf("failed to run migrations: %v", err))
		}

		// Run seed data
		if err := SeedAll(instance); err != nil {
			panic(fmt.Sprintf("failed to run seed: %v", err))
		}
	})
	return instance
}

// Close closes the database connection
func Close() error {
	if instance != nil {
		sqlDB, err := instance.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}
