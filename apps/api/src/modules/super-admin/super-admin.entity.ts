import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('super_admins')
export class SuperAdmin {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text' }) name: string;
  @Column({ type: 'text', unique: true }) phone: string;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
