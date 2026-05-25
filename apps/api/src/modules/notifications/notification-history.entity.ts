import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notification_history')
export class NotificationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  firm_id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', default: 'GENERAL' })
  type: string;

  @Column('uuid', { nullable: true })
  ref_id: string | null;

  @Column({ type: 'int', default: 0 })
  sent_to: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
