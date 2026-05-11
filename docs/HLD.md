# Smart Mandi — High-Level Design (HLD)
## Version 2.0 · Phase 11 PDF Generation & SA Config Expansion (All Phases Complete)

---

## 1. System Overview

**Smart Mandi** is a multi-tenant SaaS mobile application that digitizes and automates the end-to-end workflow of agricultural produce trading firms (tenants) operating in Indian APMC mandis.

**Scale target:** 500 firms · 100,000 transactions/day · Financial auditability

**Current phase:** Phase 11 — PDF Generation, SA Config Expansion (all phases complete)

---

## 2. Architecture Overview

```mermaid
graph TB
    subgraph "Mobile Layer"
        RN[React Native App<br/>iOS + Android]
        SQLite[(Local SQLite<br/>Offline-First)]
        OQ[Operation Queue<br/>Offline Mutations]
    end

    subgraph "API Gateway"
        APIGW[AWS API Gateway<br/>Rate Limiting · Auth]
    end

    subgraph "Application Layer — NestJS Monolith → Microservices"
        AuthSvc[Auth Service<br/>JWT · RLS · Roles]
        TruckSvc[Truck Service<br/>Lifecycle]
        KCSvc[Kaccha Chittha Service<br/>Authorization Engine]
        LedgerSvc[Ledger Engine<br/>Append-Only]
        ConfigSvc[Configurator<br/>Versioned Rules]
        DashSvc[Dashboard Service<br/>Metrics]
        ReportSvc[Report Service<br/>Summary Sheet]
        SalarySvc[Freight/Salary Service]
        RbacSvc[RBAC Service]
        NotifSvc[Notification Service<br/>FCM Push]
    end

    subgraph "Async Layer"
        SQS[AWS SQS<br/>Event Queue]
        Workers[Event Workers<br/>Idempotent Consumers]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL + RLS<br/>Primary Store)]
        Redis[(Redis<br/>Cache · Idempotency · Sessions)]
        S3[AWS S3<br/>Report Exports · Backups]
    end

    RN -->|HTTPS + JWT| APIGW
    SQLite <-->|Local sync| OQ
    OQ -->|On reconnect| APIGW
    APIGW --> AuthSvc
    AuthSvc --> TruckSvc & KCSvc & LedgerSvc & ConfigSvc & DashSvc & ReportSvc & SalarySvc
    KCSvc -->|Publish events| SQS
    TruckSvc -->|Publish events| SQS
    SalarySvc -->|Publish events| SQS
    SQS --> Workers
    Workers --> LedgerSvc
    Workers --> DashSvc
    TruckSvc & KCSvc & LedgerSvc & ConfigSvc & DashSvc & ReportSvc & SalarySvc --> PG
    AuthSvc --> Redis
    KCSvc --> Redis
    ReportSvc --> S3
```

---

## 3. Multi-Tenancy Architecture

```mermaid
graph LR
    subgraph "Request Flow"
        JWT[JWT Token<br/>firm_id claim]
        MW[Auth Middleware<br/>SET app.current_firm_id]
        RLS[PostgreSQL RLS<br/>firm_id filter on every query]
        DATA[Tenant Data<br/>Isolated by RLS]
    end
    JWT --> MW --> RLS --> DATA
```

- Every table has `firm_id UUID NOT NULL`
- PostgreSQL Row-Level Security enforces isolation at DB level
- `firm_id` is extracted from verified JWT — never from user input

---

## 4. Offline-First Architecture

```mermaid
sequenceDiagram
    participant User as Mobile User
    participant App as React Native App
    participant Local as Local SQLite
    participant Queue as Operation Queue
    participant Server as NestJS API
    participant DB as PostgreSQL

    User->>App: Create Kaccha Chittha (offline)
    App->>Local: Write KC + line items
    App->>Queue: Enqueue mutation (idempotency_key)
    App-->>User: Show "Draft — Unsynced" badge

    Note over App,Server: Connectivity Restored

    App->>Queue: Process queue (FIFO order)
    Queue->>Server: POST /kcs (X-Idempotency-Key)
    Server->>DB: Check idempotency_key (Redis)
    alt New Request
        DB->>DB: Insert KC
        Server-->>Queue: 201 Created
    else Duplicate
        Server-->>Queue: 200 Already Processed
    end
    Queue->>Local: Mark SYNCED
    App-->>User: Remove unsynced badge
```

---

## 5. Event-Driven Architecture

