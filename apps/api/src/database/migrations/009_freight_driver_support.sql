-- Migration 009: Support truck driver as recipient for INAM/KIRAYA/PARCHI freight types
-- SALARY type continues to use user_id (employee)
-- INAM/KIRAYA/PARCHI now use truck_id + driver_name (truck driver)
-- Run: docker exec -i smart-mandi-postgres psql -U smart_mandi_user -d smart_mandi < apps/api/src/database/migrations/009_freight_driver_support.sql

BEGIN;

-- Make user_id nullable (driver-type entries won't have a user_id)
ALTER TABLE salary_entries ALTER COLUMN user_id DROP NOT NULL;

-- Add truck_id reference (populated for INAM/KIRAYA/PARCHI)
ALTER TABLE salary_entries
  ADD COLUMN IF NOT EXISTS truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL;

-- Add driver_name snapshot (copied from truck at creation — immutable audit trail)
ALTER TABLE salary_entries
  ADD COLUMN IF NOT EXISTS driver_name TEXT;

-- Add driver_phone snapshot
ALTER TABLE salary_entries
  ADD COLUMN IF NOT EXISTS driver_phone TEXT;

-- Index for filtering by truck
CREATE INDEX IF NOT EXISTS idx_salary_entries_truck_id ON salary_entries(firm_id, truck_id);

COMMIT;
