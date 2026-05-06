import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('baardana_configs')
export class BaardanaConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'uuid' }) config_version_id: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) cost_per_unit: string;
  @Column({ type: 'text', default: 'bag' }) unit_label: string;
  @Column({ type: 'timestamptz' }) effective_from: Date;
  @Column({ type: 'timestamptz', nullable: true }) effective_to: Date | null;
}
