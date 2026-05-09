# Smart Mandi — Prompt Log
## Reproducibility & Continuous Improvement

---

## PROMPT 001 — Initial Project Setup
**Date:** Phase 1  
**Used For:** Project initialization, architecture setup, all Phase 1 documentation

### Prompt Summary
Senior Staff Engineer + System Architect + Automation Expert persona.
Goal: Transform project into production-grade, automated system.
Master prompt: Smart Mandi v2.0 (1149 lines, complete system spec).

### What It Generated
- Complete directory structure (monorepo: apps/api, apps/mobile, packages/shared)
- HLD.md with 8 Mermaid diagrams (system overview, multi-tenancy, offline-first, event-driven, KC authorization flow, entity relationships, commission flow, infrastructure)
- LLD.md with class diagrams and sequence diagrams for all Phase 1 modules
- features.md as persistent agent memory file
- agents.md with 5 specialized agent configs (backend-architect, security-scout, ledger-validator, migration-writer, test-engineer, api-documenter)
- prompts.md (this file)
- .github/copilot-instructions.md with complete coding standards
- NestJS project scaffold
- PostgreSQL migration 001 (complete Phase 1 schema: 15 tables, RLS, 9 indexes)
- Auth module (JWT RS256, RLS injection, RBAC)
- Ledger Engine (append-only, group integrity)
- Event Store (SQS adapter, retry logic)
- Audit Log (interceptor-based)
- Idempotency middleware (Redis-backed)
- GitHub Actions CI/CD workflow

### Improvements for Next Iteration
- Add Swagger decorators during module creation (not as a separate pass)
- Generate seed data script in Phase 1
- Add Docker Compose to Phase 1 deliverables

---

## PROMPT 002 — Phase 2–6: Core Workflow through Configurability
**Date:** Phase 2–6 (COMPLETE)  
**Used For:** Configurator, KC module, authorization engine, trucks, dashboard, salary, users, custom fields

### Prompt Summary
Sequential phase prompts referencing features.md + LLD.md section numbers.
Each phase: "Context: docs/features.md shows Phase N complete. Build Phase N+1 scope."

### What It Generated
- Phase 2: ConfigVersion + all config entities, CommissionCalculatorService (3 types × caps × rounding), ApmcFeeCalculatorService, KC creation + 9-step authorization flow, KC cancellation, 30+ unit tests
- Phase 3: Truck entity + TruckStatus state machine (SCHEDULED→ARRIVED→CLOSED), PurchaseEntry, TRUCK_* events, auto-estimated purchase entry on ARRIVED
- Phase 4: DashboardMetrics precomputed hourly, alert computation (overdue trucks/stale KCs), SummarySheet (immutable JSONB snapshot), ReportsService (ledger/cash-flow), CSV exports
- Phase 5: SalaryEntry + SalaryService (dual ledger write in transaction), User entity, UsersService, EventConsumerService (handleKcAuthorized, handleKcCancelled, handleTruckClosed)
- Phase 6: CustomFieldDef + CustomFieldValue entities, DB migration 003, Firm entity update (migration 004: apmc_code→apmc_name, contact_phone, address TEXT)

### Improvements
- Specifying LLD section numbers in prompts → precise implementations
- 30+ unit tests generated upfront → no regressions
- Migration numbering (001, 002, 003, 004) explicitly stated → no gaps

---

## PROMPT 003 — Phase 3: Supply Side (COMPLETE)
**Date:** Phase 3

### Prompt Template
```
Context: docs/features.md shows Phase 2 complete.
Phase 3 scope: Truck management full lifecycle + purchase entries + Baardana + Inam.
Truck states: SCHEDULED → ARRIVED → CLOSED (no backward transitions).
On ARRIVED: auto-create purchase_entry (is_estimated=true), publish TRUCK_ARRIVED event.
On CLOSED: publish TRUCK_CLOSED event, write INAM_PAID ledger entry (DEBIT firm_cash).
Block CLOSED if any DRAFT KCs exist.
DB migration 002: trucks + purchase_entries + RLS.
```

---

## PROMPT 004 — Security Audit (TEMPLATE)
**Date:** Run after each phase

### Prompt Template
```
Run security-scout agent on /apps/api/src.
Focus: RLS bypass, JWT firm_id spoofing, unvalidated inputs, missing role guards.
Generate: Security findings report with CVSS scores and remediation code.
```

