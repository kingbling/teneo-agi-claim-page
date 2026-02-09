package database

import (
	"context"
	"embed"
	"fmt"
	"log"

	"teneo/server-go/internal/database/generated"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

// Store wraps a pgxpool and sqlc Queries for database access.
type Store struct {
	Pool    *pgxpool.Pool
	Queries *generated.Queries
}

// NewStore creates a new Store, configures the connection pool, and runs goose migrations.
func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	// Parse pool config
	poolCfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}

	poolCfg.MaxConns = 25
	poolCfg.MinConns = 5

	// Create connection pool
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	log.Println("[DB] Connected to PostgreSQL")

	// Run goose migrations
	if err := runMigrations(databaseURL); err != nil {
		pool.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	queries := generated.New(pool)

	return &Store{
		Pool:    pool,
		Queries: queries,
	}, nil
}

// runMigrations runs goose migrations using the embedded SQL files.
// goose requires a *sql.DB, so we open a temporary stdlib connection.
func runMigrations(databaseURL string) error {
	goose.SetBaseFS(embedMigrations)

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}

	// goose needs a database/sql.DB — open one via pgx stdlib adapter
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return err
	}
	connStr := cfg.ConnConfig.ConnString()

	db, err := goose.OpenDBWithDriver("pgx", connStr)
	if err != nil {
		return fmt.Errorf("goose open db: %w", err)
	}
	defer db.Close()

	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}

	log.Println("[DB] Migrations completed")
	return nil
}

// WithTx runs the given function inside a database transaction.
// If fn returns an error the transaction is rolled back; otherwise it is committed.
func (s *Store) WithTx(ctx context.Context, fn func(q *generated.Queries) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.Queries.WithTx(tx)
	if err := fn(qtx); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// BeginTx starts a new transaction and returns the pgx.Tx alongside a transactional Queries.
// Caller is responsible for committing or rolling back.
func (s *Store) BeginTx(ctx context.Context) (pgx.Tx, *generated.Queries, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("begin tx: %w", err)
	}
	return tx, s.Queries.WithTx(tx), nil
}

// Close closes the connection pool.
func (s *Store) Close() {
	s.Pool.Close()
	log.Println("[DB] Connection pool closed")
}
