import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { KacchaChittha } from './kaccha-chittha.entity';

@Entity('kc_payments')
export class KcPayment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'uuid' }) kc_id: string;
  @Column({ type: 'uuid' }) payment_mode_id: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) amount: string;
  @Column({ type: 'text', nullable: true }) payment_reference: string | null;
  @Column({ type: 'date' }) payment_date: string;
  @Column({ type: 'boolean', default: false }) is_udhar: boolean;
  @Column({ type: 'date', nullable: true }) udhar_due_date: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'text', unique: true }) idempotency_key: string;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;

  @ManyToOne(() => KacchaChittha, kc => kc.payments)
  @JoinColumn({ name: 'kc_id' })
  kc: KacchaChittha;
}
