# Smart Mandi — Feature Tracking (Persistent Memory)
## Updated after every phase — agent context file
## Current: Phase 10 Extended Features (COMPLETE)

---

## PROJECT: Smart Mandi
**Stack:** NestJS · PostgreSQL · React Native · AWS SQS · Redis  
**Architecture:** Multi-tenant SaaS · Event-driven · Offline-first · Append-only ledger

---

## ✅ PHASE 1 — Foundation (COMPLETE)

### Completed
- [x] Project directory structure (monorepo: apps/api, apps/mobile, packages/shared)
- [x] Documentation scaffolding (HLD.md, LLD.md, features.md, prompts.md, agents.md)
- [x] .github/copilot-instructions.md
- [x] NestJS project initialization
- [x] Database migration 001 — all Phase 1 tables + RLS + indexes
- [x] Auth module (JWT RS256, firm_id RLS injection, RBAC guards)
- [x] Ledger Engine (append-only, group integrity, running balance)
- [x] Event Store module (publish, retry, dead-letter, SQS adapter)
- [x] Audit Log module (append-only, interceptor)
- [x] Idempotency middleware (Redis-backed, 24h TTL)
- [x] CI/CD GitHub Actions workflow

### Pending in Phase 1
- [ ] Integration tests for ledger group integrity
- [x] Docker Compose dev environment (added post-Phase 1)
- [ ] Swagger API documentation auto-generation

---

## ✅ PHASE 2 — Core Workflow (COMPLETE)

### Completed
- [x] Configurator module: ConfigVersion, GradeConfig, ApmcFeeConfig, CommissionConfig, BaardanaConfig, PaymentModeConfig entities
- [x] Config version resolution — always fetches config active at `sale_date`, not current config
- [x] Customer module: CRUD, soft-delete, search (ILIKE on name/phone), audit trail
- [x] KC entities: KacchaChittha + KcLineItem + KcPayment
- [x] CommissionCalculatorService: all 3 types (PERCENTAGE, FIXED_PER_KG, FIXED_PER_TRANSACTION) × min/max caps × 4 rounding strategies
- [x] ApmcFeeCalculatorService: all 3 fee types × PERCENTAGE/FLAT discounts × min/max caps
- [x] Net payable: `gross - apmc_fee - commission` (Baardana NOT deducted from customer payable)
- [x] KC creation flow: generates sequential kc_number, computes baardana_cost per line item, stores gross_amount
- [x] KC authorization — 9-step transactional flow (Section 5.5):
  - Precondition validation (status=DRAFT, line items, weights, payment, is_dirty check)
  - Config resolution at sale_date
  - Total computation (weight, gross, apmc, commission, baardana, net_payable)
  - Pessimistic lock on KC row (authorizer-wins concurrency)
  - Ledger entries: CUSTOMER CREDIT + FIRM_CASH CREDIT (commission) + FIRM_CASH DEBIT (APMC) + payment entries
  - Audit log inside transaction
  - KC_AUTHORIZED event published to SQS after commit
- [x] KC cancellation: DRAFT→CANCELLED (no ledger), AUTHORIZED→CANCELLED (KC_CANCELLED event + reversal entries via consumer)
- [x] Calculator unit tests: 30+ test cases covering all commission types, APMC types, discounts, caps, rounding, net payable

### Pending (Phase 2)
- [ ] Custom field definitions + values (dynamic entity extension) — deferred to Phase 6
- [ ] Truck-level commission override wiring (truck_id lookup) — Phase 3

---

## ✅ PHASE 3 — Supply Side (COMPLETE)

### Completed
- [x] Truck entity: truck_number, driver, produce_name, sale_date, status lifecycle
- [x] TruckStatus state machine: SCHEDULED → ARRIVED → CLOSED (no backward transitions)
- [x] TRUCK_SCHEDULED event on create
- [x] TRUCK_ARRIVED: sets arrived_weight_kg, auto-creates estimated PurchaseEntry (is_estimated=true)
- [x] TRUCK_CLOSED: finalizes actual_weight, rate_per_kg, variance, inam_amount
  - Updates estimated PurchaseEntry to actual (is_estimated=false)
  - Publishes TRUCK_CLOSED event
