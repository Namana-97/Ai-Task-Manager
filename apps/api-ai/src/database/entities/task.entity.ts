import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'tasks' })
export class TaskEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar' })
  category!: string;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'varchar' })
  priority!: 'Critical' | 'High' | 'Medium' | 'Low';

  @Column({ type: 'datetime' })
  createdAt!: Date;

  @Column({ type: 'datetime' })
  updatedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  dueDate!: Date | null;

  @Column({ type: 'varchar' })
  assigneeId!: string;

  @ManyToOne(() => UserEntity, (user) => user.assignedTasks, { eager: true })
  @JoinColumn({ name: 'assigneeId' })
  assignee!: UserEntity;

  @Column({ type: 'varchar' })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.tasks, { eager: true })
  @JoinColumn({ name: 'organizationId' })
  organization!: OrganizationEntity;

  @Column({ type: 'simple-json' })
  tags!: string[];

  @Column({ type: 'simple-json' })
  activityLog!: Array<{ timestamp: string; actorName: string; action: string; details?: string }>;

  @Column({ type: 'varchar' })
  visibilityRole!: 'viewer' | 'admin' | 'owner';
}
