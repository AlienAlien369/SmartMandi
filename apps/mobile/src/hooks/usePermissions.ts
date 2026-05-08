import { useSelector } from 'react-redux';
import type { RootState } from '../store';

export type ModulePermissions = {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
};

const DEFAULT_PERMS: ModulePermissions = {
  can_create: false,
  can_read: true,
  can_update: false,
  can_delete: false,
};

export function usePermissions(moduleId: string): ModulePermissions {
  const permissions = useSelector((s: RootState) => s.auth.permissions ?? {});
  const user = useSelector((s: RootState) => s.auth.user);

  // FIRM_HEAD always has all permissions
  if (user?.role === 'FIRM_HEAD') {
    return { can_create: true, can_read: true, can_update: true, can_delete: true };
  }

  return permissions[moduleId] ?? DEFAULT_PERMS;
}
