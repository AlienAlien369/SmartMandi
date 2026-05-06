import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { CustomFieldType, EntityType } from '../../../common/enums';

@Entity('custom_field_definitions')
@Index(['firm_id', 'entity_type'])
export class CustomFieldDef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column({ type: 'enum', enum: EntityType })
  entity_type: EntityType; // KC, TRUCK, CUSTOMER, PURCHASE

  @Column({ length: 50 })
  field_key: string; // e.g., "crop_variety"

  @Column({ length: 100 })
  label: string; // e.g., "Crop Variety"

  @Column({ type: 'enum', enum: CustomFieldType })
  field_type: CustomFieldType;

  @Column({ default: false })
  is_required: boolean;

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null; // For SELECT type

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
