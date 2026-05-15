-- ============================================================
-- Migration 003: RBAC — Super Admin, Module Access, Role Permissions
-- ============================================================

-- Super Admins (platform level, above all firms)
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All available modules/pages in the platform
CREATE TABLE IF NOT EXISTS module_definitions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Which modules a firm can access (Super Admin controls this)
CREATE TABLE IF NOT EXISTS firm_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES module_definitions(id),
  is_active BOOLEAN DEFAULT TRUE,
  granted_by UUID REFERENCES super_admins(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(firm_id, module_id)
);

-- CRUD permissions per role per module within a firm (Firm Head controls this)
CREATE TABLE IF NOT EXISTS role_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL,
  role TEXT NOT NULL,
  module_id TEXT NOT NULL REFERENCES module_definitions(id),
  can_create BOOLEAN DEFAULT FALSE,
  can_read BOOLEAN DEFAULT TRUE,
  can_update BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(firm_id, role, module_id)
);

CREATE INDEX IF NOT EXISTS idx_firm_module_access_firm ON firm_module_access(firm_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_firm_role ON role_module_permissions(firm_id, role);

-- ── Seed: Default module definitions ────────────────────────────────────────
INSERT INTO module_definitions (id, label, description, sort_order) VALUES
  ('DASHBOARD',      'Dashboard',        'Real-time business metrics and KPIs', 1),
  ('TRUCKS',         'Trucks',           'Truck scheduling, arrival and closure', 2),
  ('KC',             'Kaccha Chittha',   'Point-of-sale transaction slips', 3),
  ('CUSTOMERS',      'Customers',        'Customer directory and ledger', 4),
  ('LEDGER',         'Ledger',           'Financial ledger entries', 5),
  ('SUMMARY_SHEETS', 'Summary Sheets',   'Daily sale summary reports', 6),
  ('REPORTS',        'Reports',          'Export and analytics reports', 7),
  ('SALARY',         'Salary',           'Staff salary management', 8),
  ('USERS',          'Team Members',     'User and team management', 9),
  ('SETTINGS',       'Settings & Config','Firm configuration and rates', 10),
  ('ROLE_PERMISSIONS','Role Permissions','Configure role-based access (Firm Head only)', 11)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Super Admin ─────────────────────────────────────────────────────
INSERT INTO super_admins (id, name, phone) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Platform Admin', '9000000000')
ON CONFLICT (phone) DO NOTHING;

-- ── Seed: Give the seeded firm access to ALL modules ─────────────────────
-- Wrapped in WHERE EXISTS so this is a no-op if the dev firm doesn't exist yet
-- (production deployments won't have this firm; dev seed creates it separately)
INSERT INTO firm_module_access (firm_id, module_id, granted_by)
SELECT '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID, id, '00000000-0000-0000-0000-000000000001'::UUID
FROM module_definitions
WHERE EXISTS (SELECT 1 FROM firms WHERE id = '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID)
ON CONFLICT (firm_id, module_id) DO NOTHING;

-- ── Seed: Default role permissions for the seeded firm ───────────────────
-- FIRM_HEAD: full access to everything
INSERT INTO role_module_permissions (firm_id, role, module_id, can_create, can_read, can_update, can_delete)
SELECT '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID, 'FIRM_HEAD', id, TRUE, TRUE, TRUE, TRUE
FROM module_definitions
WHERE EXISTS (SELECT 1 FROM firms WHERE id = '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID)
ON CONFLICT (firm_id, role, module_id) DO NOTHING;

-- AUTHORIZER: CRUD on KC, TRUCKS, CUSTOMERS. Read-only on others.
INSERT INTO role_module_permissions (firm_id, role, module_id, can_create, can_read, can_update, can_delete)
SELECT vals.firm_id::UUID, vals.role, vals.module_id, vals.can_create, vals.can_read, vals.can_update, vals.can_delete
FROM (VALUES
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'DASHBOARD',   FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'TRUCKS',      TRUE,  TRUE,  TRUE,  FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'KC',          TRUE,  TRUE,  TRUE,  FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'CUSTOMERS',   TRUE,  TRUE,  TRUE,  FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'LEDGER',      FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'SUMMARY_SHEETS', FALSE, TRUE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'REPORTS',     FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'SALARY',      FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'USERS',       FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'SETTINGS',    FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'AUTHORIZER', 'ROLE_PERMISSIONS', FALSE, FALSE, FALSE, FALSE)
) AS vals(firm_id, role, module_id, can_create, can_read, can_update, can_delete)
WHERE EXISTS (SELECT 1 FROM firms WHERE id = '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID)
ON CONFLICT (firm_id, role, module_id) DO NOTHING;

-- OPERATOR: Create+Read on TRUCKS, KC, CUSTOMERS. Read-only on others.
INSERT INTO role_module_permissions (firm_id, role, module_id, can_create, can_read, can_update, can_delete)
SELECT vals.firm_id::UUID, vals.role, vals.module_id, vals.can_create, vals.can_read, vals.can_update, vals.can_delete
FROM (VALUES
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'DASHBOARD',   FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'TRUCKS',      TRUE,  TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'KC',          TRUE,  TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'CUSTOMERS',   TRUE,  TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'LEDGER',      FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'SUMMARY_SHEETS', FALSE, TRUE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'REPORTS',     FALSE, FALSE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'SALARY',      FALSE, FALSE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'USERS',       FALSE, FALSE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'SETTINGS',    FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'OPERATOR', 'ROLE_PERMISSIONS', FALSE, FALSE, FALSE, FALSE)
) AS vals(firm_id, role, module_id, can_create, can_read, can_update, can_delete)
WHERE EXISTS (SELECT 1 FROM firms WHERE id = '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID)
ON CONFLICT (firm_id, role, module_id) DO NOTHING;

-- VIEWER: Read-only on most modules
INSERT INTO role_module_permissions (firm_id, role, module_id, can_create, can_read, can_update, can_delete)
SELECT vals.firm_id::UUID, vals.role, vals.module_id, vals.can_create, vals.can_read, vals.can_update, vals.can_delete
FROM (VALUES
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'DASHBOARD',   FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'TRUCKS',      FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'KC',          FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'CUSTOMERS',   FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'LEDGER',      FALSE, TRUE,  FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'SUMMARY_SHEETS', FALSE, TRUE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'REPORTS',     FALSE, FALSE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'SALARY',      FALSE, FALSE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'USERS',       FALSE, FALSE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'SETTINGS',    FALSE, FALSE, FALSE, FALSE),
  ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'VIEWER', 'ROLE_PERMISSIONS', FALSE, FALSE, FALSE, FALSE)
) AS vals(firm_id, role, module_id, can_create, can_read, can_update, can_delete)
WHERE EXISTS (SELECT 1 FROM firms WHERE id = '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID)
ON CONFLICT (firm_id, role, module_id) DO NOTHING;
