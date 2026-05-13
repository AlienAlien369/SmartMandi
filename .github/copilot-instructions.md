# Smart Mandi — GitHub Copilot Instructions
## Copilot coding assistant configuration for this repository

---

## Project Identity

**Project:** Smart Mandi — Multi-tenant SaaS for APMC mandi trading firms  
**Type:** Financial application with strict auditability requirements  
**Scale:** 500 firms · 100,000 transactions/day

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 LTS · NestJS 10 · TypeScript 5 |
| Database | PostgreSQL 15 + Row-Level Security |
| ORM | TypeORM 0.3 |
| Mobile | React Native 0.74 · Expo SDK 50 · Redux Toolkit · React Query |
| Queue | AWS SQS (Standard queues + DLQ) |
| Cache | Redis 7 (ioredis client) |
| Auth | JWT HS256 (dev) / RS256 (prod target) · Passport.js |
| State (mobile) | Redux Toolkit (auth) + React Query (server state) |
| Offline (mobile) | SQLite operation queue + NetInfo sync engine |
| Validation | class-validator · class-transformer |
| Amounts | Decimal.js (NEVER use native float for money) |
| Testing | Jest · @nestjs/testing · Supertest · Testcontainers |
| Docs | Swagger/OpenAPI via @nestjs/swagger |
| CI/CD | GitHub Actions |
| Infrastructure | AWS (ECS Fargate · RDS · ElastiCache · SQS · S3) |

---

## Project Structure

```
SF/
├── apps/
│   ├── api/                        # NestJS backend
│   │   └── src/
│   │       ├── modules/            # Feature modules
│   │       │   ├── auth/
│   │       │   ├── firms/
│   │       │   ├── users/
│   │       │   ├── customers/
│   │       │   ├── trucks/
│   │       │   ├── kaccha-chittha/
│   │       │   ├── ledger/
│   │       │   ├── events/
│   │       │   ├── audit/
│   │       │   ├── config/
│   │       │   ├── dashboard/
│   │       │   ├── salary/
│   │       │   ├── reports/
│   │       │   └── rbac/           # Module access + role permissions + Super Admin
│   │       ├── common/             # Shared guards, interceptors, pipes
│   │       │   ├── guards/         # AuthGuard, RolesGuard
│   │       │   ├── interceptors/   # FirmContextInterceptor, AuditInterceptor
│   │       │   ├── filters/        # GlobalExceptionFilter
│   │       │   ├── decorators/     # @Roles(), @CurrentUser(), @FirmId(), @Public()
│   │       │   └── pipes/          # ParseUUIDPipe, DecimalPipe
│   │       ├── database/
│   │       │   ├── migrations/     # Numbered SQL migrations (001–012)
│   │       │   └── seeds/          # Dev/test seed data
│   │       └── config/             # App configuration (env validation)
│   └── mobile/                     # React Native 0.74 app
│       └── src/
│           ├── api/                # axios client + all endpoint wrappers + constants.ts
│           ├── navigation/         # RootNavigator, AuthNavigator, MainNavigator
│           ├── screens/            # One folder per feature
│           │   ├── Auth/           # LoginScreen, OtpVerifyScreen
│           │   ├── Dashboard/
│           │   ├── Trucks/
│           │   ├── KCs/
│           │   ├── Customers/
│           │   ├── Ledger/
│           │   ├── Reports/
│           │   ├── Salary/
│           │   ├── Users/
│           │   ├── Settings/       # RolePermissionsScreen
│           │   └── SuperAdmin/     # SADashboardScreen (dark theme, SA-only)
│           ├── store/              # Redux store + authSlice
│           ├── hooks/              # useOfflineQueue, useSyncEngine
│           ├── theme/              # Design tokens (colors, typography, spacing)
│           └── types/              # Shared TypeScript types
├── packages/
│   └── shared/                     # Shared TypeScript types
├── docs/                           # HLD, LLD, features.md, agents.md, prompts.md
├── graphify-out/                   # Knowledge graph artifacts (read before architectural decisions)
│   ├── graph.html                  # Interactive 663-node graph (open in browser)
│   ├── graph.json                  # GraphRAG-ready JSON for programmatic queries
│   └── GRAPH_REPORT.md             # Pre-computed: god nodes, community labels, surprising edges
├── scripts/                        # Dev automation scripts
└── .github/
    ├── copilot-instructions.md     # This file — Copilot system prompt
    ├── copilot-instructions/       # Per-agent instruction files
    └── workflows/                  # CI/CD pipelines
```

