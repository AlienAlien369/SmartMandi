import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRole } from '../enums';
import { PERMISSION_KEY, PermissionAction } from '../decorators/require-permission.decorator';
import { JwtPayload } from '../../modules/auth/jwt.strategy';
import { Request } from 'express';

const ACTION_COLUMN: Record<PermissionAction, string> = {
  create: 'can_create',
  read:   'can_read',
  update: 'can_update',
  delete: 'can_delete',
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<{ module: string; action: PermissionAction } | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermission decorator — any authenticated user may proceed
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');

    // FIRM_HEAD always has full access
    if (user.role === UserRole.FIRM_HEAD) return true;

    const col = ACTION_COLUMN[required.action] ?? 'can_read';

    const rows: Array<Record<string, boolean>> = await this.dataSource.query(
      `SELECT ${col} FROM role_module_permissions
       WHERE firm_id = $1 AND role = $2 AND module_id = $3`,
      [user.firm_id, user.role, required.module],
    );

    if (!rows.length || !rows[0][col]) {
      throw new ForbiddenException(
        `Your role (${user.role}) does not have permission to ${required.action} in ${required.module}`,
      );
    }

    return true;
  }
}
