import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../../modules/auth/jwt.strategy';

/** Extracts the authenticated user from the JWT payload */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return request.user;
  },
);

/** Extracts the firm_id from the JWT payload (RLS-safe: never from URL) */
export const CurrentFirmId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return request.user.firm_id;
  },
);
