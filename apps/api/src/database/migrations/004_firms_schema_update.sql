-- Migration 004: Update firms table schema for SA CRUD support
-- Rename apmc_code → apmc_name for clarity
ALTER TABLE firms RENAME COLUMN apmc_code TO apmc_name;
-- Add contact_phone column
ALTER TABLE firms ADD COLUMN IF NOT EXISTS contact_phone TEXT;
-- Convert address from JSONB to TEXT for simpler storage
ALTER TABLE firms ALTER COLUMN address TYPE TEXT USING address::text;