- [x] PurchaseEntry entity: weight, rate, gross, baardana_cost_total, inam, total_net_payable
- [x] Trucks controller: POST /trucks, GET /trucks, GET /trucks/:id, POST /trucks/:id/arrive, POST /trucks/:id/close
- [x] DB migration 002: trucks + purchase_entries tables + RLS

---

## ✅ PHASE 4 — Dashboard & Reporting (COMPLETE)

### Completed
- [x] DashboardMetrics entity: precomputed hourly (firm+date), truck/KC counts, financial totals, alerts
- [x] DashboardService.getDashboard(): auto-refresh every 60s (stale threshold)
- [x] DashboardService.computeAndSave(): recomputes from truck/KC/ledger tables
- [x] Alert computation: overdue trucks (SCHEDULED/ARRIVED >2 days), stale draft KCs (DRAFT >24h)
- [x] SummarySheet entity: immutable snapshot (JSONB), generated on demand
- [x] SummarySheet generation: truck-grouped totals, cannot be edited after generation
- [x] ReportsService: getLedgerReport() with opening/closing balance, total credits/debits
- [x] ReportsService: getCashFlowReport() — FIRM_CASH grouped by date
- [x] CSV export: exportKcsCsv(), exportTrucksCsv()
- [x] Dashboard controller: GET /dashboard, POST /dashboard/summary-sheets, GET /dashboard/summary-sheets
- [x] Reports controller: GET /reports/ledger, GET /reports/cash-flow, GET /reports/export/kcs, GET /reports/export/trucks
- [x] DB migration 002: dashboard_metrics + summary_sheets tables + RLS

---

## ✅ PHASE 5 — Operations (COMPLETE)

### Completed
- [x] SalaryEntry entity: user_id, payment_date, amount, mode, reference
- [x] SalaryService.create(): writes FIRM_CASH DEBIT + USER_SALARY CREDIT in single transaction
- [x] Salary events: SALARY_PAID published to SQS
- [x] User entity: firm_id, phone, name, role, is_active, device_id, last_login_at
- [x] UsersService: CRUD + soft-delete (`delete()` method, `is_active = false`, `findAll` filters active-only) + phone uniqueness per firm
- [x] EventConsumerService:
  - handleKcAuthorized: recomputes dashboard metrics
  - handleKcCancelled: writes 3 reversal ledger entries (customer debit + commission debit + APMC credit)
  - handleTruckClosed: writes inam FIRM_CASH DEBIT ledger entry + recomputes dashboard
- [x] DB migration 002: users + salary_entries tables + RLS

---

## ✅ PHASE 6 — Configurability Expansion (COMPLETE)

### Completed
- [x] CustomFieldDef entity: firm_id, entity_type (KC/TRUCK/CUSTOMER/PURCHASE), field_key, label, field_type, is_required, options (JSONB)
- [x] CustomFieldValue entity: field_def_id, entity_id, entity_type, value
- [x] DB migration 003: custom_field_definitions + custom_field_values tables + RLS
- [x] Firm entity updated: apmc_name, contact_phone TEXT, address TEXT (migration 004 — renamed apmc_code→apmc_name, converted address JSONB→TEXT)
- [x] DB migration 004: firms schema update (apmc_code→apmc_name, add contact_phone, address TEXT)

---

## ✅ PHASE 7 — RBAC & Super Admin (COMPLETE)

### Completed

#### Super Admin System (firm-independent)
- [x] SuperAdmin entity: phone, name, is_active, last_login_at
- [x] Super Admin JWT separate from firm user JWT (verified via jwtService.verify())
- [x] SA endpoints at `/super-admin/*` decorated with `@Public()` + `?admin_token=<token>` auth
- [x] SA login: POST /super-admin/login (phone + any OTP in dev)
- [x] verifySAToken() private helper for DRY token validation across SA endpoints

#### Module & Permission Entities
- [x] Module entity: id, key, label, description, sort_order
- [x] 11 platform modules seeded: DASHBOARD, TRUCKS, KCS, CUSTOMERS, LEDGER, REPORTS, SUMMARY_SHEETS, SALARY, USERS, SETTINGS, CONFIG
- [x] firm_module_access table: firm_id, module_id, is_active (SA assigns modules to firms)
- [x] role_permissions table: firm_id, role, module_id, can_create, can_read, can_update, can_delete (FIRM_HEAD assigns per role per module)

