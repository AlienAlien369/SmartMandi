# Smart Mandi v2.0 🌾

> **Production-grade, multi-tenant SaaS for digital APMC mandi management**  
> NestJS · PostgreSQL · React Native · AWS SQS · Redis  
> Offline-first · Event-driven · Append-only ledger · Row-Level Security · Dynamic RBAC

---

## 🗂 Project Structure

```
SF/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/           # JWT auth + refresh tokens
│   │       │   ├── ledger/         # Append-only ledger engine
│   │       │   ├── events/         # SQS event store + consumers
│   │       │   ├── audit/          # Audit log (immutable)
│   │       │   ├── config/         # Versioned config (grade/APMC/commission)
│   │       │   ├── customers/      # Customer CRUD + ledger history
│   │       │   ├── kaccha-chittha/ # KC workflow + authorization engine
│   │       │   ├── trucks/         # Truck lifecycle + purchase entries
│   │       │   ├── dashboard/      # Precomputed metrics + summary sheets
│   │       │   ├── reports/        # Ledger views + CSV export
│   │       │   ├── salary/         # Salary payments + ledger entries
│   │       │   ├── users/          # User management (soft-delete, active filter)
│   │       │   └── rbac/           # Module access + role permissions + Super Admin
│   │       ├── common/
│   │       │   ├── guards/         # JwtAuthGuard, PermissionsGuard (dynamic RBAC)
│   │       │   ├── decorators/     # @RequirePermission, @CurrentUser, @CurrentFirmId
│   │       │   └── interceptors/   # FirmContextInterceptor (RLS injection)
│   │       └── database/
│   │           └── migrations/     # 001–005 SQL migrations
│   └── mobile/                 # React Native 0.74 + Expo SDK 50
│       └── src/
│           ├── api/            # Typed API client + all endpoint wrappers
│           ├── screens/        # All screens by domain (premium UI)
│           ├── navigation/     # Stack + Tab navigators (RBAC-gated tabs)
│           ├── store/          # Redux + authSlice (isSuperAdmin, saToken, accessibleModuleIds)
│           ├── hooks/          # usePermissions, useOfflineQueue, useSyncEngine
│           ├── theme/          # Design tokens (colors, typography, spacing, radius, shadow)
│           └── types/          # Shared TypeScript types
├── docs/
│   ├── HLD.md                  # High-Level Design + Mermaid diagrams
│   ├── LLD.md                  # Low-Level Design + API contracts
│   ├── features.md             # ← Persistent agent memory (ALL phases)
│   ├── agents.md               # Specialized Copilot agent configs
│   └── prompts.md              # Prompt log for reproducibility
├── .github/
│   ├── copilot-instructions.md # Coding standards for all agents
│   ├── copilot-instructions/   # Per-agent instruction files
│   └── workflows/ci.yml        # CI pipeline
└── docker-compose.yml          # Local dev (PostgreSQL 15 + Redis 7)
```

---

## 🚀 Quick Start

### Backend
```bash
cd apps/api
cp .env.example .env           # Fill in DB + JWT + Redis config
docker compose up -d           # Start PostgreSQL + Redis
npm install
npm run migration:run          # Run migrations 001–005
npm run start:dev              # Hot-reload dev server → http://localhost:3000
# Swagger UI: http://localhost:3000/api
```

### Mobile
```bash
cd apps/mobile
npm install
npx react-native run-android   # or run-ios
# ADB tunnel for Android emulator/device:
adb reverse tcp:3000 tcp:3000
```

---

## 🏗 Architecture

### Multi-tenancy
- Every table has `firm_id UUID NOT NULL`
- PostgreSQL **Row-Level Security** enforces isolation at DB level
- `SET LOCAL app.current_firm_id = '...'` called in every transaction

### Ledger (append-only)
- **NEVER** UPDATE or DELETE `ledger_entries`
- Corrections and deletions via reversal entries only
- `NUMERIC(14,2)` in DB, `Decimal.js` in app — no float arithmetic

