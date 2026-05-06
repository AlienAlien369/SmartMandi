import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { FeeType } from '../../../common/enums';

@Entity('apmc_fee_configs')
@Index(['firm_id', 'effective_from', 'effective_to'])
export class ApmcFeeConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'uuid' }) config_version_id: string;
  @Column({ type: 'enum', enum: FeeType }) fee_type: FeeType;
  @Column({ type: 'numeric', precision: 10, scale: 4 }) fee_value: string;
  @Column({ type: 'text', nullable: true }) discount_type: string | null;
  @Column({ type: 'numeric', precision: 10, scale: 4, default: '0' }) discount_value: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) min_fee: string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) max_fee: string | null;
  @Column({ type: 'timestamptz' }) effective_from: Date;
  @Column({ type: 'timestamptz', nullable: true }) effective_to: Date | null;
}
