import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorRole!: string | null;

  @Column({ type: 'varchar' })
  orgId!: string;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar' })
  resourceType!: string;

  @Column({ type: 'varchar' })
  resourceId!: string;

  @Column({ type: 'text', nullable: true })
  details!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