### Events (at-least-once)
- DB event store + AWS SQS for durability
- Side effects (dashboard update, inam ledger, reversal entries) via event consumers
- Inline processing in local dev when `SQS_QUEUE_URL` is not set

### Offline-first (mobile)
- SQLite operation queue — FIFO, idempotent replay
- Auto-drain on network reconnect via NetInfo listener
- Dead-letter after 3 retries (user notified)

### Dynamic RBAC (3-tier)
```
Super Admin
  └── assigns modules to firms (firm_module_access)
        └── FIRM_HEAD assigns CRUD per role per module (role_module_permissions)
              └── Users see only permitted tabs + buttons (Redux + PermissionsGuard)
```
- `PermissionsGuard` queries `role_module_permissions` per request at runtime
- `@RequirePermission(module, action)` decorator on every write/delete endpoint
- `FIRM_HEAD` bypasses all permission checks — always has full access
- SA can configure role permissions for any firm via `/super-admin/firms/:id/role-permissions/:role`

---

## 📱 Mobile Screens

| Screen | Description |
|--------|-------------|
| Login → OTP | Phone + Firm ID → OTP verify; tap "Super Admin Login" for SA panel |
| Dashboard | Date filters · Truck status panel · KC counts · Financial summary · Alerts |
| Truck List | Premium filter chips (ALL/SCHEDULED/ARRIVED/CLOSED) + date filter |
| Truck Detail | Lifecycle actions: Mark Arrived, Close Truck (RBAC-gated) |
| Truck Create | Schedule new truck with produce + driver |
| KC List | Premium filter chips (ALL/DRAFT/AUTHORIZED/CANCELLED) + date filter |
| KC Detail | Amounts · Line items · Payments · Authorize/Cancel (RBAC-gated) |
| KC Create | Header + multi-line-item form + sale date picker |
| Customer List | Search by name/phone |
| Customer Detail | Profile · Outstanding udhar card · Full KC history |
| Ledger | Date filter · FIRM_CASH/CUSTOMER/TRUCK/USER_SALARY views · Balance cards |
| Reports | Summary sheets · CSV export (KC + Trucks) · Date range filter |
| Salary | Entries list · Create · Edit notes · Delete (with reversal) · RBAC-gated |
| Team Members | User list · Add · Edit role/name · Delete (RBAC-gated) |
| More Menu | Profile · Logout · Navigation links |
| Role Permissions | CRUD toggle grid per role per module (firm-assigned modules only) |
| SA Dashboard | Dark-themed · Firm list · Create/Edit/Deactivate firm · Module toggles · Role permissions per firm |

---

## 🔌 API Endpoints (All Tenant-Isolated)

| Module | Endpoints |
|--------|-----------|
| **Auth** | `POST /auth/login` · `POST /auth/refresh` |
| **Trucks** | `POST /trucks` · `GET /trucks` · `GET /trucks/:id` · `POST /trucks/:id/arrive` · `POST /trucks/:id/close` · `DELETE /trucks/:id` *(SCHEDULED only)* |
| **KCs** | `POST /kcs` · `GET /kcs` · `GET /kcs/:id` · `PATCH /kcs/:id/items` · `POST /kcs/:id/payments` · `POST /kcs/:id/authorize` · `POST /kcs/:id/cancel` |
| **Customers** | `POST /customers` · `GET /customers` · `GET /customers/:id` · `GET /customers/:id/history` · `PATCH /customers/:id` · `DELETE /customers/:id` |
| **Config** | `POST /config/versions` · `GET /config/versions` · `POST /config/grade` · `GET /config/resolve` |
| **Dashboard** | `GET /dashboard` *(date params)* · `POST /dashboard/summary-sheets` · `GET /dashboard/summary-sheets` |
| **Reports** | `GET /reports/ledger` · `GET /reports/cash-flow` · `GET /reports/export/kcs` · `GET /reports/export/trucks` |
| **Salary** | `POST /salary` · `GET /salary` · `PATCH /salary/:id` *(notes only)* · `DELETE /salary/:id` *(reversal entries)* |
| **Users** | `POST /users` · `GET /users` *(active only)* · `PATCH /users/:id` · `DELETE /users/:id` *(soft-delete)* |
| **RBAC** | `GET /rbac/my-modules` · `GET /rbac/my-permissions` · `GET /rbac/firm-modules` · `GET/PUT /rbac/permissions/:role` |
| **Super Admin** | `POST /super-admin/login` · `GET/POST/PUT/DELETE /super-admin/firms` · `GET/PUT /super-admin/firms/:id/modules` · `GET/PUT /super-admin/firms/:id/role-permissions/:role` |

