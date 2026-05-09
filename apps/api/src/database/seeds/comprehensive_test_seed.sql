-- ============================================================
-- Smart Mandi: Comprehensive Test Seed Script
-- ============================================================
-- Usage:
--   docker exec -i smart-mandi-postgres psql -U smart_mandi_user -d smart_mandi \
--     < apps/api/src/database/seeds/comprehensive_test_seed.sql
--
-- What this script does:
--   1. TRUNCATEs all business data (preserves module_definitions — seeded by migration 003)
--   2. Re-inserts base config: super_admin, firm, users, modules, config, grades, etc.
--   3. Inserts comprehensive sample data covering every edge case:
--      - Customer A (Ramesh): partial payment → outstanding udhar
--      - Customer B (Suresh): overpaid → credit balance (firm owes him)
--      - Customer C (Amit):   DRAFT KC only → balance = 0
--      - Customer D (Vijay):  fully settled → balance = 0
--      - Customer E (Priya):  no KCs at all → new customer
--      - Truck statuses: SCHEDULED / ARRIVED / CLOSED
--      - KC statuses:    AUTHORIZED / DRAFT / CANCELLED
--      - Rate modes:     PER_KG (KC-001..006) and PER_NAG (KC-007)
--      - Freight types:  SALARY / INAM / KIRAYA / PARCHI
-- ============================================================
-- UUID Reference Map:
--   Firm:              115c557f-0c07-4162-b3bc-84f1feab88fb
--   Super Admin:       00000000-0000-0000-0000-000000000001
--   User FIRM_HEAD:    aaaaaaaa-0001-0001-0001-000000000001  (phone 9999999999)
--   User AUTHORIZER:   aaaaaaaa-0002-0001-0001-000000000002  (phone 9111111111)
--   User OPERATOR:     aaaaaaaa-0003-0001-0001-000000000003  (phone 9222222222)
--   User VIEWER:       aaaaaaaa-0004-0001-0001-000000000004  (phone 9333333333)
--   Config Version:    bbbbbbbb-0001-0001-0001-000000000001
--   Grade A:           cccccccc-0001-0001-0001-000000000001
--   Grade B:           cccccccc-0002-0001-0001-000000000002
--   Grade C:           cccccccc-0003-0001-0001-000000000003
--   Commission config: dddddddd-0001-0001-0001-000000000001  (FIRM, 2%)
--   APMC fee config:   dddddddd-0002-0001-0001-000000000002  (PERCENTAGE, 0.5%)
--   Baardana config:   dddddddd-0003-0001-0001-000000000003  (₹5/bag, PER_KG)
--   Payment CASH:      eeeeeeee-0001-0001-0001-000000000001
--   Payment BANK:      eeeeeeee-0002-0001-0001-000000000002
--   Payment UPI:       eeeeeeee-0003-0001-0001-000000000003
--   Customer A Ramesh: ffffffff-0001-0001-0001-000000000001
--   Customer B Suresh: ffffffff-0002-0001-0001-000000000002
--   Customer C Amit:   ffffffff-0003-0001-0001-000000000003
--   Customer D Vijay:  ffffffff-0004-0001-0001-000000000004
--   Customer E Priya:  ffffffff-0005-0001-0001-000000000005
--   Truck 1 SCHEDULED: 11111111-0001-0001-0001-000000000001
--   Truck 2 ARRIVED:   11111111-0002-0001-0001-000000000002
--   Truck 3 CLOSED(-1):11111111-0003-0001-0001-000000000003
--   Truck 4 CLOSED(-2):11111111-0004-0001-0001-000000000004
--   KC-001:            22222222-0001-0001-0001-000000000001
--   KC-002:            22222222-0002-0001-0001-000000000002
--   KC-003:            22222222-0003-0001-0001-000000000003
--   KC-004:            22222222-0004-0001-0001-000000000004
--   KC-005:            22222222-0005-0001-0001-000000000005
--   KC-006:            22222222-0006-0001-0001-000000000006
--   KC-007:            22222222-0007-0001-0001-000000000007
-- ============================================================

\echo ''
\echo '============================================================'
\echo ' SMART MANDI — COMPREHENSIVE TEST SEED'
\echo '============================================================'
\echo ''

-- ============================================================
-- SECTION 0: TRUNCATE ALL BUSINESS DATA
-- ============================================================
-- CASCADE automatically clears all dependent tables (ledger_entries,
-- events, audit_logs, truck_events, purchase_entries, summary_sheets,
-- dashboard_metrics_hourly, etc.)
-- module_definitions is NOT affected (no FK to firms).
-- ============================================================

\echo '[0/17] Truncating all business data (CASCADE)...'

TRUNCATE TABLE firms, super_admins CASCADE;

\echo '      Done. module_definitions preserved.'

-- ============================================================
-- SECTION 1: SUPER ADMIN
-- ============================================================
\echo '[1/17] Inserting Super Admin...'

