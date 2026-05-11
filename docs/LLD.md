# Smart Mandi — Low-Level Design (LLD)
## Version 2.0 · Phase 11 PDF Generation & SA Config Expansion (All Phases Complete)

---

## 1. Module Architecture (NestJS)

```mermaid
graph TB
    subgraph "NestJS Application"
        AM[AppModule]
        AM --> DBM[DatabaseModule<br/>TypeORM + pg]
        AM --> CM[ConfigModule<br/>@nestjs/config]
        AM --> RM[RedisModule<br/>ioredis]
        AM --> SQSM[SQSModule<br/>aws-sdk]

        AM --> AuthM[AuthModule<br/>JWT Strategy]
        AM --> FirmM[FirmsModule]
        AM --> UserM[UsersModule]
        AM --> LedgerM[LedgerModule]
        AM --> EventM[EventStoreModule]
        AM --> AuditM[AuditModule]
        AM --> ConfigMod[ConfiguratorModule]
        AM --> CustomerM[CustomersModule]
        AM --> TruckM[TrucksModule]
        AM --> KCM[KacchaChitthaModule]
        AM --> DashM[DashboardModule]
        AM --> ReportM[ReportsModule]
        AM --> SalaryM[SalaryModule<br/>(tagged: freight)]
        AM --> RbacM[RbacModule<br/>RBAC + SuperAdmin]
        AM --> NotifM[NotificationModule<br/>FCM Push]
        AM --> PdfM[PDF Services<br/>KcPdf · BuyerSummaryPdf · DaybookPdf]
    end
```

---

## 2. Auth Module

```mermaid
classDiagram
    class JwtStrategy {
        +validate(payload: JwtPayload): RequestUser
    }
    class JwtPayload {
        +sub: string
        +firm_id: string
        +role: UserRole
        +iat: number
        +exp: number
    }
    class AuthGuard {
        +canActivate(context): boolean
    }
    class RolesGuard {
        +canActivate(context): boolean
        -reflector: Reflector
    }
    class FirmContextInterceptor {
        +intercept(context, next): Observable
        -setRLSContext(firmId: string): void
    }
    class AuthController {
        +login(dto): Promise~LoginResponse~
        +refresh(dto): Promise~TokenResponse~
    }
    class AuthService {
        +login(phone, otp, firmId): Promise~Tokens~
        +refreshToken(token): Promise~Tokens~
        +validateUser(userId): Promise~User~
    }

    AuthController --> AuthService
    AuthService --> JwtStrategy
    AuthGuard --> JwtStrategy
    RolesGuard --> JwtPayload
    FirmContextInterceptor --> JwtPayload
```

### 2.1 RLS Context Setting (Critical)

```typescript
// FirmContextInterceptor sets firm_id in PostgreSQL session before every query
// SQL executed before handler: SET LOCAL app.current_firm_id = '<firm_id>'
```

### 2.2 JWT Payload

```typescript
interface JwtPayload {
  sub: string;          // user_id
  firm_id: string;      // tenant ID — injected into DB session
  role: UserRole;       // FIRM_HEAD | AUTHORIZER | OPERATOR | VIEWER
  device_id?: string;   // for offline conflict resolution
}
```

---

## 3. Ledger Engine (Core)

```mermaid
classDiagram
    class LedgerService {
        +writeEntries(dto: WriteEntriesDto): Promise~LedgerEntry[]~
        +getCustomerLedger(customerId, firmId, filters): Promise~LedgerPage~
        +getTruckLedger(truckId, firmId): Promise~LedgerPage~
        +getFirmCashLedger(firmId, filters): Promise~LedgerPage~
        +getUserSalaryLedger(userId, firmId): Promise~LedgerPage~
        -validateGroupIntegrity(entries: LedgerEntryDto[]): void
        -computeRunningBalance(type, entityId, firmId): Promise~Decimal~
    }

    class LedgerEntry {
        +id: UUID
        +firm_id: UUID
        +ledger_type: LedgerType
        +entry_type: EntryType
        +amount: Decimal
        +balance_after: Decimal
        +source_type: SourceType
        +source_id: UUID
        +entry_group_id: UUID
        +customer_id?: UUID
        +truck_id?: UUID
        +user_id?: UUID
        +description: string
        +idempotency_key: string
        +created_by: UUID
        +created_at: Timestamp
    }

    class WriteEntriesDto {
        +entry_group_id: UUID
        +entries: LedgerEntryDto[]
        +source_type: SourceType
        +source_id: UUID
        +idempotency_key: string
    }

    LedgerService --> LedgerEntry
    LedgerService --> WriteEntriesDto
```

