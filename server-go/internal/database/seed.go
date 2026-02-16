package database

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// seedSpaces is now a no-op.
// Synapse generation is managed via the admin panel (POST /api/admin/synapse-types/:id/generate).
func seedSpaces(ctx context.Context, pool *pgxpool.Pool) error {
	var count int64
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM spaces").Scan(&count); err != nil {
		return nil // table may not exist yet during first migration
	}
	if count == 0 {
		log.Println("[SEED] No synapses in database. Use admin panel to create synapse types and generate synapses.")
	} else {
		log.Printf("[SEED] Database has %d synapses", count)
	}
	return nil
}
