import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('role_module_permissions')
export class RoleModulePermission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'text' }) role: string;
  @Column({ type: 'text' }) module_id: string;
  @Column({ type: 'boolean', default: false }) can_create: boolean;
  @Column({ type: 'boolean', default: true }) can_read: boolean;
  @Column({ type: 'boolean', default: false }) can_update: boolean;
  @Column({ type: 'boolean', default: false }) can_delete: boolean;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) updated_at: Date;
}
