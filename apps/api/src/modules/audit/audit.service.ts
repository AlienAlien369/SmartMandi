import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditAction } from '../../common/enums';

export interface AuditDto {
  firm_id: string;
  entity: string;
  entity_id: string;
  action: AuditAction;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  changed_by?: string;
  ip_address?: string;
  device_id?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /** Write an immutable audit entry. Fire-and-forget — never throws. */
  async log(dto: AuditDto): Promise<void> {
    try {
      const entry = this.auditRepo.create(dto);
      await this.auditRepo.save(entry);
    } catch (error) {
      // Audit failures must never break the main flow
      this.logger.error('Audit log write failed (non-fatal):', error);
    }
  }

  async getHistory(
    entity: string,
    entityId: string,
    firmId: string,
  ): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entity, entity_id: entityId, firm_id: firmId },
      order: { changed_at: 'DESC' },
    });
  }
}
