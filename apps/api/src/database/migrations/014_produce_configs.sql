-- ============================================================
-- Migration 014: Produce configs — SA-managed per firm
-- ============================================================

CREATE TABLE IF NOT EXISTS produce_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(firm_id, name)
);

CREATE INDEX IF NOT EXISTS idx_produce_configs_firm ON produce_configs(firm_id);

ALTER TABLE produce_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY produce_configs_firm_isolation ON produce_configs
  USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);

-- Seed default produces for dev firm
INSERT INTO produce_configs (firm_id, name, sort_order)
SELECT '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID, vals.name, vals.sort_order
FROM (VALUES
  ('Mossami',    1),
  ('Kela',       2),
  ('Tamatar',    3),
  ('Aloo',       4),
  ('Pyaaz',      5),
  ('Lahsun',     6),
  ('Adrak',      7),
  ('Mirchi',     8),
  ('Matar',      9),
  ('Gobhi',     10)
) AS vals(name, sort_order)
WHERE EXISTS (SELECT 1 FROM firms WHERE id = '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID)
ON CONFLICT (firm_id, name) DO NOTHING;