#### Super Admin APIs (all require `?admin_token=` query param)
- [x] GET /super-admin/firms — list all firms with apmc_name, contact_phone, is_active, created_at
- [x] POST /super-admin/firms — create firm (auto-grants all 11 modules; optionally creates FIRM_HEAD user)
- [x] PUT /super-admin/firms/:id — update firm details (name, apmc_name, contact_phone, address)
- [x] DELETE /super-admin/firms/:id — deactivate firm (soft delete, sets is_active=false)
- [x] GET /super-admin/firms/:firmId/modules — get module_ids assigned to firm
- [x] PUT /super-admin/firms/:firmId/modules — set module_ids for firm (replaces full set)

#### RBAC APIs (firm-scoped, require JWT)
- [x] GET /rbac/my-modules — modules accessible to current user (intersect firm_module_access + role_permissions)
- [x] GET /rbac/firm-modules — all modules enabled for current firm
- [x] GET /rbac/modules — all platform modules (FIRM_HEAD only)
- [x] GET /rbac/permissions/:role — get role's CRUD permissions per module
- [x] PUT /rbac/permissions/:role — set role's CRUD permissions (FIRM_HEAD only)

#### RbacService
- [x] getAccessibleModules, getFirmModules, getFirmModuleIds, setFirmModules
- [x] getRolePermissions, setRolePermissions
- [x] createFirm, updateFirm, deactivateFirm, getAllFirms

---

## ✅ PHASE 8 — Mobile App (COMPLETE)

## ✅ PHASE 8 — Mobile App (COMPLETE)

### Completed
- [x] Project structure: apps/mobile with TypeScript strict, Babel path aliases, React Native 0.74, Expo SDK 50
- [x] Design system: tokens (colors, typography, spacing, radius, shadow), premium green/amber palette
- [x] API client: axios + JWT auto-inject + 401 auto-refresh + idempotency key auto-attachment
- [x] All API endpoint wrappers in `endpoints.ts`: auth, trucks, kcs, customers, dashboard, reports, salary, users, config, rbac
- [x] Single source of truth: `apps/mobile/src/api/constants.ts` exports API_BASE_URL
- [x] TypeScript types: all domain types, navigation param lists
- [x] Redux: authSlice with login/logout/restoreSession async thunks; state includes isSuperAdmin, saToken, accessibleModuleIds
- [x] React Query: staleTime 30s, gcTime 5min, dashboard auto-refetch 60s
- [x] Offline queue: SQLite-backed FIFO, PENDING→PROCESSING→DONE/DEAD_LETTER, 3 retries
- [x] Sync engine: NetInfo listener, drains queue on reconnect, idempotency-safe replay

#### Navigation
- [x] RootNavigator: Splash → Auth/Main/SuperAdmin
- [x] AuthNavigator: LoginScreen (firm ID + phone) + OtpVerifyScreen
- [x] MainNavigator: 5 bottom tabs conditionally rendered based on accessibleModuleIds from Redux
- [x] KCsNavigator: nested stack (KCList → KCCreate / KCDetail)
- [x] Super Admin: separate dark-themed SA panel (SADashboardScreen)

#### Screens
- [x] SplashScreen: session restore on mount
- [x] LoginScreen: firm ID + phone input; "+ Super Admin Login" link at bottom
- [x] OtpVerifyScreen: OTP input + verify
- [x] DashboardScreen: truck panel (3 status cards), KC panel, financial panel, alerts banner, auto-refresh every 60s
- [x] TruckList: filter chips (ALL/SCHEDULED/ARRIVED/CLOSED) + FAB
- [x] TruckDetail: lifecycle action buttons (Arrive/Close), truck info cards
- [x] TruckCreate: form for scheduling new truck
- [x] KCList: filter chips (ALL/DRAFT/AUTHORIZED/CANCELLED)
- [x] KCDetail: amounts + line items + payments + Authorize/Cancel action buttons
- [x] KCCreate: header (truck searchable dropdown — shows ARRIVED+SCHEDULED trucks by truck_number) + line items form + saleDate field
- [x] CustomerList: search by name/phone
- [x] CustomerDetailScreen: profile card, outstanding udhar card (red/green), stats row (total KCs, total value, udhar), expandable KC cards with full breakdown (line items + payments) — uses GET /customers/:id/history
- [x] CustomerCreate: form for new customer
- [x] LedgerScreen: type selector, balance summary (opening/credits/closing), entry list with debit/credit colors
- [x] ReportsScreen: summary sheet list, generate + export actions
- [x] SalaryScreen: salary entries list + create salary modal
- [x] TeamMembersScreen (UsersScreen): user list, add user modal with role picker
- [x] MoreMenuScreen: profile card, navigation links, logout
- [x] RolePermissionsScreen: CRUD toggle grid per role per module — only shows firm-assigned modules (uses rbacApi.getMyModules())
- [x] SADashboardScreen: full SA panel with firm list, create/edit/deactivate firm modals, module toggle modal per firm (shows count e.g. "Dev Mandi · 9 of 11 enabled")

