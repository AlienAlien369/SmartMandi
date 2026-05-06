import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaardanaSource } from '../../../common/enums';
import { KacchaChittha } from './kaccha-chittha.entity';

@Entity('kc_line_items')
export class KcLineItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'uuid' }) kc_id: string;
  @Column({ type: 'uuid' }) grade_config_id: string;
  @Column({ type: 'int' }) quantity_bags: number;
  @Column({ type: 'numeric', precision: 8, scale: 3, nullable: true }) weight_per_bag_kg: string | null;
  @Column({ type: 'numeric', precision: 12, scale: 3 }) total_weight_kg: string;
  @Column({ type: 'numeric', precision: 10, scale: 4 }) rate_per_kg: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) gross_amount: string;
  @Column({ type: 'enum', enum: BaardanaSource }) baardana_source: BaardanaSource;
  @Column({ type: 'int', default: 0 }) baardana_quantity: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: '0' }) baardana_cost: string;
  @Column({ type: 'int', default: 0 }) sort_order: number;

  @ManyToOne(() => KacchaChittha, kc => kc.line_items)
  @JoinColumn({ name: 'kc_id' })
  kc: KacchaChittha;
}