---

## Knowledge Graph Reference (ALWAYS consult before changes)

**Before making any architectural change, adding a new module, or modifying a high-coupling component, read `graphify-out/GRAPH_REPORT.md` first.**

### Why
The knowledge graph maps every dependency edge in the codebase. Ignoring it risks breaking high-fan-out nodes that are non-obvious from reading a single file.

### God Nodes (highest breaking-change risk — extra caution required)
| Node | Edges | Risk |
|------|-------|------|
| `SuperAdminController` | 24 | SA CRUD + module + permission + config endpoints |
| `ConfiguratorService` | 22 | commission/APMC/baardana/grade config resolution |
| `RbacService` | 18 | module access + role permissions |
| `DashboardService` | 14 | metrics precomputation |
| `KacchaChitthaService` | 12 | 9-step KC authorization engine |

### How to use
- **Before modifying a god node** → open `graphify-out/graph.html` and inspect all edges
- **Before adding a new service/module** → search `graphify-out/graph.json` for existing nodes with the same responsibility to avoid duplication
- **For impact analysis** → `graphify-out/GRAPH_REPORT.md` lists every community cluster and surprising connections

### Key community clusters (from graph)
`RBAC & Permissions` · `Config & Users` · `Events & Trucks` · `Fee Calculation Engine` · `Mobile RBAC Screens` · `Reports & Ledger Screen` · `Dashboard Service` · `Offline Queue & Sync` · `Super Admin Dashboard` · `Auth Module` · `Ledger Service` · `KC Controller & Payments` · `Push Notifications` · `Salary & Freight Screen`

### TypeScript
- Strict mode enabled (`"strict": true`)
- No `any` types — use `unknown` and narrow
- Explicit return types on all public methods
- Enums for all finite sets (UserRole, TruckStatus, LedgerType, etc.)
- Interfaces for DTOs, Classes for entities/services

### NestJS Conventions
```typescript
// Module naming: feature.module.ts
// Service naming: feature.service.ts
// Controller naming: feature.controller.ts
// DTO naming: create-feature.dto.ts, update-feature.dto.ts
// Entity naming: feature.entity.ts (TypeORM)
// Guard naming: roles.guard.ts, jwt-auth.guard.ts
// Decorator naming: roles.decorator.ts, current-user.decorator.ts
```

### Database Rules (NON-NEGOTIABLE)
1. **Every table MUST have `firm_id UUID NOT NULL`**
2. **Every table MUST have an RLS policy** using `current_setting('app.current_firm_id')`
3. **Ledger entries are IMMUTABLE** — no UPDATE or DELETE ever
4. **Financial amounts use `NUMERIC(14,2)`** — never FLOAT
5. **idempotency_key TEXT UNIQUE** on every write table
6. **Foreign keys always have matching indexes**

### Financial Amounts (CRITICAL)
```typescript
// ALWAYS use Decimal.js for calculations
import Decimal from 'decimal.js';

// CORRECT
const commission = new Decimal(grossAmount).mul(rate).div(100).toDecimalPlaces(2);

// WRONG — NEVER DO THIS
const commission = grossAmount * rate / 100; // floating point errors!
```

### API Design
- Base path: `/api/v1/` — **firm_id is NEVER in the URL path**; it comes from JWT claim only
- All mutation endpoints require `X-Idempotency-Key` header
- Pagination: `?page=1&limit=50` (max 100)
- Dates: ISO 8601 format
- Amounts: **Rupees (`NUMERIC(14,2)`)** in both DB and API transport — do NOT convert to paise

### Error Responses
```typescript
// Always use NestJS exceptions
throw new BadRequestException('KC must have at least one line item');
throw new ConflictException('KC is already authorized');
throw new ForbiddenException('Only AUTHORIZER role can authorize KCs');
throw new UnprocessableEntityException({ errors: validationErrors });
```

### Naming Conventions
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Database columns: `snake_case`
- Environment variables: `SCREAMING_SNAKE_CASE`
- Constants: `SCREAMING_SNAKE_CASE`
- Enums: `PascalCase` names, `SCREAMING_SNAKE_CASE` values

---

## Architecture Rules (ALWAYS FOLLOW)