```mermaid
graph LR
    subgraph "Publishers"
        KC[KC Service]
        TR[Truck Service]
        SAL[Salary Service]
    end

    subgraph "Event Store"
        EVT[(events table<br/>PostgreSQL)]
        SQS[AWS SQS<br/>Reliable Delivery]
    end

    subgraph "Consumers — Idempotent"
        LW[Ledger Writer]
        DU[Dashboard Updater]
        AU[Audit Logger]
        NT[Notification Sender]
    end

    KC -->|KC_AUTHORIZED| EVT
    KC -->|KC_CANCELLED| EVT
    TR -->|TRUCK_ARRIVED / TRUCK_CLOSED| EVT
    SAL -->|SALARY_PAID| EVT
    EVT --> SQS
    SQS --> LW & DU & AU & NT
```

---

## 6. Data Flow — KC Authorization (Critical Path)

```mermaid
sequenceDiagram
    participant Auth as Authorizer (Mobile)
    participant API as NestJS API
    participant DB as PostgreSQL
    participant Redis as Redis
    participant SQS as AWS SQS

    Auth->>API: POST /kcs/:id/authorize (X-Idempotency-Key)
    API->>Redis: Check idempotency key
    alt Already processed
        Redis-->>API: Return cached result
        API-->>Auth: 200 Original result
    end
    API->>DB: BEGIN TRANSACTION
    API->>DB: Validate preconditions (7 checks)
    API->>DB: Compute totals (commission, APMC fee, net payable)
    API->>DB: SET KC status = AUTHORIZED
    API->>DB: Write 4-5 ledger entries (same entry_group_id)
    API->>DB: Write audit_log entry
    API->>DB: COMMIT
    API->>SQS: Publish KC_AUTHORIZED event
    API->>Redis: Store idempotency result
    API-->>Auth: 200 Authorized KC
    SQS-->>DB: Consumer: update dashboard_metrics_hourly
```

---

## 7. Services & Modules Map

| Module | Responsibility | Phase |
|---|---|---|
| Auth | JWT, firm isolation, RBAC | 1 |
| Ledger Engine | Append-only ledger, group integrity | 1 |
| Event Store | Publish/consume events, retry, dead-letter | 1 |
| Audit Log | Immutable change history | 1 |
| Configurator | Versioned business rules | 2 |
| Customers | Customer CRUD + ledger view + history API | 2 |
| Kaccha Chittha | KC lifecycle + authorization engine + PDF download | 2/11 |
| Trucks | Truck lifecycle + purchase entries + delete guard | 3 |
| Dashboard | Precomputed metrics, alerts, date filters | 4 |
| Reports | Summary sheet, CSV export, cash flow, buyer summary PDF, daybook PDF | 4/11 |
| Salary | Salary entries + ledger + reversal-on-delete | 5 |
| Users | User CRUD + soft-delete (active filter) | 5 |
| Custom Fields | Dynamic entity extension (field defs + values) | 6 |
| RBAC | Module access control, dynamic role permissions | 7 |
| Super Admin | Cross-firm management, module + permission + full config assignment | 7/11 |
| Notifications | FCM push on KC authorization | 10 |
| PDF Config | SA-gated firm PDF settings (KC, buyer summary, daybook) | 11 |

---

## 8. Infrastructure Architecture

```mermaid
graph TB
    subgraph "AWS Production Setup"
        ECS[AWS ECS Fargate<br/>NestJS Containers]
        RDS[AWS RDS PostgreSQL<br/>Multi-AZ · Encrypted]
        EC[AWS ElastiCache Redis<br/>Cluster Mode]
        SQS2[AWS SQS<br/>Standard + DLQ]
        S3B[AWS S3<br/>Reports · Backups]
        CF[CloudFront CDN]
        CW[CloudWatch<br/>Logs · Metrics · Alarms]
        SM[AWS Secrets Manager<br/>DB passwords · JWT secret]
    end
    ECS --> RDS & EC & SQS2 & S3B
    ECS --> CW
    SM -.->|secrets injection| ECS
```

---

## 9. Security Architecture

