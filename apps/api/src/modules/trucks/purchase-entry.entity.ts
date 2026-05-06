import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('purchase_entries')
@Index(['firm_id', 'truck_id'])
@Index(['firm_id', 'purchase_date'])
export class PurchaseEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column('uuid')
  truck_id: string;

  @Column({ type: 'date' })
  purchase_date: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  weight_kg: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true })
  rate_per_kg: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  total_amount: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: false })
  is_estimated: boolean;

  @Column({ type: 'text', nullable: true, unique: true })
  idempotency_key: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