### 1. Multi-tenancy
```typescript
// firm_id comes from JWT — NEVER from request params/body
@Get(':firmId/trucks') // This URL param is for routing only
async getTrucks(@CurrentFirmId() firmId: string) {
  // firmId injected by FirmContextInterceptor from JWT
}
```

### 2. Event-Driven Side Effects
```typescript
// Ledger writes and metric updates happen via event consumers
// NOT inline in the service method
// CORRECT
await this.eventStore.publish({ event_type: 'KC_AUTHORIZED', ... });
// WRONG
await this.ledgerService.write(...); // inline ledger write in KC service
await this.dashboardService.update(...); // inline metric update
```

### 3. Idempotency Pattern
```typescript
// Every service method that writes to DB:
async createKC(dto: CreateKCDto, idempotencyKey: string): Promise<KC> {
  const cached = await this.redis.get(`idempotency:${idempotencyKey}`);
  if (cached) return JSON.parse(cached);
  // ... perform operation
  await this.redis.setex(`idempotency:${idempotencyKey}`, 86400, JSON.stringify(result));
  return result;
}
```

### 4. Config Resolution
```typescript
// Always fetch config active at transaction_date, NOT current config
async resolveCommissionConfig(truckId: string, saleDate: Date, firmId: string) {
  // 1. Check truck-level override first
  // 2. Fall back to firm-level config where effective_from <= saleDate <= effective_to
}
```

### 5. Super Admin Pattern
```typescript
// SA endpoints use @Public() + admin_token query param — NOT JwtAuthGuard
// SA token is validated manually via jwtService.verify()
@Public()
@Get('firms')
async getAllFirms(@Query('admin_token') token: string) {
  this.verifySAToken(token); // throws UnauthorizedException if invalid
  return this.rbacService.getAllFirms();
}

// NEVER use firm JWT for Super Admin operations
// NEVER use @UseGuards(JwtAuthGuard) on SA endpoints
```

### 6. Route Order (NestJS Controllers)
```typescript
// ALWAYS register specific routes BEFORE parameterized routes
// CORRECT — NestJS matches top-down
@Get(':id/history')   // registered first
@Get(':id')           // registered second

// WRONG — 'history' gets treated as a UUID
@Get(':id')           // catches everything including GET /customers/history
@Get(':id/history')   // never reached
```

### 7. Mobile API Base URL
```typescript
// ALWAYS import from the single source of truth
import { API_BASE_URL } from '../api/constants';

// NEVER hardcode the IP/URL inline
// WRONG: baseURL: 'http://192.168.1.5:3000'  ← breaks when IP changes
```

### 8. Module Access Control
```typescript
// Three-tier access hierarchy:
// SA assigns modules to firms (firm_module_access table)
// FIRM_HEAD assigns CRUD per role per module (role_permissions table)
// Users only see tabs/screens permitted by their role

// To get modules for current user (firm-filtered):
// GET /rbac/my-modules  ← use this, not /rbac/modules

// To update firm module access (SA only):
// PUT /super-admin/firms/:firmId/modules { module_ids: string[] }
```

---

## Domain Glossary (Use These Terms Exactly)

| Term | Meaning |
|---|---|
| Firm | One mandi business entity (SaaS tenant) |
| Super Admin (SA) | Platform-level administrator above all firms; manages firm onboarding + module access |
| Kaccha Chittha (KC) | Point-of-sale transaction slip |
| Baardana | Bags/sacks for produce packaging |
| Inam | Cash gift to truck driver |
| Udhar | Credit/deferred payment |
| Commission | Revenue earned by firm per sale |
| APMC Fee | Government levy on agricultural sales |
| Summary Sheet | Truck-grouped daily report |
| Ledger Entry | Immutable financial record |
| Config Version | Time-bound business rules snapshot |
| Module | A top-level feature/page (TRUCKS, KCS, LEDGER, etc.) |
| Role Permission | CRUD access a specific role has on a specific module within a firm |
| Rate Mode | KC calculation mode: RATE_PER_KG (default) or RATE_PER_NAG (per bag) |
| Grade | Firm-specific quality label for produce (e.g. "A Grade", "Pili Matar") — configured by SA per firm |
| Freight Type | Category of payment in salary_entries: EMPLOYEE_SALARY / DRIVER_INAM / DRIVER_KIRAYA / DRIVER_PARCHI |
| Baardana Provider | Who supplies bags: FIRM_OWNED or DRIVER_PROVIDED — affects ledger direction |
| Kiraya | Transport fare paid to truck driver |
| Parchi | Document/slip fee paid to truck driver |
| Firm PDF Config | SA-controlled table (`firm_pdf_config`) that gates PDF generation per firm; has `pdf_enabled`, `buyer_summary_pdf_enabled`, `daybook_pdf_enabled`, `firm_short_name`, `footer_text` |
| KC PDF | Thermal receipt-style single-KC PDF; generated by `KcPdfService`; requires `pdf_enabled = true` |
| Buyer Summary PDF | Truck-grouped summary PDF across a date range; generated by `BuyerSummaryPdfService`; requires `buyer_summary_pdf_enabled = true` |
| Daybook PDF | Truck-wise day book PDF across a date range; generated by `DaybookPdfService`; requires `daybook_pdf_enabled = true` |

