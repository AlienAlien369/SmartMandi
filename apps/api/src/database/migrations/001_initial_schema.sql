-- ============================================================
-- Migration 001: Smart Mandi — Phase 1 Foundation Schema
-- ============================================================
-- Run: npm run migration:run
-- Revert: npm run migration:revert
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SECTION 1: Core Tenant Tables
-- ============================================================

CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  apmc_code TEXT,
  address JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('FIRM_HEAD','AUTHORIZER','OPERATOR','VIEWER')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (firm_id, phone)
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  metadata JSONB,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- SECTION 2: Configuration System
-- ============================================================

CREATE TABLE config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  version INT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (firm_id, version)
);

CREATE TABLE grade_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  config_version_id UUID NOT NULL REFERENCES config_versions(id),
  grade_code TEXT NOT NULL,
  grade_label TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE apmc_fee_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  config_version_id UUID NOT NULL REFERENCES config_versions(id),
  fee_type TEXT NOT NULL CHECK (fee_type IN ('PERCENTAGE','FIXED_PER_KG','FIXED_PER_TRANSACTION')),
  fee_value NUMERIC(10,4) NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('PERCENTAGE','FLAT','NONE')),
  discount_value NUMERIC(10,4) DEFAULT 0,
  min_fee NUMERIC(10,2),
  max_fee NUMERIC(10,2),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ
);

CREATE TABLE commission_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  config_version_id UUID NOT NULL REFERENCES config_versions(id),
  scope TEXT NOT NULL CHECK (scope IN ('FIRM','TRUCK')),
  scope_ref_id UUID,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('PERCENTAGE','FIXED_PER_KG','FIXED_PER_TRANSACTION')),
  commission_value NUMERIC(10,4) NOT NULL,
  min_commission NUMERIC(10,2),
  max_commission NUMERIC(10,2),
  rounding_strategy TEXT NOT NULL DEFAULT 'ROUND_HALF_UP' CHECK (rounding_strategy IN ('ROUND_HALF_UP','FLOOR','CEIL','NONE')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ
);

CREATE TABLE baardana_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  config_version_id UUID NOT NULL REFERENCES config_versions(id),
  cost_per_unit NUMERIC(10,2) NOT NULL,
  unit_label TEXT DEFAULT 'bag',
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ
);

CREATE TABLE payment_mode_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  mode_code TEXT NOT NULL,
  mode_label TEXT NOT NULL,
  requires_reference BOOLEAN DEFAULT FALSE,
  is_credit BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (firm_id, mode_code)
);

CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('KC','TRUCK','CUSTOMER','PURCHASE')),
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('TEXT','NUMBER','DATE','BOOLEAN','SELECT')),
  options JSONB,
  validation_rules JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id),
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 3: Truck Module
-- ============================================================

CREATE TABLE trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  source_location TEXT NOT NULL,
  source_organization TEXT,
  driver_name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  inam_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  expected_weight_kg NUMERIC(12,3),
  actual_weight_kg NUMERIC(12,3),
  weight_variance_kg NUMERIC(12,3) GENERATED ALWAYS AS (actual_weight_kg - expected_weight_kg) STORED,
  arrival_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','ARRIVED','CLOSED')),
  commission_config_id UUID REFERENCES commission_configs(id),
  idempotency_key TEXT UNIQUE NOT NULL,
  version INT NOT NULL DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  is_dirty BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE truck_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  truck_id UUID NOT NULL REFERENCES trucks(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATED','ARRIVED','CLOSED','UPDATED','INAM_PAID')),
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB,
  triggered_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  truck_id UUID NOT NULL REFERENCES trucks(id),
  purchase_date DATE NOT NULL,
  weight_kg NUMERIC(12,3) NOT NULL,
  rate_per_kg NUMERIC(10,4),
  total_amount NUMERIC(14,2),
  notes TEXT,
  is_estimated BOOLEAN DEFAULT FALSE,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 4: Kaccha Chittha
-- ============================================================

CREATE TABLE kaccha_chitthas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  kc_number TEXT NOT NULL,
  truck_id UUID REFERENCES trucks(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  sale_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','AUTHORIZED','CANCELLED')),
  total_weight_kg NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_gross_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_apmc_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_commission NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_baardana_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net_payable NUMERIC(14,2) NOT NULL DEFAULT 0,
  apmc_fee_config_id UUID REFERENCES apmc_fee_configs(id),
  commission_config_id UUID REFERENCES commission_configs(id),
  authorized_by UUID REFERENCES users(id),
  authorized_at TIMESTAMPTZ,
  authorization_notes TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  version INT NOT NULL DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  is_dirty BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  UNIQUE (firm_id, kc_number)
);

CREATE TABLE kc_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  kc_id UUID NOT NULL REFERENCES kaccha_chitthas(id),
  grade_config_id UUID NOT NULL REFERENCES grade_configs(id),
  quantity_bags INT NOT NULL,
  weight_per_bag_kg NUMERIC(8,3),
  total_weight_kg NUMERIC(12,3) NOT NULL,
  rate_per_kg NUMERIC(10,4) NOT NULL,
  gross_amount NUMERIC(14,2) NOT NULL,
  baardana_source TEXT NOT NULL CHECK (baardana_source IN ('FIRM','CUSTOMER')),
  baardana_quantity INT NOT NULL DEFAULT 0,
  baardana_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0,
  CONSTRAINT positive_weight CHECK (total_weight_kg > 0)
);

