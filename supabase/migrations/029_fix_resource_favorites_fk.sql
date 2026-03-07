-- Migration: Drop FK constraint on resource_favorites.resource_id
-- The original FK referenced module_resources(id), but favorites are now used
-- from the resources page which queries the `resources` table (not module_resources).
-- Dropping the FK allows resource_id to reference either table.

ALTER TABLE resource_favorites DROP CONSTRAINT IF EXISTS resource_favorites_resource_id_fkey;
