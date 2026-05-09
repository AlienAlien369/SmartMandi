-- ============================================================
-- Migration 006: Baardana Config — provider + default bags
-- ============================================================
-- Adds two columns to baardana_configs:
--   baardana_provider: who supplies bags — 'FIRM' or 'CUSTOMER'
--   default_bags     : default bag count pre-filled in KC line items
-- ============================================================

-- UP
ALTER TABLE baardana_configs
  ADD COLUMN IF NOT EXISTS baardana_provider TEXT NOT NULL DEFAULT 'FIRM'
    CHECK (baardana_provider IN ('FIRM', 'CUSTOMER')),
  ADD COLUMN IF NOT EXISTS default_bags INT NOT NULL DEFAULT 1;

-- DOWN
-- ALTER TABLE baardana_configs
--   DROP COLUMN IF EXISTS baardana_provider,
--   DROP COLUMN IF EXISTS default_bags;