#### Key Bug Fixes Applied
- [x] authSlice.ts: removed duplicate initialState block; interface includes isSuperAdmin, saToken, accessibleModuleIds
- [x] MainNavigator: tabs conditional on accessibleModuleIds
- [x] SADashboardScreen: module toggles show correct state (reads res.data.module_ids correctly)
- [x] RolePermissionsScreen: fixed to call rbacApi.getMyModules() (not getAllModules()) + empty state when no modules assigned
- [x] CustomerDetailScreen: uses /customers/:id/history endpoint for full purchase history
- [x] KCCreate: saleDate ReferenceError fixed; truck dropdown searchable by truck_number
- [x] SalaryScreen: JSX closing tag fix
- [x] DB migration 004: firms schema corrections (apmc_code→apmc_name, add contact_phone, address TEXT)

---

## ✅ PHASE 9 — CRUD Completion, Dynamic RBAC & Premium UI (COMPLETE)

### Completed

#### Dynamic RBAC — PermissionsGuard
- [x] `PermissionsGuard` registered as global provider in AppModule — queries `role_module_permissions` per request
- [x] `@RequirePermission(module, action)` decorator on every write/delete endpoint
- [x] FIRM_HEAD bypasses all permission checks (full access by design)
- [x] `usePermissions(module)` hook on mobile — fetches `/rbac/my-permissions` → `{can_create, can_read, can_update, can_delete}`
- [x] Mobile UI gates: Add button gated by `can_create`, Edit by `can_update`, Delete by `can_delete` across all screens (Trucks, KCs, Customers, Salary, Users)

#### Full CRUD Completion (Backend)
- [x] **Trucks DELETE**: `DELETE /trucks/:id` — SCHEDULED trucks only; ARRIVED/CLOSED throw `BadRequestException` (have financial records); audit logged
- [x] **Salary UPDATE**: `PATCH /salary/:id` — notes-only update (amount is immutable per append-only rules)
- [x] **Salary DELETE**: `DELETE /salary/:id` — writes FIRM_CASH CREDIT + USER_SALARY DEBIT reversal ledger entries before hard-deleting the salary_entry row; preserves audit trail
- [x] **Users DELETE**: renamed `deactivate()` → `delete()` — soft-delete (`is_active = false`) to preserve FK integrity; `findAll()` now filters `WHERE is_active = true` so deleted users vanish from list immediately

#### Full CRUD Completion (Mobile)
- [x] `trucksApi.delete(id)` — calls `DELETE /trucks/:id`
- [x] `salaryApi.update(id, notes)` — calls `PATCH /salary/:id`
- [x] `salaryApi.delete(id)` — calls `DELETE /salary/:id`
- [x] `usersApi.delete(id)` — renamed from `usersApi.deactivate`; calls `DELETE /users/:id`
- [x] SalaryScreen: delete button (gated by `can_delete`), confirm alert "Delete Salary Entry"
- [x] UsersScreen: full CRUD — edit modal (pre-filled, phone hidden in edit mode), delete button; alert "Delete Team Member"
- [x] TrucksScreen: delete tile on SCHEDULED trucks only

