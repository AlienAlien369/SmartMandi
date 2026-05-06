import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * SummarySheet: immutable snapshot of a mandi day's activity, grouped by truck.
 * Generated on demand or when all trucks for a sale_date are CLOSED.
 * Used for printing/export — cannot be edited after generation.
 */
@Entity('summary_sheets')
@Index(['firm_id', 'sale_date'])
export class SummarySheet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column({ type: 'date' })
  sale_date: string;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, any>; // Full denormalized snapshot

  @Column({ type: 'int', default: 0 })
  total_trucks: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_gross_sales: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_commission: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_apmc_fees: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_net_payable: string;

  @Column('uuid')
  generated_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  generated_at: Date;
}
