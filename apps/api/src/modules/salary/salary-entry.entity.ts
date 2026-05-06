import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('salary_entries')
@Index(['firm_id', 'user_id'])
@Index(['firm_id', 'salary_date'])
export class SalaryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column('uuid')
  user_id: string; // The employee being paid

  @Column({ type: 'date' })
  salary_date: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  attendance_ref_id: string | null;

  @Column({ type: 'text', unique: true })
  idempotency_key: string;

  @Column('uuid')
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
