-- ============================================================
-- Migration 007: Rate Mode — PER_KG vs PER_NAG
-- ============================================================
-- baardana_configs: SA sets rate_mode per firm
--   PER_KG  — gross = bags × weight_per_bag × rate_per_kg
--   PER_NAG — gross = bags × rate_per_nag (no weight needed)
-- kc_line_items: each line item records which mode was used
-- ============================================================

-- UP
ALTER TABLE baardana_configs
  ADD COLUMN IF NOT EXISTS rate_mode TEXT NOT NULL DEFAULT 'PER_KG'
    CHECK (rate_mode IN ('PER_KG', 'PER_NAG'));

ALTER TABLE kc_line_items
  ADD COLUMN IF NOT EXISTS rate_mode TEXT NOT NULL DEFAULT 'PER_KG'
    CHECK (rate_mode IN ('PER_KG', 'PER_NAG'));

-- DOWN
-- ALTER TABLE baardana_configs DROP COLUMN IF EXISTS rate_mode;
-- ALTER TABLE kc_line_items   DROP COLUMN IF EXISTS rate_mode;