INSERT INTO super_admins (id, name, phone, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Platform Admin', '9000000000', TRUE)
ON CONFLICT (phone) DO NOTHING;

-- ============================================================
-- SECTION 2: FIRM
-- ============================================================
\echo '[2/17] Inserting Firm...'

INSERT INTO firms (id, name, apmc_name, address, contact_phone, is_active)
VALUES (
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'Dev Mandi Firm',
  'DEV001',
  'Dev Mandi, Test City, Test State - 000000',
  '9999999998',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 3: USERS
-- ============================================================
-- Dev login credentials (any OTP accepted in dev):
--   FIRM_HEAD:  9999999999
--   AUTHORIZER: 9111111111
--   OPERATOR:   9222222222
--   VIEWER:     9333333333
-- ============================================================
\echo '[3/17] Inserting Users...'

INSERT INTO users (id, firm_id, name, phone, role, is_active)
VALUES
  (
    'aaaaaaaa-0001-0001-0001-000000000001',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'Dev Head',
    '9999999999',
    'FIRM_HEAD',
    TRUE
  ),
  (
    'aaaaaaaa-0002-0001-0001-000000000002',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'Dev Authorizer',
    '9111111111',
    'AUTHORIZER',
    TRUE
  ),
  (
    'aaaaaaaa-0003-0001-0001-000000000003',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'Dev Operator',
    '9222222222',
    'OPERATOR',
    TRUE
  ),
  (
    'aaaaaaaa-0004-0001-0001-000000000004',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'Dev Viewer',
    '9333333333',
    'VIEWER',
    TRUE
  )
ON CONFLICT (firm_id, phone) DO NOTHING;

-- ============================================================
-- SECTION 4: FIRM MODULE ACCESS
-- ============================================================
-- Gives this firm access to ALL available modules.
-- module_definitions already seeded by migration 003 — we SELECT from it.
-- ============================================================
\echo '[4/17] Granting firm access to all modules...'

INSERT INTO firm_module_access (firm_id, module_id, is_active, granted_by)
SELECT
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  id,
  TRUE,
  '00000000-0000-0000-0000-000000000001'
FROM module_definitions
ON CONFLICT (firm_id, module_id) DO NOTHING;

-- ============================================================
-- SECTION 5: ROLE MODULE PERMISSIONS
-- ============================================================
\echo '[5/17] Setting role module permissions...'

-- FIRM_HEAD: full CRUD on all modules
INSERT INTO role_module_permissions
  (firm_id, role, module_id, can_create, can_read, can_update, can_delete, updated_by)
SELECT
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'FIRM_HEAD',
  id, TRUE, TRUE, TRUE, TRUE,
  'aaaaaaaa-0001-0001-0001-000000000001'
FROM module_definitions
ON CONFLICT (firm_id, role, module_id) DO NOTHING;

-- AUTHORIZER: authorize KCs (create+read+update), read trucks/customers/ledger/others
INSERT INTO role_module_permissions
  (firm_id, role, module_id, can_create, can_read, can_update, can_delete, updated_by)
VALUES
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'DASHBOARD',        FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'TRUCKS',           FALSE, TRUE,  TRUE,  FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'KC',               TRUE,  TRUE,  TRUE,  FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'CUSTOMERS',        FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'LEDGER',           FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'SUMMARY_SHEETS',   FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'REPORTS',          FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'SALARY',           FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'USERS',            FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'SETTINGS',         FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'ROLE_PERMISSIONS', FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001')
ON CONFLICT (firm_id, role, module_id) DO NOTHING;

-- OPERATOR: create+read on KC, TRUCKS, CUSTOMERS; limited elsewhere
INSERT INTO role_module_permissions
  (firm_id, role, module_id, can_create, can_read, can_update, can_delete, updated_by)
VALUES
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'DASHBOARD',        FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'TRUCKS',           TRUE,  TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'KC',               TRUE,  TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'CUSTOMERS',        TRUE,  TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'LEDGER',           FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'SUMMARY_SHEETS',   FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'REPORTS',          FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'SALARY',           FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'USERS',            FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'SETTINGS',         FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'ROLE_PERMISSIONS', FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001')
ON CONFLICT (firm_id, role, module_id) DO NOTHING;

-- VIEWER: read-only on visible modules
INSERT INTO role_module_permissions
  (firm_id, role, module_id, can_create, can_read, can_update, can_delete, updated_by)
VALUES
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'DASHBOARD',        FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'TRUCKS',           FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'KC',               FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'CUSTOMERS',        FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'LEDGER',           FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'SUMMARY_SHEETS',   FALSE, TRUE,  FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'REPORTS',          FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'SALARY',           FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'USERS',            FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'SETTINGS',         FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'ROLE_PERMISSIONS', FALSE, FALSE, FALSE, FALSE, 'aaaaaaaa-0001-0001-0001-000000000001')
ON CONFLICT (firm_id, role, module_id) DO NOTHING;

-- ============================================================
-- SECTION 6: CONFIG VERSION
-- ============================================================
\echo '[6/17] Inserting Config Version...'

INSERT INTO config_versions
  (id, firm_id, version, effective_from, is_active, created_by)
VALUES (
  'bbbbbbbb-0001-0001-0001-000000000001',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  1,
  '2024-01-01 00:00:00+00',
  TRUE,
  'aaaaaaaa-0001-0001-0001-000000000001'
)
ON CONFLICT (firm_id, version) DO NOTHING;

-- ============================================================
-- SECTION 7: GRADE CONFIGS
-- ============================================================
\echo '[7/17] Inserting Grade Configs (A, B, C)...'

INSERT INTO grade_configs
  (id, firm_id, config_version_id, grade_code, grade_label, sort_order, is_active)
VALUES
  (
    'cccccccc-0001-0001-0001-000000000001',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'A', 'Grade A', 1, TRUE
  ),
  (
    'cccccccc-0002-0001-0001-000000000002',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'B', 'Grade B', 2, TRUE
  ),
  (
    'cccccccc-0003-0001-0001-000000000003',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'C', 'Grade C', 3, TRUE
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 8: COMMISSION CONFIG
-- ============================================================
-- Scope: FIRM-level, 2% of gross, rounds HALF_UP
-- ============================================================
\echo '[8/17] Inserting Commission Config...'

INSERT INTO commission_configs
  (id, firm_id, config_version_id, scope, commission_type, commission_value,
   rounding_strategy, effective_from)
VALUES (
  'dddddddd-0001-0001-0001-000000000001',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'bbbbbbbb-0001-0001-0001-000000000001',
  'FIRM', 'PERCENTAGE', 2.0000,
  'ROUND_HALF_UP', '2024-01-01 00:00:00+00'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 9: APMC FEE CONFIG
-- ============================================================
-- 0.5% of gross amount
-- ============================================================
\echo '[9/17] Inserting APMC Fee Config...'

INSERT INTO apmc_fee_configs
  (id, firm_id, config_version_id, fee_type, fee_value, effective_from)
VALUES (
  'dddddddd-0002-0001-0001-000000000002',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'bbbbbbbb-0001-0001-0001-000000000001',
  'PERCENTAGE', 0.5000, '2024-01-01 00:00:00+00'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 10: BAARDANA CONFIG
-- ============================================================
-- ₹5 per bag, PER_KG mode (also used for PER_NAG KCs at line-item level)
-- baardana_provider=FIRM means default is firm-supplied bags
-- ============================================================
\echo '[10/17] Inserting Baardana Config...'

INSERT INTO baardana_configs
  (id, firm_id, config_version_id, cost_per_unit, unit_label, effective_from,
   rate_mode, baardana_provider, default_bags)
VALUES (
  'dddddddd-0003-0001-0001-000000000003',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'bbbbbbbb-0001-0001-0001-000000000001',
  5.00, 'bag', '2024-01-01 00:00:00+00',
  'PER_KG', 'FIRM', 1
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 11: PAYMENT MODE CONFIGS
-- ============================================================
\echo '[11/17] Inserting Payment Modes (CASH, BANK, UPI)...'

INSERT INTO payment_mode_configs
  (id, firm_id, mode_code, mode_label, requires_reference, is_credit, is_active)
VALUES
  ('eeeeeeee-0001-0001-0001-000000000001', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'CASH', 'Cash',          FALSE, FALSE, TRUE),
  ('eeeeeeee-0002-0001-0001-000000000002', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'BANK', 'Bank Transfer', TRUE,  FALSE, TRUE),
  ('eeeeeeee-0003-0001-0001-000000000003', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'UPI',  'UPI',           FALSE, FALSE, TRUE)
ON CONFLICT (firm_id, mode_code) DO NOTHING;

-- ============================================================
-- SECTION 12: CUSTOMERS
-- ============================================================
-- A: Ramesh Kumar  — 3 authorized KCs, partial payment → udhar
-- B: Suresh Patel  — 2 authorized KCs, overpaid → credit balance
-- C: Amit Shah     — 1 DRAFT KC, 0 authorized → balance = 0
-- D: Vijay Singh   — 1 authorized KC, fully paid → settled
-- E: Priya Sharma  — no KCs at all → new customer
-- ============================================================
\echo '[12/17] Inserting Customers...'

INSERT INTO customers (id, firm_id, name, phone, address, version)
VALUES
  ('ffffffff-0001-0001-0001-000000000001', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'Ramesh Kumar', '9800000001', 'Village Rampur, Dist. XYZ - 110001',  1),
  ('ffffffff-0002-0001-0001-000000000002', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'Suresh Patel', '9800000002', 'Plot 12, Market Road, City B - 380001', 1),
  ('ffffffff-0003-0001-0001-000000000003', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'Amit Shah',    '9800000003', 'Flat 5, Colony C, City C - 400001',     1),
  ('ffffffff-0004-0001-0001-000000000004', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'Vijay Singh',  '9800000004', 'House 7, Village D, Dist. D - 302001',  1),
  ('ffffffff-0005-0001-0001-000000000005', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'Priya Sharma', '9800000005', 'Shop 3, Market E, City E - 500001',     1)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 13: TRUCKS
-- ============================================================
-- 1: HR-26-AB-1234 — SCHEDULED, arrival_date = today
-- 2: UP-32-CD-5678 — ARRIVED,   arrival_date = today
-- 3: MH-12-EF-9012 — CLOSED,    arrival_date = yesterday
-- 4: RJ-14-GH-3456 — CLOSED,    arrival_date = 2 days ago
-- ============================================================
\echo '[13/17] Inserting Trucks...'

-- truck_number + sale_date are the entity columns (from migration 002)
-- registration_number + arrival_date are the original schema columns (migration 001, NOT NULL)
-- Both must be populated so both the DB constraint and the API entity are satisfied.
INSERT INTO trucks
  (id, firm_id, source_location, driver_name,
   registration_number, truck_number,
   inam_amount,
   arrival_date, sale_date,
   status, idempotency_key, created_by)
VALUES
  (
    '11111111-0001-0001-0001-000000000001',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'Agra Mandi', 'Mohan Lal',
    'HR-26-AB-1234', 'HR-26-AB-1234',
    500.00,
    CURRENT_DATE, CURRENT_DATE,
    'SCHEDULED', 'idem-truck-001', 'aaaaaaaa-0003-0001-0001-000000000003'
  ),
  (
    '11111111-0002-0001-0001-000000000002',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'Mathura Mandi', 'Ram Kishan',
    'UP-32-CD-5678', 'UP-32-CD-5678',
    400.00,
    CURRENT_DATE, CURRENT_DATE,
    'ARRIVED', 'idem-truck-002', 'aaaaaaaa-0003-0001-0001-000000000003'
  ),
  (
    '11111111-0003-0001-0001-000000000003',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'Jaipur Mandi', 'Sunil Kumar',
    'MH-12-EF-9012', 'MH-12-EF-9012',
    500.00,
    CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day',
    'CLOSED', 'idem-truck-003', 'aaaaaaaa-0003-0001-0001-000000000003'
  ),
  (
    '11111111-0004-0001-0001-000000000004',
    '115c557f-0c07-4162-b3bc-84f1feab88fb',
    'Pune Mandi', 'Rajesh Sharma',
    'RJ-14-GH-3456', 'RJ-14-GH-3456',
    300.00,
    CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '2 days',
    'CLOSED', 'idem-truck-004', 'aaaaaaaa-0003-0001-0001-000000000003'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 14: KACCHA CHITTHAS
-- ============================================================
-- Calculations verified:
--
-- KC-001 (AUTHORIZED, Ramesh, Truck 3, yesterday):
--   Line1: Grade A, 50 bags × 40 kg/bag = 2000 kg @ ₹20/kg → ₹40,000; baardana FIRM ₹250
--   Line2: Grade B, 30 bags × 40 kg/bag = 1200 kg @ ₹18/kg → ₹21,600; baardana CUSTOMER ₹150
--   Gross=₹61,600 | APMC(0.5%)=₹308 | Comm(2%)=₹1,232 | Baardana=₹400
--   Net payable = 61600 − 308 − 1232 − 400 = ₹59,660
--   Payment: ₹30,000 cash → Udhar = ₹29,660
--
-- KC-002 (AUTHORIZED, Ramesh, Truck 3, yesterday):
--   Line1: Grade A, 100 bags × 45 kg/bag = 4500 kg @ ₹22/kg → ₹99,000; baardana FIRM ₹500
--   Gross=₹99,000 | APMC=₹495 | Comm=₹1,980 | Baardana=₹500
--   Net payable = 99000 − 495 − 1980 − 500 = ₹96,025
--   Payment: ₹0 → full Udhar = ₹96,025
--   ▶ Customer A total udhar = 29,660 + 96,025 = ₹1,25,685
--
-- KC-003 (AUTHORIZED, Suresh, Truck 4, 2 days ago):
--   Line1: Grade B, 20 bags × 50 kg/bag = 1000 kg @ ₹15/kg → ₹15,000; baardana FIRM ₹100
--   Net payable = 15000 − 75 − 300 − 100 = ₹14,525
--   Payment: ₹20,000 BANK → overpaid by ₹5,475
--
-- KC-004 (AUTHORIZED, Vijay, Truck 4, 2 days ago):
--   Line1: Grade C, 10 bags × 30 kg/bag = 300 kg @ ₹12/kg → ₹3,600; baardana FIRM ₹50
--   Net payable = 3600 − 18 − 72 − 50 = ₹3,460
--   Payment: ₹3,460 CASH → fully settled
--
-- KC-005 (DRAFT, Amit, Truck 2, today):
--   Line1: Grade A, 25 bags × 35 kg/bag = 875 kg @ ₹19/kg → ₹16,625; baardana FIRM ₹125
--   Net payable = 16625 − 83.13 − 332.50 − 125 = ₹16,084.37  [not yet authorized]
--
-- KC-006 (CANCELLED, Ramesh, Truck 3, yesterday):
--   Line1: Grade B, 15 bags × 40 kg/bag = 600 kg @ ₹16/kg → ₹9,600
--   Reason: "Wrong data entry" — no payment recorded
--
-- KC-007 (AUTHORIZED, Suresh, Truck 3, yesterday, PER_NAG rate mode):
--   Line1: Grade A, 40 bags @ ₹800/nag → gross = 40 × 800 = ₹32,000
--          (rate_per_kg column stores rate_per_nag; total_weight_kg=40 as dummy)
--   Net payable = 32000 − 160 − 640 − 200 = ₹31,000
--   Payment: ₹35,000 UPI → overpaid by ₹4,000
--   ▶ Customer B net: owed (14,525+31,000)=₹45,525; paid (20,000+35,000)=₹55,000
--     Credit balance = ₹9,475  (firm owes Customer B)
-- ============================================================
\echo '[14/17] Inserting Kaccha Chitthas...'

-- KC-001: AUTHORIZED, Ramesh Kumar, Truck 3, yesterday
INSERT INTO kaccha_chitthas (
  id, firm_id, kc_number, truck_id, customer_id, sale_date, status,
  total_weight_kg, total_gross_amount, total_apmc_fee, total_commission,
  total_baardana_cost, total_net_payable,
  apmc_fee_config_id, commission_config_id,
  authorized_by, authorized_at,
  idempotency_key, created_by
) VALUES (
  '22222222-0001-0001-0001-000000000001',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'KC-001',
  '11111111-0003-0001-0001-000000000003',
  'ffffffff-0001-0001-0001-000000000001',
  CURRENT_DATE - INTERVAL '1 day',
  'AUTHORIZED',
  3200.000,   -- 2000 + 1200 kg
  61600.00,
  308.00,
  1232.00,
  400.00,
  59660.00,
  'dddddddd-0002-0001-0001-000000000002',
  'dddddddd-0001-0001-0001-000000000001',
  'aaaaaaaa-0002-0001-0001-000000000002',
  NOW() - INTERVAL '23 hours',
  'idem-kc-001',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-002: AUTHORIZED, Ramesh Kumar, Truck 3, yesterday (full udhar)
INSERT INTO kaccha_chitthas (
  id, firm_id, kc_number, truck_id, customer_id, sale_date, status,
  total_weight_kg, total_gross_amount, total_apmc_fee, total_commission,
  total_baardana_cost, total_net_payable,
  apmc_fee_config_id, commission_config_id,
  authorized_by, authorized_at,
  idempotency_key, created_by
) VALUES (
  '22222222-0002-0001-0001-000000000002',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'KC-002',
  '11111111-0003-0001-0001-000000000003',
  'ffffffff-0001-0001-0001-000000000001',
  CURRENT_DATE - INTERVAL '1 day',
  'AUTHORIZED',
  4500.000,
  99000.00,
  495.00,
  1980.00,
  500.00,
  96025.00,
  'dddddddd-0002-0001-0001-000000000002',
  'dddddddd-0001-0001-0001-000000000001',
  'aaaaaaaa-0002-0001-0001-000000000002',
  NOW() - INTERVAL '22 hours',
  'idem-kc-002',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-003: AUTHORIZED, Suresh Patel, Truck 4, 2 days ago (overpaid)
INSERT INTO kaccha_chitthas (
  id, firm_id, kc_number, truck_id, customer_id, sale_date, status,
  total_weight_kg, total_gross_amount, total_apmc_fee, total_commission,
  total_baardana_cost, total_net_payable,
  apmc_fee_config_id, commission_config_id,
  authorized_by, authorized_at,
  idempotency_key, created_by
) VALUES (
  '22222222-0003-0001-0001-000000000003',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'KC-003',
  '11111111-0004-0001-0001-000000000004',
  'ffffffff-0002-0001-0001-000000000002',
  CURRENT_DATE - INTERVAL '2 days',
  'AUTHORIZED',
  1000.000,
  15000.00,
  75.00,
  300.00,
  100.00,
  14525.00,
  'dddddddd-0002-0001-0001-000000000002',
  'dddddddd-0001-0001-0001-000000000001',
  'aaaaaaaa-0002-0001-0001-000000000002',
  NOW() - INTERVAL '47 hours',
  'idem-kc-003',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-004: AUTHORIZED, Vijay Singh, Truck 4, 2 days ago (fully paid)
INSERT INTO kaccha_chitthas (
  id, firm_id, kc_number, truck_id, customer_id, sale_date, status,
  total_weight_kg, total_gross_amount, total_apmc_fee, total_commission,
  total_baardana_cost, total_net_payable,
  apmc_fee_config_id, commission_config_id,
  authorized_by, authorized_at,
  idempotency_key, created_by
) VALUES (
  '22222222-0004-0001-0001-000000000004',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'KC-004',
  '11111111-0004-0001-0001-000000000004',
  'ffffffff-0004-0001-0001-000000000004',
  CURRENT_DATE - INTERVAL '2 days',
  'AUTHORIZED',
  300.000,
  3600.00,
  18.00,
  72.00,
  50.00,
  3460.00,
  'dddddddd-0002-0001-0001-000000000002',
  'dddddddd-0001-0001-0001-000000000001',
  'aaaaaaaa-0002-0001-0001-000000000002',
  NOW() - INTERVAL '46 hours',
  'idem-kc-004',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-005: DRAFT, Amit Shah, Truck 2 (ARRIVED), today — not yet authorized
INSERT INTO kaccha_chitthas (
  id, firm_id, kc_number, truck_id, customer_id, sale_date, status,
  total_weight_kg, total_gross_amount, total_apmc_fee, total_commission,
  total_baardana_cost, total_net_payable,
  apmc_fee_config_id, commission_config_id,
  idempotency_key, created_by
) VALUES (
  '22222222-0005-0001-0001-000000000005',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'KC-005',
  '11111111-0002-0001-0001-000000000002',
  'ffffffff-0003-0001-0001-000000000003',
  CURRENT_DATE,
  'DRAFT',
  875.000,
  16625.00,
  83.13,
  332.50,
  125.00,
  16084.37,
  'dddddddd-0002-0001-0001-000000000002',
  'dddddddd-0001-0001-0001-000000000001',
  'idem-kc-005',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-006: CANCELLED, Ramesh Kumar, Truck 3, yesterday — "Wrong data entry"
INSERT INTO kaccha_chitthas (
  id, firm_id, kc_number, truck_id, customer_id, sale_date, status,
  total_weight_kg, total_gross_amount, total_apmc_fee, total_commission,
  total_baardana_cost, total_net_payable,
  cancelled_at, cancellation_reason,
  idempotency_key, created_by
) VALUES (
  '22222222-0006-0001-0001-000000000006',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'KC-006',
  '11111111-0003-0001-0001-000000000003',
  'ffffffff-0001-0001-0001-000000000001',
  CURRENT_DATE - INTERVAL '1 day',
  'CANCELLED',
  600.000,
  9600.00,
  48.00,    -- 0.5% of 9600
  192.00,   -- 2.0% of 9600
  75.00,    -- 15 bags × ₹5
  9285.00,  -- 9600 − 48 − 192 − 75
  NOW() - INTERVAL '21 hours',
  'Wrong data entry',
  'idem-kc-006',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-007: AUTHORIZED, Suresh Patel, Truck 3, yesterday — PER_NAG rate mode
-- rate_per_kg column stores rate_per_nag (₹800/bag)
-- total_weight_kg = 40 (1 kg dummy per bag to satisfy CHECK total_weight_kg > 0)
-- gross = quantity_bags × rate_per_nag = 40 × 800 = ₹32,000
INSERT INTO kaccha_chitthas (
  id, firm_id, kc_number, truck_id, customer_id, sale_date, status,
  total_weight_kg, total_gross_amount, total_apmc_fee, total_commission,
  total_baardana_cost, total_net_payable,
  apmc_fee_config_id, commission_config_id,
  authorized_by, authorized_at,
  idempotency_key, created_by
) VALUES (
  '22222222-0007-0001-0001-000000000007',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'KC-007',
  '11111111-0003-0001-0001-000000000003',
  'ffffffff-0002-0001-0001-000000000002',
  CURRENT_DATE - INTERVAL '1 day',
  'AUTHORIZED',
  40.000,     -- dummy: 40 bags × 1 kg/bag (PER_NAG; weight is not used for pricing)
  32000.00,
  160.00,
  640.00,
  200.00,
  31000.00,
  'dddddddd-0002-0001-0001-000000000002',
  'dddddddd-0001-0001-0001-000000000001',
  'aaaaaaaa-0002-0001-0001-000000000002',
  NOW() - INTERVAL '20 hours',
  'idem-kc-007',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- ============================================================
-- SECTION 15: KC LINE ITEMS
-- ============================================================
\echo '[15/17] Inserting KC Line Items...'

-- KC-001 Line 1: Grade A, PER_KG, 50 bags × 40 kg/bag, ₹20/kg → gross ₹40,000
--                Baardana: FIRM, 50 bags × ₹5 = ₹250
INSERT INTO kc_line_items (
  id, firm_id, kc_id, grade_config_id,
  quantity_bags, weight_per_bag_kg, total_weight_kg,
  rate_per_kg, gross_amount,
  baardana_source, baardana_quantity, baardana_cost,
  rate_mode, sort_order
) VALUES (
  '33333333-0001-0001-0001-000000000001',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0001-0001-0001-000000000001',
  'cccccccc-0001-0001-0001-000000000001',
  50, 40.000, 2000.000,
  20.0000, 40000.00,
  'FIRM', 50, 250.00,
  'PER_KG', 1
);

-- KC-001 Line 2: Grade B, PER_KG, 30 bags × 40 kg/bag, ₹18/kg → gross ₹21,600
--                Baardana: CUSTOMER, 30 bags × ₹5 = ₹150
INSERT INTO kc_line_items (
  id, firm_id, kc_id, grade_config_id,
  quantity_bags, weight_per_bag_kg, total_weight_kg,
  rate_per_kg, gross_amount,
  baardana_source, baardana_quantity, baardana_cost,
  rate_mode, sort_order
) VALUES (
  '33333333-0002-0001-0001-000000000002',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0001-0001-0001-000000000001',
  'cccccccc-0002-0001-0001-000000000002',
  30, 40.000, 1200.000,
  18.0000, 21600.00,
  'CUSTOMER', 30, 150.00,
  'PER_KG', 2
);

-- KC-002 Line 1: Grade A, PER_KG, 100 bags × 45 kg/bag, ₹22/kg → gross ₹99,000
--                Baardana: FIRM, 100 bags × ₹5 = ₹500
INSERT INTO kc_line_items (
  id, firm_id, kc_id, grade_config_id,
  quantity_bags, weight_per_bag_kg, total_weight_kg,
  rate_per_kg, gross_amount,
  baardana_source, baardana_quantity, baardana_cost,
  rate_mode, sort_order
) VALUES (
  '33333333-0003-0001-0001-000000000003',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0002-0001-0001-000000000002',
  'cccccccc-0001-0001-0001-000000000001',
  100, 45.000, 4500.000,
  22.0000, 99000.00,
  'FIRM', 100, 500.00,
  'PER_KG', 1
);

-- KC-003 Line 1: Grade B, PER_KG, 20 bags × 50 kg/bag, ₹15/kg → gross ₹15,000
--                Baardana: FIRM, 20 bags × ₹5 = ₹100
INSERT INTO kc_line_items (
  id, firm_id, kc_id, grade_config_id,
  quantity_bags, weight_per_bag_kg, total_weight_kg,
  rate_per_kg, gross_amount,
  baardana_source, baardana_quantity, baardana_cost,
  rate_mode, sort_order
) VALUES (
  '33333333-0004-0001-0001-000000000004',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0003-0001-0001-000000000003',
  'cccccccc-0002-0001-0001-000000000002',
  20, 50.000, 1000.000,
  15.0000, 15000.00,
  'FIRM', 20, 100.00,
  'PER_KG', 1
);

-- KC-004 Line 1: Grade C, PER_KG, 10 bags × 30 kg/bag, ₹12/kg → gross ₹3,600
--                Baardana: FIRM, 10 bags × ₹5 = ₹50
INSERT INTO kc_line_items (
  id, firm_id, kc_id, grade_config_id,
  quantity_bags, weight_per_bag_kg, total_weight_kg,
  rate_per_kg, gross_amount,
  baardana_source, baardana_quantity, baardana_cost,
  rate_mode, sort_order
) VALUES (
  '33333333-0005-0001-0001-000000000005',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0004-0001-0001-000000000004',
  'cccccccc-0003-0001-0001-000000000003',
  10, 30.000, 300.000,
  12.0000, 3600.00,
  'FIRM', 10, 50.00,
  'PER_KG', 1
);

-- KC-005 Line 1: Grade A, PER_KG, 25 bags × 35 kg/bag, ₹19/kg → gross ₹16,625
--                Baardana: FIRM, 25 bags × ₹5 = ₹125  [DRAFT KC]
INSERT INTO kc_line_items (
  id, firm_id, kc_id, grade_config_id,
  quantity_bags, weight_per_bag_kg, total_weight_kg,
  rate_per_kg, gross_amount,
  baardana_source, baardana_quantity, baardana_cost,
  rate_mode, sort_order
) VALUES (
  '33333333-0006-0001-0001-000000000006',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0005-0001-0001-000000000005',
  'cccccccc-0001-0001-0001-000000000001',
  25, 35.000, 875.000,
  19.0000, 16625.00,
  'FIRM', 25, 125.00,
  'PER_KG', 1
);

-- KC-006 Line 1: Grade B, PER_KG, 15 bags × 40 kg/bag, ₹16/kg → gross ₹9,600
--                Baardana: FIRM, 15 bags × ₹5 = ₹75  [CANCELLED KC — kept for audit]
INSERT INTO kc_line_items (
  id, firm_id, kc_id, grade_config_id,
  quantity_bags, weight_per_bag_kg, total_weight_kg,
  rate_per_kg, gross_amount,
  baardana_source, baardana_quantity, baardana_cost,
  rate_mode, sort_order
) VALUES (
  '33333333-0007-0001-0001-000000000007',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0006-0001-0001-000000000006',
  'cccccccc-0002-0001-0001-000000000002',
  15, 40.000, 600.000,
  16.0000, 9600.00,
  'FIRM', 15, 75.00,
  'PER_KG', 1
);

-- KC-007 Line 1: Grade A, PER_NAG, 40 bags @ ₹800/nag → gross ₹32,000
--   rate_per_kg column stores rate_per_nag (₹800) — the PER_NAG convention
--   weight_per_bag_kg = 1.0 (dummy), total_weight_kg = 40 (satisfies > 0 CHECK)
--   Baardana: FIRM, 40 bags × ₹5 = ₹200
INSERT INTO kc_line_items (
  id, firm_id, kc_id, grade_config_id,
  quantity_bags, weight_per_bag_kg, total_weight_kg,
  rate_per_kg, gross_amount,
  baardana_source, baardana_quantity, baardana_cost,
  rate_mode, sort_order
) VALUES (
  '33333333-0008-0001-0001-000000000008',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0007-0001-0001-000000000007',
  'cccccccc-0001-0001-0001-000000000001',
  40, 1.000, 40.000,
  800.0000, 32000.00,
  'FIRM', 40, 200.00,
  'PER_NAG', 1
);

-- ============================================================
-- SECTION 16: KC PAYMENTS
-- ============================================================
-- KC-001: ₹30,000 CASH (partial) → udhar = ₹29,660
-- KC-002: no payment              → full udhar = ₹96,025
-- KC-003: ₹20,000 BANK           → overpaid by ₹5,475
-- KC-004: ₹3,460 CASH            → exactly settled
-- KC-005: no payment (DRAFT)
-- KC-006: no payment (CANCELLED)
-- KC-007: ₹35,000 UPI            → overpaid by ₹4,000
-- ============================================================
\echo '[16/17] Inserting KC Payments...'

-- KC-001: ₹30,000 cash, partial payment
INSERT INTO kc_payments (
  id, firm_id, kc_id, payment_mode_id,
  amount, payment_date, is_udhar,
  idempotency_key, created_by
) VALUES (
  '44444444-0001-0001-0001-000000000001',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0001-0001-0001-000000000001',
  'eeeeeeee-0001-0001-0001-000000000001',
  30000.00,
  CURRENT_DATE - INTERVAL '1 day',
  FALSE,
  'idem-pay-001',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-003: ₹20,000 bank transfer, overpayment
INSERT INTO kc_payments (
  id, firm_id, kc_id, payment_mode_id,
  amount, payment_date, is_udhar,
  notes, idempotency_key, created_by
) VALUES (
  '44444444-0002-0001-0001-000000000002',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0003-0001-0001-000000000003',
  'eeeeeeee-0002-0001-0001-000000000002',
  20000.00,
  CURRENT_DATE - INTERVAL '2 days',
  FALSE,
  'Advance payment — credit balance ₹5,475 carried forward',
  'idem-pay-002',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-004: ₹3,460 cash, exact settlement
INSERT INTO kc_payments (
  id, firm_id, kc_id, payment_mode_id,
  amount, payment_date, is_udhar,
  notes, idempotency_key, created_by
) VALUES (
  '44444444-0003-0001-0001-000000000003',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0004-0001-0001-000000000004',
  'eeeeeeee-0001-0001-0001-000000000001',
  3460.00,
  CURRENT_DATE - INTERVAL '2 days',
  FALSE,
  'Full payment — account settled',
  'idem-pay-003',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- KC-007: ₹35,000 UPI, overpayment
INSERT INTO kc_payments (
  id, firm_id, kc_id, payment_mode_id,
  amount, payment_date, is_udhar,
  notes, idempotency_key, created_by
) VALUES (
  '44444444-0004-0001-0001-000000000004',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  '22222222-0007-0001-0001-000000000007',
  'eeeeeeee-0003-0001-0001-000000000003',
  35000.00,
  CURRENT_DATE - INTERVAL '1 day',
  FALSE,
  'Advance payment — credit balance ₹4,000 carried forward',
  'idem-pay-004',
  'aaaaaaaa-0003-0001-0001-000000000003'
);

-- ============================================================
-- SECTION 17: FREIGHT / SALARY ENTRIES
-- ============================================================
-- SALARY entries have user_id (employee), no truck_id
-- INAM / KIRAYA / PARCHI entries have truck_id + driver snapshot, no user_id
--
-- 1. SALARY  — Dev Operator,    ₹15,000  (May 2026)
-- 2. SALARY  — Dev Viewer,      ₹8,000   (May 2026)
-- 3. INAM    — Truck 3 driver (Sunil Kumar),   ₹500
-- 4. KIRAYA  — Truck 3,         ₹2,000   (return journey)
-- 5. PARCHI  — Truck 4,         ₹100     (parchi charges)
-- 6. INAM    — Truck 4 driver (Rajesh Sharma), ₹300
-- ============================================================
\echo '[17/17] Inserting Freight / Salary Entries...'

-- 1. SALARY: Dev Operator
INSERT INTO salary_entries (
  id, firm_id, user_id, salary_date, amount, notes,
  freight_type, idempotency_key, created_by
) VALUES (
  '55555555-0001-0001-0001-000000000001',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'aaaaaaaa-0003-0001-0001-000000000003',
  CURRENT_DATE - INTERVAL '1 day',
  15000.00,
  'May 2026 salary',
  'SALARY',
  'idem-sal-001',
  'aaaaaaaa-0001-0001-0001-000000000001'
);

-- 2. SALARY: Dev Viewer
INSERT INTO salary_entries (
  id, firm_id, user_id, salary_date, amount, notes,
  freight_type, idempotency_key, created_by
) VALUES (
  '55555555-0002-0001-0001-000000000002',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  'aaaaaaaa-0004-0001-0001-000000000004',
  CURRENT_DATE - INTERVAL '1 day',
  8000.00,
  'May 2026 salary',
  'SALARY',
  'idem-sal-002',
  'aaaaaaaa-0001-0001-0001-000000000001'
);

-- 3. INAM: Truck 3, driver Sunil Kumar, ₹500
INSERT INTO salary_entries (
  id, firm_id, user_id, salary_date, amount, notes,
  freight_type, truck_id, driver_name, driver_phone,
  idempotency_key, created_by
) VALUES (
  '55555555-0003-0001-0001-000000000003',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  NULL,   -- INAM goes to truck driver, not an employee user
  CURRENT_DATE - INTERVAL '1 day',
  500.00,
  'Inam for Truck 3 (MH-12-EF-9012)',
  'INAM',
  '11111111-0003-0001-0001-000000000003',
  'Sunil Kumar',   -- snapshot from truck at time of entry
  NULL,
  'idem-sal-003',
  'aaaaaaaa-0001-0001-0001-000000000001'
);

-- 4. KIRAYA: Truck 3, return journey, ₹2,000
INSERT INTO salary_entries (
  id, firm_id, user_id, salary_date, amount, notes,
  freight_type, truck_id, driver_name, driver_phone,
  idempotency_key, created_by
) VALUES (
  '55555555-0004-0001-0001-000000000004',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  NULL,
  CURRENT_DATE - INTERVAL '1 day',
  2000.00,
  'Journey return',
  'KIRAYA',
  '11111111-0003-0001-0001-000000000003',
  'Sunil Kumar',
  NULL,
  'idem-sal-004',
  'aaaaaaaa-0001-0001-0001-000000000001'
);

-- 5. PARCHI: Truck 4, parchi charges, ₹100
INSERT INTO salary_entries (
  id, firm_id, user_id, salary_date, amount, notes,
  freight_type, truck_id, driver_name, driver_phone,
  idempotency_key, created_by
) VALUES (
  '55555555-0005-0001-0001-000000000005',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  NULL,
  CURRENT_DATE - INTERVAL '2 days',
  100.00,
  'Parchi charges',
  'PARCHI',
  '11111111-0004-0001-0001-000000000004',
  'Rajesh Sharma',
  NULL,
  'idem-sal-005',
  'aaaaaaaa-0001-0001-0001-000000000001'
);

-- 6. INAM: Truck 4, driver Rajesh Sharma, ₹300
INSERT INTO salary_entries (
  id, firm_id, user_id, salary_date, amount, notes,
  freight_type, truck_id, driver_name, driver_phone,
  idempotency_key, created_by
) VALUES (
  '55555555-0006-0001-0001-000000000006',
  '115c557f-0c07-4162-b3bc-84f1feab88fb',
  NULL,
  CURRENT_DATE - INTERVAL '2 days',
  300.00,
  'Inam for Truck 4 (RJ-14-GH-3456)',
  'INAM',
  '11111111-0004-0001-0001-000000000004',
  'Rajesh Sharma',
  NULL,
  'idem-sal-006',
  'aaaaaaaa-0001-0001-0001-000000000001'
);

-- ============================================================
-- SECTION 18: VERIFICATION QUERIES
-- ============================================================
\echo ''
\echo '============================================================'
\echo ' VERIFICATION RESULTS'
\echo '============================================================'

-- ── 1. Customer ledger balance summary ──────────────────────
\echo ''
\echo '--- [1] Customer Ledger Balances ---'
\echo '    (positive net_balance = udhar owed to firm)'
\echo '    (negative net_balance = credit, firm owes customer)'

SELECT
  c.name                                                                 AS customer_name,
  COUNT(k.id) FILTER (WHERE k.status = 'AUTHORIZED')                    AS authorized_kcs,
  COALESCE(
    SUM(k.total_net_payable) FILTER (WHERE k.status = 'AUTHORIZED'), 0
  )                                                                       AS total_net_payable,
  COALESCE((
    SELECT SUM(p.amount)
    FROM kc_payments p
    JOIN kaccha_chitthas kk ON p.kc_id = kk.id
    WHERE kk.customer_id = c.id
      AND kk.firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb'
      AND kk.status = 'AUTHORIZED'
  ), 0)                                                                   AS total_paid,
  COALESCE(
    SUM(k.total_net_payable) FILTER (WHERE k.status = 'AUTHORIZED'), 0
  ) - COALESCE((
    SELECT SUM(p.amount)
    FROM kc_payments p
    JOIN kaccha_chitthas kk ON p.kc_id = kk.id
    WHERE kk.customer_id = c.id
      AND kk.firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb'
      AND kk.status = 'AUTHORIZED'
  ), 0)                                                                   AS net_balance
FROM customers c
LEFT JOIN kaccha_chitthas k
  ON k.customer_id = c.id
  AND k.firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb'
WHERE c.firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb'
GROUP BY c.id, c.name
ORDER BY c.name;

-- ── 2. Edge case assertions ──────────────────────────────────
\echo ''
\echo '--- [2] Edge Case Assertions ---'

-- Customer A: must have udhar > 0 (expected: ₹1,25,685)
SELECT
  CASE
    WHEN net_balance > 0
    THEN '✅ PASS: Customer A (Ramesh Kumar) has udhar = ₹' || net_balance::TEXT
    ELSE '❌ FAIL: Customer A balance should be > 0, got ₹' || net_balance::TEXT
  END AS assertion
FROM (
  SELECT
    COALESCE(SUM(k.total_net_payable), 0) - COALESCE((
      SELECT SUM(p.amount) FROM kc_payments p
      JOIN kaccha_chitthas kk ON p.kc_id = kk.id
      WHERE kk.customer_id = 'ffffffff-0001-0001-0001-000000000001'
        AND kk.status = 'AUTHORIZED'
    ), 0) AS net_balance
  FROM kaccha_chitthas k
  WHERE k.customer_id = 'ffffffff-0001-0001-0001-000000000001'
    AND k.status = 'AUTHORIZED'
) t;

-- Customer B: must have credit (net_balance < 0) — firm owes ₹9,475
SELECT
  CASE
    WHEN net_balance < 0
    THEN '✅ PASS: Customer B (Suresh Patel) credit balance = ₹' || ABS(net_balance)::TEXT || ' (firm owes)'
    ELSE '❌ FAIL: Customer B balance should be < 0 (overpaid), got ₹' || net_balance::TEXT
  END AS assertion
FROM (
  SELECT
    COALESCE(SUM(k.total_net_payable), 0) - COALESCE((
      SELECT SUM(p.amount) FROM kc_payments p
      JOIN kaccha_chitthas kk ON p.kc_id = kk.id
      WHERE kk.customer_id = 'ffffffff-0002-0001-0001-000000000002'
        AND kk.status = 'AUTHORIZED'
    ), 0) AS net_balance
  FROM kaccha_chitthas k
  WHERE k.customer_id = 'ffffffff-0002-0001-0001-000000000002'
    AND k.status = 'AUTHORIZED'
) t;

-- Customer C: no authorized KCs → balance = 0
SELECT
  CASE
    WHEN cnt = 0
    THEN '✅ PASS: Customer C (Amit Shah) has no authorized KCs — balance = 0'
    ELSE '❌ FAIL: Customer C should have 0 authorized KCs, found ' || cnt::TEXT
  END AS assertion
FROM (
  SELECT COUNT(*) AS cnt
  FROM kaccha_chitthas
  WHERE customer_id = 'ffffffff-0003-0001-0001-000000000003'
    AND status = 'AUTHORIZED'
) t;

-- Customer D: exactly settled (balance = 0)
SELECT
  CASE
    WHEN net_balance = 0
    THEN '✅ PASS: Customer D (Vijay Singh) is fully settled — balance = 0'
    ELSE '❌ FAIL: Customer D balance should be 0, got ₹' || net_balance::TEXT
  END AS assertion
FROM (
  SELECT
    COALESCE(SUM(k.total_net_payable), 0) - COALESCE((
      SELECT SUM(p.amount) FROM kc_payments p
      JOIN kaccha_chitthas kk ON p.kc_id = kk.id
      WHERE kk.customer_id = 'ffffffff-0004-0001-0001-000000000004'
        AND kk.status = 'AUTHORIZED'
    ), 0) AS net_balance
  FROM kaccha_chitthas k
  WHERE k.customer_id = 'ffffffff-0004-0001-0001-000000000004'
    AND k.status = 'AUTHORIZED'
) t;

-- Customer E: no KCs at all
SELECT
  CASE
    WHEN cnt = 0
    THEN '✅ PASS: Customer E (Priya Sharma) has no KCs — new customer'
    ELSE '❌ FAIL: Customer E should have 0 KCs, found ' || cnt::TEXT
  END AS assertion
FROM (
  SELECT COUNT(*) AS cnt
  FROM kaccha_chitthas
  WHERE customer_id = 'ffffffff-0005-0001-0001-000000000005'
) t;

-- ── 3. Truck status check ────────────────────────────────────
\echo ''
\echo '--- [3] Truck Status Check ---'

SELECT
  registration_number,
  status,
  arrival_date,
  CASE
    WHEN status = 'SCHEDULED' AND arrival_date = CURRENT_DATE
      THEN '✅ SCHEDULED / today'
    WHEN status = 'ARRIVED' AND arrival_date = CURRENT_DATE
      THEN '✅ ARRIVED / today'
    WHEN status = 'CLOSED' AND arrival_date = CURRENT_DATE - 1
      THEN '✅ CLOSED / yesterday'
    WHEN status = 'CLOSED' AND arrival_date = CURRENT_DATE - 2
      THEN '✅ CLOSED / 2 days ago'
    ELSE '❌ UNEXPECTED'
  END AS check_result
FROM trucks
WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb'
ORDER BY arrival_date DESC, registration_number;

-- ── 4. KC status + payment balance ──────────────────────────
\echo ''
\echo '--- [4] KC Status & Balance Check ---'

SELECT
  kc.kc_number,
  kc.status,
  kc.total_net_payable,
  COALESCE((
    SELECT SUM(p.amount) FROM kc_payments p WHERE p.kc_id = kc.id
  ), 0)                                                              AS total_paid,
  kc.total_net_payable - COALESCE((
    SELECT SUM(p.amount) FROM kc_payments p WHERE p.kc_id = kc.id
  ), 0)                                                              AS balance,
  CASE
    WHEN kc.status IN ('DRAFT','CANCELLED')      THEN '— (not finalized)'
    WHEN kc.total_net_payable - COALESCE((
      SELECT SUM(p.amount) FROM kc_payments p WHERE p.kc_id = kc.id
    ), 0) > 0                                    THEN '📌 UDHAR'
    WHEN kc.total_net_payable - COALESCE((
      SELECT SUM(p.amount) FROM kc_payments p WHERE p.kc_id = kc.id
    ), 0) < 0                                    THEN '💰 CREDIT (overpaid)'
    ELSE                                              '✅ SETTLED'
  END AS payment_status
FROM kaccha_chitthas kc
WHERE kc.firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb'
ORDER BY kc.kc_number;

-- ── 5. Freight entries by type ───────────────────────────────
\echo ''
\echo '--- [5] Freight Entries by Type ---'

SELECT
  freight_type,
  COUNT(*)        AS entry_count,
  SUM(amount)     AS total_amount
FROM salary_entries
WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb'
GROUP BY freight_type
ORDER BY freight_type;

-- Expected:
--   INAM   | 2 | 800
--   KIRAYA | 1 | 2000
--   PARCHI | 1 | 100
--   SALARY | 2 | 23000

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM salary_entries WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb' AND freight_type = 'SALARY') = 2
    THEN '✅ PASS: 2 SALARY entries'
    ELSE '❌ FAIL: Expected 2 SALARY entries'
  END AS sal_check,
  CASE
    WHEN (SELECT COUNT(*) FROM salary_entries WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb' AND freight_type = 'INAM') = 2
    THEN '✅ PASS: 2 INAM entries'
    ELSE '❌ FAIL: Expected 2 INAM entries'
  END AS inam_check,
  CASE
    WHEN (SELECT COUNT(*) FROM salary_entries WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb' AND freight_type = 'KIRAYA') = 1
    THEN '✅ PASS: 1 KIRAYA entry'
    ELSE '❌ FAIL: Expected 1 KIRAYA entry'
  END AS kiraya_check,
  CASE
    WHEN (SELECT COUNT(*) FROM salary_entries WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb' AND freight_type = 'PARCHI') = 1
    THEN '✅ PASS: 1 PARCHI entry'
    ELSE '❌ FAIL: Expected 1 PARCHI entry'
  END AS parchi_check;

-- ── 6. Final data summary ─────────────────────────────────────
\echo ''
\echo '--- [6] Data Summary ---'

SELECT table_name, row_count FROM (
  SELECT 'super_admins'         AS table_name, (SELECT COUNT(*) FROM super_admins)::INT                                                                        AS row_count, 1 AS sort_key UNION ALL
  SELECT 'firms',                              (SELECT COUNT(*) FROM firms)::INT,                                                                              2 UNION ALL
  SELECT 'users',                              (SELECT COUNT(*) FROM users WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,                        3 UNION ALL
  SELECT 'module_definitions',                 (SELECT COUNT(*) FROM module_definitions)::INT,                                                                 4 UNION ALL
  SELECT 'firm_module_access',                 (SELECT COUNT(*) FROM firm_module_access WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,          5 UNION ALL
  SELECT 'role_module_permissions',            (SELECT COUNT(*) FROM role_module_permissions WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,     6 UNION ALL
  SELECT 'config_versions',                    (SELECT COUNT(*) FROM config_versions WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,             7 UNION ALL
  SELECT 'grade_configs',                      (SELECT COUNT(*) FROM grade_configs WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,               8 UNION ALL
  SELECT 'commission_configs',                 (SELECT COUNT(*) FROM commission_configs WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,          9 UNION ALL
  SELECT 'apmc_fee_configs',                   (SELECT COUNT(*) FROM apmc_fee_configs WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,           10 UNION ALL
  SELECT 'baardana_configs',                   (SELECT COUNT(*) FROM baardana_configs WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,           11 UNION ALL
  SELECT 'payment_mode_configs',               (SELECT COUNT(*) FROM payment_mode_configs WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,       12 UNION ALL
  SELECT 'customers',                          (SELECT COUNT(*) FROM customers WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,                  13 UNION ALL
  SELECT 'trucks',                             (SELECT COUNT(*) FROM trucks WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,                     14 UNION ALL
  SELECT 'kaccha_chitthas',                    (SELECT COUNT(*) FROM kaccha_chitthas WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,            15 UNION ALL
  SELECT 'kc_line_items',                      (SELECT COUNT(*) FROM kc_line_items WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,              16 UNION ALL
  SELECT 'kc_payments',                        (SELECT COUNT(*) FROM kc_payments WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,                17 UNION ALL
  SELECT 'salary_entries',                     (SELECT COUNT(*) FROM salary_entries WHERE firm_id = '115c557f-0c07-4162-b3bc-84f1feab88fb')::INT,             18
) t ORDER BY sort_key;

\echo ''
\echo '============================================================'
\echo ' SEED COMPLETE'
\echo '============================================================'
\echo ''
\echo 'Dev login credentials (any OTP in dev mode):'
\echo '  FIRM_HEAD:  phone=9999999999  firm_id=115c557f-0c07-4162-b3bc-84f1feab88fb'
\echo '  AUTHORIZER: phone=9111111111  firm_id=115c557f-0c07-4162-b3bc-84f1feab88fb'
\echo '  OPERATOR:   phone=9222222222  firm_id=115c557f-0c07-4162-b3bc-84f1feab88fb'
\echo '  VIEWER:     phone=9333333333  firm_id=115c557f-0c07-4162-b3bc-84f1feab88fb'
\echo '  SUPER ADMIN: tap "Super Admin Login" on login screen, phone=9000000000'
\echo ''