---

## PROMPT 005 — Financial Integrity Tests (TEMPLATE)

### Prompt Template
```
Run ledger-validator agent.
Generate Jest tests verifying:
1. SUM(CREDIT) == SUM(DEBIT) per entry_group_id for every KC authorization scenario
2. Running balance consistency for customer, truck, firm_cash ledgers
3. Historical immutability: config change does not alter pre-existing KC totals
4. Commission/APMC computed values match stored config snapshots
```

---

## PROMPT 006 — Phase 7: RBAC & Super Admin (COMPLETE)
**Date:** Phase 7

### Prompt Summary
Build a two-tier access control system: Super Admin (firm-independent) and per-firm RBAC with module-level CRUD permissions.

### Prompt Template
```
Context: docs/features.md shows Phases 1–6 complete.
Phase 7 scope: RBAC + Super Admin system.

Super Admin:
- SuperAdmin entity (separate from firm users)
- SA login: POST /super-admin/login → SA-specific JWT (HS256)
- SA endpoints decorated @Public(), verified via verifySAToken() helper using ?admin_token query param
- SA firm CRUD: GET/POST/PUT/DELETE /super-admin/firms
- SA module assignment: GET/PUT /super-admin/firms/:id/modules
- Auto-grant all 11 modules when creating a firm

Platform Modules:
- Module entity with 11 seeded entries: DASHBOARD, TRUCKS, KCS, CUSTOMERS, LEDGER, REPORTS, SUMMARY_SHEETS, SALARY, USERS, SETTINGS, CONFIG
- firm_module_access join table (firm_id, module_id, is_active) — SA controls
- role_permissions table (firm_id, role, module_id, can_create/read/update/delete) — FIRM_HEAD controls

RBAC APIs (JWT-authenticated):
- GET /rbac/my-modules — accessible modules for current user
- GET /rbac/firm-modules — firm's enabled modules
- GET/PUT /rbac/permissions/:role — FIRM_HEAD sets CRUD per role per module

Architecture rule: SA token is never a firm JWT. SA endpoints bypass firm middleware.
```

### What It Generated
- SuperAdmin entity + SA auth flow
- Module entity + 11 seeded modules
- firm_module_access + role_permissions tables
- RbacModule: RbacService (10 methods) + RbacController + SuperAdminController
- DB migration 005: super_admins, modules (seeded), firm_module_access, role_permissions + RLS
- SA APIs: 7 endpoints with verifySAToken() DRY helper
- RBAC APIs: 5 endpoints with FIRM_HEAD role guard on mutations

### Improvements
- Specifying "SA token separate from firm JWT" explicitly → correct @Public() usage
- Naming verifySAToken() in prompt → DRY implementation vs per-handler duplication

---

## PROMPT 007 — Mobile Bug Fixes & Screen Polish (COMPLETE)
**Date:** Phase 8

### Prompt Summary
Fix accumulated bugs across mobile screens after initial screen implementation, and add SA-specific UI.

### Prompt Template
```
Context: Mobile app Phase 8. Multiple screens have bugs listed in docs/features.md "Key Bug Fixes Applied".
Fix the following:
1. authSlice.ts: duplicate initialState block; ensure interface includes isSuperAdmin, saToken, accessibleModuleIds
2. MainNavigator: tabs must be conditional on accessibleModuleIds from Redux (not hardcoded)
3. SADashboardScreen: module toggles must read res.data.module_ids correctly
4. RolePermissionsScreen: must call rbacApi.getMyModules() (not getAllModules()); add empty state when no modules assigned
5. CustomerDetailScreen: must use GET /customers/:id/history endpoint
6. KCCreate: fix ReferenceError for saleDate (was referenced before useState declaration); truck dropdown must search by truck_number
7. SalaryScreen: fix JSX unclosed tag
Architecture: API_BASE_URL lives in apps/mobile/src/api/constants.ts — never hardcode base URLs.
```

### What It Generated
- Fixed authSlice.ts with correct interface and single initialState
- MainNavigator conditional tab rendering
- SADashboardScreen with working module toggle state
- RolePermissionsScreen with firm-filtered modules + empty state
- CustomerDetailScreen using history endpoint with udhar + KC breakdown
- KCCreate with saleDate useState fix + searchable truck dropdown