#### Super Admin Role Permissions
- [x] `GET /super-admin/firms/:firmId/role-permissions?admin_token=` — returns all `role_module_permissions` rows for any firm
- [x] `PUT /super-admin/firms/:firmId/role-permissions/:role?admin_token=` — sets CRUD permissions for a role in a firm; calls existing `bulkSetRolePermissions()`
- [x] SADashboardScreen: "🔑 Permissions" action tile on each FirmCard; opens Role Permissions modal
- [x] Role tabs (AUTHORIZER / OPERATOR / VIEWER) with colored dots; color-coded C/R/U/D column headers
- [x] Permission grid: color-coded checkboxes (C=green, R=blue, U=amber, D=red); alternating row backgrounds
- [x] Permissions cached across role-tab switches to avoid redundant API calls

#### Premium UI Redesign
- [x] **SA Dashboard**: Deep navy (`#050d1a`) design system; purple `SA` logo mark header; 3 colored-top stat cards; FirmCard with left accent bar + initials avatar + 5 color-coded action tiles; all modals use unified `sheetContainer/sheetHandle/sheetHeader` design
- [x] **Dashboard screen**: Date filters (Today / This Week / This Month); premium financial cards
- [x] **Trucks page**: Premium filter chips matching KC page design; date filter
- [x] **KC page**: Premium filter chips + date filter (matching trucks); correct data shown per filter
- [x] **Ledger screen**: Date filter (premium); balance cards redesigned — amount overflow handled, fixed alignment at all balance sizes
- [x] **App-wide safe-area**: Increased top/bottom padding for curved/full-screen phones with notch + bottom nav bar

#### Firm Name Display
- [x] After login, firm name from JWT/profile shown in app header and relevant screens
- [x] Firm name sourced from backend — no hardcoding in mobile

#### Terminology Updates
- [x] "Deactivate User" → "Delete Team Member" in all alerts, success messages, and API layer
- [x] Users list no longer shows soft-deleted users (filtered at DB query level)

---

## ✅ PHASE 10 — Extended Features & Bug Fixes (COMPLETE)

### KC Rate Mode (Configurable per Firm)
- [x] `rate_mode` field added to `kc_line_items` table (migration 009)
- [x] Two rate modes: **RATE_PER_KG** (default) and **RATE_PER_NAG** (per bag/baardana)
- [x] SA configures rate mode per firm via `PUT /super-admin/firms/:id/rate-mode`
- [x] KC line item form adapts dynamically — shows "Rate/Kg" or "Rate/Nag" label
- [x] `gross_amount` calculation switches based on mode: `weight × rate` vs `nag_count × rate`

### Grade Configuration (Per-Firm Custom Terminology)
- [x] `grades` table added (migration 009): `id, firm_id, label, sort_order, is_active`
- [x] SA creates/edits grades per firm via `GET/POST/PUT /super-admin/firms/:id/grades`
- [x] `grade_id` on `kc_line_items` references `grades` table (FK + RLS)
- [x] KC Create screen: grade dropdown populated from firm-specific grades API
- [x] Grades screen in SA Dashboard: full CRUD to configure labels (e.g. "A Grade", "Pili Matar", "Desi")

### Baardana Provider Config (Per-Firm)
- [x] Baardana config entity: `baardana_provider` field (FIRM_OWNED | DRIVER_PROVIDED) added (migration 008)
- [x] ConfiguratorService.resolveConfig(): returns `baardana_provider` alongside existing config
- [x] KC line item creation: `baardana_cost` ledger direction depends on provider

### Push Notifications (KC Authorization)
- [x] FCM integration: `POST /users/fcm-token` stores device token on user record
- [x] `NotificationService` dispatched by `EventConsumerService` on `KC_AUTHORIZED`
- [x] Recipients: **KC authorizer** + **FIRM_HEAD** of the firm → both receive push notification
- [x] Notification payload: `"KC #<number> Authorized"` with KC amount summary
- [x] Mobile: FCM token registered on login via `usersApi.saveFcmToken(token)`

### Freight Payments Screen (Renamed from Salary)
- [x] `SalaryController` tagged as `@ApiTags('freight')` — UI uses "Freight" terminology
- [x] `freight_type` column on `salary_entries`: EMPLOYEE_SALARY | DRIVER_INAM | DRIVER_KIRAYA | DRIVER_PARCHI
- [x] Create freight payment form: type selector determines recipient (employee vs truck driver)
- [x] Freight list: grouped by type with color-coded badges
- [x] Ledger entry label reflects freight type (not generic "SALARY")

