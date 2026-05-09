import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('baardana_configs')
export class BaardanaConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'uuid' }) config_version_id: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) cost_per_unit: string;
  @Column({ type: 'text', default: 'bag' }) unit_label: string;
  /** Who supplies bags — FIRM or CUSTOMER */
  @Column({ type: 'text', default: 'FIRM' }) baardana_provider: 'FIRM' | 'CUSTOMER';
  /** Default number of bags pre-filled in each KC line item */
  @Column({ type: 'int', default: 1 }) default_bags: number;
  /** How rate is applied — PER_KG: gross = bags×weight×rate | PER_NAG: gross = bags×rate */
  @Column({ type: 'text', default: 'PER_KG' }) rate_mode: 'PER_KG' | 'PER_NAG';
  @Column({ type: 'timestamptz' }) effective_from: Date;
  @Column({ type: 'timestamptz', nullable: true }) effective_to: Date | null;
}
