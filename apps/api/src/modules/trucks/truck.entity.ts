import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { TruckStatus } from '../../common/enums';

@Entity('trucks')
@Index(['firm_id', 'status'])
@Index(['firm_id', 'sale_date'])
export class Truck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column({ length: 20 })
  truck_number: string; // e.g. RJ14GB0001

  @Column({ length: 100 })
  driver_name: string;

  @Column({ length: 15, nullable: true })
  driver_phone: string;

  @Column({ length: 100 })
  produce_name: string; // e.g. "Wheat", "Onion"

  @Column({ type: 'date' })
  sale_date: string; // YYYY-MM-DD — which mandi day

  @Column({ type: 'enum', enum: TruckStatus, default: TruckStatus.SCHEDULED })
  status: TruckStatus;

  // Estimated at SCHEDULED time
  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  estimated_weight_kg: string;

  // Set on TRUCK_ARRIVED
  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  arrived_weight_kg: string;

  // Set on TRUCK_CLOSED (actual weighed)
  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  actual_weight_kg: string;

  // Computed by DB: arrived_weight - actual_weight (GENERATED ALWAYS AS)
  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true, insert: false, update: false })
  weight_variance_kg: string;

  // Inam amount — set on TRUCK_CLOSED
  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  inam_amount: string;

  // Commission config override for this truck
  @Column('uuid', { nullable: true })
  commission_config_id: string;

  // Linked customer (seller / farmer)
  @Column('uuid', { nullable: true })
  customer_id: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Timestamps for lifecycle transitions
  @Column({ type: 'timestamptz', nullable: true })
  arrived_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date;

  @Column('uuid')
  created_by: string;

  @Column('uuid', { nullable: true })
  closed_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
