-- ============================================================
-- Migration 002: Additive changes — Phase 3-6 enhancements
-- Only adds what is NOT already in 001_initial_schema
-- ============================================================

-- Add summary_sheets table (not in 001)
CREATE TABLE IF NOT EXISTS summary_sheets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID NOT NULL REFERENCES firms(id),
  sale_date         DATE NOT NULL,
  snapshot          JSONB NOT NULL DEFAULT '{}',
  total_trucks      INT NOT NULL DEFAULT 0,
  total_gross_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_commission  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_apmc_fees   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net_payable NUMERIC(14,2) NOT NULL DEFAULT 0,
  generated_by      UUID NOT NULL,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_summary_firm_date ON summary_sheets(firm_id, sale_date);

ALTER TABLE summary_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS summary_firm_isolation ON summary_sheets;
CREATE POLICY summary_firm_isolation ON summary_sheets
  USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);

-- Add missing columns to existing tables if not already present
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS truck_number VARCHAR(20);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS produce_name VARCHAR(100);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS sale_date DATE;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS estimated_weight_kg NUMERIC(10,3);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS arrived_weight_kg NUMERIC(10,3);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS weight_variance_kg NUMERIC(10,3);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(15);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS closed_by UUID;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_trucks_firm_sale_date ON trucks(firm_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_trucks_firm_customer ON trucks(firm_id, customer_id);

-- Add missing columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Ensure RLS is enabled on all key tables
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_metrics_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies safely for tables 002 manages
DROP POLICY IF EXISTS summary_firm_isolation ON summary_sheets;
CREATE POLICY summary_firm_isolation ON summary_sheets
  USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);

-- updated_at trigger for summary_sheets (reuse existing function from 001)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';