### Customer Credit Balance (Negative Udhar)
- [x] `CustomerDetailScreen`: when firm owes customer money (negative udhar), shows green "Credit Balance" card
- [x] Balance logic: positive udhar = customer owes firm (red); negative = firm owes customer (green)
- [x] `GET /customers/:id/history` response includes `credit_balance` flag + `balance_type` field

### Ledger Date Filter Fix
- [x] **Bug fixed**: `reports.service.ts` date filter used `new Date('YYYY-MM-DD')` which resolves to midnight UTC = 5:30 AM IST — entries before 5:30 AM on any date were wrongly excluded
- [x] **Fix**: replaced Date object comparison with ISO string comparison (`.toISOString().slice(0,10)`)
- [x] All 5 filter combinations verified: FIRM_CASH/CUSTOMER/TRUCK/USER_SALARY + date range

### SADashboardScreen Text Rendering Fix
- [x] **Bug fixed**: bare string `{condition && 'text'}` inside RCTView caused "Text strings must be rendered within a `<Text>` component" crash on Android
- [x] **Fix**: wrapped all conditional string renders in `<Text>` components in SADashboardScreen

### Comprehensive Test Seed
- [x] `apps/api/src/database/seeds/comprehensive_test_seed.sql` — master test dataset
- [x] 30 ledger entries added (Section 17b) covering all business scenarios
- [x] Double-entry bookkeeping verified: SUM(CREDIT) == SUM(DEBIT) per entry_group_id

### Graphify Knowledge Graph
- [x] `graphify-out/graph.html` — 663-node interactive knowledge graph (open in browser)
- [x] `graphify-out/GRAPH_REPORT.md` — 35KB audit report: god nodes, surprising connections, 25 community labels
- [x] God nodes: `SuperAdminController` (24 edges), `ConfiguratorService` (22), `RbacService` (18)

---

## SEEDED TEST CREDENTIALS

| Role | Phone | Firm ID | Notes |
|---|---|---|---|
| SUPER_ADMIN | 9000000000 | n/a | Tap "Super Admin Login" on login screen, any OTP |
| FIRM_HEAD | 9999999999 | 115c557f-0c07-4162-b3bc-84f1feab88fb | Any OTP in dev |
| AUTHORIZER | 9111111111 | same firm | Any OTP in dev |
| OPERATOR | 9222222222 | same firm | Any OTP in dev |
| VIEWER | 9333333333 | same firm | Any OTP in dev |

---

## ARCHITECTURE DECISIONS

| Decision | Choice | Reason |
|---|---|---|
| Multi-tenancy | PostgreSQL RLS | Zero cross-tenant data leakage at DB layer |
| Ledger | Append-only, no UPDATE/DELETE | Financial auditability requirement |
| Offline sync | Idempotency keys + operation queue | At-least-once delivery with dedup |
| Events | AWS SQS + DB event store | Reliable async, at-least-once |
| Auth | JWT RS256 + refresh tokens | Stateless, mobile-friendly |
| Commission/fees | Computed+stored at authorization | Historical immutability |
| Config | Versioned with effective_from/to | Rules change over time without retroactive effect |
| Amounts | NUMERIC(14,2) in DB, Decimal.js in app | No floating point rounding errors |
| Super Admin isolation | SA uses separate JWT (not firm JWT) | Prevents SA token from being used as firm token |
| SA endpoints | @Public() + ?admin_token query param | Avoids JWT middleware; SA token verified inside handler |
| Module access hierarchy | SA assigns modules to firms → FIRM_HEAD assigns CRUD per role → users see permitted tabs | Three-layer delegation of access control |
| accessibleModuleIds flow | Fetched from /rbac/my-modules after login → stored in Redux + AsyncStorage; re-fetched on restoreSession | Always up-to-date without full re-login |
| API_BASE_URL | Single source of truth in constants.ts | Change one file to update all API calls across the app |
| Route order in NestJS | GET /:id/history must be registered before GET /:id | Prevents NestJS treating "history" as a UUID param |
| User delete strategy | Soft-delete (is_active=false) + findAll filter | Hard delete violates FK constraints from salary_entries, ledger_entries, audit_logs, trucks, kcs; soft-delete preserves audit trail while hiding user from all list queries |
| Salary delete strategy | Write reversal ledger entries, then hard-delete salary_entry row | Ledger is append-only; salary_entry row deletion preserves accounting integrity via reversal entries |
| Truck delete guard | Only SCHEDULED trucks can be deleted | ARRIVED/CLOSED trucks have financial records (PurchaseEntry, inam ledger); deleting would orphan them |
| Dynamic RBAC | PermissionsGuard queries role_module_permissions per request | Runtime configurability — FIRM_HEAD and SA can change permissions without redeployment |