### Improvements
- Listing specific bugs by file/component → agent fixes exactly those without scope creep
- Referencing "Key Bug Fixes Applied" in features.md → agent reads history before acting

---

## PROMPT 008 — Firm CRUD & Customer History (COMPLETE)
**Date:** Phase 8

### Prompt Summary
Implement the customer history endpoint and firm CRUD flows that were missing or incomplete.

### Prompt Template
```
Context: docs/features.md Phase 7+8 complete.
Tasks:
1. GET /customers/:id/history endpoint:
   - Raw SQL JOIN: kaccha_chitthas + kc_line_items + kc_payments WHERE customer_id = :id
   - Response: outstanding_udhar (sum UDHAR), total_purchases, total_value, kcs[] with line_items + payments
   - CRITICAL: Register GET /:id/history BEFORE GET /:id in CustomersController (NestJS route order)
2. DB migration 004: rename apmc_code→apmc_name in firms table, add contact_phone TEXT, convert address JSONB→TEXT
   - Use: ALTER TABLE firms RENAME COLUMN apmc_code TO apmc_name; ALTER TABLE firms ADD COLUMN contact_phone TEXT; ALTER TABLE firms ALTER COLUMN address TYPE TEXT USING address::TEXT;
3. Super Admin firm create: on POST /super-admin/firms, if firm_head param provided, auto-create user with role FIRM_HEAD
```

### What It Generated
- CustomersController: history route before /:id route
- CustomerHistoryDto with nested kcs[], outstanding_udhar aggregation
- DB migration 004 with safe column rename + type conversion
- SA firm creation with optional FIRM_HEAD auto-provisioning

### Improvements
- Specifying the exact SQL for migration 004 → avoids TypeORM generating DROP/ADD instead of RENAME
- "Register BEFORE /:id" explicit note → prevents NestJS treating 'history' as UUID param

---

---

## PROMPT 009 — Phase 9: CRUD Completion, Dynamic RBAC & Premium UI (COMPLETE)
**Date:** Phase 9

### Prompt Summary
Complete CRUD on all modules, implement dynamic permission-based UI gating, enable SA role permission management, and redesign all key screens to premium quality.

### Prompt Template
```
Context: docs/features.md Phases 1–8 complete.
Phase 9 scope: CRUD completion + dynamic RBAC enforcement + SA role permissions + premium UI.

1. RBAC enforcement:
   - PermissionsGuard: queries role_module_permissions per request for non-FIRM_HEAD roles
   - @RequirePermission(module, action) decorator on every write/delete endpoint
   - usePermissions(module) hook on mobile → {can_create, can_read, can_update, can_delete}
   - Gate Add/Edit/Delete buttons in UI — hide if permission not granted

2. Trucks: DELETE /trucks/:id — SCHEDULED only; ARRIVED/CLOSED throw BadRequestException

3. Salary: 
   - PATCH /salary/:id — notes-only update (amount immutable by financial rules)
   - DELETE /salary/:id — write reversal ledger entries (FIRM_CASH CREDIT + USER_SALARY DEBIT) before hard-deleting row

4. Users:
   - Rename deactivate() → delete(); is_active = false (soft-delete preserves FK integrity from salary/ledger/audit)
   - findAll() must filter WHERE is_active = true so deleted users disappear immediately
   - Mobile: full CRUD UI, alert says "Delete Team Member" not "Deactivate"

5. SA role permissions:
   - GET /super-admin/firms/:firmId/role-permissions?admin_token= → all role_module_permissions rows
   - PUT /super-admin/firms/:firmId/role-permissions/:role?admin_token= → calls bulkSetRolePermissions()
   - Mobile: "🔑 Permissions" tile on FirmCard → modal with role tabs + color-coded CRUD grid

6. Premium UI redesign:
   - SA Dashboard: deep navy (#050d1a), purple logo mark, 3 stat cards with color-coded tops, FirmCard with left accent bar + 5 action tiles
   - Dashboard: date filters (Today/This Week/This Month)
   - Trucks/KCs: matching premium filter chips + date filter showing correct data
   - Ledger: date filter + balance card overflow fix

Architecture rules:
- FK constraints: salary_entries.user_id, ledger_entries.created_by, audit_logs.changed_by all REFERENCE users(id)
  → User delete MUST be soft-delete; hard delete will violate FK constraints
- Salary delete MUST write reversal entries — ledger is append-only
- Truck delete guard: check truck.status === 'SCHEDULED' before deleting
```

