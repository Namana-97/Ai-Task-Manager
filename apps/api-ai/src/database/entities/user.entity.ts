import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { RoleEntity } from './role.entity';
import { TaskEntity } from './task.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ type: 'varchar' })
  password!: string;

  @Column({ type: 'varchar' })
  displayName!: string;

  @Column({ type: 'varchar' })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.users, { eager: true })
  @JoinColumn({ name: 'organizationId' })
  organization!: OrganizationEntity;

  @Column({ type: 'varchar' })
  roleName!: 'owner' | 'admin' | 'viewer';

  @ManyToOne(() => RoleEntity, (role) => role.users, { eager: true })
  @JoinColumn({ name: 'roleName', referencedColumnName: 'name' })
  role!: RoleEntity;

  @Column({ type: 'varchar' })
  jobTitle!: string;

  @OneToMany(() => TaskEntity, (task) => task.assignee)
  assignedTasks!: TaskEntity[];
}
