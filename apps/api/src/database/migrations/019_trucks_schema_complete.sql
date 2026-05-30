-- ============================================================
-- Migration 019: Add missing trucks columns to match entity
-- Migration 013 dropped old columns (registration_number, arrival_date,
-- expected_weight_kg) but never added the new entity columns.
-- ============================================================

-- Core columns the entity expects but DB was missing
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS truck_number VARCHAR(20);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS produce_name VARCHAR(100);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS sale_date DATE;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(15);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS estimated_weight_kg NUMERIC(10,3);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS arrived_weight_kg NUMERIC(10,3);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS notes TEXT;

-- Make purchase_entries.idempotency_key nullable (entity has nullable: true)
-- service was not always setting it
ALTER TABLE purchase_entries ALTER COLUMN idempotency_key DROP NOT NULL;

-- Backfill truck_number from any existing trucks that have idempotency_key
-- (previously created trucks will have NULL truck_number — that's OK)

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_trucks_sale_date ON trucks(firm_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_trucks_customer ON trucks(firm_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trucks_truck_number ON trucks(firm_id, truck_number) WHERE truck_number IS NOT NULL;