### What It Generated
- `PermissionsGuard` with FIRM_HEAD bypass + DB query for other roles
- `@RequirePermission` decorator applied to all write/delete endpoints in Trucks, KC, Customers, Salary, Users controllers
- `usePermissions(module)` hook + all screens wired with CRUD-gated buttons
- `trucks.service.delete()` with SCHEDULED guard + audit log
- `salary.service.update()` (notes-only) + `salary.service.delete()` with reversal ledger entries
- `users.service.delete()` (soft-delete, is_active=false) + `users.service.findAll()` filtered by is_active=true
- SA endpoints: `GET/PUT /super-admin/firms/:firmId/role-permissions/:role`
- `superAdminApi.getRolePermissions()` + `superAdminApi.setRolePermissions()`
- SADashboardScreen: full premium redesign (dark navy design system, action tiles, permissions modal, colored CRUD grid)
- Mobile: all CRUD UI (SalaryScreen delete, UsersScreen edit/delete, TrucksScreen delete)
- Terminology update: "Deactivate User" → "Delete Team Member" everywhere

### Improvements
- Stating exact FK constraint tables → agent chose soft-delete correctly (not hard-delete)
- Specifying "reversal entries before delete" → salary delete maintains ledger integrity
- Color-coding CRUD columns (C=green, R=blue, U=amber, D=red) in prompt → consistent SA permission grid

---

---

## PROMPT 010 — Phase 10: Extended Features Batch (COMPLETE)
**Date:** Phase 10

### Prompt Summary
Multi-feature batch: KC rate mode, grade config, baardana provider, push notifications, freight type split, customer credit balance.

### Prompt Template
```
Context: docs/features.md Phases 1–9 complete.
Phase 10 batch:

1. KC Rate Mode:
   - Add rate_mode ENUM('RATE_PER_KG', 'RATE_PER_NAG') to kc_line_items (migration 009)
   - SA sets rate_mode per firm via PUT /super-admin/firms/:id/rate-mode
   - KC line item form shows dynamic label based on mode
   - gross_amount: RATE_PER_KG = weight × rate, RATE_PER_NAG = nag_count × rate

2. Grade Config (per firm):
   - grades table: id, firm_id, label, sort_order, is_active (migration 009)
   - SA CRUD: GET/POST/PUT /super-admin/firms/:id/grades
   - kc_line_items.grade_id → grades(id) FK + RLS
   - KC Create dropdown: fetch grades for current firm

3. Baardana Provider:
   - Add baardana_provider ENUM('FIRM_OWNED', 'DRIVER_PROVIDED') to baardana_configs (migration 008)
   - ConfiguratorService resolves provider at sale_date

4. Push Notifications:
   - POST /users/fcm-token — store FCM token on users table
   - NotificationService.send(recipients, title, body)
   - EventConsumerService.handleKcAuthorized: notify KC authorizer + FIRM_HEAD
   - Mobile: register token on login, handle onMessage + onNotificationOpenedApp

5. Freight types:
   - freight_type ENUM on salary_entries: EMPLOYEE_SALARY | DRIVER_INAM | DRIVER_KIRAYA | DRIVER_PARCHI
   - Create form: type determines recipient (employee vs truck driver)
   - Ledger entry description uses freight_type

6. Customer credit balance:
   - GET /customers/:id/history: add credit_balance boolean + balance_type field
   - CustomerDetailScreen: positive udhar = red "Owes Firm", negative = green "Credit Balance"
```

### What It Generated
- Migration 008: baardana_provider column
- Migration 009: rate_mode on kc_line_items, grades table
- NotificationService with FCM HTTP v1 API
- EventConsumerService updated to send notifications
- freight_type enum + salary_entries migration
- Customer history endpoint updated with credit balance flag
- KC Create rate mode adaptive form
- SA Grade management screen

### Improvements
- Batching related features into one prompt → fewer context reloads
- Specifying exact ENUM values → no naming drift
- "notify KC authorizer + FIRM_HEAD" explicit → both recipients implemented

---