---

## KNOWN LIMITATIONS

- OTP is mocked in dev (`NODE_ENV === 'development'`) — real SMS via Twilio/MSG91 needed for production
- JWT uses `HS256` (secret-based) for dev — upgrade to `RS256` asymmetric keys for production
- SA token uses HS256 shared secret — use RS256 asymmetric in production
- KC number is count-based (not concurrency-safe at extreme scale) — upgrade to DB SEQUENCE in production
- Summary sheet generation is synchronous — move to background job for large date ranges
- CSV export returns raw text — add proper download + share for mobile in production
- Custom fields UI (mobile) not yet implemented — data model is ready (CustomFieldDef + CustomFieldValue), no controller/service registered yet
- Commission truck-level override UI (mobile) not yet implemented
- Push notifications require `google-services.json` (FCM) — not committed to repo; must be added from Firebase console before building Android
- FCM notifications only tested via API; end-to-end device delivery needs real Firebase project
- Amounts in DB are **rupees (NUMERIC 14,2)**, not paise — API transport also in rupees
- Base URL for API does NOT include `firm_id` — firm ID comes from JWT claim only
- `SalaryController` is tagged `freight` in Swagger — module name in code is `salary`
- `graphify-out/` directory contains generated knowledge graph artifacts — not committed to git

---

## AGENT CONTEXT (Quick Reference)

When resuming from a new session, read this file first. Key facts:
1. **Every table has `firm_id`** — RLS enforces isolation at the DB layer
2. **Ledger is append-only** — NEVER update or delete ledger entries; write reversal entries instead
3. **Idempotency key** required on every POST/PUT (X-Idempotency-Key header)
4. **Config is versioned** — always fetch config active at `transaction_date`, not current config
5. **Amounts are stored, never recomputed** after authorization — NUMERIC(14,2) in DB, rupees (not paise)
6. **Events trigger side effects** — ledger writes and dashboard updates happen via event consumers, not inline
7. **Super Admin is separate** — SA token is not a firm JWT; SA endpoints use `@Public()` + `?admin_token` query param
8. **Module access is three-tier** — SA assigns modules to firms → FIRM_HEAD assigns CRUD per role → users see permitted tabs only
9. **accessibleModuleIds in Redux** — drives conditional tab rendering in MainNavigator
10. **Route order matters in NestJS** — register `GET /:id/history` before `GET /:id`
11. **User delete = soft delete** — `is_active = false` preserved in DB; `findAll` filters `WHERE is_active = true`
12. **Salary delete = reversal entries** — FIRM_CASH CREDIT + USER_SALARY DEBIT written before hard-deleting `salary_entry` row
13. **Truck delete = SCHEDULED only** — cannot delete trucks with financial records (ARRIVED/CLOSED)
14. **Dynamic RBAC** — `PermissionsGuard` + `@RequirePermission(module, action)` on all write endpoints; FIRM_HEAD bypasses
15. **SA can configure role permissions** — `GET/PUT /super-admin/firms/:firmId/role-permissions/:role`
16. **KC rate mode** — RATE_PER_KG (default) or RATE_PER_NAG; configured per firm by SA
17. **Grades are firm-specific** — grade labels configured by SA per firm; `grade_id` FK on `kc_line_items`
18. **Push notifications** — KC authorization triggers FCM to authorizer + FIRM_HEAD via NotificationService
19. **Freight = Salary module** — `salary_entries` table tagged `freight` in API; has `freight_type` column
20. **API base path has no firm_id in URL** — `firm_id` comes from JWT exclusively; routes are `/api/v1/trucks` not `/api/v1/:firmId/trucks`
21. **Migrations are 001–009** — not 001–005 as some old docs state; migrations 006–009 added baardana, rate_mode, freight_type, grades
