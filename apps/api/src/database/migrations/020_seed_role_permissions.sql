-- ============================================================
-- Migration 020: Seed default role permissions for dev firm
-- AUTHORIZER: read+update trucks/kcs, read others
-- OPERATOR: create+read+update trucks/kcs/customers/salary
-- VIEWER: read-only all modules
-- ============================================================

DO $$
DECLARE
  fid UUID := '115c557f-0c07-4162-b3bc-84f1feab88fb';
BEGIN
  -- Only seed if firm exists
  IF NOT EXISTS (SELECT 1 FROM firms WHERE id = fid) THEN
    RETURN;
  END IF;

  -- ── AUTHORIZER ─────────────────────────────────────────────
  INSERT INTO role_module_permissions (firm_id, role, module_id, can_create, can_read, can_update, can_delete)
  VALUES
    (fid, 'AUTHORIZER', 'DASHBOARD',      FALSE, TRUE,  FALSE, FALSE),
    (fid, 'AUTHORIZER', 'TRUCKS',         FALSE, TRUE,  TRUE,  FALSE),
    (fid, 'AUTHORIZER', 'KC',             FALSE, TRUE,  TRUE,  FALSE),
    (fid, 'AUTHORIZER', 'CUSTOMERS',      FALSE, TRUE,  FALSE, FALSE),
    (fid, 'AUTHORIZER', 'LEDGER',         FALSE, TRUE,  FALSE, FALSE),
    (fid, 'AUTHORIZER', 'REPORTS',        TRUE,  TRUE,  FALSE, FALSE),
    (fid, 'AUTHORIZER', 'SALARY',         FALSE, TRUE,  FALSE, FALSE),
    (fid, 'AUTHORIZER', 'NOTIFICATIONS',  FALSE, TRUE,  FALSE, FALSE)
  ON CONFLICT (firm_id, role, module_id) DO UPDATE
    SET can_create=EXCLUDED.can_create, can_read=EXCLUDED.can_read,
        can_update=EXCLUDED.can_update, can_delete=EXCLUDED.can_delete;

  -- ── OPERATOR ──────────────────────────────────────────────
  INSERT INTO role_module_permissions (firm_id, role, module_id, can_create, can_read, can_update, can_delete)
  VALUES
    (fid, 'OPERATOR', 'DASHBOARD',     FALSE, TRUE,  FALSE, FALSE),
    (fid, 'OPERATOR', 'TRUCKS',        TRUE,  TRUE,  TRUE,  FALSE),
    (fid, 'OPERATOR', 'KC',            TRUE,  TRUE,  TRUE,  FALSE),
    (fid, 'OPERATOR', 'CUSTOMERS',     TRUE,  TRUE,  TRUE,  FALSE),
    (fid, 'OPERATOR', 'LEDGER',        FALSE, TRUE,  FALSE, FALSE),
    (fid, 'OPERATOR', 'REPORTS',       TRUE,  TRUE,  FALSE, FALSE),
    (fid, 'OPERATOR', 'SALARY',        TRUE,  TRUE,  TRUE,  FALSE),
    (fid, 'OPERATOR', 'NOTIFICATIONS', FALSE, TRUE,  FALSE, FALSE)
  ON CONFLICT (firm_id, role, module_id) DO UPDATE
    SET can_create=EXCLUDED.can_create, can_read=EXCLUDED.can_read,
        can_update=EXCLUDED.can_update, can_delete=EXCLUDED.can_delete;

  -- ── VIEWER ────────────────────────────────────────────────
  INSERT INTO role_module_permissions (firm_id, role, module_id, can_create, can_read, can_update, can_delete)
  VALUES
    (fid, 'VIEWER', 'DASHBOARD',     FALSE, TRUE, FALSE, FALSE),
    (fid, 'VIEWER', 'TRUCKS',        FALSE, TRUE, FALSE, FALSE),
    (fid, 'VIEWER', 'KC',            FALSE, TRUE, FALSE, FALSE),
    (fid, 'VIEWER', 'CUSTOMERS',     FALSE, TRUE, FALSE, FALSE),
    (fid, 'VIEWER', 'LEDGER',        FALSE, TRUE, FALSE, FALSE),
    (fid, 'VIEWER', 'REPORTS',       FALSE, TRUE, FALSE, FALSE),
    (fid, 'VIEWER', 'NOTIFICATIONS', FALSE, TRUE, FALSE, FALSE)
  ON CONFLICT (firm_id, role, module_id) DO UPDATE
    SET can_create=EXCLUDED.can_create, can_read=EXCLUDED.can_read,
        can_update=EXCLUDED.can_update, can_delete=EXCLUDED.can_delete;

END $$;
