-- ============================================================
-- Migration 013: Fix trucks table schema drift
-- The entity uses truck_number/produce_name/sale_date but the
-- original 001 schema had source_location NOT NULL (unused).
-- Drop legacy columns and make source_location nullable.
-- ============================================================

-- Make legacy NOT NULL columns nullable (unused in entity/app)
ALTER TABLE trucks ALTER COLUMN source_location DROP NOT NULL;
ALTER TABLE trucks ALTER COLUMN idempotency_key DROP NOT NULL;

-- Drop old column names that were replaced in the entity
ALTER TABLE trucks DROP COLUMN IF EXISTS registration_number;
ALTER TABLE trucks DROP COLUMN IF EXISTS source_organization;
ALTER TABLE trucks DROP COLUMN IF EXISTS arrival_date;
ALTER TABLE trucks DROP COLUMN IF EXISTS expected_weight_kg;

-- Ensure actual_weight_kg column matches entity precision
ALTER TABLE trucks ALTER COLUMN actual_weight_kg TYPE NUMERIC(10,3);

-- Drop old generated column if it still exists from 001 (can't alter, must recreate)
-- weight_variance_kg was GENERATED ALWAYS AS in 001 but nullable in entity/002
-- 002 already added a plain column; drop the generated one if present
DO $$
BEGIN
  -- Check if weight_variance_kg is a generated column; if so, drop and re-add as plain
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks'
      AND column_name = 'weight_variance_kg'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE trucks DROP COLUMN weight_variance_kg;
    ALTER TABLE trucks ADD COLUMN weight_variance_kg NUMERIC(12,3);
  END IF;
END $$;
