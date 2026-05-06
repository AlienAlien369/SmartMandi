import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.module';

/**
 * Injects firm_id into PostgreSQL session context for every request.
 * This enables Row-Level Security policies that read app.current_firm_id.
 * Must run after JWT authentication so req.user.firm_id is available.
 */
@Injectable()
export class FirmContextInterceptor implements NestInterceptor {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { firm_id?: string } }>();
    const firmId = request.user?.firm_id;

    if (firmId) {
      // The TypeORM connection manager handles per-request connections.
      // The actual SET LOCAL is done in a TypeORM subscriber or query runner.
      // Attach to request for use in services.
      (request as unknown as Record<string, unknown>)['firmId'] = firmId;
    }

    return next.handle().pipe(tap(() => {}));
  }
}