| Layer | Control |
|---|---|
| Transport | HTTPS/TLS 1.3 everywhere |
| Authentication | JWT (RS256 prod / HS256 dev), 1h access token, 7d refresh token |
| Super Admin Auth | Separate SA JWT (HS256), validated via `?admin_token` query param |
| Authorization | Row-Level Security (PostgreSQL) — `current_setting('app.current_firm_id')` |
| RBAC | SUPER_ADMIN > FIRM_HEAD > AUTHORIZER > OPERATOR > VIEWER |
| Module Access | SA assigns modules to firms; FIRM_HEAD assigns CRUD per role per module |
| Idempotency | Redis-backed dedup on all mutations (24h TTL) |
| Audit | Append-only audit_log on every mutation |
| Secrets | AWS Secrets Manager injection |
| Input Validation | class-validator on all DTOs |

---

## 10. Super Admin Architecture

```mermaid
graph TB
    subgraph "Super Admin Panel (Mobile — Dark Theme)"
        SALogin[SA Login Screen<br/>phone + any OTP dev]
        SADash[SADashboardScreen<br/>Firm list + action tiles]
        SALogin --> SADash
    end

    subgraph "SA API Layer"
        SACtrl[SuperAdminController<br/>@Public() + verifySAToken()]
        SAFirms[GET/POST/PUT/DELETE<br/>/super-admin/firms]
        SAModules[GET/PUT<br/>/super-admin/firms/:id/modules]
        SAPerms[GET/PUT<br/>/super-admin/firms/:id/role-permissions/:role]
        SACtrl --> SAFirms
        SACtrl --> SAModules
        SACtrl --> SAPerms
    end

    subgraph "Firm User Panel (Main App)"
        Login[LoginScreen]
        Main[MainNavigator<br/>tabs from accessibleModuleIds]
        RolePerms[RolePermissionsScreen<br/>CRUD toggles per role per module]
        Login --> Main
        Main --> RolePerms
    end

    subgraph "RBAC API Layer"
        RbacCtrl[RbacController<br/>JWT-authenticated]
        MyMods[GET /rbac/my-modules]
        MyPerms[GET /rbac/my-permissions]
        FirmMods[GET /rbac/firm-modules]
        Perms[GET/PUT /rbac/permissions/:role]
        RbacCtrl --> MyMods & MyPerms & FirmMods & Perms
    end

    SADash -->|admin_token| SACtrl
    Main -->|JWT| RbacCtrl
```

---

## 11. Module Access Control Hierarchy

```mermaid
graph TD
    SA[Super Admin<br/>Platform-level access]
    SA -->|assigns module_ids to firm| FMA[firm_module_access<br/>firm_id · module_id · is_active]
    FMA -->|FIRM_HEAD configures| RP[role_permissions<br/>firm_id · role · module_id<br/>can_create · can_read · can_update · can_delete]
    RP -->|intersect with firm_module_access| UMA[User Accessible Modules<br/>GET /rbac/my-modules]
    UMA -->|stored in Redux| TABS[MainNavigator<br/>conditional bottom tabs]
```

**Flow:**
1. SA creates firm → auto-grants all 11 modules
2. SA can restrict modules: PUT /super-admin/firms/:id/modules with subset of module_ids
3. **SA can configure role permissions**: PUT /super-admin/firms/:id/role-permissions/:role `{permissions: [{module_id, can_create, can_read, can_update, can_delete}]}`
4. FIRM_HEAD assigns CRUD permissions per role per module: PUT /rbac/permissions/:role
5. After login, mobile fetches GET /rbac/my-modules → stores `accessibleModuleIds` in Redux
6. MainNavigator renders only the tabs whose module keys are in `accessibleModuleIds`
7. Each screen calls `usePermissions(module)` → UI buttons (Add/Edit/Delete) conditionally rendered

---

## 12. Dynamic RBAC Flow

```mermaid
sequenceDiagram
    participant Mobile as React Native App
    participant Guard as PermissionsGuard
    participant DB as PostgreSQL

    Mobile->>Guard: DELETE /trucks/:id (JWT + X-Idempotency-Key)
    Guard->>Guard: Extract role from JWT
    alt FIRM_HEAD
        Guard-->>Mobile: ✅ Allowed (bypass)
    else AUTHORIZER / OPERATOR / VIEWER
        Guard->>DB: SELECT can_delete FROM role_module_permissions<br/>WHERE firm_id=? AND role=? AND module_id='TRUCKS'
        DB-->>Guard: {can_delete: true/false}
        alt can_delete = true
            Guard-->>Mobile: ✅ Allowed
        else
            Guard-->>Mobile: 403 Forbidden
        end
    end
```

---

*Last updated: Phase 11 — PDF Generation, SA Config Expansion (all phases complete)*
