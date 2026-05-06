import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { AuditAction } from '../../common/enums';

/** Append-only audit log — never update or delete */
@Entity('audit_logs')
@Index(['firm_id', 'entity', 'entity_id'])
@Index(['firm_id', 'changed_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  firm_id: string;

  @Column({ type: 'text' })
  entity: string;

  @Column({ type: 'uuid' })
  entity_id: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'jsonb', nullable: true })
  old_value: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_value: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  changed_by: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  changed_at: Date;

  @Column({ type: 'inet', nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  device_id: string | null;
}
