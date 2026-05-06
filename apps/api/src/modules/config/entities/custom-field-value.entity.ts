import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('custom_field_values')
@Index(['firm_id', 'entity_type', 'entity_id'])
export class CustomFieldValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column('uuid')
  field_def_id: string;

  @Column({ length: 50 })
  entity_type: string;

  @Column('uuid')
  entity_id: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
