import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LedgerType, EntryType, SourceType } from '../../common/enums';

/**
 * Ledger Entry — IMMUTABLE. NEVER UPDATE OR DELETE.
 * All financial corrections are done via reversal entries.
 */
@Entity('ledger_entries')
@Index(['firm_id', 'ledger_type', 'created_at'])
@Index(['entry_group_id'])
@Index(['firm_id', 'customer_id'])
@Index(['firm_id', 'truck_id'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  firm_id: string;

  @Column({ type: 'enum', enum: LedgerType })
  ledger_type: LedgerType;

  @Column({ type: 'enum', enum: EntryType })
  entry_type: EntryType;

  /** Always positive — direction determined by entry_type */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  /** Running balance stored at write time — never recomputed */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  balance_after: string;

  @Column({ type: 'enum', enum: SourceType })
  source_type: SourceType;

  @Column({ type: 'uuid' })
  source_id: string;

  /** All entries from one business action share an entry_group_id */
  @Column({ type: 'uuid' })
  entry_group_id: string;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  truck_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', unique: true })
  idempotency_key: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
