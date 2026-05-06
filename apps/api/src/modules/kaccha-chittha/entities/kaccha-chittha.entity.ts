import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index, OneToMany,
} from 'typeorm';
import { KCStatus } from '../../../common/enums';
import { KcLineItem } from './kc-line-item.entity';
import { KcPayment } from './kc-payment.entity';

@Entity('kaccha_chitthas')
@Index(['firm_id', 'sale_date'])
@Index(['firm_id', 'customer_id'])
@Index(['firm_id', 'truck_id'])
@Index(['firm_id', 'status'])
export class KacchaChittha {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;

  /** Human-readable sequential number, e.g. "KC-2025-001" */
  @Column({ type: 'text' }) kc_number: string;

  @Column({ type: 'uuid', nullable: true }) truck_id: string | null;
  @Column({ type: 'uuid' }) customer_id: string;
  @Column({ type: 'date' }) sale_date: string;
  @Column({ type: 'enum', enum: KCStatus, default: KCStatus.DRAFT }) status: KCStatus;

  // ── Totals (stored at authorization, NEVER recomputed) ──────────────────────
  @Column({ type: 'numeric', precision: 12, scale: 3, default: '0' }) total_weight_kg: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' }) total_gross_amount: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' }) total_apmc_fee: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' }) total_commission: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' }) total_baardana_cost: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' }) total_net_payable: string;

  // ── Config snapshots (which rules were active at authorization time) ─────────
  @Column({ type: 'uuid', nullable: true }) apmc_fee_config_id: string | null;
  @Column({ type: 'uuid', nullable: true }) commission_config_id: string | null;

  // ── Authorization ────────────────────────────────────────────────────────────
  @Column({ type: 'uuid', nullable: true }) authorized_by: string | null;
  @Column({ type: 'timestamptz', nullable: true }) authorized_at: Date | null;
  @Column({ type: 'text', nullable: true }) authorization_notes: string | null;

  // ── Offline sync ─────────────────────────────────────────────────────────────
  @Column({ type: 'text', unique: true }) idempotency_key: string;
  @Column({ type: 'int', default: 1 }) version: number;
  @Column({ type: 'timestamptz', nullable: true }) last_synced_at: Date | null;
  @Column({ type: 'boolean', default: false }) is_dirty: boolean;

  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) cancelled_at: Date | null;
  @Column({ type: 'text', nullable: true }) cancellation_reason: string | null;

  @OneToMany(() => KcLineItem, li => li.kc, { eager: false })
  line_items: KcLineItem[];

  @OneToMany(() => KcPayment, p => p.kc, { eager: false })
  payments: KcPayment[];
}
