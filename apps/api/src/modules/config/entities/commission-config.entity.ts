import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { CommissionType, ConfigScope, RoundingStrategy } from '../../../common/enums';

@Entity('commission_configs')
@Index(['firm_id', 'scope', 'effective_from'])
export class CommissionConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'uuid' }) config_version_id: string;
  @Column({ type: 'enum', enum: ConfigScope }) scope: ConfigScope;
  @Column({ type: 'uuid', nullable: true }) scope_ref_id: string | null;
  @Column({ type: 'enum', enum: CommissionType }) commission_type: CommissionType;
  @Column({ type: 'numeric', precision: 10, scale: 4 }) commission_value: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) min_commission: string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) max_commission: string | null;
  @Column({ type: 'enum', enum: RoundingStrategy, default: RoundingStrategy.ROUND_HALF_UP })
  rounding_strategy: RoundingStrategy;
  @Column({ type: 'timestamptz' }) effective_from: Date;
  @Column({ type: 'timestamptz', nullable: true }) effective_to: Date | null;
}
