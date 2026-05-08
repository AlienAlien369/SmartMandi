import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

/** Attach a required module + action to a route handler. Enforced by PermissionsGuard. */
export const RequirePermission = (module: string, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, { module, action });