---

## 🔐 RBAC Roles

| Role | Access |
|------|--------|
| `FIRM_HEAD` | Full access — bypasses permission checks; manages team, config, salary |
| `AUTHORIZER` | Configurable per module by FIRM_HEAD/SA — typically: create+read+update KCs/trucks |
| `OPERATOR` | Configurable per module by FIRM_HEAD/SA — typically: create+read KCs/trucks |
| `VIEWER` | Configurable per module by FIRM_HEAD/SA — typically: read-only |
| `SUPER_ADMIN` | Platform-level — manages all firms, module access, role permissions |

> CRUD access per role per module is fully configurable at runtime via the Role Permissions screen or SA dashboard. UI buttons (Add/Edit/Delete) are automatically hidden when access is not granted.

---

## 💡 Key Business Logic

### KC Authorization (9-step flow)
1. Validate KC is DRAFT + has line items + weights
2. Resolve config versions at `sale_date` (NOT current config)
3. Compute totals: weight, gross, APMC fee, commission, baardana, net_payable
4. Pessimistic lock (SERIALIZABLE, `pessimistic_write`)
5. Write to KC: status=AUTHORIZED, stored amounts, config snapshot IDs
6. Write ledger entries (4-5 entries per KC)
7. Audit log inside transaction
8. Commit transaction
9. Publish `KC_AUTHORIZED` event (after commit)

### Config Resolution (critical)
```sql
-- Always fetch config active on sale_date, NOT current config
WHERE effective_from <= :saleDate AND (effective_to IS NULL OR effective_to >= :saleDate)
```

### Net Payable Formula
```
net_payable = gross_amount - apmc_fee - commission
# Baardana is tracked for firm analytics but NOT deducted from customer payable
```

### Delete Strategies
| Entity | Strategy | Reason |
|--------|----------|--------|
| User | Soft-delete (`is_active=false`) + `findAll` filters active-only | FK constraints from salary/ledger/audit tables |
| Salary entry | Write reversal ledger entries → hard-delete row | Ledger is immutable; accounting preserved via reversals |
| Truck | Hard-delete only if SCHEDULED | ARRIVED/CLOSED have financial records (PurchaseEntry, inam) |
| Customer | Soft-delete | May have KC history and ledger entries |
| Ledger entry | **Never delete** — write reversal entry | Immutable by design |

---

## 🧪 Dev Credentials

| Role | Phone | Firm ID |
|------|-------|---------|
| Super Admin | 9000000000 | — |
| Firm Head | 9999999999 | 115c557f-0c07-4162-b3bc-84f1feab88fb |
| Authorizer | 9111111111 | same |
| Operator | 9222222222 | same |
| Viewer | 9333333333 | same |

> Any OTP works in dev mode (`NODE_ENV=development`).

---

## 📄 Docs

- **`docs/features.md`** — Persistent agent memory (read first in every new session)
- **`docs/HLD.md`** — Architecture + Mermaid diagrams
- **`docs/LLD.md`** — API contracts + class diagrams
- **`docs/agents.md`** — Specialized Copilot agent configs
- **`.github/copilot-instructions.md`** — Coding standards for all sessions

---

## 🤖 Agent Usage

```bash
# Run all docs agents in parallel (Copilot Fleet)
gh copilot fleet docs/agents.md

# Run security scan
gh copilot agent security-scout

# Run migration writer
gh copilot agent migration-writer
```

---

*Smart Mandi v2.0 — Built for 500 firms, 100,000 transactions/day*
