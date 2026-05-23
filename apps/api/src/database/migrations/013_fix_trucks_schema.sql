-- ============================================================
-- Migration 013: Fix trucks table schema drift
-- The entity uses truck_number/produce_name/sale_date but the
-- original 001 schema had source_location NOT NULL (unused).
-- Drop legacy columns and make source_location nullable.
-- ============================================================

-- Make legacy NOT NULL columns nullable (unused in entity/app)
ALTER TABLE trucks ALTER COLUMN source_location DROP NOT NULL;
ALTER TABLE trucks ALTER COLUMN idempotency_key DROP NOT NULL;

-- Drop weight_variance_kg first (it's a GENERATED column depending on expected_weight_kg)
ALTER TABLE trucks DROP COLUMN IF EXISTS weight_variance_kg;

-- Now drop old legacy columns
ALTER TABLE trucks DROP COLUMN IF EXISTS registration_number;
ALTER TABLE trucks DROP COLUMN IF EXISTS source_organization;
ALTER TABLE trucks DROP COLUMN IF EXISTS arrival_date;
ALTER TABLE trucks DROP COLUMN IF EXISTS expected_weight_kg;

-- Re-add weight_variance_kg as a plain nullable column (entity manages it)
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS weight_variance_kg NUMERIC(12,3);
