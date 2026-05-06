import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('customers')
@Index(['firm_id', 'name'])
@Index(['firm_id', 'phone'])
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'text' }) name: string;
  @Column({ type: 'text', nullable: true }) phone: string | null;
  @Column({ type: 'text', nullable: true }) address: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;
  @Column({ type: 'int', default: 1 }) version: number;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}