### 3.1 Group Integrity Rule

```
For every entry_group_id:
  SUM(amount WHERE entry_type=CREDIT) == SUM(amount WHERE entry_type=DEBIT)
Enforced at: application layer (pre-write) + nightly reconciliation job
```

### 3.2 Balance Computation (Stored, Never Recomputed)

```
balance_after = previous_balance + amount (if CREDIT)
balance_after = previous_balance - amount (if DEBIT)
Uses SELECT ... FOR UPDATE on running balance row
```

---

## 4. Event Store Module

```mermaid
classDiagram
    class EventStoreService {
        +publish(dto: PublishEventDto): Promise~Event~
        +processNext(): Promise~void~
        +retryFailed(): Promise~void~
        +deadLetterHandler(event): Promise~void~
    }

    class Event {
        +id: UUID
        +firm_id: UUID
        +event_type: string
        +aggregate_type: string
        +aggregate_id: UUID
        +payload: JSONB
        +status: EventStatus
        +retry_count: number
        +max_retries: number
        +process_after: Timestamp
        +processed_at?: Timestamp
        +error_message?: string
        +idempotency_key: string
        +created_at: Timestamp
    }

    class EventConsumer {
        <<interface>>
        +handle(event: Event): Promise~void~
        +getEventTypes(): string[]
    }

    class SQSAdapter {
        +sendMessage(event): Promise~void~
        +receiveMessages(): Promise~SQSMessage[]~
        +deleteMessage(receiptHandle): Promise~void~
    }

    EventStoreService --> Event
    EventStoreService --> SQSAdapter
    EventStoreService --> EventConsumer
```

### 4.1 Retry Strategy

```
retry_count < max_retries (default 5):
  - Exponential backoff: process_after = NOW() + 2^retry_count minutes
  - Update status = FAILED, increment retry_count

retry_count >= max_retries:
  - Move to DEAD_LETTER
  - Alert engineering team (CloudWatch alarm)
```

---

## 5. Audit Log Module

```mermaid
classDiagram
    class AuditService {
        +log(dto: AuditDto): Promise~void~
        +getHistory(entity, entityId, firmId): Promise~AuditEntry[]~
    }

    class AuditLog {
        +id: UUID
        +firm_id: UUID
        +entity: string
        +entity_id: UUID
        +action: AuditAction
        +old_value?: JSONB
        +new_value?: JSONB
        +changed_by: UUID
        +changed_at: Timestamp
        +ip_address?: string
        +device_id?: string
    }

    class AuditInterceptor {
        +intercept(context, next): Observable
        -captureAuditEntry(req, response): AuditDto
    }

    AuditService --> AuditLog
    AuditInterceptor --> AuditService
```

---

## 6. Database Schema — Entity Relationships

```mermaid
erDiagram
    firms ||--o{ users : "has"
    firms ||--o{ customers : "has"
    firms ||--o{ trucks : "has"
    firms ||--o{ config_versions : "has"
    firms ||--o{ kaccha_chitthas : "has"
    firms ||--o{ ledger_entries : "has"
    firms ||--o{ events : "has"
    firms ||--o{ audit_logs : "has"

    firms ||--o{ custom_field_definitions : "defines"
    firms ||--o{ firm_module_access : "has"
    firms ||--o{ role_permissions : "has"
    modules ||--o{ firm_module_access : "used in"
    modules ||--o{ role_permissions : "governs"

    config_versions ||--o{ grade_configs : "contains"
    config_versions ||--o{ apmc_fee_configs : "contains"
    config_versions ||--o{ commission_configs : "contains"
    config_versions ||--o{ baardana_configs : "contains"

    trucks ||--o{ purchase_entries : "has"
    trucks ||--o{ kaccha_chitthas : "linked to"
    trucks ||--o{ truck_events : "logs"

    kaccha_chitthas ||--o{ kc_line_items : "has"
    kaccha_chitthas ||--o{ kc_payments : "has"

    customers ||--o{ kaccha_chitthas : "buyer in"

    users ||--o{ salary_entries : "receives"

    firms {
        UUID id PK
        TEXT name
        TEXT apmc_name
        TEXT contact_phone
        TEXT address
        BOOL is_active
        TIMESTAMPTZ created_at
    }

    modules {
        UUID id PK
        TEXT key
        TEXT label
        TEXT description
        INT sort_order
    }

    firm_module_access {
        UUID firm_id FK
        UUID module_id FK
        BOOL is_active
    }

    role_permissions {
        UUID firm_id FK
        TEXT role
        UUID module_id FK
        BOOL can_create
        BOOL can_read
        BOOL can_update
        BOOL can_delete
    }

    kaccha_chitthas {
        UUID id PK
        UUID firm_id FK
        TEXT kc_number
        UUID truck_id FK
        UUID customer_id FK
        DATE sale_date
        TEXT status
        NUMERIC total_net_payable
        TEXT idempotency_key
        INT version
        BOOL is_dirty
    }

    ledger_entries {
        UUID id PK
        UUID firm_id FK
        TEXT ledger_type
        TEXT entry_type
        NUMERIC amount
        NUMERIC balance_after
        UUID entry_group_id
        TEXT idempotency_key
        TIMESTAMPTZ created_at
    }
```