## PROMPT 011 — Ledger Date Filter Bug Fix (COMPLETE)
**Date:** Phase 10 (bug fix)

### Prompt Summary
Ledger screen showed empty data on all filters. Two root causes: empty `ledger_entries` table (seeded KCs bypass event system) and timezone bug in date filter.

### Prompt Template
```
Context: Ledger screen returns empty on all filter combinations (FIRM_CASH, CUSTOMER, date range).

Root cause 1: ledger_entries table is empty. Seeded KCs are inserted as AUTHORIZED directly via SQL,
  bypassing EventConsumerService which normally writes ledger entries.
Fix: Add 30 ledger entries to comprehensive_test_seed.sql (Section 17b).
  Use double-entry bookkeeping: for each KC, write CUSTOMER CREDIT + FIRM_CASH entries.
  UUIDs must use only hex chars (0-9, a-f) for entry_group_id.

Root cause 2: reports.service.ts date filter:
  new Date('2026-05-09') = midnight UTC = 5:30 AM IST.
  Entries created before 5:30 AM on any date are wrongly excluded.
Fix: Compare date strings: entity.created_at.toISOString().slice(0, 10) >= options.from
  instead of comparing Date objects.
```

### What It Generated
- `reports.service.ts` date filter fix (string comparison)
- 30 ledger entries in `comprehensive_test_seed.sql`

### Improvements
- Specifying exact root causes → surgical fix, no regressions
- Specifying "hex chars only" for UUIDs → avoids invalid UUID seed data

---

## PROMPT 012 — Full Documentation Update (COMPLETE)
**Date:** Session (current)

### Prompt Summary
Full documentation update across all docs to match actual codebase state after 10 phases of development.

### What Was Found (Audit by Explore Agent)
- README said "migrations 001–005" — actual: 001–009
- copilot-instructions said "amounts in paise" — actual: rupees (NUMERIC 14,2)
- copilot-instructions said base path `/api/v1/{firm_id}/` — actual: no firm_id in URL
- LLD had CustomFieldsModule as registered NestJS module — entities exist but no controller/service registered
- Config endpoints in README (POST /config/versions, GET /config/resolve) — not in ConfiguratorController
- SalaryController tagged `freight` in Swagger — docs used "Salary"

### What It Updated
- README.md: migration count, API endpoint table, version header
- docs/features.md: Phase 10 section, KNOWN LIMITATIONS, AGENT CONTEXT (21 items)
- docs/HLD.md: version header, NotificationService in architecture diagram
- docs/LLD.md: version header, removed CustomFieldsModule, added NotificationModule
- docs/agents.md: added notification-engineer + graphify-analyst agents, updated fleet examples
- docs/prompts.md: added PROMPT 010-012 (this entry)
- .github/copilot-instructions.md: fixed "amounts in paise", fixed base path, updated migration count

### Meta-Lesson
Run a full doc audit after every 2-3 phases. Docs drift silently — the graphify knowledge graph + explore agent audit catches drift that manual tracking misses.

---

## META: Prompt Engineering Lessons

| Pattern | Result | Use When |
|---|---|---|
| Give domain glossary in context | Correct terminology usage | Every session |
| Reference specific section numbers | Precise implementation | Architecture decisions |
| Specify "stored at write time, never recomputed" | No accidental live computation | Financial fields |
| Name the idempotency constraint explicitly | Proper dedup implementation | All mutation endpoints |
| Use `/fleet` for parallel agents | 3-5x speed on multi-module work | Phase implementation |
| Read `features.md` first in every new session | Agent has full context | Session resumption |
| List specific bug files/components in fix prompts | No scope creep, surgical fixes | Bug fix phases |
| Specify exact SQL for migrations | RENAME vs DROP+ADD; correct type conversion | Schema migrations |
| State "Register /:id/history BEFORE /:id" explicitly | Prevents NestJS UUID parsing 'history' as a param | History endpoints |
| Separate SA and firm JWT concerns in prompt | Correct @Public() + admin_token pattern | Super Admin endpoints |
| Specify "SA auto-grant all N modules on firm create" | Correct onboarding default behavior | Multi-tenant setup |
| State FK constraints when asking for delete logic | Agent chooses soft vs hard delete correctly | Entity delete operations |
| Specify "reversal entries before delete" for financial records | Audit trail preserved even after row deletion | Salary/ledger delete |
