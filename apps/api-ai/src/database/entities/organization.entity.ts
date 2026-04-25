import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryColumn
} from 'typeorm';
import { UserEntity } from './user.entity';
import { TaskEntity } from './task.entity';

@Entity({ name: 'organizations' })
export class OrganizationEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.children, {
    nullable: true,
    onDelete: 'SET NULL'
  })
  parent!: OrganizationEntity | null;

  @OneToMany(() => OrganizationEntity, (organization) => organization.parent)
  children!: OrganizationEntity[];

  @OneToMany(() => UserEntity, (user) => user.organization)
  users!: UserEntity[];

  @OneToMany(() => TaskEntity, (task) => task.organization)
  tasks!: TaskEntity[];
}