---

## 7. API — Request/Response Contracts (Phase 1)

### 7.1 Auth

```typescript
// POST /api/v1/auth/login
Request:  { phone: string; otp: string; firm_id: string }
Response: { access_token: string; refresh_token: string; expires_in: number; user: UserDto }

// POST /api/v1/auth/refresh
Request:  { refresh_token: string }
Response: { access_token: string; expires_in: number }
```

### 7.2 Ledger (Read-Only in Phase 1)

```typescript
// GET /api/v1/:firm_id/ledger/firm
Query: { from?: string; to?: string; page?: number; limit?: number }
Response: {
  data: LedgerEntryDto[];
  meta: { total: number; page: number; balance: string }
}
```

### 7.3 RBAC (Phase 7)

```typescript
// GET /api/v1/:firm_id/rbac/my-modules
Response: { module_ids: string[] }

// GET /api/v1/:firm_id/rbac/permissions/:role
Response: { permissions: { module_id: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }[] }

// PUT /api/v1/:firm_id/rbac/permissions/:role
Request:  { permissions: { module_id: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }[] }
Response: { updated: number }
```

---

## 8. RBAC Module

```mermaid
classDiagram
    class RbacService {
        +getAccessibleModules(userId, firmId): Promise~Module[]~
        +getFirmModules(firmId): Promise~Module[]~
        +getFirmModuleIds(firmId): Promise~string[]~
        +setFirmModules(firmId, moduleIds): Promise~void~
        +getRolePermissions(role, firmId): Promise~Permission[]~
        +setRolePermissions(role, firmId, perms): Promise~void~
        +createFirm(dto): Promise~Firm~
        +updateFirm(id, dto): Promise~Firm~
        +deactivateFirm(id): Promise~void~
        +getAllFirms(): Promise~Firm[]~
    }

    class RbacController {
        +getMyModules(user): Promise~ModuleDto[]~
        +getFirmModules(firmId): Promise~ModuleDto[]~
        +getAllModules(): Promise~ModuleDto[]~
        +getPermissions(role, firmId): Promise~PermissionDto[]~
        +setPermissions(role, firmId, dto): Promise~void~
    }

    class SuperAdminController {
        +login(dto): Promise~SATokenResponse~
        +listFirms(): Promise~FirmDto[]~
        +createFirm(dto): Promise~FirmDto~
        +updateFirm(id, dto): Promise~FirmDto~
        +deactivateFirm(id): Promise~void~
        +getFirmModules(firmId): Promise~ModuleIdsDto~
        +setFirmModules(firmId, dto): Promise~void~
        -verifySAToken(token): void
    }

    class Module {
        +id: UUID
        +key: string
        +label: string
        +description: string
        +sort_order: number
    }

    class FirmModuleAccess {
        +firm_id: UUID
        +module_id: UUID
        +is_active: boolean
    }

    class RolePermission {
        +firm_id: UUID
        +role: UserRole
        +module_id: UUID
        +can_create: boolean
        +can_read: boolean
        +can_update: boolean
        +can_delete: boolean
    }

    RbacController --> RbacService
    SuperAdminController --> RbacService
    RbacService --> Module
    RbacService --> FirmModuleAccess
    RbacService --> RolePermission
```

