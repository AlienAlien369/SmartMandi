import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index,
} from 'typeorm';

@Entity('config_versions')
@Index(['firm_id', 'is_active'])
export class ConfigVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) firm_id: string;
  @Column({ type: 'int' }) version: number;
  @Column({ type: 'timestamptz' }) effective_from: Date;
  @Column({ type: 'timestamptz', nullable: true }) effective_to: Date | null;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
