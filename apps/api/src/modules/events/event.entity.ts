import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { EventStatus } from '../../common/enums';

@Entity('events')
@Index(['firm_id', 'status', 'process_after'])
@Index(['aggregate_type', 'aggregate_id'])
export class AppEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  firm_id: string;

  @Column({ type: 'text' })
  event_type: string;

  @Column({ type: 'text' })
  aggregate_type: string;

  @Column({ type: 'uuid' })
  aggregate_id: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  status: EventStatus;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @Column({ type: 'int', default: 5 })
  max_retries: number;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  process_after: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'text', unique: true })
  idempotency_key: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
