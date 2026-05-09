-- Migration 008: Add freight_type to salary_entries, rename Salary module to Freight
-- Run: docker exec -i smart-mandi-postgres psql -U smart_mandi_user -d smart_mandi < apps/api/src/database/migrations/008_freight_type.sql

BEGIN;

-- Add freight_type column (defaults to SALARY for backward compat)
ALTER TABLE salary_entries
  ADD COLUMN IF NOT EXISTS freight_type TEXT NOT NULL DEFAULT 'SALARY'
  CHECK (freight_type IN ('SALARY', 'INAM', 'KIRAYA', 'PARCHI'));

-- Rename module label
UPDATE module_definitions SET label = 'Freight' WHERE id = 'SALARY';

COMMIT;
