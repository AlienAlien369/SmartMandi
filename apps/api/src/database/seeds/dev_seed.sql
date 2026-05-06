-- Dev seed data with proper UUID v4 values
-- Run: docker cp dev_seed.sql smart-mandi-postgres:/tmp/ && docker exec smart-mandi-postgres psql -U smart_mandi_user -d smart_mandi -f /tmp/dev_seed.sql
-- Login: phone=9999999999, otp=123456 (any), firm_id=115c557f-0c07-4162-b3bc-84f1feab88fb

INSERT INTO firms (id, name, apmc_code, is_active)
VALUES ('115c557f-0c07-4162-b3bc-84f1feab88fb', 'Dev Mandi Firm', 'DEV001', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, firm_id, name, phone, role, is_active)
VALUES ('5e138578-f0a6-4679-a463-79730d20b035', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'Dev Admin', '9999999999', 'FIRM_HEAD', true)
ON CONFLICT DO NOTHING;

INSERT INTO config_versions (id, firm_id, version, effective_from, is_active, created_by)
VALUES ('c13aa2b5-b2d5-47b1-88ab-acc68801abea', '115c557f-0c07-4162-b3bc-84f1feab88fb', 1, '2024-01-01 00:00:00+00', true, '5e138578-f0a6-4679-a463-79730d20b035')
ON CONFLICT (firm_id, version) DO NOTHING;

INSERT INTO grade_configs (id, firm_id, config_version_id, grade_code, grade_label, sort_order, is_active)
VALUES
  ('9984b5b7-15e8-42a8-9fdf-7166386b9d61', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'c13aa2b5-b2d5-47b1-88ab-acc68801abea', 'A', 'Grade A', 1, true),
  ('cf82b1f9-08cf-4aa0-b7f2-8542ecaa3f1a', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'c13aa2b5-b2d5-47b1-88ab-acc68801abea', 'B', 'Grade B', 2, true),
  ('903abb78-fed7-4605-b0e5-0bfeb51bbe3e', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'c13aa2b5-b2d5-47b1-88ab-acc68801abea', 'C', 'Grade C', 3, true)
ON CONFLICT DO NOTHING;

INSERT INTO commission_configs (id, firm_id, config_version_id, scope, commission_type, commission_value, rounding_strategy, effective_from)
VALUES ('58312e6c-91f3-4e3c-96e3-68d0bfdc7cd8', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'c13aa2b5-b2d5-47b1-88ab-acc68801abea', 'FIRM', 'PERCENTAGE', 2.0000, 'ROUND_HALF_UP', '2024-01-01 00:00:00+00')
ON CONFLICT DO NOTHING;

INSERT INTO apmc_fee_configs (id, firm_id, config_version_id, fee_type, fee_value, effective_from)
VALUES ('a5ad978d-d19a-41d2-ace2-a5b538397bdb', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'c13aa2b5-b2d5-47b1-88ab-acc68801abea', 'PERCENTAGE', 0.5000, '2024-01-01 00:00:00+00')
ON CONFLICT DO NOTHING;

INSERT INTO baardana_configs (id, firm_id, config_version_id, cost_per_unit, unit_label, effective_from)
VALUES ('0cd689c8-2f76-415c-8e0a-a5bb75022e28', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'c13aa2b5-b2d5-47b1-88ab-acc68801abea', 5.00, 'bag', '2024-01-01 00:00:00+00')
ON CONFLICT DO NOTHING;

INSERT INTO payment_mode_configs (id, firm_id, mode_code, mode_label, is_active)
VALUES
  ('467235a8-6c9b-47ad-8b72-ede2ef28faf8', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'CASH', 'Cash', true),
  ('aaf851c1-4889-4b95-b4d8-ff383c989e11', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'BANK', 'Bank Transfer', true),
  ('7444c301-b12e-4060-bdf2-2aa0e3deac49', '115c557f-0c07-4162-b3bc-84f1feab88fb', 'UPI', 'UPI', true)
ON CONFLICT (firm_id, mode_code) DO NOTHING;

SELECT 'SEED OK: firms=' || (SELECT count(*)::text FROM firms) || ' users=' || (SELECT count(*)::text FROM users) || ' grades=' || (SELECT count(*)::text FROM grade_configs) || ' payment_modes=' || (SELECT count(*)::text FROM payment_mode_configs);