CREATE TABLE kc_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  kc_id UUID NOT NULL REFERENCES kaccha_chitthas(id),
  payment_mode_id UUID NOT NULL REFERENCES payment_mode_configs(id),
  amount NUMERIC(14,2) NOT NULL,
  payment_reference TEXT,
  payment_date DATE NOT NULL,
  is_udhar BOOLEAN DEFAULT FALSE,
  udhar_due_date DATE,
  notes TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 5: Ledger System (Core Financial Backbone)
-- ============================================================

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  ledger_type TEXT NOT NULL CHECK (ledger_type IN ('CUSTOMER','TRUCK','FIRM_CASH','USER_SALARY')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(14,2) NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'KC_AUTHORIZATION','PAYMENT_RECEIVED','SALARY_PAID',
    'INAM_PAID','REVERSAL','MANUAL_ADJUSTMENT','PURCHASE_ENTRY'
  )),
  source_id UUID NOT NULL,
  entry_group_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id),
  truck_id UUID REFERENCES trucks(id),
  user_id UUID REFERENCES users(id),
  description TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- NO updated_at, NO deleted_at — IMMUTABLE
);

-- ============================================================
-- SECTION 6: Salary Module
-- ============================================================

CREATE TABLE salary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  user_id UUID NOT NULL REFERENCES users(id),
  salary_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  notes TEXT,
  attendance_ref_id UUID,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- Append-only: NO updated_at, NO deleted_at
);

-- ============================================================
-- SECTION 7: Event Store
-- ============================================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSED','FAILED','DEAD_LETTER')),
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 5,
  process_after TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 8: Audit Log
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','AUTHORIZE','CANCEL')),
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  device_id TEXT
  -- IMMUTABLE: NO updated_at, NO deleted_at
);

-- ============================================================
-- SECTION 9: Dashboard Metrics (Precomputed)
-- ============================================================

CREATE TABLE dashboard_metrics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  metric_date DATE NOT NULL,
  metric_hour INT NOT NULL CHECK (metric_hour BETWEEN 0 AND 23),
  trucks_scheduled INT DEFAULT 0,
  trucks_arrived INT DEFAULT 0,
  trucks_closed INT DEFAULT 0,
  trucks_in_progress INT DEFAULT 0,
  total_kc_count INT DEFAULT 0,
  total_kc_authorized INT DEFAULT 0,
  total_weight_sold_kg NUMERIC(14,3) DEFAULT 0,
  total_sales_amount NUMERIC(14,2) DEFAULT 0,
  total_commission_earned NUMERIC(14,2) DEFAULT 0,
  total_udhar_outstanding NUMERIC(14,2) DEFAULT 0,
  total_salaries_paid NUMERIC(14,2) DEFAULT 0,
  total_inam_paid NUMERIC(14,2) DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (firm_id, metric_date, metric_hour)
);

