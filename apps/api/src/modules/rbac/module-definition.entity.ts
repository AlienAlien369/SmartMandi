import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('module_definitions')
export class ModuleDefinition {
  @PrimaryColumn({ type: 'text' }) id: string;
  @Column({ type: 'text' }) label: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
}
