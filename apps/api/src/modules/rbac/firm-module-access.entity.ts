import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('firm_module_access')
export class FirmModuleAccess {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'text' }) module_id: string;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'uuid', nullable: true }) granted_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) granted_at: Date;
}
