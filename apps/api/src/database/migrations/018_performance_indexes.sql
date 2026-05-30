-- ============================================================
-- Migration 018: Performance indexes for high-frequency queries
-- ============================================================

-- KC number search and status filter
CREATE INDEX IF NOT EXISTS idx_kc_kc_number ON kaccha_chitthas(firm_id, kc_number);
CREATE INDEX IF NOT EXISTS idx_kc_status_date ON kaccha_chitthas(firm_id, status, sale_date);

-- KC payments idempotency (prevents cross-tenant bypass)
CREATE INDEX IF NOT EXISTS idx_kc_payments_idempotency ON kc_payments(firm_id, idempotency_key);

-- Ledger ordered scan (getLedgerReport)
CREATE INDEX IF NOT EXISTS idx_ledger_firm_type_created ON ledger_entries(firm_id, ledger_type, created_at);

-- Salary/freight date range
CREATE INDEX IF NOT EXISTS idx_salary_firm_date ON salary_entries(firm_id, salary_date);
CREATE INDEX IF NOT EXISTS idx_salary_firm_truck ON salary_entries(firm_id, truck_id) WHERE truck_id IS NOT NULL;

-- Trucks status-date lookup (dashboard)
CREATE INDEX IF NOT EXISTS idx_trucks_firm_status_date ON trucks(firm_id, status, sale_date);

-- Notification history
CREATE INDEX IF NOT EXISTS idx_notifications_firm_created ON notification_history(firm_id, created_at DESC);
