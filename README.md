# Smart Mandi v2.0 🌾

> **Production-grade, multi-tenant SaaS for digital APMC mandi management**  
> NestJS · PostgreSQL · React Native · AWS SQS · Redis  
> Offline-first · Event-driven · Append-only ledger · Row-Level Security

---

## 🗂 Project Structure

```
SF/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/       # JWT auth + refresh tokens
│   │       │   ├── ledger/     # Append-only ledger engine
│   │       │   ├── events/     # SQS event store + consumers
│   │       │   ├── audit/      # Audit log (immutable)
│   │       │   ├── config/     # Versioned config (grade/APMC/commission)
│   │       │   ├── customers/  # Customer CRUD
│   │       │   ├── kaccha-chittha/ # KC workflow + authorization
│   │       │   ├── trucks/     # Truck lifecycle + purchase entries
│   │       │   ├── dashboard/  # Precomputed metrics + summary sheets
│   │       │   ├── reports/    # Ledger views + CSV export
│   │       │   ├── salary/     # Salary payments + ledger entries
│   │       │   └── users/      # User management
│   │       └── database/
│   │           └── migrations/ # 001_initial_schema.sql, 002_phase3_6_schema.sql
│   └── mobile/                 # React Native app (iOS + Android)
│       └── src/
│           ├── api/            # Typed API client + endpoints
│           ├── screens/        # All screens by domain
│           ├── navigation/     # Stack + Tab navigators
│           ├── store/          # Redux + auth slice
│           ├── offline/        # SQLite queue + sync engine
│           ├── theme/          # Design tokens
│           └── types/          # Shared TypeScript types
├── docs/
│   ├── HLD.md                  # High-Level Design + 8 Mermaid diagrams
│   ├── LLD.md                  # Low-Level Design + API contracts
│   ├── features.md             # ← Persistent agent memory (ALL 6 phases)
│   ├── agents.md               # 6 Copilot agent configs
│   └── prompts.md              # Prompt log
├── .github/
│   ├── copilot-instructions.md # Coding standards for all agents
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
npm run migration:run          # Run migrations 001 + 002
npm run start:dev              # Hot-reload dev server → http://localhost:3000
# Swagger UI: http://localhost:3000/api
```

### Mobile
```bash
cd apps/mobile
npm install
npx react-native run-android   # or run-ios
```

---

## 🏗 Architecture

### Multi-tenancy
- Every table has `firm_id UUID NOT NULL`
- PostgreSQL **Row-Level Security** enforces isolation at DB level
- `SET LOCAL app.current_firm_id = '...'` called in every transaction

### Ledger (append-only)
- **NEVER** UPDATE or DELETE `ledger_entries`
- Corrections via reversal entries only
- `NUMERIC(14,2)` in DB, `Decimal.js` in app — no float arithmetic

### Events (at-least-once)
- DB event store + AWS SQS for durability
- Side effects (dashboard update, inam ledger, reversal entries) via event consumers
- Inline processing in local dev when `SQS_QUEUE_URL` is not set

### Offline-first (mobile)
- SQLite operation queue — FIFO, idempotent replay
- Auto-drain on network reconnect via NetInfo listener
- Dead-letter after 3 retries (user notified)

---

## 📱 Mobile Screens

| Screen | Description |
|--------|-------------|
| Login → OTP | Phone + Firm ID → OTP verify |
| Dashboard | Truck status panel + KC counts + financial summary + alerts |
| Truck List | Filter by SCHEDULED/ARRIVED/CLOSED, today's date |
| Truck Detail | Lifecycle actions: Mark Arrived, Close Truck |
| Truck Create | Schedule new truck with produce + driver |
| KC List | Filter by DRAFT/AUTHORIZED/CANCELLED |
| KC Detail | Amounts, line items, payments, Authorize/Cancel |
| KC Create | Header + multi-line-item form |
| Customer List | Search by name/phone |
| Customer Detail | Info + future: ledger history |
| Ledger | FIRM_CASH/CUSTOMER/TRUCK/USER_SALARY views with balance |
| Reports | Summary sheets list + generate + CSV export |
| More Menu | Profile, Ledger, Reports, Salary, Users, Settings, Logout |

---

## 🔌 API Endpoints (All Tenant-Isolated)

| Module | Endpoints |
|--------|-----------|
| **Auth** | `POST /auth/login` · `POST /auth/refresh` |
| **Trucks** | `POST /trucks` · `GET /trucks` · `GET /trucks/:id` · `POST /trucks/:id/arrive` · `POST /trucks/:id/close` |
| **KCs** | `POST /kcs` · `GET /kcs` · `GET /kcs/:id` · `PATCH /kcs/:id/items` · `POST /kcs/:id/payments` · `POST /kcs/:id/authorize` · `POST /kcs/:id/cancel` |
| **Customers** | `POST /customers` · `GET /customers` · `GET /customers/:id` · `PATCH /customers/:id` · `DELETE /customers/:id` |
| **Config** | `POST /config/versions` · `GET /config/versions` · `POST /config/grade` · `GET /config/resolve` |
| **Dashboard** | `GET /dashboard` · `POST /dashboard/summary-sheets` · `GET /dashboard/summary-sheets` |
| **Reports** | `GET /reports/ledger` · `GET /reports/cash-flow` · `GET /reports/export/kcs` · `GET /reports/export/trucks` |
| **Salary** | `POST /salary` · `GET /salary` |
| **Users** | `POST /users` · `GET /users` · `PATCH /users/:id` · `DELETE /users/:id` |

---

## 🔐 RBAC Roles

| Role | Permissions |
|------|-------------|
| `FIRM_HEAD` | Full access including user management, config changes, salary |
| `AUTHORIZER` | Create + authorize KCs, manage trucks, view everything |
| `OPERATOR` | Create KCs and trucks, no authorization |
| `VIEWER` | Read-only across all modules |

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

---

## 📄 Docs

- **`docs/features.md`** — Persistent agent memory (read first in every new session)
- **`docs/HLD.md`** — Architecture + 8 Mermaid diagrams  
- **`docs/LLD.md`** — API contracts + class diagrams
- **`docs/agents.md`** — 6 Copilot agent configs (backend, security, ledger, migration, test, docs)
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
# SmartMandi
# SmartMandi
