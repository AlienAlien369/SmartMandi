-- ============================================================
-- Migration 017: Fix trucks table schema — CASCADE version
-- Migration 013 failed on EC2 because expected_weight_kg had
-- a GENERATED column (weight_variance_kg) depending on it.
-- This migration uses CASCADE to handle generated column deps.
-- Also fixes source_location NOT NULL (blocks truck creation).
-- ============================================================

-- Step 1: Make legacy NOT NULL columns nullable
ALTER TABLE trucks ALTER COLUMN source_location DROP NOT NULL;
ALTER TABLE trucks ALTER COLUMN idempotency_key DROP NOT NULL;

-- Step 2: Drop generated/computed weight_variance_kg (may be GENERATED ALWAYS AS)
ALTER TABLE trucks DROP COLUMN IF EXISTS weight_variance_kg CASCADE;

-- Step 3: Drop old legacy columns with CASCADE
ALTER TABLE trucks DROP COLUMN IF EXISTS registration_number CASCADE;
ALTER TABLE trucks DROP COLUMN IF EXISTS source_organization CASCADE;
ALTER TABLE trucks DROP COLUMN IF EXISTS arrival_date CASCADE;
ALTER TABLE trucks DROP COLUMN IF EXISTS expected_weight_kg CASCADE;

-- Step 4: Re-add weight_variance_kg as a plain nullable computed-by-app column
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS weight_variance_kg NUMERIC(12,3);
