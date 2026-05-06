import {
  Entity, PrimaryGeneratedColumn, Column, Index,
} from 'typeorm';

/**
 * Precomputed hourly dashboard snapshot.
 * Updated by TRUCK_CLOSED and KC_AUTHORIZED event consumers.
 * Never queried live — always read from this precomputed table.
 */
@Entity('dashboard_metrics_hourly')
@Index(['firm_id', 'metric_date', 'metric_hour'], { unique: true })
export class DashboardMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column({ type: 'date' })
  metric_date: string;

  @Column({ type: 'int' })
  metric_hour: number;

  @Column({ type: 'int', default: 0 })
  trucks_scheduled: number;

  @Column({ type: 'int', default: 0 })
  trucks_arrived: number;

  @Column({ type: 'int', default: 0 })
  trucks_closed: number;

  @Column({ type: 'int', default: 0 })
  trucks_in_progress: number;

  @Column({ type: 'int', default: 0 })
  total_kc_count: number;

  @Column({ type: 'int', default: 0 })
  total_kc_authorized: number;

  @Column({ type: 'numeric', precision: 14, scale: 3, default: '0.000' })
  total_weight_sold_kg: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_sales_amount: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_commission_earned: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_udhar_outstanding: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_salaries_paid: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  total_inam_paid: string;

  @Column({ type: 'timestamptz', nullable: true })
  computed_at: Date;
}