-- ============================================================
-- SECTION 10: Indexes (Query Performance)
-- ============================================================

-- Users
CREATE INDEX idx_users_firm ON users (firm_id);

-- Trucks
CREATE INDEX idx_trucks_firm_date ON trucks (firm_id, arrival_date);
CREATE INDEX idx_trucks_firm_status ON trucks (firm_id, status);

-- Kaccha Chitthas
CREATE INDEX idx_kc_firm_date ON kaccha_chitthas (firm_id, sale_date);
CREATE INDEX idx_kc_firm_customer ON kaccha_chitthas (firm_id, customer_id);
CREATE INDEX idx_kc_firm_truck ON kaccha_chitthas (firm_id, truck_id);
CREATE INDEX idx_kc_firm_status ON kaccha_chitthas (firm_id, status);

-- Ledger
CREATE INDEX idx_ledger_firm_type_date ON ledger_entries (firm_id, ledger_type, created_at);
CREATE INDEX idx_ledger_group ON ledger_entries (entry_group_id);
CREATE INDEX idx_ledger_customer ON ledger_entries (firm_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_ledger_truck ON ledger_entries (firm_id, truck_id) WHERE truck_id IS NOT NULL;
CREATE INDEX idx_ledger_user ON ledger_entries (firm_id, user_id) WHERE user_id IS NOT NULL;

-- Events
CREATE INDEX idx_events_firm_status ON events (firm_id, status, process_after);
CREATE INDEX idx_events_aggregate ON events (aggregate_type, aggregate_id);

-- Salary
CREATE INDEX idx_salary_firm_date ON salary_entries (firm_id, salary_date);
CREATE INDEX idx_salary_firm_user ON salary_entries (firm_id, user_id);

-- Audit
CREATE INDEX idx_audit_firm_entity ON audit_logs (firm_id, entity, entity_id);

-- Dashboard
CREATE INDEX idx_dashboard_firm_date ON dashboard_metrics_hourly (firm_id, metric_date);

-- ============================================================
-- SECTION 11: Row-Level Security (Tenant Isolation)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE apmc_fee_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE baardana_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_mode_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaccha_chitthas ENABLE ROW LEVEL SECURITY;
ALTER TABLE kc_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kc_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_metrics_hourly ENABLE ROW LEVEL SECURITY;

-- RLS Policies: firm_id = app.current_firm_id (set by API before every query)
CREATE POLICY users_firm_isolation ON users USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY customers_firm_isolation ON customers USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY config_versions_firm_isolation ON config_versions USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY grade_configs_firm_isolation ON grade_configs USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY apmc_fee_configs_firm_isolation ON apmc_fee_configs USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY commission_configs_firm_isolation ON commission_configs USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY baardana_configs_firm_isolation ON baardana_configs USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY payment_mode_configs_firm_isolation ON payment_mode_configs USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY custom_field_definitions_firm_isolation ON custom_field_definitions USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY custom_field_values_firm_isolation ON custom_field_values USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY trucks_firm_isolation ON trucks USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY truck_events_firm_isolation ON truck_events USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY purchase_entries_firm_isolation ON purchase_entries USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY kaccha_chitthas_firm_isolation ON kaccha_chitthas USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY kc_line_items_firm_isolation ON kc_line_items USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY kc_payments_firm_isolation ON kc_payments USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY ledger_entries_firm_isolation ON ledger_entries USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY salary_entries_firm_isolation ON salary_entries USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY events_firm_isolation ON events USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY audit_logs_firm_isolation ON audit_logs USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);
CREATE POLICY dashboard_metrics_firm_isolation ON dashboard_metrics_hourly USING (firm_id = current_setting('app.current_firm_id', TRUE)::UUID);

-- ============================================================
-- SECTION 12: Stored Functions
-- ============================================================

-- Auto-update updated_at on mutations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_firms_updated_at BEFORE UPDATE ON firms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kaccha_chitthas_updated_at BEFORE UPDATE ON kaccha_chitthas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION METADATA
-- ============================================================