---

## 9. Customer History API

```mermaid
sequenceDiagram
    participant Mobile as Mobile (CustomerDetailScreen)
    participant API as NestJS API
    participant DB as PostgreSQL

    Mobile->>API: GET /customers/:id/history
    Note over API: Route registered BEFORE /:id to prevent<br/>"history" being parsed as UUID

    API->>DB: Raw SQL JOIN query
    Note over DB: kaccha_chitthas<br/>JOIN kc_line_items<br/>JOIN kc_payments<br/>WHERE customer_id = :id AND firm_id = current_firm_id

    DB-->>API: Rows with KC + line items + payments
    API->>API: Aggregate outstanding_udhar<br/>(sum of UDHAR payment type amounts)
    API->>API: Group line_items and payments under each KC
    API-->>Mobile: CustomerHistoryDto
```

```typescript
// GET /api/v1/:firm_id/customers/:id/history
Response: {
  customer_id: string;
  outstanding_udhar: string;         // Decimal string (rupees)
  total_purchases: number;           // count of AUTHORIZED KCs
  total_value: string;               // sum of total_net_payable
  kcs: Array<{
    id: string;
    kc_number: string;
    sale_date: string;
    status: KCStatus;
    total_net_payable: string;
    total_gross_amount: string;
    commission: string;
    apmc_fee: string;
    line_items: KcLineItemDto[];
    payments: KcPaymentDto[];
  }>;
}
```

---

## 10. Super Admin API Contracts

```typescript
// POST /super-admin/login?admin_token=<token>  (No JWT required — @Public())
Request:  { phone: string; otp: string }
Response: { access_token: string; admin: { id: string; name: string; phone: string } }

// GET /super-admin/firms?admin_token=<token>
Response: FirmDto[]  // { id, name, apmc_name, contact_phone, is_active, created_at }

// POST /super-admin/firms?admin_token=<token>
Request:  { name: string; apmc_name: string; contact_phone: string; address?: string;
            firm_head?: { phone: string; name: string } }
Response: FirmDto  // firm created + all 11 modules auto-granted + optional FIRM_HEAD user created

// PUT /super-admin/firms/:id?admin_token=<token>
Request:  { name?: string; apmc_name?: string; contact_phone?: string; address?: string }
Response: FirmDto

// DELETE /super-admin/firms/:id?admin_token=<token>
Response: { deactivated: true }

// GET /super-admin/firms/:firmId/modules?admin_token=<token>
Response: { module_ids: string[] }

// PUT /super-admin/firms/:firmId/modules?admin_token=<token>
Request:  { module_ids: string[] }
Response: { updated: number }
```

---

*Last updated: Phase 8 — All phases complete*

---

## 11. Idempotency Flow

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as IdempotencyMiddleware
    participant Redis
    participant Handler as Route Handler
    participant DB

    Client->>Middleware: POST /kcs (X-Idempotency-Key: abc123)
    Middleware->>Redis: GET idempotency:abc123
    alt Cache HIT
        Redis-->>Middleware: Cached response
        Middleware-->>Client: 200 Cached response
    else Cache MISS
        Middleware->>Handler: Proceed
        Handler->>DB: Execute mutation
        DB-->>Handler: Result
        Handler-->>Middleware: Response
        Middleware->>Redis: SET idempotency:abc123 (TTL 24h)
        Middleware-->>Client: 201 Created
    end
```

---

## 12. Commission Calculation Flow

```mermaid
flowchart TD
    A[KC Authorization triggered] --> B{Truck has commission_config_id?}
    B -->|Yes| C[Use truck-level commission config]
    B -->|No| D[Fetch firm-level config active at sale_date]
    C --> E{commission_type?}
    D --> E
    E -->|PERCENTAGE| F[commission = gross × rate / 100]
    E -->|FIXED_PER_KG| G[commission = weight × rate]
    E -->|FIXED_PER_TRANSACTION| H[commission = flat value]
    F --> I[Apply min/max caps]
    G --> I
    H --> I
    I --> J[Apply rounding strategy]
    J --> K[Store computed value + config_snapshot_id on KC]
    K --> L[NEVER recompute after this point]
```

---

*Last updated: Phase 8 — All phases complete*
