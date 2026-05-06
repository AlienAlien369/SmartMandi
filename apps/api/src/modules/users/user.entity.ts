import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { UserRole } from '../../common/enums';

@Entity('users')
@Index(['firm_id', 'phone'], { unique: true })
@Index(['firm_id', 'is_active'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column({ length: 15 })
  phone: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.OPERATOR })
  role: UserRole;

  @Column({ default: true })
  is_active: boolean;

  @Column({ length: 200, nullable: true })
  device_id: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at: Date;

  @Column('uuid')
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
