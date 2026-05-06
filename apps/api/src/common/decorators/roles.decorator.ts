import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums';

export const ROLES_KEY = 'roles';

/** Decorator to restrict endpoint access to specific roles */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