---

## What NOT to Do

- ❌ Never use `float` or `number` for financial amounts — use `Decimal.js`
- ❌ Never UPDATE or DELETE `ledger_entries` — write reversal entries instead
- ❌ Never recompute commission/APMC fee from current config — use stored snapshot
- ❌ Never pass `firm_id` as a URL parameter that reaches database queries — always from JWT
- ❌ Never put `firm_id` in the API URL path — base path is `/api/v1/`, not `/api/v1/:firmId/`
- ❌ Never write ledger entries inline — always via event consumer
- ❌ Never skip idempotency key on write endpoints
- ❌ Never hardcode grade names, produce types, fee values — all come from config
- ❌ Never use `SELECT *` — always specify columns
- ❌ Never run migrations manually — use the migration runner script
- ❌ Never use `@UseGuards(JwtAuthGuard)` on Super Admin endpoints — they use `@Public()` + token
- ❌ Never use `rbacApi.getAllModules()` to populate role/permission UIs — always use `rbacApi.getMyModules()` (firm-filtered)
- ❌ Never hardcode the API base URL in mobile — always import from `apps/mobile/src/api/constants.ts`
- ❌ Never use amounts in paise — DB and API use rupees (`NUMERIC(14,2)`)
- ❌ Never call the salary module "Salary" in UI copy — use "Freight" (SalaryController is `@ApiTags('freight')`)
- ❌ Never register a parameterized route (`:id`) before a specific sub-route (`:id/history`)
- ❌ Never generate KC PDF / Buyer Summary PDF / Daybook PDF without checking the corresponding `firm_pdf_config` flag (`pdf_enabled` / `buyer_summary_pdf_enabled` / `daybook_pdf_enabled`) — throw `ForbiddenException` if disabled
- ❌ Never hard-code `firm_short_name` or `footer_text` in PDF templates — always fetch from `firm_pdf_config`
- ❌ Never add SA config endpoints (apmc-fee, commission, baardana, grades, pdf) under `/super-admin/firms/:id/` directly — they go under the `/config/` sub-prefix (e.g. `/super-admin/firms/:id/config/pdf`)

---

## Security Checklist (Before Every PR)

- [ ] All new firm-scoped endpoints have `@UseGuards(JwtAuthGuard, RolesGuard)`
- [ ] All Super Admin endpoints use `@Public()` + `verifySAToken()` — NOT JwtAuthGuard
- [ ] All new DTOs have `class-validator` decorators
- [ ] No `firm_id` taken from request body/params for DB queries
- [ ] All new tables have RLS policies (`firm_id = current_setting('app.current_firm_id')::UUID`)
- [ ] No string interpolation in SQL queries — use parameterized queries or TypeORM `.where('col = :val', { val })`
- [ ] `X-Idempotency-Key` middleware applied to route
- [ ] New modules added to `modules` seed table and granted to existing firms if needed

---

## Dev Credentials (Never Commit to Production)

| Role | Phone | Firm ID | Notes |
|---|---|---|---|
| Super Admin | 9000000000 | — | Tap "Super Admin Login" on login screen; any OTP |
| Firm Head | 9999999999 | 115c557f-0c07-4162-b3bc-84f1feab88fb | Dev Mandi firm |
| Authorizer | 9111111111 | same | Can authorize KCs |
| Operator | 9222222222 | same | Can create KCs/trucks |
| Viewer | 9333333333 | same | Read-only |
