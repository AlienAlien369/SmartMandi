-- ============================================================
-- Migration 016: Add NOTIFICATIONS module definition
-- ============================================================

INSERT INTO module_definitions (id, label, description, sort_order)
VALUES ('NOTIFICATIONS', 'Notifications', 'Notification history and alerts', 9)
ON CONFLICT (id) DO NOTHING;

-- Grant NOTIFICATIONS module to dev firm
INSERT INTO firm_module_access (firm_id, module_id, is_active, granted_by)
SELECT '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID, 'NOTIFICATIONS', TRUE, 'system'
WHERE EXISTS (SELECT 1 FROM firms WHERE id = '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID)
ON CONFLICT (firm_id, module_id) DO UPDATE SET is_active = TRUE;

-- Default role permissions for NOTIFICATIONS (all roles get read access)
INSERT INTO role_permissions (firm_id, role, module_id, can_create, can_read, can_update, can_delete)
SELECT '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID, role, 'NOTIFICATIONS', FALSE, TRUE, FALSE, FALSE
FROM (VALUES ('FIRM_HEAD'), ('AUTHORIZER'), ('OPERATOR'), ('VIEWER')) AS r(role)
WHERE EXISTS (SELECT 1 FROM firms WHERE id = '115c557f-0c07-4162-b3bc-84f1feab88fb'::UUID)
ON CONFLICT (firm_id, role, module_id) DO NOTHING;
