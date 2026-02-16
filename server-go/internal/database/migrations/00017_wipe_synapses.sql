-- +goose Up
-- Clean slate: wipe existing synapses and related data
-- Synapse types are now admin-managed via synapse_types table
DELETE FROM synapse_explorers;
DELETE FROM agent_clusters;
DELETE FROM space_clusters;
DELETE FROM spaces;
-- Reset agents to idle
UPDATE agents SET state = 'idle', target_space_id = NULL, current_space_id = NULL, destination_x = NULL, destination_y = NULL, destination_z = NULL;

-- +goose Down
-- No-op: data loss is intentional
