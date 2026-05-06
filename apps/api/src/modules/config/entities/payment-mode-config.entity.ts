import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('payment_mode_configs')
export class PaymentModeConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'text' }) mode_code: string;
  @Column({ type: 'text' }) mode_label: string;
  @Column({ type: 'boolean', default: false }) requires_reference: boolean;
  @Column({ type: 'boolean', default: false }) is_credit: boolean;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
}
