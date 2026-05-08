import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { FreightType } from '../../common/enums';

@Entity('salary_entries')
@Index(['firm_id', 'user_id'])
@Index(['firm_id', 'salary_date'])
@Index(['firm_id', 'freight_type'])
@Index(['firm_id', 'truck_id'])
export class SalaryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  /** Populated for SALARY type — the employee being paid. */
  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  /** Populated for INAM/KIRAYA/PARCHI — the truck the driver belongs to. */
  @Column({ type: 'uuid', nullable: true })
  truck_id: string | null;

  /** Snapshot of driver name at time of payment (for INAM/KIRAYA/PARCHI). */
  @Column({ type: 'text', nullable: true })
  driver_name: string | null;

  /** Snapshot of driver phone at time of payment. */
  @Column({ type: 'text', nullable: true })
  driver_phone: string | null;

  @Column({ type: 'date' })
  salary_date: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', default: FreightType.SALARY })
  freight_type: FreightType;

  @Column({ type: 'uuid', nullable: true })
  attendance_ref_id: string | null;

  @Column({ type: 'text', unique: true })
  idempotency_key: string;

  @Column('uuid')
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
