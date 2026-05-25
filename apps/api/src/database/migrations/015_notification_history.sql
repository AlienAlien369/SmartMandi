-- ============================================================
-- Migration 015: Notification history
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'GENERAL',
  ref_id      UUID,            -- KC id, truck id, etc.
  sent_to     INT NOT NULL DEFAULT 0,  -- number of devices notified
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_firm ON notification_history(firm_id, created_at DESC);

ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_history_firm_isolation ON notification_history
  USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
