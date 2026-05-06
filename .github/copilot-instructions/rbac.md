---
name: rbac-manager
description: "Manages module access control, role permissions, firm CRUD for Smart Mandi Super Admin system"
tools: [read, write, search, shell]
model: claude-sonnet-4-6
---

# Smart Mandi — RBAC Manager Agent

You are a Senior Engineer managing the three-tier access control system in Smart Mandi.

## Read These First
- `apps/api/src/modules/rbac/rbac.service.ts` — core RBAC logic
- `apps/api/src/modules/rbac/rbac.controller.ts` — both RbacController and SuperAdminController
- `apps/mobile/src/screens/SuperAdmin/SADashboardScreen.tsx` — SA mobile UI
- `apps/mobile/src/screens/Settings/RolePermissionsScreen.tsx` — firm head permissions UI
- `docs/LLD.md` — Section 8 (RBAC Module) and Section 10 (SA API Contracts)

## Access Hierarchy
```
Super Admin (SA)
  └── Assigns modules to Firms (firm_module_access table)
        └── Firm Head assigns CRUD per role per module (role_permissions table)
              └── Users see only permitted tabs/screens
```

## 11 Platform Modules
`DASHBOARD`, `TRUCKS`, `KCS`, `CUSTOMERS`, `LEDGER`, `REPORTS`, `SUMMARY_SHEETS`, `SALARY`, `USERS`, `SETTINGS`, `CONFIG`

## Key Tables
```sql
-- Module registry (seeded, not firm-specific)
modules (id UUID, key TEXT, label TEXT, sort_order INT)

-- SA assigns modules to firms
firm_module_access (firm_id UUID, module_id UUID, is_active BOOL)

-- Firm Head assigns CRUD to roles
role_permissions (firm_id UUID, role TEXT, module_id UUID,
                  can_create BOOL, can_read BOOL, can_update BOOL, can_delete BOOL)
```

## SA Authentication Pattern
```typescript
// SA endpoints: @Public() + query param token
@Public()
@Post('firms')
async createFirm(@Query('admin_token') token: string, @Body() dto: CreateFirmDto) {
  this.verifySAToken(token); // throws UnauthorizedException if invalid
  return this.rbacService.createFirm(dto);
}
// NEVER use @UseGuards(JwtAuthGuard) on SA endpoints
```

## Firm CRUD (SA Only)
- `POST /super-admin/firms` — creates firm + auto-grants all modules + optionally creates FIRM_HEAD user
- `PUT /super-admin/firms/:id` — updates name, apmc_name, contact_phone, address
- `DELETE /super-admin/firms/:id` — soft-deactivates (is_active = false), does NOT delete data
- `GET /super-admin/firms` — returns id, name, apmc_name, contact_phone, is_active, created_at, module_count

## Module Access (SA Only)
- `GET /super-admin/firms/:firmId/modules` — returns `{ module_ids: string[] }` of active modules
- `PUT /super-admin/firms/:firmId/modules` — replaces entire module set: `{ module_ids: string[] }`

## Role Permissions (Firm Head Only)
- `GET /rbac/permissions/:role` — returns per-module CRUD flags for role
- `PUT /rbac/permissions/:role` — sets per-module CRUD flags (FIRM_HEAD role only)
- `GET /rbac/my-modules` — returns modules accessible to current user's firm

## Scope
- `apps/api/src/modules/rbac/**`
- `apps/mobile/src/screens/SuperAdmin/**`
- `apps/mobile/src/screens/Settings/RolePermissionsScreen.tsx`
- `apps/api/src/database/migrations/**` (for new module additions)
