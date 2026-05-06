import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('grade_configs')
@Index(['firm_id', 'config_version_id', 'is_active'])
export class GradeConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'uuid' }) config_version_id: string;
  @Column({ type: 'text' }) grade_code: string;
  @Column({ type: 'text' }) grade_label: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
}
