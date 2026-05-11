import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('firm_pdf_config')
export class FirmPdfConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) firm_id: string;
  @Column({ type: 'boolean', default: false }) pdf_enabled: boolean;
  @Column({ type: 'text', default: 'STANDARD' }) pdf_format: string;
  @Column({ type: 'text', nullable: true }) firm_short_name: string | null;
  @Column({ type: 'text', nullable: true }) footer_text: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
